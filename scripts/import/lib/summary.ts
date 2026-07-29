// Post-fetch report: what landed in staging, so curation starts from numbers
// instead of opening the JSON. Pure console output.
import { formatCOP } from "../../../src/lib/money";
import type { StagedProduct } from "./staging";

function histogram(values: (string | null)[]): [string, number][] {
  const counts = new Map<string, number>();
  for (const v of values) {
    const key = v ?? "(sin asignar)";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

export function summarizeStaging(
  staged: StagedProduct[],
  warnings: string[],
): void {
  console.log(`\nStaged ${staged.length} products.`);

  console.log("\nSuggested category:");
  for (const [name, n] of histogram(staged.map((p) => p.suggestedCategorySlug)))
    console.log(`  ${String(n).padStart(4)}  ${name}`);

  const brands = histogram(staged.map((p) => p.brand));
  console.log(`\nBrands detected (top 12 of ${brands.length}):`);
  for (const [name, n] of brands.slice(0, 12))
    console.log(`  ${String(n).padStart(4)}  ${name}`);

  const withOptions = staged.filter((p) => p.options.length > 0).length;
  const priceVaries = staged.filter((p) => p.priceVariesByVariant).length;
  const noImages = staged.filter((p) => p.images.length === 0).length;
  const unavailable = staged.filter(
    (p) => !p.variants.some((v) => v.available),
  ).length;
  const prices = staged.map((p) => p.supplierPriceCents).sort((a, b) => a - b);
  const mid = prices[Math.floor(prices.length / 2)] ?? 0;

  console.log(`\nWith options: ${withOptions} · price varies by variant: ${priceVaries}`);
  console.log(`Without images: ${noImages} · fully unavailable at supplier: ${unavailable}`);
  if (prices.length > 0) {
    console.log(
      `Supplier price range: ${formatCOP(prices[0])} – ${formatCOP(prices[prices.length - 1])} (median ${formatCOP(mid)})`,
    );
  }

  if (warnings.length > 0) {
    console.log(`\n${warnings.length} warnings:`);
    for (const w of warnings.slice(0, 20)) console.log(`  ⚠ ${w}`);
    if (warnings.length > 20)
      console.log(`  … and ${warnings.length - 20} more`);
  }
}
