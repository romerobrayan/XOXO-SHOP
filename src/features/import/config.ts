// Shared configuration for the supplier import pipeline — the parts both the
// CLI scripts (scripts/import/, run with tsx) and the admin panel's curator
// need. Filesystem paths (staging dumps, seleccion.json) stay in
// scripts/import/lib/config.ts: only the CLI touches disk.
//
// Both suppliers granted permission to use their photos and data; the
// User-Agent below is deliberately identifiable so they can see who calls.

export const USER_AGENT =
  "SecretoBoutique-CatalogImport/1.0 (+https://secretxoxo-shop.vercel.app; contacto: brayaniselrey09@gmail.com)";

/** Minimum gap between consecutive requests to the same host. */
export const RATE_LIMIT_MS = 700;

export type Supplier = "distrisex" | "climax";

export const SUPPLIERS: Record<Supplier, { label: string; baseUrl: string }> = {
  distrisex: {
    label: "DistriSex Colombia (WooCommerce)",
    baseUrl: "https://distrisexcolombia.com",
  },
  climax: {
    label: "Climax (Shopify)",
    baseUrl: "https://climax.com.co",
  },
};

// ─── Project taxonomy ────────────────────────────────────────
// The three storefront categories, matching demo-catalog.ts IDs and slugs so a
// seeded database and a fresh one converge on the same rows.
export const CATEGORIES = [
  { id: "cat-lenceria", name: "Lencería", slug: "lenceria" },
  { id: "cat-cosmetica", name: "Cosmética íntima", slug: "cosmetica-intima" },
  {
    id: "cat-jugueteria",
    name: "Juguetería y dispositivos",
    slug: "jugueteria-y-dispositivos",
  },
] as const;

export type CategorySlug = (typeof CATEGORIES)[number]["slug"];

// First match wins, evaluated against supplier category names / product_type /
// product name, in that order. A miss leaves the category for curation.
export const CATEGORY_RULES: Array<{ match: RegExp; slug: CategorySlug }> = [
  {
    match:
      /lencer|liguero|babydoll|body\b|corset|cors[eé]|disfra|medias|brasier|panty|cachetero|conjunto|portaligas|catsuit/i,
    slug: "lenceria",
  },
  {
    match:
      /lubric|aceite|gel\b|cosm[eé]t|estimulant|retardant|potencial|shot|elixir|feromona|desensib|higien|limpiador|comestible|sabor|masaje|cream|crema|potenciador|vigorizante|suplemento/i,
    slug: "cosmetica-intima",
  },
  {
    match:
      /juguete|vibrador|dildo|masturbador|anillo|plug|bala|huevo|bondage|arn[eé]s|succi[oó]n|realista|lovense|satisfyer|bomba|prost[aá]t|consolador|l[aá]tigo|esposas|columpio|mu[nñ]ec|str[ao]p|rotador|extensi[oó]n|funda|vagina|lencer[oó]metro/i,
    slug: "jugueteria-y-dispositivos",
  },
];

/** Supplier categories that carry no taxonomy signal (merchandising noise). */
export const NOISE_CATEGORIES =
  /^(todo|liquidaci[oó]n|dcto|descuento|ofertas?|nuevo|new|destacad)/i;

// ─── Brands ──────────────────────────────────────────────────
// Canonical casing for brands seen across both suppliers. Detection: DistriSex
// carries a per-product "Marca" attribute; Climax hides brands in titles/tags
// (its `vendor` is mostly the Shopify default "My Store"). Curation can always
// override per product.
export const KNOWN_BRANDS = [
  "Lovense",
  "Pretty Love",
  "Satisfyer",
  "Kiiroo",
  "Lerot",
  "Camtoyz",
  "Evolved",
  "Sen Intimo",
  "Erotic Mist",
  "Climax",
] as const;

/** Exact-match (case/diacritics-insensitive) swatch colors for option values.
 * Unknown colors stay hex-less: the picker renders a text chip instead. */
export const COLOR_HEX: Record<string, string> = {
  negro: "#1A1A1A",
  blanco: "#F5F5F5",
  rojo: "#C0182B",
  rosa: "#E86FA8",
  rosado: "#E86FA8",
  fucsia: "#D5327D",
  morado: "#7C4FA8",
  lila: "#B48CC8",
  purpura: "#7C4FA8",
  azul: "#3B5BA5",
  "azul claro": "#7FA7D8",
  verde: "#587A4F",
  amarillo: "#E8C547",
  naranja: "#E07A3F",
  dorado: "#C9A96E",
  plateado: "#C0C0C0",
  gris: "#808080",
  cafe: "#6F4E37",
  vinotinto: "#5C1A2E",
  beige: "#D9B99B",
  nude: "#D9B99B",
  piel: "#D9B99B",
  transparente: "#EDEDED",
};
