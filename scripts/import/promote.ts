// Promote APPROVED staging entries into the real catalog.
//
//   npm run import:promote                       against the LOCAL database
//   npm run import:promote -- --refs climax:liguero-lucy-rojo,distrisex:17382
//   npm run import:promote -- --update-prices    re-apply pricing to existing variants
//   npm run import:promote -- --neon             ONLY once the client approved staging
//
// What it does per approved product: enriches Woo variations (price/SKU),
// downloads supplier images and re-hosts them on Cloudinary with the
// brand-guide transformation, then upserts the product inside a transaction.
//
// Idempotency contract (Product.supplierRef is the key):
//   - re-running updates name/description/brand/category/specs, never duplicates
//   - variants match by optionKey; new ones are created, existing ones keep
//     their price unless --update-prices, and their stock is NEVER touched
//   - initial stock applies per variant, only at creation, and goes through
//     the inventory ledger (CLAUDE.md rule 3)
//   - images: one Cloudinary asset per source URL (deterministic public_id),
//     one ProductMedia row per delivery URL
import "dotenv/config";
import type { Prisma } from "../../src/generated/prisma/client";
import { computeOptionKey } from "../../src/features/catalog/optionKey";
import { formatCOP } from "../../src/lib/money";
import { slugify } from "../../src/lib/slug";
import {
  assertCloudinaryConfigured,
  deliveryUrl,
  publicIdForSource,
  uploadImage,
} from "./lib/cloudinary";
import { CATEGORIES } from "./lib/config";
import { createImportDb, resolveDatabaseUrl } from "./lib/db";
import { fetchBytes } from "./lib/http";
import { wooPriceToCents } from "./lib/normalize";
import { computeSalePriceCents } from "./lib/pricing";
import {
  readAllStaged,
  readSeleccion,
  type ApprovedEntry,
  type Seleccion,
  type StagedProduct,
  type StagedVariant,
} from "./lib/staging";
import { fetchWooVariation } from "./lib/woo-variations";

/** Uploading every angle of a 12-photo listing is supplier noise, not
 * catalog quality — the storefront gallery works best under ~8. */
const MAX_IMAGES_PER_PRODUCT = 8;

type Db = ReturnType<typeof createImportDb>;
type Tx = Prisma.TransactionClient;
type ExistingProduct = Prisma.ProductGetPayload<{
  include: {
    media: true;
    options: { include: { values: true } };
    variants: true;
  };
}>;

const args = process.argv.slice(2);
const hasFlag = (f: string) => args.includes(f);
const argValue = (f: string): string | undefined => {
  const i = args.indexOf(f);
  return i >= 0 ? args[i + 1] : undefined;
};

const stats = {
  created: 0,
  updated: 0,
  variantsCreated: 0,
  variantsKept: 0,
  imagesUploaded: 0,
  imagesReused: 0,
  warnings: [] as string[],
};
const warn = (msg: string) => {
  stats.warnings.push(msg);
  console.log(`  ⚠ ${msg}`);
};

async function main() {
  const useNeon = hasFlag("--neon");
  const updatePrices = hasFlag("--update-prices");
  const onlyRefs = argValue("--refs")
    ?.split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const seleccion = readSeleccion();
  const staged = readAllStaged();
  const entries = seleccion.approved.filter(
    (e) => !onlyRefs || onlyRefs.includes(e.supplierRef),
  );
  if (entries.length === 0) {
    throw new Error("Nothing to promote — check seleccion.json / --refs.");
  }

  // Fail fast on credentials before any database write.
  const { cloudName } = assertCloudinaryConfigured();
  const { url, host } = resolveDatabaseUrl(useNeon);
  console.log(
    `Promoting ${entries.length} approved product(s) → ${host}` +
      (useNeon ? "  [NEON — explicit]" : "  [local]") +
      `  · images → Cloudinary "${cloudName}"`,
  );

  const db = createImportDb(url);
  try {
    await db.$queryRaw`SELECT 1`;
  } catch {
    throw new Error(
      `Cannot reach the database at ${host}. Local? Start it: docker compose up -d --wait`,
    );
  }

  try {
    // The three storefront categories, same ids/slugs as the demo catalog so
    // both databases converge on identical taxonomy rows.
    for (const [position, c] of CATEGORIES.entries()) {
      await db.category.upsert({
        where: { slug: c.slug },
        update: {},
        create: { id: c.id, name: c.name, slug: c.slug, position },
      });
    }

    for (const entry of entries) {
      const product = staged.get(entry.supplierRef);
      if (!product) {
        throw new Error(
          `${entry.supplierRef} is approved but not in staging — re-run the fetch (npm run import:distrisex / import:climax).`,
        );
      }
      await promoteOne(db, product, entry, seleccion, updatePrices);
    }
  } finally {
    await db.$disconnect();
  }

  console.log(
    `\nDone. Products: ${stats.created} created, ${stats.updated} updated · ` +
      `variants: ${stats.variantsCreated} created, ${stats.variantsKept} kept · ` +
      `images: ${stats.imagesUploaded} uploaded, ${stats.imagesReused} already hosted` +
      (stats.warnings.length ? ` · ${stats.warnings.length} warning(s)` : ""),
  );
}

