// The staging shape: everything a supplier publishes, normalized to one
// structure, BEFORE any of it touches the catalog. The fetch scripts write it
// (files under data/import/ + rows in SupplierStagingProduct via
// `npm run import:stage`), the curator reads it, and promote-core turns the
// approved ones into real products.
//
// Supplier prices are REFERENCE data. Climax is simultaneously a supplier and
// a retail competitor in Medellín, and DistriSex publishes wholesale prices —
// neither is the client's sale price. The sale price is decided at publish
// time (panel) or promote time (CLI seleccion.json).
//
// The shape is a Zod schema, not just a type: staged products cross real
// boundaries — JSON files from disk, a Json column read back from Postgres —
// and every boundary validates (CLAUDE.md rule 7).
import { z } from "zod";
import { CATEGORIES, type CategorySlug } from "./config";
import { normalizeKey } from "./normalize";

export const STAGING_FORMAT_VERSION = 1;

const categorySlugs = CATEGORIES.map((c) => c.slug) as [
  CategorySlug,
  ...CategorySlug[],
];

export const stagedOptionValueSchema = z.object({
  value: z.string().min(1),
  hex: z.string().nullable(),
});

export const stagedOptionSchema = z.object({
  name: z.string().min(1),
  values: z.array(stagedOptionValueSchema),
});

export const stagedVariantSchema = z.object({
  /** Supplier's own id for the variant (Woo variation id / Shopify variant id). */
  supplierVariantId: z.string(),
  sku: z.string().nullable(),
  /** Option name → value. Empty object for the option-less singleton variant.
   * Woo can mark a variation's attribute as "any" (null) — those entries are
   * dropped here, and promote-core discards variations left incomplete by it
   * (they are unsellable duplicates, not real combinations). */
  options: z
    .record(z.string(), z.string().nullable())
    .transform((rec) =>
      Object.fromEntries(
        Object.entries(rec).filter(
          (entry): entry is [string, string] => entry[1] !== null,
        ),
      ),
    ),
  /** Minor units (COP cents). Reference only — never the sale price. */
  supplierPriceCents: z.number().int().min(0),
  supplierCompareAtCents: z.number().int().nullable(),
  /** Supplier availability — reference only; the client's stock is her own. */
  available: z.boolean(),
});

export const stagedImageSchema = z.object({
  url: z.string().min(1),
  /** Set when the supplier ties the image to an option value (color photos). */
  optionValue: z
    .object({ option: z.string(), value: z.string() })
    .nullable(),
  position: z.number().int(),
});

export const stagedProductSchema = z.object({
  supplierRef: z
    .string()
    .regex(/^(distrisex|climax):.+$/, "supplierRef must be namespaced")
    // promote-core copies this straight into Product.supplierRef, which is
    // VARCHAR(80). Catch an over-long ref here, where the error names the
    // product, instead of at the Postgres write where it names a column.
    .max(80, "supplierRef must be at most 80 characters"),
  supplier: z.enum(["distrisex", "climax"]),
  supplierUrl: z.string(),
  name: z.string().min(1),
  descriptionText: z.string(),
  brand: z.string().nullable(),
  supplierCategories: z.array(z.string()),
  tags: z.array(z.string()),
  suggestedCategorySlug: z.enum(categorySlugs).nullable(),
  /** Minimum variant price — the number the margin applies to by default. */
  supplierPriceCents: z.number().int().min(0),
  /** DistriSex sometimes prints "Precio sugerido" (suggested retail) in the
   * short description — a real pricing hint from a wholesaler, kept verbatim. */
  suggestedRetailCents: z.number().int().nullable(),
  /** Woo lists variations without their own prices; when the supplier signals
   * a price range, promote fetches each variation before writing. */
  priceVariesByVariant: z.boolean(),
  options: z.array(stagedOptionSchema),
  specs: z.array(z.object({ label: z.string(), value: z.string() })),
  images: z.array(stagedImageSchema),
  /** At least one, always — option-less products get the singleton variant. */
  variants: z.array(stagedVariantSchema).min(1),
});

export type StagedOptionValue = z.infer<typeof stagedOptionValueSchema>;
export type StagedOption = z.infer<typeof stagedOptionSchema>;
export type StagedVariant = z.infer<typeof stagedVariantSchema>;
export type StagedImage = z.infer<typeof stagedImageSchema>;
export type StagedProduct = z.infer<typeof stagedProductSchema>;

/** The haystack the curator's search matches against — normalizeKey'd so
 * "lenceria" finds "Lencería" regardless of accents or case. */
export function stagingSearchText(staged: StagedProduct): string {
  return normalizeKey(
    [staged.name, staged.brand ?? "", ...staged.supplierCategories].join(" "),
  );
}
