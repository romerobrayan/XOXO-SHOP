import "server-only";

import { db } from "@/lib/db";
import type { OrderStatus, PaymentStatus } from "@/generated/prisma/enums";

// Read path for the payment return page (/checkout/gracias). Deliberately
// minimal: the page is reachable by anyone holding the order number, so it
// exposes state and totals — never a name, an address or the items. The
// number itself is the capability, same as quoting it on WhatsApp.

export type OrderPaymentSummary = {
  id: string;
  orderNumber: string;
  orderStatus: OrderStatus;
  totalCents: number;
  guestEmail: string | null;
  reservationExpiresAt: Date | null;
  /**
   * The reservation still holds, so re-deriving the payment link makes
   * sense. Computed here, against the request clock, because render is not
   * allowed to ask what time it is (react-hooks/purity).
   */
  stillPayable: boolean;
  gatewayPayment: { provider: string; status: PaymentStatus } | null;
};

export async function getOrderPaymentSummary(
  orderNumber: string,
): Promise<OrderPaymentSummary | null> {
  // Fixtures-only preview: no orders exist to summarize.
  if (!process.env.DATABASE_URL) return null;

  const order = await db.order.findUnique({
    where: { orderNumber },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      totalCents: true,
      guestEmail: true,
      reservationExpiresAt: true,
      payments: {
        // Gateway attempts carry a providerReference; contra entrega's
        // "manual" row does not. This page only reports the gateway.
        where: { providerReference: { not: null } },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { provider: true, status: true },
      },
    },
  });
  if (!order) return null;

  return {
    id: order.id,
    orderNumber: order.orderNumber,
    orderStatus: order.status,
    totalCents: order.totalCents,
    guestEmail: order.guestEmail,
    reservationExpiresAt: order.reservationExpiresAt,
    stillPayable:
      order.status === "PENDING" &&
      order.reservationExpiresAt !== null &&
      order.reservationExpiresAt.getTime() > Date.now(),
    gatewayPayment: order.payments[0] ?? null,
  };
}
