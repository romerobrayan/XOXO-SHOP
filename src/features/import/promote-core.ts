// Promote ONE staged supplier product into the real catalog — the single
// source of the import normalization, shared verbatim by the CLI
// (scripts/import/promote.ts, seleccion.json) and the panel curator
// (/admin/proveedores, "Publicar"). Moving it here from scripts/ is what lets
// the owner press the button herself: the --neon guardrail's approval step is
// satisfied by design when the person publishing IS the client.
//
// What it does per product: enriches Woo variations (price/SKU), downloads
// supplier images and re-hosts them on Cloudinary with the brand-guide
// transformation, then upserts the product inside a transaction.
//
// Idempotency contract (Product.supplierRef is the key):
//   - re-running updates name/description/brand/category/specs, never duplicates
//   - variants match by optionKey; new ones are created, existing ones keep
//     their price unless updatePrices, and their stock is NEVER touched
//   - initial stock applies per variant, only at creation, and goes through
//     the inventory ledger (CLAUDE.md rule 3)
//   - images: one Cloudinary asset per source URL (deterministic public_id),
//     one ProductMedia row per delivery URL
import type { Prisma, PrismaClient } from "../../generated/prisma/client";
import { computeOptionKey } from "../catalog/optionKey";
import {
  deliveryUrl,
  publicIdForSource,
  uploadImage,
} from "../../lib/cloudinary";
import { slugify } from "../../lib/slug";
import { CATEGORIES, type CategorySlug } from "./config";
import { fetchBytes } from "./http";
import { wooPriceToCents } from "./normalize";
import { computeSalePriceCents, type PromotePricing } from "./pricing";
import type { StagedProduct, StagedVariant } from "./staging";
import { fetchWooVariation } from "./woo-variations";

/** Uploading every angle of a 12-photo listing is supplier noise, not
 * catalog quality — the storefront gallery works best under ~8. */
export const MAX_IMAGES_PER_PRODUCT = 8;

type Tx = Prisma.TransactionClient;
type ExistingProduct = Prisma.ProductGetPayload<{
  include: {
    media: true;
    options: { include: { values: true } };
    variants: true;
  };
}>;

export type PromoteEntry = {
  supplierRef: string;
  /** Sale price in whole COP — wins over the margin, for every variant. */
  salePriceCOP?: number;
  categorySlug?: CategorySlug;
  brand?: string;
  /** Opening stock for NEW variants, written through the inventory ledger.
   * Existing variants never have their stock touched by a promote. */
  initialStock?: number;
};

export type PromoteOutcome = {
  action: "created" | "updated";
  productId: string;
  slug: string;
  variantsCreated: number;
  variantsKept: number;
  imagesUploaded: number;
  imagesReused: number;
  minPriceCents: number;
  warnings: string[];
};

/** The three storefront categories, same ids/slugs as the demo catalog so
 * every database converges on identical taxonomy rows. Call once before
 * promoting. */
export async function ensureCatalogCategories(db: PrismaClient): Promise<void> {
  for (const [position, c] of CATEGORIES.entries()) {
    await db.category.upsert({
      where: { slug: c.slug },
      update: {},
      create: { id: c.id, name: c.name, slug: c.slug, position },
    });
  }
}