async function promoteOne(
  db: Db,
  staged: StagedProduct,
  entry: ApprovedEntry,
  seleccion: Seleccion,
  updatePrices: boolean,
) {
  const categorySlug = entry.categorySlug ?? staged.suggestedCategorySlug;
  if (!categorySlug) {
    throw new Error(
      `${staged.supplierRef} has no category. Set "categorySlug" for it in seleccion.json.`,
    );
  }
  const brandName = entry.brand ?? staged.brand;

  console.log(`\n${staged.supplierRef} — ${staged.name}`);

  const variants = await enrichedVariants(staged);
  if (!variants.some((v) => v.available)) {
    warn(`${staged.supplierRef} is fully unavailable at the supplier right now`);
  }

  const marginPct = seleccion.pricing.marginPct[staged.supplier];
  const salePriceFor = (v: StagedVariant) =>
    entry.salePriceCOP !== undefined
      ? entry.salePriceCOP * 100
      : computeSalePriceCents(
          v.supplierPriceCents,
          marginPct,
          seleccion.pricing.roundUpToCOP,
        );

  const existing = await db.product.findFirst({
    where: { supplierRef: staged.supplierRef },
    include: {
      media: true,
      options: { include: { values: true } },
      variants: true,
    },
  });

  // ── Images: supplier → Cloudinary, before the transaction ──
  const existingUrls = new Set(existing?.media.map((m) => m.url) ?? []);
  const mediaPlan: {
    url: string;
    alt: string;
    optionValue: { option: string; value: string } | null;
  }[] = [];
  for (const img of staged.images.slice(0, MAX_IMAGES_PER_PRODUCT)) {
    const publicId = publicIdForSource(staged.supplier, img.url);
    const url = deliveryUrl(publicId);
    const alt = img.optionValue
      ? `${staged.name} — ${img.optionValue.value}`
      : staged.name;
    mediaPlan.push({ url, alt, optionValue: img.optionValue });
    if (existingUrls.has(url)) {
      stats.imagesReused++;
      continue;
    }
    const { buffer, contentType } = await fetchBytes(img.url);
    const uploaded = await uploadImage({
      buffer,
      contentType,
      publicId,
      supplierRef: staged.supplierRef,
    });
    if (uploaded.existed) stats.imagesReused++;
    else stats.imagesUploaded++;
  }
  if (staged.images.length > MAX_IMAGES_PER_PRODUCT) {
    warn(
      `${staged.supplierRef}: kept ${MAX_IMAGES_PER_PRODUCT} of ${staged.images.length} supplier images`,
    );
  }

  const summary = await db.$transaction(
    async (tx) => {
      if (!existing) {
        const created = await createProduct(tx, {
          staged,
          entry,
          categorySlug,
          brandName,
          variants,
          salePriceFor,
          mediaPlan,
        });
        stats.created++;
        return created;
      }
      const updated = await updateProduct(tx, {
        existing,
        staged,
        entry,
        categorySlug,
        brandName,
        variants,
        salePriceFor,
        mediaPlan,
        updatePrices,
      });
      stats.updated++;
      return updated;
    },
    { timeout: 30_000 },
  );

  console.log(`  ${summary}`);
}

