// Download the DistriSex catalog (WooCommerce Store API — public, allowed by
// their robots.txt) and normalize it into the staging area. Read-only against
// the supplier; writes only under data/import/.
//
//   npm run import:distrisex            full catalog (~900 products, 9 pages)
//   npm run import:distrisex -- --limit 50    smoke test
import { SUPPLIERS } from "./lib/config";
import { fetchJsonWithHeaders } from "./lib/http";
import {
  normalizeDistrisex,
  type WooProduct,
} from "./lib/normalize-distrisex";
import { rawPath, writeJson, writeStaging } from "./lib/staging";
import { summarizeStaging } from "./lib/summary";

const PER_PAGE = 100;

function argValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const limit = argValue("--limit") ? Number(argValue("--limit")) : Infinity;
  const base = `${SUPPLIERS.distrisex.baseUrl}/wp-json/wc/store/v1/products`;
  // orderby=id keeps pagination stable if products are published mid-fetch.
  const url = (page: number) =>
    `${base}?per_page=${PER_PAGE}&page=${page}&orderby=id&order=asc`;

  console.log(`Fetching ${SUPPLIERS.distrisex.label}…`);
  const first = await fetchJsonWithHeaders<WooProduct[]>(url(1));
  const totalPages = Number(first.headers.get("x-wp-totalpages") ?? "1");
  const total = Number(first.headers.get("x-wp-total") ?? "?");
  console.log(`  ${total} products across ${totalPages} pages of ${PER_PAGE}`);

  const raw: WooProduct[] = [...first.data];
  for (let page = 2; page <= totalPages && raw.length < limit; page++) {
    const { data } = await fetchJsonWithHeaders<WooProduct[]>(url(page));
    raw.push(...data);
    console.log(`  page ${page}/${totalPages} — ${raw.length} so far`);
  }
  const sliced = raw.slice(0, limit === Infinity ? raw.length : limit);

  writeJson(rawPath("distrisex"), sliced);

  const warnings: string[] = [];
  const staged = sliced.map((p) =>
    normalizeDistrisex(p, (w) => warnings.push(w)),
  );
  const outPath = writeStaging("distrisex", staged);

  summarizeStaging(staged, warnings);
  console.log(`\nStaging written to ${outPath}`);
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
