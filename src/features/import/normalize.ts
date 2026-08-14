// Normalization helpers shared by both supplier adapters. Everything here is
// pure — no I/O — so the adapters stay testable against saved payloads.
import {
  CATEGORY_RULES,
  COLOR_HEX,
  KNOWN_BRANDS,
  NOISE_CATEGORIES,
  type CategorySlug,
} from "./config";

/** lowercase + diacritics stripped — the comparison key for names and colors. */
export function normalizeKey(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

export function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n: string) =>
      String.fromCodePoint(parseInt(n, 16)),
    )
    .replace(/&nbsp;/gi, " ")
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&amp;/gi, "&");
}

/** Supplier descriptions arrive as HTML; the catalog stores plain text.
 * Block-level closers become line breaks, list items become dashes. */
export function stripHtml(html: string): string {
  const text = html
    .replace(/<\s*(script|style)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
    .replace(/<\s*li[^>]*>/gi, "\n- ")
    .replace(/<\s*(br|\/p|\/div|\/h[1-6]|\/li|\/tr|\/ul|\/ol)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, "");
  return decodeEntities(text)
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Swatch hex for color-like option values; null keeps the picker on text
 * chips, which is always safe. */
export function hexForColor(optionName: string, value: string): string | null {
  if (!/color/i.test(optionName)) return null;
  return COLOR_HEX[normalizeKey(value)] ?? null;
}

/** First category rule that matches any candidate string, in candidate order.
 * Noise categories ("Todo", "Liquidación"…) never vote. */
export function suggestCategory(candidates: string[]): CategorySlug | null {
  for (const candidate of candidates) {
    if (!candidate || NOISE_CATEGORIES.test(candidate)) continue;
    for (const rule of CATEGORY_RULES) {
      if (rule.match.test(candidate)) return rule.slug;
    }
  }
  return null;
}

/** Map a raw brand string to its canonical casing; ALL-CAPS strangers get
 * title case ("NITROSX" → "Nitrosx"), anything else stays verbatim. */
export function canonicalizeBrand(raw: string): string {
  const key = normalizeKey(raw);
  for (const brand of KNOWN_BRANDS) {
    if (normalizeKey(brand) === key) return brand;
  }
  const trimmed = raw.trim();
  if (trimmed.length > 3 && trimmed === trimmed.toUpperCase()) {
    return trimmed
      .toLowerCase()
      .replace(/(^|\s)\p{L}/gu, (c) => c.toUpperCase());
  }
  return trimmed;
}

/** Find a known brand mentioned in free text (titles, tags). */
export function detectBrand(texts: string[]): string | null {
  const haystack = normalizeKey(texts.join(" "));
  for (const brand of KNOWN_BRANDS) {
    const needle = normalizeKey(brand);
    const re = new RegExp(`(^|[^\\p{L}])${needle}([^\\p{L}]|$)`, "u");
    if (re.test(haystack)) return brand;
  }
  return null;
}

/** Woo Store API prices are strings in the currency's MINOR units —
 * `currency_minor_unit: 0` for COP, so "80000" means $80.000. The project
 * stores cents, so the factor is 10^(2 - minorUnit). */
export function wooPriceToCents(price: string, minorUnit: number): number {
  const n = Number(price);
  if (!Number.isFinite(n)) throw new Error(`Unparseable Woo price: "${price}"`);
  return Math.round(n * 10 ** (2 - minorUnit));
}

/** Shopify prices are decimal strings in whole currency units: "80000.00". */
export function shopifyPriceToCents(price: string): number {
  const n = Number(price);
  if (!Number.isFinite(n)) {
    throw new Error(`Unparseable Shopify price: "${price}"`);
  }
  return Math.round(n * 100);
}

/** "Precio sugerido … $10,000" hidden in DistriSex short descriptions — a
 * wholesaler's suggested retail, worth keeping as a pricing hint. */
export function parseSuggestedRetailCents(shortDescriptionHtml: string): number | null {
  const text = stripHtml(shortDescriptionHtml);
  const m = text.match(/precio\s+sugerido[^0-9$]*\$?\s*([\d.,]+)/i);
  if (!m) return null;
  const cop = Number(m[1].replace(/[.,]/g, ""));
  if (!Number.isFinite(cop) || cop < 1_000 || cop > 5_000_000) return null;
  return cop * 100;
}
