import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import type { CategorySlug, Supplier } from "./config";
import { normalizeKey } from "./normalize";
import { stagedProductSchema, type StagedProduct } from "./staging";

// Curator reads. Like the rest of the panel: no fixtures fallback — curating
// a staging that is not in a database is not a thing. The staging is internal
// working material; nothing here is ever imported by the storefront.

export const STAGING_PAGE_SIZE = 24;

export type StagingListFilters = {
  q?: string;
  supplier?: Supplier;
  categoria?: CategorySlug | "sin-categoria";
  estado: "pendientes" | "publicados" | "todos";
  page: number;
};

export type StagingListItem = Awaited<
  ReturnType<typeof listStagedProducts>
>["items"][number];

export async function listStagedProducts(filters: StagingListFilters) {
  const where: Prisma.SupplierStagingProductWhereInput = {};
  if (filters.supplier) where.supplier = filters.supplier;
  if (filters.categoria === "sin-categoria") where.suggestedCategorySlug = null;
  else if (filters.categoria) where.suggestedCategorySlug = filters.categoria;
  if (filters.estado === "pendientes") where.status = "PENDING";
  else if (filters.estado === "publicados") where.status = "PUBLISHED";
  if (filters.q?.trim()) {
    where.searchText = { contains: normalizeKey(filters.q) };
  }

  const [total, items] = await Promise.all([
    db.supplierStagingProduct.count({ where }),
    db.supplierStagingProduct.findMany({
      where,
      orderBy: [{ name: "asc" }, { id: "asc" }],
      skip: (filters.page - 1) * STAGING_PAGE_SIZE,
      take: STAGING_PAGE_SIZE,
      select: {
        id: true,
        supplierRef: true,
        supplier: true,
        name: true,
        brand: true,
        suggestedCategorySlug: true,
        supplierPriceCents: true,
        priceVariesByVariant: true,
        optionCount: true,
        imageCount: true,
        previewImageUrl: true,
        available: true,
        status: true,
        publishedProductId: true,
      },
    }),
  ]);

  return {
    items,
    total,
    page: filters.page,
    pageCount: Math.max(1, Math.ceil(total / STAGING_PAGE_SIZE)),
  };
}

/** Counts for the estado tabs — how much curation work remains is the number
 * the owner opens this screen to see. */
export async function stagingStatusCounts() {
  const groups = await db.supplierStagingProduct.groupBy({
    by: ["status"],
    _count: { _all: true },
  });
  const of = (status: "PENDING" | "PUBLISHED") =>
    groups.find((g) => g.status === status)?._count._all ?? 0;
  return {
    pendientes: of("PENDING"),
    publicados: of("PUBLISHED"),
    total: of("PENDING") + of("PUBLISHED"),
  };
}

export type StagedProductDetail = NonNullable<
  Awaited<ReturnType<typeof getStagedProduct>>
>;

export async function getStagedProduct(id: string) {
  const row = await db.supplierStagingProduct.findUnique({
    where: { id },
    include: {
      publishedProduct: {
        select: { id: true, slug: true, name: true, status: true },
      },
    },
  });
  if (!row) return null;

  // The payload crossed a boundary (Postgres Json) — validate before anyone
  // trusts it. A failed parse is shown honestly instead of half-rendering.
  const parsed = stagedProductSchema.safeParse(row.payload);
  const staged: StagedProduct | null = parsed.success ? parsed.data : null;
  return {
    ...row,
    staged,
    payloadError: parsed.success
      ? null
      : (parsed.error.issues[0]?.message ?? "payload inválido"),
  };
}
