"use server";

import { revalidatePath } from "next/cache";

import { requireStaff } from "@/features/admin/session";
import { computeOptionKey } from "@/features/catalog/optionKey";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { actionClient } from "@/lib/safe-action";
import { slugify } from "@/lib/slug";
import { deleteProductPermanently } from "./lifecycle";
import {
  addProductImage,
  moveProductMedia as moveMediaCore,
  removeProductMedia as removeMediaCore,
} from "./media";
import {
  addOptionSchema,
  addOptionValueSchema,
  adjustStockSchema,
  createProductSchema,
  deleteProductSchema,
  generateVariantsSchema,
  moveProductMediaSchema,
  removeProductMediaSchema,
  setProductArchivedSchema,
  updateProductSchema,
  updateVariantSchema,
  uploadProductMediaSchema,
} from "./schemas";
import { applyStockAdjustment } from "./stock-adjust";
import { cartesian, proposeVariantSku } from "./variant-sku";

// Every action gates on requireStaff() first — the layout only proves who
// loaded the page — and revalidates the panel list when it writes.

function revalidateProduct(productId: string) {
  revalidatePath("/admin/productos");
  revalidatePath(`/admin/productos/${productId}`);
}

// The denormalized card price. Active variants define it; a product whose
// variants are all inactive keeps the last value rather than showing $0.
async function recalcMinPrice(
  tx: Prisma.TransactionClient,
  productId: string,
) {
  const min = await tx.productVariant.aggregate({
    where: { productId, isActive: true },
    _min: { priceCents: true },
  });
  if (min._min.priceCents !== null) {
    await tx.product.update({
      where: { id: productId },
      data: { minPriceCents: min._min.priceCents },
    });
  }
}

async function uniqueSlug(name: string): Promise<string> {
  const base = slugify(name) || "producto";
  const taken = await db.product.findMany({
    where: { slug: { startsWith: base } },
    select: { slug: true },
  });
  const slugs = new Set(taken.map((p) => p.slug));
  if (!slugs.has(base)) return base;
  for (let n = 2; ; n++) {
    if (!slugs.has(`${base}-${n}`)) return `${base}-${n}`;
  }
}

export type CreateProductResult =
  | { ok: true; productId: string }
  | { ok: false; code: "SKU_TAKEN" };

export const createProduct = actionClient
  .inputSchema(createProductSchema)
  .action(async ({ parsedInput }): Promise<CreateProductResult> => {
    await requireStaff();
    const { name, description, brandId, categoryId, supplierRef, status, sku, priceCents } =
      parsedInput;

    if (await db.productVariant.findUnique({ where: { sku }, select: { id: true } })) {
      return { ok: false, code: "SKU_TAKEN" };
    }

    const slug = await uniqueSlug(name);
    const product = await db.product.create({
      data: {
        name,
        slug,
        description: description || null,
        brandId: brandId || null,
        categoryId: categoryId || null,
        supplierRef: supplierRef || null,
        status,
        publishedAt: status === "ACTIVE" ? new Date() : null,
        minPriceCents: priceCents,
        // Born with its singleton variant — |V| = 1 for n = 0, and cart and
        // checkout only ever speak variants. Stock starts at zero on purpose:
        // units enter through the adjustment action, which is what writes the
        // ledger row saying where they came from.
        variants: {
          create: { sku, priceCents, optionKey: "" },
        },
      },
      select: { id: true },
    });

    revalidateProduct(product.id);
    return { ok: true, productId: product.id };
  });

export const updateProduct = actionClient
  .inputSchema(updateProductSchema)
  .action(async ({ parsedInput }) => {
    await requireStaff();
    const { productId, name, description, brandId, categoryId, supplierRef, status } =
      parsedInput;

    const current = await db.product.findUnique({
      where: { id: productId },
      select: { publishedAt: true },
    });
    if (!current) return { ok: false as const, code: "NOT_FOUND" as const };

    await db.product.update({
      where: { id: productId },
      data: {
        name,
        description: description || null,
        brandId: brandId || null,
        categoryId: categoryId || null,
        supplierRef: supplierRef || null,
        status,
        // First activation stamps publishedAt; later toggles keep the
        // original date. The slug never changes here — it is the URL the
        // client already shared on WhatsApp.
        publishedAt:
          status === "ACTIVE" && !current.publishedAt
            ? new Date()
            : undefined,
      },
    });

    revalidateProduct(productId);
    return { ok: true as const };
  });

