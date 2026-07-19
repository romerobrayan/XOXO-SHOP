// Local catalog data for running without a database — Phase 0 deploys to a
// Vercel preview with no DATABASE_URL. Exact mirror of prisma/seed.ts (same
// products, prices, stock, and slugs) typed as the same Prisma payloads the
// live queries return, so pages cannot tell the two sources apart.
import type { Prisma } from "@/generated/prisma/client";
import { computeOptionKey } from "./optionKey";
import type { ProductDetailPayload } from "./shapes";

// Seed uses relative dates; fixtures pin them so ordering is stable.
const T0 = new Date("2026-07-19T12:00:00Z");
const daysAgo = (n: number) => new Date(T0.getTime() - n * 24 * 60 * 60 * 1000);

type BrandRow = Prisma.BrandGetPayload<Record<string, never>>;
type CategoryRow = Prisma.CategoryGetPayload<Record<string, never>>;

export const fixtureBrands: BrandRow[] = [
  { id: "brand-lovense", name: "Lovense", slug: "lovense", logoUrl: null },
  { id: "brand-sen-intimo", name: "Sen Intimo", slug: "sen-intimo", logoUrl: null },
  { id: "brand-pretty-love", name: "Pretty Love", slug: "pretty-love", logoUrl: null },
];

export const fixtureCategories: CategoryRow[] = [
  {
    id: "cat-lenceria",
    name: "Lencería",
    slug: "lenceria",
    position: 0,
    parentId: null,
    createdAt: T0,
    updatedAt: T0,
  },
  {
    id: "cat-cosmetica",
    name: "Cosmética íntima",
    slug: "cosmetica-intima",
    position: 1,
    parentId: null,
    createdAt: T0,
    updatedAt: T0,
  },
  {
    id: "cat-jugueteria",
    name: "Juguetería y dispositivos",
    slug: "jugueteria-y-dispositivos",
    position: 2,
    parentId: null,
    createdAt: T0,
    updatedAt: T0,
  },
];

const brandById = new Map(fixtureBrands.map((b) => [b.id, b]));
const categoryById = new Map(fixtureCategories.map((c) => [c.id, c]));

type OptionSeed = {
  id: string;
  name: string;
  values: { id: string; value: string; hex?: string }[];
};

type VariantSeed = {
  id: string;
  sku: string;
  priceCents: number;
  compareAtCents?: number;
  stockOnHand: number;
  valueIds?: string[];
};

type ProductSeed = {
  id: string;
  slug: string;
  name: string;
  description: string;
  publishedDaysAgo: number;
  supplierRef?: string;
  brandId?: string;
  categoryId: string;
  minPriceCents: number;
  options?: OptionSeed[];
  specs?: { label: string; value: string }[];
  variants: VariantSeed[];
};

function build(seed: ProductSeed): ProductDetailPayload {
  const publishedAt = daysAgo(seed.publishedDaysAgo);
  return {
    id: seed.id,
    slug: seed.slug,
    name: seed.name,
    description: seed.description,
    status: "ACTIVE",
    supplierRef: seed.supplierRef ?? null,
    brandId: seed.brandId ?? null,
    brand: seed.brandId ? (brandById.get(seed.brandId) ?? null) : null,
    categoryId: seed.categoryId,
    category: categoryById.get(seed.categoryId) ?? null,
    minPriceCents: seed.minPriceCents,
    createdAt: publishedAt,
    updatedAt: publishedAt,
    publishedAt,
    options: (seed.options ?? []).map((o, oIdx) => ({
      id: o.id,
      productId: seed.id,
      name: o.name,
      position: oIdx,
      values: o.values.map((v, vIdx) => ({
        id: v.id,
        optionId: o.id,
        value: v.value,
        hex: v.hex ?? null,
        position: vIdx,
      })),
    })),
    variants: seed.variants.map((v) => ({
      id: v.id,
      productId: seed.id,
      sku: v.sku,
      priceCents: v.priceCents,
      compareAtCents: v.compareAtCents ?? null,
      barcode: null,
      optionKey: computeOptionKey(v.valueIds ?? []),
      stockOnHand: v.stockOnHand,
      stockReserved: 0,
      lowStockAt: 3,
      isActive: true,
      createdAt: publishedAt,
      updatedAt: publishedAt,
      optionValues: (v.valueIds ?? []).map((optionValueId) => ({
        variantId: v.id,
        optionValueId,
      })),
    })),
    specs: (seed.specs ?? []).map((s, i) => ({
      id: `${seed.id}-spec-${i}`,
      productId: seed.id,
      label: s.label,
      value: s.value,
      position: i,
    })),
    media: [],
  };
}

