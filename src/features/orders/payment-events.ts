import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import type { PaymentStatus } from "@/generated/prisma/enums";
import type { WebhookEvent } from "@/payments";
import { applyOrderTransition } from "./apply-transition";

// Applies a VERIFIED gateway event to the order it references. The adapter
// already proved the signature; this file decides what the event means for
// Payment and Order — and it has to keep meaning the same thing when Wompi
// delivers the event two, three or N times, concurrently and out of order,
// because it does.
//
// On APPROVED the order moves PENDING → PAID **through the state machine**,
// which declares that move's stock effect is "none": the reservation keeps
// holding the units (the sweep only expires PENDING) and the sale commits
// exactly once at PROCESSING → SHIPPED, the invariant transitions.test.ts
// pins ("consumes the reservation only when shipping"). A webhook that
// called commitSale here would consume the reservation early and break both
// "Marcar enviado" (double commit) and "Cancelar" (release with nothing
// reserved) for every gateway-paid order.
//
// Idempotency is two compare-and-sets, not a dedup table:
//   Payment: APPROVED is terminal — every write is guarded by
//            `status: { not: "APPROVED" }`, so a duplicate approval or a
//            late, out-of-order DECLINED from an earlier attempt on the same
//            reference updates zero rows and stops.
//   Order:   the PENDING → PAID flip is the same conditional updateMany the
//            panel and the expiry sweep use; whoever loses the race sees
//            count 0 and touches nothing.

export type PaymentEventOutcome =
  // No Payment row carries this reference for this provider. Initiation
  // writes the row before the customer ever reaches the gateway, so a legit
  // event always finds it — this is another environment's event or a
  // misconfigured panel URL. Logged by the route; acknowledged so the
  // gateway stops retrying something that will never match.
  | { outcome: "unknown_reference" }
  // The APPROVED event won: payment approved, order flipped to PAID.
  | { outcome: "order_paid"; orderNumber: string }
  // Nothing left to do — a retry of an event that already landed, or an
  // advisor marked the order paid from the panel before the webhook arrived.
  | { outcome: "already_processed"; orderNumber: string }
  // Money confirmed for an order the expiry sweep had already cancelled and
  // released. The payment row records the truth (the money moved); stock is
  // NOT touched — those units may be sold. A human refunds or re-confirms
  // from the panel. The route logs this loudly.
  | { outcome: "paid_after_cancelled"; orderNumber: string }
  // A non-approved status (DECLINED / VOIDED / ERROR / PENDING) recorded on
  // the payment row. The order is not touched: the buyer can retry from the
  // same link, and the reservation expiry already handles abandonment.
  | { outcome: "recorded"; orderNumber: string; status: PaymentStatus };

export async function applyPaymentEvent(
  db: PrismaClient,
  providerName: string,
  event: WebhookEvent,
): Promise<PaymentEventOutcome> {
  return db.$transaction(async (tx) => {
    const payment = await tx.payment.findUnique({
      where: { providerReference: event.providerReference },
      select: {
        id: true,
        provider: true,
        status: true,
        order: { select: { id: true, orderNumber: true } },
      },
    });

    // The provider check closes a cross-adapter collision: references are
    // only guaranteed unique per gateway, and an event must never settle a
    // payment that a different provider owns.
    if (!payment || payment.provider !== providerName) {
      return { outcome: "unknown_reference" };
    }

    const { orderNumber } = payment.order;

    // Every payment write is a CAS away from APPROVED. The early read above
    // can be stale under concurrent deliveries; this guard cannot be.
    const paymentUpdate = {
      status: event.status,
      // The rail (tarjeta / Nequi / PSE) is informative — it labels the
      // panel; it never decides anything. Unknown rails stay null.
      ...(event.method ? { method: event.method } : {}),
      rawPayload: event.rawPayload as Prisma.InputJsonValue,
    };

    if (event.status !== "APPROVED") {
      const recorded = await tx.payment.updateMany({
        where: { id: payment.id, status: { not: "APPROVED" } },
        data: paymentUpdate,
      });
      return recorded.count === 1
        ? { outcome: "recorded", orderNumber, status: event.status }
        : // An approval already landed; a late DECLINED from an earlier
          // attempt on the same reference must not regress it.
          { outcome: "already_processed", orderNumber };
    }

    const approved = await tx.payment.updateMany({
      where: { id: payment.id, status: { not: "APPROVED" } },
      data: paymentUpdate,
    });
    if (approved.count === 0) {
      // A concurrent or earlier delivery of this same approval got here
      // first — and with it, the order transition. Nothing to do.
      return { outcome: "already_processed", orderNumber };
    }

    const transition = await applyOrderTransition(
      tx,
      payment.order.id,
      "PENDING",
      "PAID",
    );
    if (transition.won) {
      return { outcome: "order_paid", orderNumber };
    }
    if (transition.currentStatus === "CANCELLED") {
      return { outcome: "paid_after_cancelled", orderNumber };
    }
    // Already PAID or further along — an advisor's "Marcar pagado" beat the
    // webhook. The payment row now confirms what they assumed.
    return { outcome: "already_processed", orderNumber };
  });
}
