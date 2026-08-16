import "server-only";

import { db } from "@/lib/db";

// Admin-side reads. Like the orders panel, no fixtures fallback: managing a
// catalog that is not in a database is not a thing. And unlike the
// storefront's catalog queries these expose stockOnHand/stockReserved —
// that rule guards the storefront, not the owner counting her own shelf.

export type AdminProductListItem = Awaited<
  ReturnType<typeof listAdminProducts>
>[number];
export type AdminProductDetail = NonNullable<
  Awaited<ReturnType<typeof getAdminProduct>>
>;

export async function listAdminProducts() {
  return db.product.findMany({
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      slug: true,
      status: true,
      minPriceCents: true,
      brand: { select: { name: true } },
      category: { select: { name: true } },
      variants: {
        select: {
          stockOnHand: true,
          stockReserved: true,
          lowStockAt: true,
          isActive: true,
        },
      },
    },
  });
}

export async function getAdminProduct(productId: string) {
  const product = await db.product.findUnique({
    where: { id: productId },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      status: true,
      supplierRef: true,
      brandId: true,
      categoryId: true,
      media: {
        orderBy: [{ position: "asc" }, { id: "asc" }],
        select: {
          id: true,
          url: true,
          alt: true,
          position: true,
          type: true,
          posterUrl: true,
        },
      },
      options: {
        orderBy: { position: "asc" },
        select: {
          id: true,
          name: true,
          values: {
            orderBy: { position: "asc" },
            select: { id: true, value: true, hex: true },
          },
        },
      },
      variants: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          sku: true,
          priceCents: true,
          compareAtCents: true,
          stockOnHand: true,
          stockReserved: true,
          lowStockAt: true,
          isActive: true,
          optionValues: {
            select: {
              optionValue: {
                select: { id: true, value: true, option: { select: { name: true } } },
              },
            },
          },
          _count: { select: { orderItems: true, movements: true } },
        },
      },
    },
  });
  if (!product) return null;
  return {
    ...product,
    // Whether ANY variant carries history. Real deletion exists only for a
    // product nobody ever ordered or counted — everything else archives.
    hasHistory: product.variants.some(
      (v) => v._count.orderItems > 0 || v._count.movements > 0,
    ),
  };
}

export async function listBrandAndCategoryChoices() {
  const [brands, categories] = await Promise.all([
    db.brand.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    db.category.findMany({
      orderBy: { position: "asc" },
      select: { id: true, name: true },
    }),
  ]);
  return { brands, categories };
}
