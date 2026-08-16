// No "server-only" marker here, deliberately: createOrder's test imports the
// action, which imports this. The module still never reaches a client bundle
// — its only importers are the server action and server components.
import { db } from "@/lib/db";
import { requestOrigin } from "@/lib/origin";
import type { CreatePaymentResult, PaymentProvider } from "@/payments";

// Assembling the gateway link is deliberately separate from recording the
// attempt: createOrder needs both (build + Payment row), while the return
// page re-derives the link for "Reintentar el pago" during render, where a
// database write would be a side effect of a GET.

export type OnlinePayableOrder = {
  id: string;
  orderNumber: string;
  totalCents: number;
  guestEmail: string | null;
  reservationExpiresAt: Date | null;
};

/**
 * Builds the signed gateway link for an order. Deterministic on purpose:
 * same reference, amount and stored expiry produce a byte-identical URL, so
 * retries and the return page always hand the buyer the same link.
 */
export async function buildGatewayCheckout(
  provider: PaymentProvider,
  order: OnlinePayableOrder,
): Promise<CreatePaymentResult> {
  const origin = await requestOrigin();
  return provider.createPayment({
    orderId: order.id,
    orderNumber: order.orderNumber,
    amountCents: order.totalCents,
    currency: "COP",
    customerEmail: order.guestEmail ?? "",
    redirectUrl: `${origin}/checkout/gracias?pedido=${encodeURIComponent(order.orderNumber)}`,
    // The link dies when the reservation does: the gateway refuses money for
    // stock the sweep already released.
    expiresAt: order.reservationExpiresAt ?? undefined,
  });
}

/**
 * Builds the link AND records the attempt. providerReference is
 * deterministic (derived from the order number), so the upsert IS the
 * idempotency: a retried checkout re-derives the same signed link instead of
 * writing a second Payment row. The row goes in with method null — the
 * gateway's checkout picks the actual rail (CARD / PSE / NEQUI) and its
 * webhook records it (spec §2); inventing one here would put a wrong rail in
 * the panel.
 */
export async function initiateOnlinePayment(
  provider: PaymentProvider,
  order: OnlinePayableOrder,
): Promise<string> {
  const payment = await buildGatewayCheckout(provider, order);
  await db.payment.upsert({
    where: { providerReference: payment.providerReference },
    create: {
      orderId: order.id,
      provider: provider.name,
      providerReference: payment.providerReference,
      status: "PENDING",
      amountCents: order.totalCents,
    },
    update: {},
  });
  return payment.checkoutUrl;
}
