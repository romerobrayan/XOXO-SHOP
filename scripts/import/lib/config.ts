// CLI-side configuration: where the pipeline touches disk. Everything the
// panel also needs (suppliers, taxonomy, brands, colors, rate limits) moved
// to src/features/import/config.ts — one source for CLI and panel.
import path from "node:path";

/** Everything under data/ is git-ignored: staging dumps are regenerable
 * third-party data. The curation decision lives in scripts/import/seleccion.json,
 * which IS committed. */
export const DATA_DIR = path.join(process.cwd(), "data", "import");

export const SELECCION_PATH = path.join(
  process.cwd(),
  "scripts",
  "import",
  "seleccion.json",
);