/** Woo lists variations without price or SKU — fetch each one for approved
 * variable products. Shopify variants arrive complete and skip this. */
async function enrichedVariants(
  staged: StagedProduct,
): Promise<StagedVariant[]> {
  let variants = staged.variants;
  const needsDetail =
    staged.supplier === "distrisex" &&
    staged.options.length > 0 &&
    variants.some((v) => v.sku === null);
  if (needsDetail) {
    console.log(`  fetching ${variants.length} Woo variation(s) for price/SKU…`);
    variants = await Promise.all(
      variants.map(async (v) => {
        try {
          const d = await fetchWooVariation(v.supplierVariantId);
          return {
            ...v,
            sku: d.sku?.trim() || null,
            supplierPriceCents: wooPriceToCents(
              d.prices.price,
              d.prices.currency_minor_unit,
            ),
            available: d.is_in_stock,
          };
        } catch (e) {
          warn(
            `${staged.supplierRef}: variation ${v.supplierVariantId} detail failed (${e instanceof Error ? e.message : e}) — using list values`,
          );
          return v;
        }
      }),
    );
  }
  // Defensive: two variations collapsing onto the same combination would
  // violate @@unique([productId, optionKey]).
  const seen = new Set<string>();
  return variants.filter((v) => {
    const key = JSON.stringify(
      Object.entries(v.options).sort(([a], [b]) => a.localeCompare(b)),
    );
    if (seen.has(key)) {
      warn(
        `${staged.supplierRef}: duplicate option combination ${key || "(none)"} — kept the first`,
      );
      return false;
    }
    seen.add(key);
    return true;
  });
}

const valueKey = (option: string, value: string) => `${option} ${value}`;

async function createProduct(
  tx: Tx,
  ctx: {
    staged: StagedProduct;
    entry: ApprovedEntry;
    categorySlug: string;
    brandName: string | null;
    variants: StagedVariant[];
    salePriceFor: (v: StagedVariant) => number;
    mediaPlan: {
      url: string;
      alt: string;
      optionValue: { option: string; value: string } | null;
    }[];
  },
): Promise<string> {
  const { staged, entry, categorySlug, brandName, variants, salePriceFor } = ctx;

  const slug = await freeSlug(tx, slugify(staged.name));
  const product = await tx.product.create({
    data: {
      slug,
      name: staged.name,
      description: staged.descriptionText || null,
      status: "ACTIVE",
      publishedAt: new Date(),
      supplierRef: staged.supplierRef,
      ...(brandName ? { brand: brandConnect(brandName) } : {}),
      category: { connect: { slug: categorySlug } },
      minPriceCents: Math.min(...variants.map(salePriceFor)),
      specs: {
        create: staged.specs.map((s, position) => ({ ...s, position })),
      },
    },
  });

  // Options and values first — variants reference the value ids.
  const valueIds = new Map<string, string>();
  for (const [position, option] of staged.options.entries()) {
    const created = await tx.productOption.create({
      data: {
        productId: product.id,
        name: option.name,
        position,
        values: {
          create: option.values.map((v, i) => ({
            value: v.value,
            hex: v.hex,
            position: i,
          })),
        },
      },
      include: { values: true },
    });
    for (const v of created.values)
      valueIds.set(valueKey(option.name, v.value), v.id);
  }

  const initialStock = entry.initialStock ?? 0;
  for (const sv of variants) {
    const ids = await resolveValueIds(tx, product.id, sv, valueIds, staged);
    const sku = await freeSku(tx, sv, staged, product.id);
    const variant = await tx.productVariant.create({
      data: {
        productId: product.id,
        sku,
        priceCents: salePriceFor(sv),
        optionKey: computeOptionKey(ids),
        stockOnHand: initialStock,
        optionValues: { create: ids.map((optionValueId) => ({ optionValueId })) },
      },
    });
    stats.variantsCreated++;
    if (initialStock > 0) {
      // Opening stock is a stock change like any other — through the ledger,
      // in the same transaction (same contract as prisma/seed.ts).
      await tx.inventoryMovement.create({
        data: {
          variantId: variant.id,
          delta: initialStock,
          reason: "PURCHASE",
          note: `Carga inicial importación ${staged.supplier} (${staged.supplierRef})`,
        },
      });
    }
  }

  await createMedia(tx, product.id, ctx.mediaPlan, valueIds, 0);

  const min = Math.min(...variants.map(salePriceFor));
  return `created /producto/${slug} · ${variants.length} variant(s) · desde ${formatCOP(min)}`;
}

