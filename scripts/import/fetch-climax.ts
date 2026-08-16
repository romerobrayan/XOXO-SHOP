// Download the Climax catalog (Shopify's public /products.json — allowed by
// their robots.txt) and normalize it into the staging area. Read-only against
// the supplier; writes only under data/import/.
//
//   npm run import:climax               full catalog (~376 products, 2 pages)
//   npm run import:climax -- --limit 50       smoke test
import { SUPPLIERS } from "../../src/features/import/config";
import { fetchJson } from "../../src/features/import/http";
import { normalizeClimax, type ShopifyProduct } from "./lib/normalize-climax";
import { rawPath, writeJson, writeStaging } from "./lib/staging";
import { summarizeStaging } from "./lib/summary";

const PER_PAGE = 250; // Shopify's maximum
const MAX_PAGES = 40; // hard stop well above the observed catalog size

function argValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const limit = argValue("--limit") ? Number(argValue("--limit")) : Infinity;
  const base = SUPPLIERS.climax.baseUrl;

  console.log(`Fetching ${SUPPLIERS.climax.label}…`);
  const raw: ShopifyProduct[] = [];
  for (let page = 1; page <= MAX_PAGES && raw.length < limit; page++) {
    const { products } = await fetchJson<{ products: ShopifyProduct[] }>(
      `${base}/products.json?limit=${PER_PAGE}&page=${page}`,
    );
    if (products.length === 0) break;
    raw.push(...products);
    console.log(`  page ${page} — ${raw.length} so far`);
  }
  const sliced = raw.slice(0, limit === Infinity ? raw.length : limit);

  writeJson(rawPath("climax"), sliced);

  const warnings: string[] = [];
  const staged = sliced.map((p) => normalizeClimax(p, (w) => warnings.push(w)));
  const outPath = writeStaging("climax", staged);

  summarizeStaging(staged, warnings);
  console.log(`\nStaging written to ${outPath}`);
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
