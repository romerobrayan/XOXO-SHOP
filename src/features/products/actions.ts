"use server";

import { revalidatePath } from "next/cache";

import { requireStaff } from "@/features/admin/session";
import { computeOptionKey } from "@/features/catalog/optionKey";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { actionClient } from "@/lib/safe-action";
import { slugify } from "@/lib/slug";
import {
  addOptionSchema,
  addOptionValueSchema,
  adjustStockSchema,
  createProductSchema,
  generateVariantsSchema,
  updateProductSchema,
  updateVariantSchema,
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