async function updateProduct(
  tx: Tx,
  ctx: {
    existing: ExistingProduct;
    staged: StagedProduct;
    entry: ApprovedEntry;
    categorySlug: string;
    brandName: string | null;
    variants: StagedVariant[];
    salePriceFor: (v: StagedVariant) => number;
    mediaPlan: {
      url: string;
      alt: string;
      optionValue: { option: string; value: string } | null;
    }[];
    updatePrices: boolean;
  },
): Promise<string> {
  const {
    existing,
    staged,
    entry,
    categorySlug,
    brandName,
    variants,
    salePriceFor,
    updatePrices,
  } = ctx;

  // Slug stays — it is a public URL. Stock stays — it is the client's count.
  await tx.product.update({
    where: { id: existing.id },
    data: {
      name: staged.name,
      description: staged.descriptionText || null,
      supplierRef: staged.supplierRef,
      ...(brandName ? { brand: brandConnect(brandName) } : {}),
      category: { connect: { slug: categorySlug } },
    },
  });

  // Specs are display-only rows with no inbound references — replace wholesale.
  await tx.productSpec.deleteMany({ where: { productId: existing.id } });
  if (staged.specs.length > 0) {
    await tx.productSpec.createMany({
      data: staged.specs.map((s, position) => ({
        productId: existing.id,
        ...s,
        position,
      })),
    });
  }

  // Options/values: additive only. Removing a value would orphan variants that
  // reference it; supplier axis removals are a curation conversation, not an
  // automatic delete.
  const valueIds = new Map<string, string>();
  for (const o of existing.options)
    for (const v of o.values) valueIds.set(valueKey(o.name, v.value), v.id);
  for (const [position, option] of staged.options.entries()) {
    let dbOption = existing.options.find((o) => o.name === option.name);
    if (!dbOption) {
      const created = await tx.productOption.create({
        data: { productId: existing.id, name: option.name, position },
        include: { values: true },
      });
      dbOption = created;
    }
    for (const [i, v] of option.values.entries()) {
      if (!valueIds.has(valueKey(option.name, v.value))) {
        const createdValue = await tx.productOptionValue.create({
          data: { optionId: dbOption.id, value: v.value, hex: v.hex, position: i },
        });
        valueIds.set(valueKey(option.name, v.value), createdValue.id);
      }
    }
  }

  const byOptionKey = new Map(existing.variants.map((v) => [v.optionKey, v]));
  const initialStock = entry.initialStock ?? 0;
  for (const sv of variants) {
    const ids = await resolveValueIds(tx, existing.id, sv, valueIds, staged);
    const key = computeOptionKey(ids);
    const current = byOptionKey.get(key);
    if (current) {
      stats.variantsKept++;
      if (updatePrices) {
        await tx.productVariant.update({
          where: { id: current.id },
          data: { priceCents: salePriceFor(sv) },
        });
      }
      continue;
    }
    const sku = await freeSku(tx, sv, staged, existing.id);
    const variant = await tx.productVariant.create({
      data: {
        productId: existing.id,
        sku,
        priceCents: salePriceFor(sv),
        optionKey: key,
        stockOnHand: initialStock,
        optionValues: { create: ids.map((optionValueId) => ({ optionValueId })) },
      },
    });
    stats.variantsCreated++;
    if (initialStock > 0) {
      await tx.inventoryMovement.create({
        data: {
          variantId: variant.id,
          delta: initialStock,
          reason: "PURCHASE",
          note: `Variante nueva importación ${staged.supplier} (${staged.supplierRef})`,
        },
      });
    }
  }

  const existingUrls = new Set(existing.media.map((m) => m.url));
  await createMedia(
    tx,
    existing.id,
    ctx.mediaPlan.filter((m) => !existingUrls.has(m.url)),
    valueIds,
    existing.media.length,
  );

  // The denormalized card price tracks whatever the variants now cost.
  const prices = await tx.productVariant.findMany({
    where: { productId: existing.id },
    select: { priceCents: true },
  });
  const min = Math.min(...prices.map((p) => p.priceCents));
  await tx.product.update({
    where: { id: existing.id },
    data: { minPriceCents: min },
  });

  return `updated /producto/${existing.slug} · ${variants.length} variant(s) · desde ${formatCOP(min)}`;
}

