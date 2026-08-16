import { NextResponse } from "next/server";

import { applyPaymentEvent } from "@/features/orders/payment-events";
import { db } from "@/lib/db";
import { getPaymentProvider } from "@/payments";

// Payment webhook endpoint. The provider adapter verifies the signature —
// every gateway signs differently — and normalizes the event; what the event
// MEANS (idempotent PENDING→PAID through the state machine, never twice, and
// never a stock movement — see payment-events.ts) is the orders feature's
// decision, not this route's. Wompi documents that the browser redirect must
// never be trusted as confirmation: this endpoint is the only place an
// online payment becomes real.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params;
  const paymentProvider = getPaymentProvider();

  if (provider !== paymentProvider.name) {
    return NextResponse.json({ error: "Unknown provider" }, { status: 404 });
  }

  // The fixtures-only preview has no orders to settle. 503 (not 200) keeps
  // the gateway retrying and makes the misconfiguration visible in its
  // dashboard instead of silently swallowing real money events.
  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      { error: "No database in this environment" },
      { status: 503 },
    );
  }

  const rawBody = await request.text();
  const event = await paymentProvider.verifyWebhook(rawBody, request.headers);

  if (!event) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // Throws (→ 500) on infrastructure failure, and the gateway retries — the
  // function is idempotent precisely so retries are always safe.
  const result = await applyPaymentEvent(db, paymentProvider.name, event);

  if (result.outcome === "unknown_reference") {
    // Initiation writes the Payment row before the buyer can reach the
    // gateway, so this is another environment's event (shared sandbox keys,
    // wrong events URL) — worth a trace, not worth infinite retries.
    console.warn(
      `[webhook:${paymentProvider.name}] event for unknown reference ${event.providerReference}`,
    );
  } else if (result.outcome === "paid_after_cancelled") {
    console.error(
      `[webhook:${paymentProvider.name}] APPROVED payment for cancelled order ${result.orderNumber}: ` +
        "money received but the reservation was already released. Refund or " +
        "re-confirm manually from the panel.",
    );
  }

  return NextResponse.json({ received: true, outcome: result.outcome });
}
