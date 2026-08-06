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
  return db.product.findUnique({
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
        },
      },
    },
  });
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