export const addOption = actionClient
  .inputSchema(addOptionSchema)
  .action(async ({ parsedInput }) => {
    await requireStaff();
    const { productId, name } = parsedInput;

    const count = await db.productOption.count({ where: { productId } });
    try {
      await db.productOption.create({
        data: { productId, name, position: count },
      });
    } catch {
      // @@unique([productId, name]) — the option already exists.
      return { ok: false as const, code: "DUPLICATE" as const };
    }
    revalidateProduct(productId);
    return { ok: true as const };
  });

export const addOptionValue = actionClient
  .inputSchema(addOptionValueSchema)
  .action(async ({ parsedInput }) => {
    await requireStaff();
    const { optionId, value, hex } = parsedInput;

    const option = await db.productOption.findUnique({
      where: { id: optionId },
      select: { productId: true, _count: { select: { values: true } } },
    });
    if (!option) return { ok: false as const, code: "NOT_FOUND" as const };

    try {
      await db.productOptionValue.create({
        data: {
          optionId,
          value,
          hex: hex || null,
          position: option._count.values,
        },
      });
    } catch {
      return { ok: false as const, code: "DUPLICATE" as const };
    }
    revalidateProduct(option.productId);
    return { ok: true as const };
  });

export type GenerateVariantsResult =
  | { ok: true; created: number; skipped: number }
  | { ok: false; code: "NO_OPTIONS" | "NOT_FOUND" };

export const generateVariants = actionClient
  .inputSchema(generateVariantsSchema)
  .action(async ({ parsedInput }): Promise<GenerateVariantsResult> => {
    await requireStaff();
    const { productId, priceCents } = parsedInput;

    const product = await db.product.findUnique({
      where: { id: productId },
      select: {
        supplierRef: true,
        slug: true,
        options: {
          orderBy: { position: "asc" },
          select: {
            values: {
              orderBy: { position: "asc" },
              select: { id: true, value: true },
            },
          },
        },
        variants: { select: { optionKey: true, sku: true } },
      },
    });
    if (!product) return { ok: false, code: "NOT_FOUND" };

    const sets = product.options
      .map((o) => o.values)
      .filter((values) => values.length > 0);
    if (sets.length === 0) return { ok: false, code: "NO_OPTIONS" };

    const existingKeys = new Set(product.variants.map((v) => v.optionKey));
    const takenSkus = new Set(product.variants.map((v) => v.sku));
    const base = product.supplierRef || product.slug;

    // The full space; only combos nobody has materialized yet get created.
    // Existing variants keep their price, stock, and ledger untouched —
    // generation is additive, never a rebuild.
    const combos = cartesian(sets).filter(
      (combo) => !existingKeys.has(computeOptionKey(combo.map((v) => v.id))),
    );
    const skipped = cartesian(sets).length - combos.length;

    let created = 0;
    for (const combo of combos) {
      let sku = proposeVariantSku(base, combo.map((v) => v.value));
      // Globally unique — the same "M / Negro" exists on many products.
      for (let n = 2; takenSkus.has(sku) || (await db.productVariant.findUnique({ where: { sku }, select: { id: true } })); n++) {
        sku = `${proposeVariantSku(base, combo.map((v) => v.value))}-${n}`;
      }
      takenSkus.add(sku);

      await db.productVariant.create({
        data: {
          productId,
          sku,
          priceCents,
          optionKey: computeOptionKey(combo.map((v) => v.id)),
          optionValues: {
            create: combo.map((v) => ({ optionValueId: v.id })),
          },
        },
      });
      created += 1;
    }

    await db.$transaction((tx) => recalcMinPrice(tx, productId));
    revalidateProduct(productId);
    return { ok: true, created, skipped };
  });

