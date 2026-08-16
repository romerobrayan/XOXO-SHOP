import {
  commitSale,
  releaseStock,
  returnStock,
} from "@/features/checkout/stock";
import type { Prisma } from "@/generated/prisma/client";
import type { OrderStatus } from "@/generated/prisma/enums";
import { findTransition } from "./transitions";

// The one place a declared transition is EXECUTED: compare-and-set on the
// status the caller saw, then the machine's stock effect, inside the caller's
// transaction. The admin panel and the payment webhook both come through
// here, so "what does moving an order do to the ledger" keeps having exactly
// one answer — transitions.ts declares it, this file applies it, and neither
// caller can drift from the other.

export type ApplyTransitionResult =
  | { won: true }
  // Someone else moved the order first — an expiry sweep, a webhook, another
  // tab. The caller decides whether that is an error (panel) or idempotent
  // success (webhook); this function only reports what it found.
  | { won: false; currentStatus: OrderStatus | "UNKNOWN" };

export async function applyOrderTransition(
  tx: Prisma.TransactionClient,
  orderId: string,
  from: OrderStatus,
  to: OrderStatus,
): Promise<ApplyTransitionResult> {
  const transition = findTransition(from, to);
  if (!transition) {
    // Callers validate the pair before starting a transaction (the panel
    // returns NOT_ALLOWED, the webhook uses a fixed pair the tests pin), so
    // reaching this is a programming error, not an input error.
    throw new Error(`Transition ${from} → ${to} is not declared`);
  }

  // Compare-and-set on `from`: the reservation-expiry sweep cancels PENDING
  // orders on its own schedule and webhook retries race each other, so a
  // transition decided against a stale status must update zero rows and
  // touch nothing — applying its stock effect anyway would double-move.
  const won = await tx.order.updateMany({
    where: { id: orderId, status: from },
    data: {
      status: to,
      // A cancelled, paid or shipped order has nothing left to expire;
      // leaving the timestamp set would let the sweep pick it up again.
      reservationExpiresAt: to === "PENDING" ? undefined : null,
      ...(to === "PAID" ? { paidAt: new Date() } : {}),
      ...(to === "SHIPPED" ? { shippedAt: new Date() } : {}),
    },
  });

  if (won.count === 0) {
    const current = await tx.order.findUnique({
      where: { id: orderId },
      select: { status: true },
    });
    return { won: false, currentStatus: current?.status ?? "UNKNOWN" };
  }

  if (transition.effect !== "none") {
    const items = await tx.orderItem.findMany({
      where: { orderId },
      select: { variantId: true, quantity: true },
    });
    // variantId is SetNull if the variant was deleted; there is no balance
    // left to move for those lines.
    const lines = items
      .filter((i): i is { variantId: string; quantity: number } =>
        Boolean(i.variantId),
      )
      .map((i) => ({ variantId: i.variantId, qty: i.quantity }));

    if (lines.length > 0) {
      if (transition.effect === "release") {
        await releaseStock(tx, orderId, lines, `cancelled from ${from}`);
      } else if (transition.effect === "commit") {
        await commitSale(tx, orderId, lines);
      } else {
        await returnStock(tx, orderId, lines, "refunded");
      }
    }
  }

  return { won: true };
}
