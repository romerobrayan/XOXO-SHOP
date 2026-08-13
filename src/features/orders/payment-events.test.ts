// Exercises the webhook's order transition against a real Postgres. The
// whole contract is concurrency and idempotency — Wompi redelivers the same
// event, retries race each other and the expiry sweep — and none of that
// means anything against a mock. Skips DB-less, like stock.test.ts, whose
// fixture pattern this follows.
import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { releaseExpiredReservations } from "@/features/checkout/expiry";
import { reserveStock } from "@/features/checkout/stock";
import { PrismaClient } from "@/generated/prisma/client";
import type { WebhookEvent } from "@/payments";
import { applyOrderTransition } from "./apply-transition";
import { applyPaymentEvent } from "./payment-events";

const databaseUrl = process.env.DATABASE_URL;

const PRODUCT_ID = "test-payment-events-product";
const VARIANT_ID = "test-payment-events-variant";
const ORDER_NUMBER = "SECRETO-TESTPE";
const QTY = 2;
const STOCK = 5;
const PRICE = 90_000_00;
const TOTAL = PRICE * QTY + 12_000_00;

describe.skipIf(!databaseUrl)("applyPaymentEvent", () => {
  const db = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl }),
  });

  const cleanup = async () => {
    await db.order.deleteMany({ where: { orderNumber: ORDER_NUMBER } });
    await db.product.deleteMany({ where: { id: PRODUCT_ID } });
  };

  let orderId = "";

  // An online order exactly as createOrder + initiateOnlinePayment leave it:
  // PENDING, stock reserved through the real primitive (so the ledger stays
  // reconciled), and a wompi Payment row with our reference and method null.
  beforeEach(async () => {
    await cleanup();
    await db.product.create({
      data: {
        id: PRODUCT_ID,
        slug: "test-payment-events-product",
        name: "Test payment events product",
        status: "ACTIVE",
        variants: {
          create: {
            id: VARIANT_ID,
            sku: "TEST-PE-A",
            optionKey: "test-pe-a",
            priceCents: PRICE,
            stockOnHand: STOCK,
            movements: { create: { delta: STOCK, reason: "PURCHASE" } },
          },
        },
      },
    });
    const order = await db.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          orderNumber: ORDER_NUMBER,
          subtotalCents: PRICE * QTY,
          shippingCents: 12_000_00,
          totalCents: TOTAL,
          reservationExpiresAt: new Date(Date.now() + 30 * 60 * 1000),
          items: {
            create: {
              variantId: VARIANT_ID,
              productName: "Test payment events product",
              variantSku: "TEST-PE-A",
              variantLabel: "",
              unitPriceCents: PRICE,
              quantity: QTY,
              totalCents: PRICE * QTY,
            },
          },
          payments: {
            create: {
              provider: "wompi",
              providerReference: ORDER_NUMBER,
              status: "PENDING",
              amountCents: TOTAL,
            },
          },
        },
        select: { id: true },
      });
      await reserveStock(tx, created.id, [
        { variantId: VARIANT_ID, qty: QTY },
      ]);
      return created;
    });
    orderId = order.id;
  });

  afterAll(async () => {
    await cleanup();
    await db.$disconnect();
  });

  const evento = (
    status: WebhookEvent["status"],
    method: WebhookEvent["method"] = "NEQUI",
  ): WebhookEvent => ({
    providerReference: ORDER_NUMBER,
    status,
    method,
    rawPayload: { simulated: true, status },
  });

  const orderNow = () =>
    db.order.findUniqueOrThrow({
      where: { id: orderId },
      include: { payments: true },
    });

  const variantNow = () =>
    db.productVariant.findUniqueOrThrow({
      where: { id: VARIANT_ID },
      include: { movements: true },
    });

  // Both reconciliations from the stock.ts header, over the whole ledger:
  // physical reasons must sum to stockOnHand, reservation reasons to
  // -stockReserved. Every test ends with the books balancing.
  const expectLedgerReconciles = async () => {
    const v = await variantNow();
    const physical = v.movements
      .filter((m) => !m.reason.startsWith("RESERVATION"))
      .reduce((sum, m) => sum + m.delta, 0);
    const reservation = v.movements
      .filter((m) => m.reason.startsWith("RESERVATION"))
      .reduce((sum, m) => sum + m.delta, 0);
    expect(v.stockOnHand).toBe(physical);
    // `|| 0` flattens JavaScript's -0 (Object.is(-0, 0) is false under toBe)
    // when the reservation column and its ledger both sit at zero.
    expect(v.stockReserved).toBe(-reservation || 0);
  };

  it("APPROVED flips PENDING → PAID and records the rail — but moves no stock", async () => {
    const result = await applyPaymentEvent(db, "wompi", evento("APPROVED"));
    expect(result).toEqual({ outcome: "order_paid", orderNumber: ORDER_NUMBER });

    const order = await orderNow();
    expect(order.status).toBe("PAID");
    expect(order.paidAt).not.toBeNull();
    // Nothing left to expire — the sweep must never pick this order up.
    expect(order.reservationExpiresAt).toBeNull();
    expect(order.payments[0].status).toBe("APPROVED");
    expect(order.payments[0].method).toBe("NEQUI");

    // The machine declares PENDING → PAID with effect "none": the units stay
    // reserved for the order until shipping consumes them. No SALE row yet.
    const v = await variantNow();
    expect(v.stockOnHand).toBe(STOCK);
    expect(v.stockReserved).toBe(QTY);
    expect(v.movements.map((m) => m.reason)).not.toContain("SALE");
    await expectLedgerReconciles();
  });

  it("8 concurrent deliveries of the same approval: exactly one wins", async () => {
    const results = await Promise.all(
      Array.from({ length: 8 }, () =>
        applyPaymentEvent(db, "wompi", evento("APPROVED")),
      ),
    );

    const outcomes = results.map((r) => r.outcome).sort();
    expect(outcomes.filter((o) => o === "order_paid")).toHaveLength(1);
    expect(outcomes.filter((o) => o === "already_processed")).toHaveLength(7);

    const order = await orderNow();
    expect(order.status).toBe("PAID");
    expect(order.payments).toHaveLength(1);
    expect(order.payments[0].status).toBe("APPROVED");
    await expectLedgerReconciles();
  });

  it("a redelivered approval after PAID changes nothing, not even paidAt", async () => {
    await applyPaymentEvent(db, "wompi", evento("APPROVED"));
    const first = await orderNow();

    const replay = await applyPaymentEvent(db, "wompi", evento("APPROVED"));
    expect(replay.outcome).toBe("already_processed");

    const second = await orderNow();
    expect(second.paidAt?.getTime()).toBe(first.paidAt?.getTime());
    expect(second.updatedAt.getTime()).toBe(first.updatedAt.getTime());
  });

  it("an out-of-order DECLINED never regresses an APPROVED payment", async () => {
    // Same reference, two attempts at the gateway: the decline of the first
    // attempt can arrive after the approval of the second.
    await applyPaymentEvent(db, "wompi", evento("APPROVED"));
    const result = await applyPaymentEvent(db, "wompi", evento("DECLINED"));

    expect(result.outcome).toBe("already_processed");
    const order = await orderNow();
    expect(order.status).toBe("PAID");
    expect(order.payments[0].status).toBe("APPROVED");
  });

  it("DECLINED on a pending order records it and leaves the order payable", async () => {
    const result = await applyPaymentEvent(db, "wompi", evento("DECLINED"));
    expect(result).toEqual({
      outcome: "recorded",
      orderNumber: ORDER_NUMBER,
      status: "DECLINED",
    });

    const order = await orderNow();
    // The buyer can retry from the same link; only the sweep cancels.
    expect(order.status).toBe("PENDING");
    expect(order.payments[0].status).toBe("DECLINED");
    const v = await variantNow();
    expect(v.stockReserved).toBe(QTY);

    // …and the retry's approval still lands.
    const retried = await applyPaymentEvent(db, "wompi", evento("APPROVED"));
    expect(retried.outcome).toBe("order_paid");
  });

  it("money arriving after the sweep cancelled the order touches no stock", async () => {
    await db.order.update({
      where: { id: orderId },
      data: { reservationExpiresAt: new Date(Date.now() - 1000) },
    });
    await releaseExpiredReservations(db);

    const result = await applyPaymentEvent(db, "wompi", evento("APPROVED"));
    expect(result).toEqual({
      outcome: "paid_after_cancelled",
      orderNumber: ORDER_NUMBER,
    });

    const order = await orderNow();
    // The money moved — the payment row says so for the panel — but the
    // released units may already be someone else's: hands off the ledger.
    expect(order.status).toBe("CANCELLED");
    expect(order.payments[0].status).toBe("APPROVED");
    const v = await variantNow();
    expect(v.stockOnHand).toBe(STOCK);
    expect(v.stockReserved).toBe(0);
    await expectLedgerReconciles();
  });

  it("ignores references it has never issued, and other providers' references", async () => {
    expect(
      (
        await applyPaymentEvent(db, "wompi", {
          ...evento("APPROVED"),
          providerReference: "SECRETO-NUNCA1",
        })
      ).outcome,
    ).toBe("unknown_reference");

    // A "mock" event must not settle a payment that wompi owns.
    expect((await applyPaymentEvent(db, "mock", evento("APPROVED"))).outcome).toBe(
      "unknown_reference",
    );
    expect((await orderNow()).status).toBe("PENDING");
  });

  it("whole flow: N webhook deliveries + shipping decrement stock exactly once", async () => {
    // Redundant deliveries land before, between and after the panel moves.
    await Promise.all(
      Array.from({ length: 4 }, () =>
        applyPaymentEvent(db, "wompi", evento("APPROVED")),
      ),
    );
    // The advisor prepares and ships — the panel path, same executor.
    await db.$transaction((tx) =>
      applyOrderTransition(tx, orderId, "PAID", "PROCESSING"),
    );
    await db.$transaction((tx) =>
      applyOrderTransition(tx, orderId, "PROCESSING", "SHIPPED"),
    );
    await applyPaymentEvent(db, "wompi", evento("APPROVED"));

    const order = await orderNow();
    expect(order.status).toBe("SHIPPED");

    // Shipping consumed the reservation exactly once: the sale left the
    // shelf, nothing stays reserved, and each ledger reason appears once.
    const v = await variantNow();
    expect(v.stockOnHand).toBe(STOCK - QTY);
    expect(v.stockReserved).toBe(0);
    const reasons = v.movements.map((m) => m.reason);
    expect(reasons.filter((r) => r === "SALE")).toHaveLength(1);
    expect(reasons.filter((r) => r === "RESERVATION")).toHaveLength(1);
    expect(reasons.filter((r) => r === "RESERVATION_RELEASE")).toHaveLength(1);
    await expectLedgerReconciles();
  });
});
