// End-to-end tests for createOrder against a real Postgres — the whole point
// of the action is transactional behavior (snapshots + reservation + rollback
// as one unit), which mocks cannot prove. Skips DB-less, like parity.test.ts.
//
// The fixture product is ACTIVE (createOrder refuses drafts), which is why
// vitest.config.ts serializes test files when DATABASE_URL is set: parity
// asserts over the whole ACTIVE catalog and must not see this product.
import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { PrismaClient } from "@/generated/prisma/client";
import { getPaymentProvider } from "@/payments";
import { createOrder } from "./actions";
import { releaseExpiredReservations } from "./expiry";
import { SHIPPING_CENTS } from "./shipping";

const databaseUrl = process.env.DATABASE_URL;

const PRODUCT_ID = "test-order-product";
const VARIANT_A = "test-order-variant-a";
const VARIANT_B = "test-order-variant-b";
const PRICE_A = 80_000_00;
const PRICE_B = 95_000_00;

const delivery = {
  nombre: "Ana María Restrepo",
  celular: "300 123 4567",
  documentType: "CC" as const,
  documentId: "1023456789",
  department: "Antioquia" as const,
  ciudad: "Medellín",
  direccion: "Calle 10 # 43E-25, apto 301",
};

const freshInput = () => ({
  idempotencyKey: crypto.randomUUID(),
  items: [
    { variantId: VARIANT_A, qty: 2, expectedPriceCents: PRICE_A },
    { variantId: VARIANT_B, qty: 1, expectedPriceCents: PRICE_B },
  ],
  delivery,
  paymentMethod: "CASH_ON_DELIVERY" as const,
});

