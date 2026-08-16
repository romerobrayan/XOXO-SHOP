import { z } from "zod";

import { CATEGORIES, type CategorySlug } from "./config";

const categorySlugs = CATEGORIES.map((c) => c.slug) as [
  CategorySlug,
  ...CategorySlug[],
];

// Whole COP from a text input ("120.000" or "120000") — the sale price the
// owner confirms. Stored money is cents everywhere (CLAUDE.md rule 1);
// promote-core multiplies exactly once from salePriceCOP.
export const pesosEnteros = z
  .string()
  .trim()
  .regex(/^\$?\s*\d{1,3}(\.\d{3})*$|^\$?\s*\d+$/, "Precio inválido")
  .transform((raw) => Number(raw.replace(/[^\d]/g, "")))
  .refine((n) => n > 0, "El precio no puede ser cero");

export const publishStagedProductSchema = z
  .object({
    stagingId: z.string().min(1),
    categorySlug: z.enum(categorySlugs),
    brand: z.string().trim().max(60).optional(),
    // "margen" applies a percentage over each variant's supplier price —
    // the only mode that keeps per-variant price differences. "manual" pins
    // one price for every variant.
    pricingMode: z.enum(["margen", "manual"]),
    salePriceCOP: pesosEnteros.optional(),
    marginPct: z.number().min(0).max(500).optional(),
    /** Opening stock for NEW variants — enters through the inventory ledger
     * as a purchase. Zero is normal: units arrive later via the two-tap
     * adjustment. */
    initialStock: z.number().int().min(0).max(999),
  })
  .superRefine((value, ctx) => {
    if (value.pricingMode === "manual" && value.salePriceCOP === undefined) {
      ctx.addIssue({ code: "custom", message: "Escribe el precio de venta" });
    }
    if (value.pricingMode === "margen" && value.marginPct === undefined) {
      ctx.addIssue({ code: "custom", message: "Escribe el margen" });
    }
  });

export type PublishStagedProductInput = z.infer<
  typeof publishStagedProductSchema
>;