function brandConnect(name: string) {
  const slug = slugify(name);
  return {
    connectOrCreate: { where: { slug }, create: { name, slug } },
  };
}

/** Option value ids for a staged variant, creating values the supplier used in
 * a variation but forgot to list under the attribute (it happens). */
async function resolveValueIds(
  tx: Tx,
  productId: string,
  sv: StagedVariant,
  valueIds: Map<string, string>,
  staged: StagedProduct,
): Promise<string[]> {
  const ids: string[] = [];
  for (const [option, value] of Object.entries(sv.options)) {
    let id = valueIds.get(valueKey(option, value));
    if (!id) {
      const dbOption = await tx.productOption.findUnique({
        where: { productId_name: { productId, name: option } },
        include: { values: true },
      });
      if (!dbOption) {
        throw new Error(
          `${staged.supplierRef}: variation uses unknown option "${option}"`,
        );
      }
      const created = await tx.productOptionValue.create({
        data: {
          optionId: dbOption.id,
          value,
          hex: null,
          position: dbOption.values.length,
        },
      });
      warn(
        `${staged.supplierRef}: value "${value}" existed only on a variation — added to option "${option}"`,
      );
      id = created.id;
      valueIds.set(valueKey(option, value), id);
    }
    ids.push(id);
  }
  return ids;
}

async function createMedia(
  tx: Tx,
  productId: string,
  plan: {
    url: string;
    alt: string;
    optionValue: { option: string; value: string } | null;
  }[],
  valueIds: Map<string, string>,
  startPosition: number,
) {
  for (const [i, m] of plan.entries()) {
    await tx.productMedia.create({
      data: {
        productId,
        url: m.url,
        alt: m.alt,
        position: startPosition + i,
        type: "IMAGE",
        optionValueId: m.optionValue
          ? (valueIds.get(valueKey(m.optionValue.option, m.optionValue.value)) ??
            null)
          : null,
      },
    });
  }
}

async function freeSlug(tx: Tx, base: string): Promise<string> {
  let candidate = base;
  for (let n = 2; ; n++) {
    const taken = await tx.product.findUnique({ where: { slug: candidate } });
    if (!taken) return candidate;
    candidate = `${base}-${n}`;
  }
}

/** Supplier SKU when free, otherwise a prefixed fallback — SKUs are globally
 * unique in the schema and both suppliers plus the demo share the namespace. */
async function freeSku(
  tx: Tx,
  sv: StagedVariant,
  staged: StagedProduct,
  productId: string,
): Promise<string> {
  const prefix = staged.supplier === "distrisex" ? "DSX" : "CLX";
  const base = sv.sku ?? `${prefix}-${sv.supplierVariantId}`;
  const candidates = [
    base,
    `${prefix}-${base}`,
    `${base}-${sv.supplierVariantId}`,
  ];
  for (const candidate of candidates) {
    const taken = await tx.productVariant.findUnique({
      where: { sku: candidate },
    });
    if (!taken) return candidate;
    if (taken.productId === productId) {
      // Same product re-promoted with a changed combination — keep its SKU
      // unique by falling through to the next candidate.
      continue;
    }
    warn(
      `${staged.supplierRef}: SKU "${candidate}" already belongs to another product — using a fallback`,
    );
  }
  return `${prefix}-${staged.supplierRef.split(":")[1]}-${sv.supplierVariantId}`;
}

main().catch((e: unknown) => {
  console.error(`\nPromote FAILED: ${e instanceof Error ? e.message : e}`);
  process.exit(1);
});
