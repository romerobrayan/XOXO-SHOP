import "server-only";

import { db } from "@/lib/db";

// Read paths — server-only, called directly from RSC.

export async function getProducts() {
  return db.product.findMany({
    where: { status: "ACTIVE" },
    include: {
      brand: true,
      category: true,
      images: { orderBy: { position: "asc" }, take: 1 },
    },
    orderBy: { publishedAt: "desc" },
  });
}

export async function getProductBySlug(slug: string) {
  return db.product.findUnique({
    where: { slug },
    include: {
      brand: true,
      category: true,
      options: {
        orderBy: { position: "asc" },
        include: { values: { orderBy: { position: "asc" } } },
      },
      variants: {
        where: { isActive: true },
        include: { optionValues: true },
      },
      specs: { orderBy: { position: "asc" } },
      images: { orderBy: { position: "asc" } },
    },
  });
}
