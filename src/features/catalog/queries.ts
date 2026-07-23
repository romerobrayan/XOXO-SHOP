import "server-only";

import type {
  BrandSummary,
  CategorySummary,
  ProductCardDTO,
  ProductDetailDTO,
} from "./dto";
import { toProductCard, toProductDetail } from "./dto";
import { fixtureBrands, fixtureCategories, fixtureProducts } from "./fixtures";
import { productCardInclude, productDetailInclude } from "./shapes";

// Read paths — server-only, called directly from RSC. Every function returns
// DTOs, never Prisma rows: the DTO layer is what keeps stockOnHand out of the
// storefront (CLAUDE.md).
//
// Phase 0 runs without a database: when DATABASE_URL is absent, every query
// answers from fixtures with the exact same payload shape. `@/lib/db` is
// imported dynamically inside the live branch only — the module constructs the
// Prisma client at load time, so it must never load during a database-less
// build or Vercel preview render.
const useFixtures = !process.env.DATABASE_URL;
const loadDb = async () => (await import("@/lib/db")).db;

export type CatalogFilters = {
  categorySlug?: string;
  brandSlug?: string;
};

export async function getProducts(
  filters: CatalogFilters = {},
): Promise<ProductCardDTO[]> {
  if (useFixtures) {
    return fixtureProducts
      .filter(
        (p) => !filters.categorySlug || p.category?.slug === filters.categorySlug,
      )
      .filter((p) => !filters.brandSlug || p.brand?.slug === filters.brandSlug)
      .map(toProductCard);
  }
  const db = await loadDb();
  const products = await db.product.findMany({
    where: {
      status: "ACTIVE",
      ...(filters.categorySlug
        ? { category: { slug: filters.categorySlug } }
        : {}),
      ...(filters.brandSlug ? { brand: { slug: filters.brandSlug } } : {}),
    },
    include: productCardInclude,
    orderBy: { publishedAt: "desc" },
  });
  return products.map(toProductCard);
}

export async function getProductBySlug(
  slug: string,
): Promise<ProductDetailDTO | null> {
  if (useFixtures) {
    const product = fixtureProducts.find((p) => p.slug === slug);
    return product ? toProductDetail(product) : null;
  }
  const db = await loadDb();
  const product = await db.product.findUnique({
    where: { slug },
    include: productDetailInclude,
  });
  return product && product.status === "ACTIVE"
    ? toProductDetail(product)
    : null;
}

export async function getBrands(): Promise<BrandSummary[]> {
  if (useFixtures) {
    return [...fixtureBrands]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((b) => ({
        id: b.id,
        name: b.name,
        slug: b.slug,
        productCount: fixtureProducts.filter((p) => p.brandId === b.id).length,
      }));
  }
  const db = await loadDb();
  const brands = await db.brand.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: { select: { products: { where: { status: "ACTIVE" } } } },
    },
  });
  return brands.map((b) => ({
    id: b.id,
    name: b.name,
    slug: b.slug,
    productCount: b._count.products,
  }));
}

export async function getCategories(): Promise<CategorySummary[]> {
  if (useFixtures) {
    return fixtureCategories.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      productCount: fixtureProducts.filter((p) => p.categoryId === c.id).length,
    }));
  }
  const db = await loadDb();
  const categories = await db.category.findMany({
    orderBy: { position: "asc" },
    include: {
      _count: { select: { products: { where: { status: "ACTIVE" } } } },
    },
  });
  return categories.map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    productCount: c._count.products,
  }));
}