export const updateVariant = actionClient
  .inputSchema(updateVariantSchema)
  .action(async ({ parsedInput }) => {
    await requireStaff();
    const { variantId, sku, priceCents, compareAtCents, isActive } = parsedInput;

    const variant = await db.productVariant.findUnique({
      where: { id: variantId },
      select: { productId: true },
    });
    if (!variant) return { ok: false as const, code: "NOT_FOUND" as const };

    const skuOwner = await db.productVariant.findUnique({
      where: { sku },
      select: { id: true },
    });
    if (skuOwner && skuOwner.id !== variantId) {
      return { ok: false as const, code: "SKU_TAKEN" as const };
    }

    await db.$transaction(async (tx) => {
      await tx.productVariant.update({
        where: { id: variantId },
        data: {
          sku,
          priceCents,
          compareAtCents: compareAtCents ?? null,
          isActive,
        },
      });
      await recalcMinPrice(tx, variant.productId);
    });

    revalidateProduct(variant.productId);
    return { ok: true as const };
  });

export const adjustStock = actionClient
  .inputSchema(adjustStockSchema)
  .action(async ({ parsedInput }) => {
    await requireStaff();
    const outcome = await applyStockAdjustment(db, parsedInput);
    if (outcome.ok) revalidateProduct(outcome.productId);
    return outcome;
  });

// Media and lifecycle writes are the edits the storefront shows instantly
// (card, gallery, home showcase, a product vanishing), so they also
// revalidate the store paths — the older product actions predate this and
// keep their narrower scope.

async function revalidateStorefront(slug?: string) {
  if (slug) revalidatePath(`/tienda/${slug}`);
  revalidatePath("/tienda");
  revalidatePath("/");
}

async function revalidateMedia(productId: string) {
  revalidateProduct(productId);
  const product = await db.product.findUnique({
    where: { id: productId },
    select: { slug: true },
  });
  await revalidateStorefront(product?.slug);
}

export const uploadProductMedia = actionClient
  .inputSchema(uploadProductMediaSchema)
  .action(async ({ parsedInput }) => {
    await requireStaff();
    const { productId, file } = parsedInput;
    const buffer = Buffer.from(await file.arrayBuffer());
    const outcome = await addProductImage(db, {
      productId,
      buffer,
      // Some Android pickers hand over files with an empty type; the bytes
      // are still a photo and Cloudinary sniffs the real format on ingest.
      contentType: file.type || "image/jpeg",
    });
    if (outcome.ok) await revalidateMedia(productId);
    return outcome;
  });

export const moveProductMedia = actionClient
  .inputSchema(moveProductMediaSchema)
  .action(async ({ parsedInput }) => {
    await requireStaff();
    const { productId, mediaId, direction } = parsedInput;
    const outcome = await moveMediaCore(db, { mediaId, direction });
    if (outcome.ok) await revalidateMedia(productId);
    return outcome;
  });

export const removeProductMedia = actionClient
  .inputSchema(removeProductMediaSchema)
  .action(async ({ parsedInput }) => {
    await requireStaff();
    const { productId, mediaId } = parsedInput;
    const outcome = await removeMediaCore(db, { mediaId });
    if (outcome.ok) await revalidateMedia(productId);
    return outcome;
  });

// ─── Lifecycle ──────────────────────────────────────────────
// "Quitar de la tienda" means ARCHIVE: the product disappears from the
// storefront instantly while orders, snapshots, and the inventory ledger
// stay whole. Real deletion exists only for a product with no history at
// all — and the guard re-checks inside the transaction, not just in the UI.

export const setProductArchived = actionClient
  .inputSchema(setProductArchivedSchema)
  .action(async ({ parsedInput }) => {
    await requireStaff();
    const { productId, archived } = parsedInput;

    const current = await db.product.findUnique({
      where: { id: productId },
      select: { slug: true, publishedAt: true },
    });
    if (!current) return { ok: false as const, code: "NOT_FOUND" as const };

    await db.product.update({
      where: { id: productId },
      data: {
        // Restoring returns the product to the state its history implies: it
        // was live if it ever published, otherwise back to draft.
        status: archived ? "ARCHIVED" : current.publishedAt ? "ACTIVE" : "DRAFT",
      },
    });

    revalidateProduct(productId);
    await revalidateStorefront(current.slug);
    return { ok: true as const, archived };
  });

export const deleteProduct = actionClient
  .inputSchema(deleteProductSchema)
  .action(async ({ parsedInput }) => {
    await requireStaff();
    const outcome = await deleteProductPermanently(db, parsedInput.productId);
    if (outcome.ok) {
      revalidatePath("/admin/productos");
      revalidatePath("/admin/proveedores");
      await revalidateStorefront(outcome.slug);
    }
    return outcome;
  });