describe.skipIf(!databaseUrl)("createOrder", () => {
  const db = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl }),
  });

  const cleanup = async () => {
    await db.order.deleteMany({
      where: { items: { some: { variantSku: { startsWith: "TEST-ORDER-" } } } },
    });
    await db.address.deleteMany({
      where: { customerId: null, orders: { none: {} } },
    });
    await db.product.deleteMany({ where: { id: PRODUCT_ID } });
  };

  beforeEach(async () => {
    await cleanup();
    await db.product.create({
      data: {
        id: PRODUCT_ID,
        slug: "test-order-product",
        name: "Test order product",
        status: "ACTIVE",
        variants: {
          create: [
            {
              id: VARIANT_A,
              sku: "TEST-ORDER-A",
              optionKey: "test-a",
              priceCents: PRICE_A,
              stockOnHand: 10,
              movements: { create: { delta: 10, reason: "PURCHASE" } },
            },
            {
              id: VARIANT_B,
              sku: "TEST-ORDER-B",
              optionKey: "test-b",
              priceCents: PRICE_B,
              stockOnHand: 1,
              movements: { create: { delta: 1, reason: "PURCHASE" } },
            },
          ],
        },
      },
    });
  });

  afterAll(async () => {
    await cleanup();
    await db.$disconnect();
  });

  it("creates the order: snapshots, guest address, reservation, totals", async () => {
    const result = await createOrder(freshInput());
    const data = result.data;
    expect(data?.ok).toBe(true);
    if (!data?.ok) return;

    expect(data.orderNumber).toMatch(/^SECRETO-[2-9A-HJKMNP-Z]{6}$/);

    const order = await db.order.findUniqueOrThrow({
      where: { id: data.orderId },
      include: { items: true, address: true },
    });
    expect(order.status).toBe("PENDING");
    expect(order.guestPhone).toBe("3001234567"); // normalized by the schema
    expect(order.discreetPackaging).toBe(true);
    expect(order.subtotalCents).toBe(PRICE_A * 2 + PRICE_B);
    expect(order.totalCents).toBe(PRICE_A * 2 + PRICE_B + SHIPPING_CENTS);

    // ~72h reservation window for contra entrega
    const hours =
      (order.reservationExpiresAt!.getTime() - Date.now()) / 3_600_000;
    expect(hours).toBeGreaterThan(71);
    expect(hours).toBeLessThan(73);

    // Guest address with no Customer behind it
    expect(order.address?.customerId).toBeNull();
    expect(order.address?.department).toBe("Antioquia");
    expect(order.address?.documentId).toBe("1023456789");

    // Snapshots, not joins
    const itemA = order.items.find((i) => i.variantId === VARIANT_A)!;
    expect(itemA.productName).toBe("Test order product");
    expect(itemA.variantSku).toBe("TEST-ORDER-A");
    expect(itemA.variantLabel).toBe(""); // option-less product
    expect(itemA.unitPriceCents).toBe(PRICE_A);
    expect(itemA.totalCents).toBe(PRICE_A * 2);

    // Reservation happened, with the ledger row pointing at this order
    const a = await db.productVariant.findUniqueOrThrow({
      where: { id: VARIANT_A },
      include: { movements: { where: { reason: "RESERVATION" } } },
    });
    expect(a.stockReserved).toBe(2);
    expect(a.movements).toEqual([
      expect.objectContaining({ delta: -2, orderId: order.id }),
    ]);
  });

  it("is idempotent: the same key returns the same order and reserves once", async () => {
    const input = freshInput();
    const first = await createOrder(input);
    const second = await createOrder(input);
    expect(first.data?.ok).toBe(true);
    expect(second.data).toEqual(first.data);

    const count = await db.order.count({
      where: { idempotencyKey: input.idempotencyKey },
    });
    expect(count).toBe(1);

    const a = await db.productVariant.findUniqueOrThrow({
      where: { id: VARIANT_A },
    });
    expect(a.stockReserved).toBe(2); // not 4
  });

  it("returns a PRICE_CHANGED conflict instead of charging a price the customer never saw", async () => {
    const input = freshInput();
    input.items[0].expectedPriceCents = PRICE_A - 5_000_00; // stale bag
    const result = await createOrder(input);
    expect(result.data).toEqual({
      ok: false,
      code: "CONFLICTS",
      conflicts: [
        {
          variantId: VARIANT_A,
          productName: "Test order product",
          reason: "PRICE_CHANGED",
          currentPriceCents: PRICE_A,
        },
      ],
    });
    expect(
      await db.order.count({ where: { idempotencyKey: input.idempotencyKey } }),
    ).toBe(0);
  });

  it("rolls back the whole order when one line is out of stock", async () => {
    const input = freshInput();
    input.items[1].qty = 2; // only 1 on hand
    const result = await createOrder(input);
    expect(result.data).toEqual({
      ok: false,
      code: "CONFLICTS",
      conflicts: [
        {
          variantId: VARIANT_B,
          productName: "Test order product",
          reason: "OUT_OF_STOCK",
        },
      ],
    });

    // Nothing survived the rollback: no order, no address, no reservation
    expect(
      await db.order.count({ where: { idempotencyKey: input.idempotencyKey } }),
    ).toBe(0);
    const a = await db.productVariant.findUniqueOrThrow({
      where: { id: VARIANT_A },
    });
    expect(a.stockReserved).toBe(0);
  });

  it("rejects retired products as INACTIVE", async () => {
    await db.product.update({
      where: { id: PRODUCT_ID },
      data: { status: "ARCHIVED" },
    });
    const result = await createOrder(freshInput());
    expect(result.data?.ok).toBe(false);
    if (result.data?.ok !== false) return;
    expect(result.data.code).toBe("CONFLICTS");
    if (result.data.code !== "CONFLICTS") return;
    expect(result.data.conflicts.map((c) => c.reason)).toEqual([
      "INACTIVE",
      "INACTIVE",
    ]);
  });

  it("refuses online payment without an email, at the boundary", async () => {
    const input = { ...freshInput(), paymentMethod: "ONLINE" as const };
    const result = await createOrder(input);
    expect(result.data).toBeUndefined();
    expect(result.validationErrors).toBeDefined();
  });

  it("sweeps expired reservations: cancels, releases, reconciles — once", async () => {
    const created = await createOrder(freshInput());
    expect(created.data?.ok).toBe(true);
    if (!created.data?.ok) return;
    const orderId = created.data.orderId;

    await db.order.update({
      where: { id: orderId },
      data: { reservationExpiresAt: new Date(Date.now() - 60_000) },
    });

    const first = await releaseExpiredReservations(db);
    expect(first.released).toBe(1);

    const order = await db.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(order.status).toBe("CANCELLED");
    expect(order.reservationExpiresAt).toBeNull();

    const a = await db.productVariant.findUniqueOrThrow({
      where: { id: VARIANT_A },
      include: { movements: { where: { orderId } } },
    });
    expect(a.stockReserved).toBe(0);
    expect(a.movements.map((m) => [m.delta, m.reason]).sort()).toEqual([
      [-2, "RESERVATION"],
      [2, "RESERVATION_RELEASE"],
    ]);

    // A second sweep (or a racing cron) finds nothing to do
    const second = await releaseExpiredReservations(db);
    expect(second.released).toBe(0);
  });

  // ─── Online payment initiation ──────────────────────────────────────────
  // These run against whichever provider the environment configures (wompi
  // locally with pub_test_ keys, mock in CI), so they assert the contract —
  // row written, link returned, idempotent re-issue — and only pin
  // gateway-specific detail when a real gateway is active.

  const onlineInput = () => ({
    ...freshInput(),
    paymentMethod: "ONLINE" as const,
    delivery: { ...delivery, email: "compradora@ejemplo.co" },
  });

  it("ONLINE: writes the gateway Payment row and hands back the checkout link", async () => {
    const providerName = getPaymentProvider().name;
    const result = await createOrder(onlineInput());
    const data = result.data;
    expect(data?.ok).toBe(true);
    if (!data?.ok) return;

    expect(data.checkoutUrl).toBeDefined();
    const url = new URL(data.checkoutUrl!);

    // The attempt is on the books before the buyer ever sees the gateway:
    // that row is what the webhook will find by reference. Rail unknown
    // until the event says so (method null) — never invented here.
    const payments = await db.payment.findMany({
      where: { orderId: data.orderId },
    });
    expect(payments).toHaveLength(1);
    expect(payments[0].provider).toBe(providerName);
    expect(payments[0].providerReference).not.toBeNull();
    expect(payments[0].status).toBe("PENDING");
    expect(payments[0].method).toBeNull();
    expect(payments[0].amountCents).toBe(PRICE_A * 2 + PRICE_B + SHIPPING_CENTS);

    const order = await db.order.findUniqueOrThrow({
      where: { id: data.orderId },
    });
    const minutes =
      (order.reservationExpiresAt!.getTime() - Date.now()) / 60_000;
    if (providerName === "mock") {
      // No real redirect exists: an advisor coordinates over WhatsApp, so
      // the window stays at contra entrega's 72h.
      expect(minutes).toBeGreaterThan(71 * 60);
    } else {
      // A real gateway redirect holds stock for 30 minutes, and the signed
      // link expires at the same instant the reservation does.
      expect(minutes).toBeGreaterThan(25);
      expect(minutes).toBeLessThan(35);
      expect(url.searchParams.get("expiration-time")).toBe(
        order.reservationExpiresAt!.toISOString(),
      );
      expect(url.searchParams.get("reference")).toBe(data.orderNumber);
    }
  });

  it("ONLINE: a retried request re-issues the identical link, not a second row", async () => {
    const input = onlineInput();
    const first = await createOrder(input);
    const second = await createOrder(input);
    expect(first.data?.ok).toBe(true);
    expect(second.data?.ok).toBe(true);
    if (!first.data?.ok || !second.data?.ok) return;

    // Deterministic reference + stored expiry ⇒ byte-identical URL, and the
    // upsert means the double-tap never doubles the Payment row.
    expect(second.data.checkoutUrl).toBe(first.data.checkoutUrl);
    expect(
      await db.payment.count({ where: { orderId: first.data.orderId } }),
    ).toBe(1);
  });

  it("contra entrega keeps its manual Payment row and never gets a link", async () => {
    const result = await createOrder(freshInput());
    expect(result.data?.ok).toBe(true);
    if (!result.data?.ok) return;

    expect(result.data.checkoutUrl).toBeUndefined();
    const payments = await db.payment.findMany({
      where: { orderId: result.data.orderId },
    });
    expect(payments).toHaveLength(1);
    expect(payments[0].provider).toBe("manual");
    expect(payments[0].method).toBe("CASH_ON_DELIVERY");
    expect(payments[0].providerReference).toBeNull();
  });
});
