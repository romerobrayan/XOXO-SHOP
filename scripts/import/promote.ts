// Promote APPROVED staging entries into the real catalog — a thin CLI over
// the shared core in src/features/import/promote-core.ts, which is the SAME
// code the panel curator runs on "Publicar". This wrapper only owns the CLI
// concerns: seleccion.json, the staging files, flags, and the database
// guardrail.
//
//   npm run import:promote                       against the LOCAL database
//   npm run import:promote -- --refs climax:liguero-lucy-rojo,distrisex:17382
//   npm run import:promote -- --update-prices    re-apply pricing to existing variants
//   npm run import:promote -- --neon             ONLY once the client approved staging
import "dotenv/config";
import {
  ensureCatalogCategories,
  promoteStagedProduct,
} from "../../src/features/import/promote-core";
import { stagedProductSchema } from "../../src/features/import/staging";
import { assertCloudinaryConfigured } from "../../src/lib/cloudinary";
import { formatCOP } from "../../src/lib/money";
import { createImportDb, resolveDatabaseUrl } from "./lib/db";
import { readAllStaged, readSeleccion } from "./lib/staging";

const args = process.argv.slice(2);
const hasFlag = (f: string) => args.includes(f);
const argValue = (f: string): string | undefined => {
  const i = args.indexOf(f);
  return i >= 0 ? args[i + 1] : undefined;
};

async function main() {
  const useNeon = hasFlag("--neon");
  const updatePrices = hasFlag("--update-prices");
  const onlyRefs = argValue("--refs")
    ?.split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const seleccion = readSeleccion();
  const staged = readAllStaged();
  const entries = seleccion.approved.filter(
    (e) => !onlyRefs || onlyRefs.includes(e.supplierRef),
  );
  if (entries.length === 0) {
    throw new Error("Nothing to promote — check seleccion.json / --refs.");
  }

  // Fail fast on credentials before any database write.
  const { cloudName } = assertCloudinaryConfigured();
  const { url, host } = resolveDatabaseUrl(useNeon);
  console.log(
    `Promoting ${entries.length} approved product(s) → ${host}` +
      (useNeon ? "  [NEON — explicit]" : "  [local]") +
      `  · images → Cloudinary "${cloudName}"`,
  );

  const db = createImportDb(url);
  try {
    await db.$queryRaw`SELECT 1`;
  } catch {
    throw new Error(
      `Cannot reach the database at ${host}. Local? Start it: docker compose up -d --wait`,
    );
  }

  const totals = {
    created: 0,
    updated: 0,
    variantsCreated: 0,
    variantsKept: 0,
    imagesUploaded: 0,
    imagesReused: 0,
    warnings: 0,
  };
  try {
    await ensureCatalogCategories(db);

    for (const entry of entries) {
      const raw = staged.get(entry.supplierRef);
      if (!raw) {
        throw new Error(
          `${entry.supplierRef} is approved but not in staging — re-run the fetch (npm run import:distrisex / import:climax).`,
        );
      }
      // The staging files are a boundary like any other: validate before the
      // core trusts the shape (same schema the panel runs on its Json column).
      const parsed = stagedProductSchema.safeParse(raw);
      if (!parsed.success) {
        throw new Error(
          `${entry.supplierRef} does not pass the staging schema (${parsed.error.issues[0]?.message}). Re-run the fetch.`,
        );
      }
      const product = parsed.data;
      console.log(`\n${product.supplierRef} — ${product.name}`);
      const outcome = await promoteStagedProduct(db, {
        staged: product,
        entry,
        pricing: seleccion.pricing,
        updatePrices,
      });
      for (const w of outcome.warnings) console.log(`  ⚠ ${w}`);
      totals[outcome.action]++;
      totals.variantsCreated += outcome.variantsCreated;
      totals.variantsKept += outcome.variantsKept;
      totals.imagesUploaded += outcome.imagesUploaded;
      totals.imagesReused += outcome.imagesReused;
      totals.warnings += outcome.warnings.length;
      console.log(
        `  ${outcome.action} /producto/${outcome.slug} · ${
          outcome.variantsCreated + outcome.variantsKept
        } variant(s) · desde ${formatCOP(outcome.minPriceCents)}`,
      );
    }
  } finally {
    await db.$disconnect();
  }

  console.log(
    `\nDone. Products: ${totals.created} created, ${totals.updated} updated · ` +
      `variants: ${totals.variantsCreated} created, ${totals.variantsKept} kept · ` +
      `images: ${totals.imagesUploaded} uploaded, ${totals.imagesReused} already hosted` +
      (totals.warnings ? ` · ${totals.warnings} warning(s)` : ""),
  );
}

main().catch((e: unknown) => {
  console.error(`\nPromote FAILED: ${e instanceof Error ? e.message : e}`);
  process.exit(1);
});
