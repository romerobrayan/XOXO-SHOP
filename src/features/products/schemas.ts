import { z } from "zod";

import { ProductStatus } from "@/generated/prisma/enums";

// Cents come from a text input as pesos ("120.000" or "120000"), so the
// schema owns the conversion: strip separators, multiply once, integers only
// after that. Money never travels as a float (CLAUDE.md rule 1).
export const pesosToCents = z
  .string()
  .trim()
  .regex(/^\$?\s*\d{1,3}(\.\d{3})*$|^\$?\s*\d+$/, "Precio inválido")
  .transform((raw) => Number(raw.replace(/[^\d]/g, "")) * 100);

const productFields = {
  name: z.string().trim().min(2, "El nombre es muy corto").max(160),
  description: z.string().trim().max(4000).optional(),
  brandId: z.string().optional(),
  categoryId: z.string().optional(),
  supplierRef: z.string().trim().max(40).optional(),
  status: z.enum(ProductStatus),
};

export const createProductSchema = z.object({
  ...productFields,
  // Every product ships with at least one variant, even option-less ones —
  // |V| = 1 for n = 0 (CLAUDE.md). The first variant is born here so the
  // invariant holds from the first row, not from the first edit.
  sku: z.string().trim().min(2, "SKU muy corto").max(60),
  priceCents: pesosToCents,
});

export const updateProductSchema = z.object({
  productId: z.string().min(1),
  ...productFields,
});

export const addOptionSchema = z.object({
  productId: z.string().min(1),
  name: z.string().trim().min(1).max(40),
});

export const addOptionValueSchema = z.object({
  optionId: z.string().min(1),
  value: z.string().trim().min(1).max(60),
  hex: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, "Color inválido")
    .optional(),
});

export const generateVariantsSchema = z.object({
  productId: z.string().min(1),
  priceCents: pesosToCents,
});

export const updateVariantSchema = z.object({
  variantId: z.string().min(1),
  sku: z.string().trim().min(2).max(60),
  priceCents: pesosToCents,
  compareAtCents: pesosToCents.optional(),
  isActive: z.boolean(),
});

export const ADJUST_REASONS = ["PURCHASE", "MANUAL_ADJUST", "DAMAGE"] as const;

export const adjustStockSchema = z
  .object({
    variantId: z.string().min(1),
    // Bounded: the biggest honest restock fits, a typo'd extra digit does not.
    delta: z.number().int().min(-999).max(999),
    reason: z.enum(ADJUST_REASONS),
    note: z.string().trim().max(200).optional(),
  })
  .superRefine((value, ctx) => {
    // The reason must agree with the direction, or the ledger stops meaning
    // anything: a "purchase" that removes stock is a correction wearing the
    // wrong label, and MANUAL_ADJUST is the only two-way reason.
    if (value.delta === 0) {
      ctx.addIssue({ code: "custom", message: "El ajuste no puede ser cero" });
    }
    if (value.reason === "PURCHASE" && value.delta < 0) {
      ctx.addIssue({ code: "custom", message: "Una compra suma stock" });
    }
    if (value.reason === "DAMAGE" && value.delta > 0) {
      ctx.addIssue({ code: "custom", message: "Un daño resta stock" });
    }
  });

export type AdjustReason = (typeof ADJUST_REASONS)[number];
export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type AdjustStockInput = z.infer<typeof adjustStockSchema>;
