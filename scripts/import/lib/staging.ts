// The staging area: everything a supplier publishes, normalized to one shape,
// BEFORE any of it touches the catalog. Curation happens on top of these files
// (see seleccion.json); promote.ts only ever reads what was approved.
//
// Supplier prices are REFERENCE data. Climax is simultaneously a supplier and
// a retail competitor in Medellín, and DistriSex publishes wholesale prices —
// neither is the client's sale price. The sale price is decided at promote
// time from seleccion.json (per-product override or configured margin).
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import {
  CATEGORIES,
  DATA_DIR,
  SELECCION_PATH,
  type CategorySlug,
  type Supplier,
} from "./config";

export const STAGING_FORMAT_VERSION = 1;

export type StagedOptionValue = { value: string; hex: string | null };
export type StagedOption = { name: string; values: StagedOptionValue[] };

export type StagedVariant = {
  /** Supplier's own id for the variant (Woo variation id / Shopify variant id). */
  supplierVariantId: string;
  sku: string | null;
  /** Option name → value. Empty object for the option-less singleton variant. */
  options: Record<string, string>;
  /** Minor units (COP cents). Reference only — never the sale price. */
  supplierPriceCents: number;
  supplierCompareAtCents: number | null;
  /** Supplier availability — reference only; the client's stock is her own. */
  available: boolean;
};

export type StagedImage = {
  url: string;
  /** Set when the supplier ties the image to an option value (color photos). */
  optionValue: { option: string; value: string } | null;
  position: number;
};

export type StagedProduct = {
  supplierRef: string; // "distrisex:99363" | "climax:liguero-lucy-rojo"
  supplier: Supplier;
  supplierUrl: string;
  name: string;
  descriptionText: string;
  brand: string | null;
  supplierCategories: string[];
  tags: string[];
  suggestedCategorySlug: CategorySlug | null;
  /** Minimum variant price — the number the margin applies to by default. */
  supplierPriceCents: number;
  /** DistriSex sometimes prints "Precio sugerido" (suggested retail) in the
   * short description — a real pricing hint from a wholesaler, kept verbatim. */
  suggestedRetailCents: number | null;
  /** Woo lists variations without their own prices; when the supplier signals
   * a price range, promote.ts fetches each variation before writing. */
  priceVariesByVariant: boolean;
  options: StagedOption[];
  specs: { label: string; value: string }[];
  images: StagedImage[];
  /** At least one, always — option-less products get the singleton variant. */
  variants: StagedVariant[];
};

export type StagingFile = {
  formatVersion: number;
  supplier: Supplier;
  fetchedAt: string;
  productCount: number;
  products: StagedProduct[];
};

export function stagingPath(supplier: Supplier): string {
  return path.join(DATA_DIR, `staging-${supplier}.json`);
}

export function rawPath(supplier: Supplier): string {
  return path.join(DATA_DIR, `raw-${supplier}.json`);
}

export function writeJson(filePath: string, data: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 1));
}

export function writeStaging(
  supplier: Supplier,
  products: StagedProduct[],
): string {
  const file: StagingFile = {
    formatVersion: STAGING_FORMAT_VERSION,
    supplier,
    fetchedAt: new Date().toISOString(),
    productCount: products.length,
    products,
  };
  const p = stagingPath(supplier);
  writeJson(p, file);
  return p;
}

export function readStaging(supplier: Supplier): StagingFile {
  const p = stagingPath(supplier);
  if (!fs.existsSync(p)) {
    throw new Error(
      `Missing ${p}. Run \`npm run import:${supplier}\` first — staging is the input to everything else.`,
    );
  }
  const file = JSON.parse(fs.readFileSync(p, "utf8")) as StagingFile;
  if (file.formatVersion !== STAGING_FORMAT_VERSION) {
    throw new Error(
      `${p} has format v${file.formatVersion}, expected v${STAGING_FORMAT_VERSION}. Re-run the fetch.`,
    );
  }
  return file;
}

/** Both staging files indexed by supplierRef. Missing files throw with the
 * command that produces them. */
export function readAllStaged(): Map<string, StagedProduct> {
  const map = new Map<string, StagedProduct>();
  for (const supplier of ["distrisex", "climax"] as const) {
    for (const p of readStaging(supplier).products) map.set(p.supplierRef, p);
  }
  return map;
}

// ─── seleccion.json — the curation boundary ─────────────────
// Validated with Zod like every other boundary in the project (CLAUDE.md).

const categorySlugs = CATEGORIES.map((c) => c.slug) as [
  CategorySlug,
  ...CategorySlug[],
];

export const approvedEntrySchema = z.object({
  supplierRef: z
    .string()
    .regex(/^(distrisex|climax):.+$/, "supplierRef must be namespaced, e.g. climax:liguero-lucy-rojo"),
  /** Sale price in whole COP (not cents) — the file is edited by humans.
   * Omitted → margin over the supplier price. */
  salePriceCOP: z.number().int().positive().optional(),
  categorySlug: z.enum(categorySlugs).optional(),
  brand: z.string().min(1).optional(),
  /** Opening stock for NEW variants, written through the inventory ledger.
   * Existing variants never have their stock touched by the import. */
  initialStock: z.number().int().min(0).optional(),
  note: z.string().optional(),
});

export const seleccionSchema = z.object({
  _ayuda: z.array(z.string()).optional(),
  pricing: z.object({
    /** Percentage margin over the supplier price, per supplier. Business
     * decision pending with the client — these are working defaults. */
    marginPct: z.object({
      distrisex: z.number().min(0).max(500),
      climax: z.number().min(0).max(500),
    }),
    /** Sale prices round UP to this COP step (500 → $45.230 becomes $45.500). */
    roundUpToCOP: z.number().int().positive(),
  }),
  approved: z.array(approvedEntrySchema),
});

export type Seleccion = z.infer<typeof seleccionSchema>;
export type ApprovedEntry = z.infer<typeof approvedEntrySchema>;

export function readSeleccion(): Seleccion {
  if (!fs.existsSync(SELECCION_PATH)) {
    throw new Error(`Missing ${SELECCION_PATH} — it should be committed.`);
  }
  const parsed = seleccionSchema.safeParse(
    JSON.parse(fs.readFileSync(SELECCION_PATH, "utf8")),
  );
  if (!parsed.success) {
    throw new Error(
      `seleccion.json is invalid:\n${parsed.error.issues
        .map((i) => `  ${i.path.join(".")}: ${i.message}`)
        .join("\n")}`,
    );
  }
  const refs = parsed.data.approved.map((a) => a.supplierRef);
  const dupes = refs.filter((r, i) => refs.indexOf(r) !== i);
  if (dupes.length) {
    throw new Error(`seleccion.json lists duplicated refs: ${dupes.join(", ")}`);
  }
  return parsed.data;
}
