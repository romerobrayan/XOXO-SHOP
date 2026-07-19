// The canonical Prisma include shapes for catalog reads, shared by the live
// queries and the fixtures so both produce byte-identical structures. These
// payload types never leave the data layer — the storefront consumes the DTOs
// in dto.ts, which strip stockOnHand/stockReserved (see CLAUDE.md).
import type { Prisma } from "@/generated/prisma/client";

export const productCardInclude = {
  brand: true,
  category: true,
  options: {
    orderBy: { position: "asc" },
    include: { values: { orderBy: { position: "asc" } } },
  },
  variants: { where: { isActive: true } },
  media: { orderBy: { position: "asc" }, take: 1 },
} as const satisfies Prisma.ProductInclude;

export const productDetailInclude = {
  brand: true,
  category: true,
  options: {
    orderBy: { position: "asc" },
    include: { values: { orderBy: { position: "asc" } } },
  },
  variants: { where: { isActive: true }, include: { optionValues: true } },
  specs: { orderBy: { position: "asc" } },
  media: { orderBy: { position: "asc" } },
} as const satisfies Prisma.ProductInclude;

export type ProductCardPayload = Prisma.ProductGetPayload<{
  include: typeof productCardInclude;
}>;

export type ProductDetailPayload = Prisma.ProductGetPayload<{
  include: typeof productDetailInclude;
}>;
