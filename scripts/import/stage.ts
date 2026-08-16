// Load the staging JSON dumps into the SupplierStagingProduct table — the
// staging the DEPLOYED panel curator reads (/admin/proveedores). Files stay
// the fetch scripts' output; this moves them where a deployment can see them.
//
//   npm run import:stage              → local Docker database
//   npm run import:stage -- --neon    → Neon, so the deployed panel can curate
//
// Same guardrail as the promote: local by default, Neon only with an explicit
// flag. Re-running upserts by supplierRef — curation state (status,
// publishedProductId) is deliberately never touched by an update, so
// re-staging after a fresh fetch cannot un-publish anything.
import "dotenv/config";
import {
  stagedProductSchema,
  stagingSearchText,
  type StagedProduct,
} from "../../src/features/import/staging";
import { createImportDb, resolveDatabaseUrl } from "./lib/db";
import { readStaging } from "./lib/staging";

const CONCURRENCY = 8;

async function main() {
  const useNeon = process.argv.includes("--neon");
  const { url, host } = resolveDatabaseUrl(useNeon);
  console.log(
    `Staging table → ${host}` + (useNeon ? "  [NEON — explicit]" : "  [local]"),
  );

  const db = createImportDb(url);
  try {
    await db.$queryRaw`SELECT 1`;
  } catch {
    throw new Error(
      `Cannot reach the database at ${host}. Local? Start it: docker compose up -d --wait`,
    );
  }

  const totals = { created: 0, updated: 0, invalid: 0, stale: 0 };
  try {
    for (const supplier of ["distrisex", "climax"] as const) {
      const file = readStaging(supplier);
      console.log(
        `\n${supplier}: ${file.productCount} product(s), fetched ${file.fetchedAt}`,
      );
      const fetchedAt = new Date(file.fetchedAt);

      const existing = new Set(
        (
          await db.supplierStagingProduct.findMany({
            where: { supplier },
            select: { supplierRef: true },
          })
        ).map((r) => r.supplierRef),
      );

      const valid: StagedProduct[] = [];
      for (const raw of file.products) {
        const parsed = stagedProductSchema.safeParse(raw);
        if (!parsed.success) {
          totals.invalid++;
          const ref =
            typeof raw === "object" && raw !== null && "supplierRef" in raw
              ? String((raw as { supplierRef: unknown }).supplierRef)
              : "(sin ref)";
          console.log(
            `  ⚠ ${ref}: no pasa el esquema de staging — ${parsed.error.issues[0]?.message ?? "inválido"}`,
          );
          continue;
        }
        valid.push(parsed.data);
      }

      let cursor = 0;
      await Promise.all(
        Array.from({ length: CONCURRENCY }, async () => {
          while (cursor < valid.length) {
            const p = valid[cursor++];
            const row = {
              supplier: p.supplier,
              name: p.name,
              brand: p.brand,
              suggestedCategorySlug: p.suggestedCategorySlug,
              supplierPriceCents: p.supplierPriceCents,
              suggestedRetailCents: p.suggestedRetailCents,
              priceVariesByVariant: p.priceVariesByVariant,
              optionCount: p.options.length,
              imageCount: p.images.length,
              previewImageUrl: p.images[0]?.url ?? null,
              available: p.variants.some((v) => v.available),
              payload: p,
              searchText: stagingSearchText(p),
              fetchedAt,
            };
            await db.supplierStagingProduct.upsert({
              where: { supplierRef: p.supplierRef },
              create: { supplierRef: p.supplierRef, ...row },
              update: row,
            });
            if (existing.has(p.supplierRef)) totals.updated++;
            else totals.created++;
          }
        }),
      );

      // Rows the supplier no longer publishes: reported, never deleted — a
      // PUBLISHED row is curation history, and a vanished supplier listing is
      // a conversation, not an automatic wipe.
      const fresh = new Set(valid.map((p) => p.supplierRef));
      const stale = [...existing].filter((ref) => !fresh.has(ref));
      totals.stale += stale.length;
      if (stale.length > 0) {
        console.log(
          `  ${stale.length} fila(s) ya no aparecen en el proveedor (se conservan)`,
        );
      }
    }
  } finally {
    await db.$disconnect();
  }

  console.log(
    `\nDone. ${totals.created} created, ${totals.updated} updated` +
      (totals.invalid ? ` · ${totals.invalid} invalid` : "") +
      (totals.stale ? ` · ${totals.stale} stale kept` : ""),
  );
}

main().catch((e: unknown) => {
  console.error(`\nStage FAILED: ${e instanceof Error ? e.message : e}`);
  process.exit(1);
});