export async function promoteStagedProduct(
  db: PrismaClient,
  params: {
    staged: StagedProduct;
    entry: PromoteEntry;
    pricing: PromotePricing;
    updatePrices?: boolean;
  },
): Promise<PromoteOutcome> {
  const { staged, entry, pricing, updatePrices = false } = params;
  const warnings: string[] = [];
  const warn = (msg: string) => warnings.push(msg);
  const counters = {
    variantsCreated: 0,
    variantsKept: 0,
    imagesUploaded: 0,
    imagesReused: 0,
  };

  const categorySlug = entry.categorySlug ?? staged.suggestedCategorySlug;
  if (!categorySlug) {
    throw new Error(
      `${staged.supplierRef} has no category — pick one before publishing.`,
    );
  }
  const brandName = entry.brand ?? staged.brand;

  const variants = await enrichedVariants(staged, warn);
  if (variants.length === 0) {
    throw new Error(
      `${staged.supplierRef}: every supplier variation is incomplete — nothing sellable to publish.`,
    );
  }
  if (!variants.some((v) => v.available)) {
    warn(`${staged.supplierRef} is fully unavailable at the supplier right now`);
  }

  const marginPct = pricing.marginPct[staged.supplier];
  const salePriceFor = (v: StagedVariant) =>
    entry.salePriceCOP !== undefined
      ? entry.salePriceCOP * 100
      : computeSalePriceCents(
          v.supplierPriceCents,
          marginPct,
          pricing.roundUpToCOP,
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
  const mediaPlan: MediaPlanItem[] = [];
  for (const img of staged.images.slice(0, MAX_IMAGES_PER_PRODUCT)) {
    const publicId = publicIdForSource(staged.supplier, img.url);
    const url = deliveryUrl(publicId);
    const alt = img.optionValue
      ? `${staged.name} — ${img.optionValue.value}`
      : staged.name;
    mediaPlan.push({ url, alt, optionValue: img.optionValue });
    if (existingUrls.has(url)) {
      counters.imagesReused++;
      continue;
    }
    const { buffer, contentType } = await fetchBytes(img.url);
    const uploaded = await uploadImage({
      buffer,
      contentType,
      publicId,
      sourceRef: staged.supplierRef,
    });
    if (uploaded.existed) counters.imagesReused++;
    else counters.imagesUploaded++;
  }
  if (staged.images.length > MAX_IMAGES_PER_PRODUCT) {
    warn(
      `${staged.supplierRef}: kept ${MAX_IMAGES_PER_PRODUCT} of ${staged.images.length} supplier images`,
    );
  }

  const result = await db.$transaction(
    async (tx) => {
      if (!existing) {
        return createProduct(tx, {
          staged,
          entry,
          categorySlug,
          brandName,
          variants,
          salePriceFor,
          mediaPlan,
          warn,
          counters,
        });
      }
      return updateProduct(tx, {
        existing,
        staged,
        entry,
        categorySlug,
        brandName,
        variants,
        salePriceFor,
        mediaPlan,
        updatePrices,
        warn,
        counters,
      });
    },
    { timeout: 30_000 },
  );

  return { ...result, ...counters, warnings };
}

type MediaPlanItem = {
  url: string;
  alt: string;
  optionValue: { option: string; value: string } | null;
};

type PromoteCounters = {
  variantsCreated: number;
  variantsKept: number;
  imagesUploaded: number;
  imagesReused: number;
};

/** Woo lists variations without price or SKU — fetch each one for approved
 * variable products. Shopify variants arrive complete and skip this. */
async function enrichedVariants(
  staged: StagedProduct,
  warn: (msg: string) => void,
): Promise<StagedVariant[]> {
  let variants = staged.variants;
  const needsDetail =
    staged.supplier === "distrisex" &&
    staged.options.length > 0 &&
    variants.some((v) => v.sku === null);
  if (needsDetail) {
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
  // A variation that lost option values to Woo's "any" (see staging schema)
  // is not a real combination — it duplicates whichever full variations
  // exist. Only applies to products that do have option axes.
  const optionNames = staged.options.map((o) => o.name);
  const complete = variants.filter((v) => {
    const missing = optionNames.filter((name) => !(name in v.options));
    if (missing.length === 0 || optionNames.length === 0) return true;
    warn(
      `${staged.supplierRef}: variation ${v.supplierVariantId} lacks ${missing.join(", ")} — discarded as an incomplete supplier duplicate`,
    );
    return false;
  });

  // Defensive: two variations collapsing onto the same combination would
  // violate @@unique([productId, optionKey]).
  const seen = new Set<string>();
  return complete.filter((v) => {
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

const valueKey = (option: string, value: string) => `${option} ${value}`;

async function createProduct(
  tx: Tx,
  ctx: {
    staged: StagedProduct;
    entry: PromoteEntry;
    categorySlug: string;
    brandName: string | null;
    variants: StagedVariant[];
    salePriceFor: (v: StagedVariant) => number;
    mediaPlan: MediaPlanItem[];
    warn: (msg: string) => void;
    counters: PromoteCounters;
  },
): Promise<{
  action: "created";
  productId: string;
  slug: string;
  minPriceCents: number;
}> {
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
    const ids = await resolveValueIds(tx, product.id, sv, valueIds, staged, ctx.warn);
    const sku = await freeSku(tx, sv, staged, product.id, ctx.warn);
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
    ctx.counters.variantsCreated++;
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
  return {
    action: "created",
    productId: product.id,
    slug,
    minPriceCents: min,
  };
}

async function updateProduct(
  tx: Tx,
  ctx: {
    existing: ExistingProduct;
    staged: StagedProduct;
    entry: PromoteEntry;
    categorySlug: string;
    brandName: string | null;
    variants: StagedVariant[];
    salePriceFor: (v: StagedVariant) => number;
    mediaPlan: MediaPlanItem[];
    updatePrices: boolean;
    warn: (msg: string) => void;
    counters: PromoteCounters;
  },
): Promise<{
  action: "updated";
  productId: string;
  slug: string;
  minPriceCents: number;
}> {
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
    const ids = await resolveValueIds(tx, existing.id, sv, valueIds, staged, ctx.warn);
    const key = computeOptionKey(ids);
    const current = byOptionKey.get(key);
    if (current) {
      ctx.counters.variantsKept++;
      if (updatePrices) {
        await tx.productVariant.update({
          where: { id: current.id },
          data: { priceCents: salePriceFor(sv) },
        });
      }
      continue;
    }
    const sku = await freeSku(tx, sv, staged, existing.id, ctx.warn);
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
    ctx.counters.variantsCreated++;
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

  return {
    action: "updated",
    productId: existing.id,
    slug: existing.slug,
    minPriceCents: min,
  };
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
  warn: (msg: string) => void,
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
  plan: MediaPlanItem[],
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
  warn: (msg: string) => void,
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
