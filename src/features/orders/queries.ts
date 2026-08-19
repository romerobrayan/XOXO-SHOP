import "server-only";

import { db } from "@/lib/db";
import type { OrderStatus } from "@/generated/prisma/enums";

// Read paths for the admin panel. Unlike the storefront's catalog queries
// these have no fixtures fallback: the panel is meaningless without a
// database, and a fixtures "order list" would invite the owner to act on
// orders that do not exist.

export const ORDER_PAGE_SIZE = 25;

export type OrderListItem = Awaited<ReturnType<typeof listOrders>>[number];
export type OrderDetail = NonNullable<Awaited<ReturnType<typeof getOrder>>>;

export async function listOrders(status?: OrderStatus) {
  return db.order.findMany({
    where: status ? { status } : undefined,
    orderBy: { createdAt: "desc" },
    take: ORDER_PAGE_SIZE,
    select: {
      id: true,
      orderNumber: true,
      status: true,
      totalCents: true,
      createdAt: true,
      address: { select: { fullName: true, city: true } },
      payments: { select: { method: true, status: true } },
      _count: { select: { items: true } },
    },
  });
}

export async function countByStatus() {
  const rows = await db.order.groupBy({
    by: ["status"],
    _count: { _all: true },
  });
  return new Map(rows.map((r) => [r.status, r._count._all]));
}

export async function getOrder(orderNumber: string) {
  return db.order.findUnique({
    where: { orderNumber },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      subtotalCents: true,
      shippingCents: true,
      shippingZoneName: true,
      discountCents: true,
      totalCents: true,
      discreetPackaging: true,
      reservationExpiresAt: true,
      createdAt: true,
      paidAt: true,
      shippedAt: true,
      guestEmail: true,
      guestPhone: true,
      // Snapshots, deliberately: an order shows what was bought at the time,
      // never a join back into the live catalog (CLAUDE.md rule 4).
      items: {
        select: {
          id: true,
          productName: true,
          brandName: true,
          variantSku: true,
          variantLabel: true,
          unitPriceCents: true,
          quantity: true,
          totalCents: true,
        },
      },
      address: {
        select: {
          fullName: true,
          phone: true,
          documentType: true,
          documentId: true,
          department: true,
          city: true,
          line1: true,
          neighborhood: true,
          notes: true,
        },
      },
      payments: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          provider: true,
          method: true,
          status: true,
          amountCents: true,
          proofOfPaymentUrl: true,
          verifiedAt: true,
          createdAt: true,
        },
      },
    },
  });
}