// Ordered newest-first, matching `orderBy: { publishedAt: "desc" }`.
export const fixtureProducts: ProductDetailPayload[] = [
  // ── Two axes: Talla × Color, sparse variant space, one combo sold out ────
  build({
    id: "prod-conjunto-tiras",
    slug: "conjunto-tiras",
    name: "Conjunto Tiras",
    description:
      "Conjunto de dos piezas en tiras elásticas ajustables. Tejido suave con elastano. Lavar a mano con agua fría.",
    publishedDaysAgo: 0,
    supplierRef: "11362",
    categoryId: "cat-lenceria",
    minPriceCents: 45_000_00,
    options: [
      {
        id: "opt-tiras-talla",
        name: "Talla",
        values: [
          { id: "val-tiras-s", value: "S" },
          { id: "val-tiras-m", value: "M" },
          { id: "val-tiras-l", value: "L" },
          { id: "val-tiras-xl", value: "XL" },
        ],
      },
      {
        id: "opt-tiras-color",
        name: "Color",
        values: [
          { id: "val-tiras-negro", value: "Negro", hex: "#1A1A1A" },
          { id: "val-tiras-rojo", value: "Rojo", hex: "#C0182B" },
        ],
      },
    ],
    specs: [
      { label: "Material", value: "Tejido con elastano" },
      { label: "Piezas", value: "2" },
      { label: "Cuidado", value: "Lavar a mano con agua fría" },
    ],
    variants: [
      { id: "var-tiras-s-negro", sku: "11362-S-NEGRO", priceCents: 45_000_00, stockOnHand: 4, valueIds: ["val-tiras-s", "val-tiras-negro"] },
      { id: "var-tiras-m-negro", sku: "11362-M-NEGRO", priceCents: 45_000_00, stockOnHand: 6, valueIds: ["val-tiras-m", "val-tiras-negro"] },
      { id: "var-tiras-l-negro", sku: "11362-L-NEGRO", priceCents: 45_000_00, stockOnHand: 0, valueIds: ["val-tiras-l", "val-tiras-negro"] },
      { id: "var-tiras-xl-negro", sku: "11362-XL-NEGRO", priceCents: 45_000_00, stockOnHand: 2, valueIds: ["val-tiras-xl", "val-tiras-negro"] },
      { id: "var-tiras-m-rojo", sku: "11362-M-ROJO", priceCents: 45_000_00, stockOnHand: 3, valueIds: ["val-tiras-m", "val-tiras-rojo"] },
    ],
  }),

  // ── One axis: Presentación, price varies per variant ─────────────────────
  build({
    id: "prod-sen-desensibilizante",
    slug: "sen-intimo-desensibilizante",
    name: "Sen Intimo Desensibilizante",
    description:
      "Gel desensibilizante de uso externo. Aplicar la cantidad indicada y esperar unos minutos antes del contacto. No contiene fragancia.",
    publishedDaysAgo: 1,
    brandId: "brand-sen-intimo",
    categoryId: "cat-cosmetica",
    minPriceCents: 45_000_00,
    options: [
      {
        id: "opt-des-presentacion",
        name: "Presentación",
        values: [
          { id: "val-des-30ml", value: "30 ml" },
          { id: "val-des-130ml", value: "130 ml" },
        ],
      },
    ],
    specs: [
      { label: "Uso", value: "Externo" },
      { label: "Base", value: "Agua" },
    ],
    variants: [
      { id: "var-des-30ml", sku: "SEN-DES-30ML", priceCents: 45_000_00, stockOnHand: 8, valueIds: ["val-des-30ml"] },
      { id: "var-des-130ml", sku: "SEN-DES-130ML", priceCents: 80_000_00, stockOnHand: 5, valueIds: ["val-des-130ml"] },
    ],
  }),

  // ── Zero axes: single SKU, exactly one variant by construction ───────────
  build({
    id: "prod-lovense-lush-3",
    slug: "lovense-lush-3",
    name: "Lovense Lush 3",
    description:
      "Dispositivo controlado por aplicación vía Bluetooth. Batería recargable por USB con hasta 5 horas de uso continuo. Lavar con agua tibia y jabón neutro antes y después de cada uso.",
    publishedDaysAgo: 2,
    brandId: "brand-lovense",
    categoryId: "cat-jugueteria",
    minPriceCents: 120_000_00,
    specs: [
      { label: "Material", value: "Silicona médica" },
      { label: "Conectividad", value: "Bluetooth" },
      { label: "Batería", value: "Recargable USB" },
      { label: "Resistente al agua", value: "Sí (IPX7)" },
    ],
    variants: [
      { id: "var-lush3", sku: "LOV-LUSH3", priceCents: 120_000_00, stockOnHand: 3 },
    ],
  }),

  // ── One axis (color swatches), on promotion, one color sold out ──────────
  build({
    id: "prod-pl-huevo",
    slug: "pretty-love-huevo-vibrador",
    name: "Pretty Love Huevo Vibrador",
    description:
      "Huevo vibrador con control remoto inalámbrico. 12 modos de vibración. Incluye batería. Material libre de ftalatos.",
    publishedDaysAgo: 3,
    brandId: "brand-pretty-love",
    categoryId: "cat-jugueteria",
    minPriceCents: 60_000_00,
    options: [
      {
        id: "opt-huevo-color",
        name: "Color",
        values: [
          { id: "val-huevo-rosa", value: "Rosa", hex: "#E86FA8" },
          { id: "val-huevo-morado", value: "Morado", hex: "#7C4FA8" },
        ],
      },
    ],
    specs: [
      { label: "Material", value: "Silicona" },
      { label: "Modos", value: "12 vibraciones" },
    ],
    variants: [
      { id: "var-huevo-rosa", sku: "PL-HUEVO-ROSA", priceCents: 60_000_00, compareAtCents: 75_000_00, stockOnHand: 6, valueIds: ["val-huevo-rosa"] },
      { id: "var-huevo-morado", sku: "PL-HUEVO-MORADO", priceCents: 60_000_00, compareAtCents: 75_000_00, stockOnHand: 0, valueIds: ["val-huevo-morado"] },
    ],
  }),

  // ── One axis, on promotion: second lencería so related products render ───
  build({
    id: "prod-conjunto-encaje",
    slug: "conjunto-encaje",
    name: "Conjunto Encaje",
    description:
      "Conjunto de dos piezas en encaje con forro suave. Copa sin varilla y tiras ajustables. Lavar a mano con agua fría y secar a la sombra.",
    publishedDaysAgo: 4,
    supplierRef: "11417",
    categoryId: "cat-lenceria",
    minPriceCents: 55_000_00,
    options: [
      {
        id: "opt-encaje-talla",
        name: "Talla",
        values: [
          { id: "val-encaje-s", value: "S" },
          { id: "val-encaje-m", value: "M" },
          { id: "val-encaje-l", value: "L" },
        ],
      },
    ],
    specs: [
      { label: "Material", value: "Encaje con forro" },
      { label: "Color", value: "Negro" },
      { label: "Cuidado", value: "Lavar a mano con agua fría" },
    ],
    variants: [
      { id: "var-encaje-s", sku: "11417-S", priceCents: 55_000_00, compareAtCents: 65_000_00, stockOnHand: 5, valueIds: ["val-encaje-s"] },
      { id: "var-encaje-m", sku: "11417-M", priceCents: 55_000_00, compareAtCents: 65_000_00, stockOnHand: 4, valueIds: ["val-encaje-m"] },
      { id: "var-encaje-l", sku: "11417-L", priceCents: 55_000_00, compareAtCents: 65_000_00, stockOnHand: 6, valueIds: ["val-encaje-l"] },
    ],
  }),

  // ── Zero axes, fully sold out: the PLP "Agotado" card state ──────────────
  build({
    id: "prod-pl-anillo",
    slug: "pretty-love-anillo-vibrador",
    name: "Pretty Love Anillo Vibrador",
    description:
      "Anillo con vibración de un solo botón. Material flexible libre de ftalatos. Batería incluida. Lavar con agua tibia y jabón neutro antes y después de cada uso.",
    publishedDaysAgo: 5,
    brandId: "brand-pretty-love",
    categoryId: "cat-jugueteria",
    minPriceCents: 45_000_00,
    specs: [
      { label: "Material", value: "TPE libre de ftalatos" },
      { label: "Batería", value: "Incluida" },
    ],
    variants: [
      { id: "var-anillo", sku: "PL-ANILLO", priceCents: 45_000_00, stockOnHand: 0 },
    ],
  }),
];
