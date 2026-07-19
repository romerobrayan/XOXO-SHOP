import { z } from "zod";

// Zod schemas are the single source of truth for catalog input types.
// Admin CRUD schemas land in Sprint 2; these cover the read paths.

export const productFiltersSchema = z.object({
  category: z.string().optional(),
  brand: z.string().optional(),
  inStockOnly: z.boolean().default(false),
});

export type ProductFilters = z.infer<typeof productFiltersSchema>;
