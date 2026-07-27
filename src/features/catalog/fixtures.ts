// Local catalog data for running without a database — Phase 0 deploys to a
// Vercel preview with no DATABASE_URL. The products themselves are declared in
// demo-catalog.ts, the same module prisma/seed.ts writes to Postgres; this file
// only shapes them into the Prisma payloads the live queries return, so pages
// cannot tell the two sources apart. parity.test.ts proves they don't.
import type { Prisma } from "@/generated/prisma/client";
import {
  demoBrands,
  demoCategories,
  demoProducts,
  type DemoProduct,
} from "./demo-catalog";
import { computeOptionKey } from "./optionKey";
import type { ProductDetailPayload } from "./shapes";

// Seed uses dates relative to the run; fixtures pin them so ordering is stable.
const T0 = new Date("2026-07-19T12:00:00Z");
const daysAgo = (n: number) => new Date(T0.getTime() - n * 24 * 60 * 60 * 1000);

type BrandRow = Prisma.BrandGetPayload<Record<string, never>>;
type CategoryRow = Prisma.CategoryGetPayload<Record<string, never>>;

export const fixtureBrands: BrandRow[] = demoBrands.map((b) => ({
  id: b.id,
  name: b.name,
  slug: b.slug,
  logoUrl: null,
}));

export const fixtureCategories: CategoryRow[] = demoCategories.map(
  (c, position) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    position,
    parentId: null,
    createdAt: T0,
    updatedAt: T0,
  }),
);

const brandById = new Map(fixtureBrands.map((b) => [b.id, b]));
const categoryById = new Map(fixtureCategories.map((c) => [c.id, c]));

function build(seed: DemoProduct): ProductDetailPayload {
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
    // No product photography exists yet — the storefront renders
    // ProductImagePlaceholder while this is empty. See CLAUDE.md, "Images".
    media: [],
  };
}

// Ordered newest-first, matching `orderBy: { publishedAt: "desc" }`.
export const fixtureProducts: ProductDetailPayload[] = demoProducts.map(build);
