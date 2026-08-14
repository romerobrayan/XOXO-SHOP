// CLI-side staging I/O: the git-ignored JSON dumps under data/import/ and the
// committed curation file (seleccion.json). The staging SHAPE — schema and
// types — lives in src/features/import/staging.ts, shared with the panel;
// this module only owns reading and writing files.
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import {
  CATEGORIES,
  type CategorySlug,
  type Supplier,
} from "../../../src/features/import/config";
import {
  STAGING_FORMAT_VERSION,
  type StagedProduct,
} from "../../../src/features/import/staging";
import { DATA_DIR, SELECCION_PATH } from "./config";

// Re-exported so the fetch normalizers and the summary keep their historical
// import path.
export type {
  StagedImage,
  StagedOption,
  StagedOptionValue,
  StagedProduct,
  StagedVariant,
} from "../../../src/features/import/staging";

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
