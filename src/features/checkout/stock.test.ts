// Exercises the reservation guard against a real Postgres — the conditional
// UPDATE only means anything under actual concurrency, so these tests skip
// (like parity.test.ts) when DATABASE_URL is absent. The fixture product is
// created here and deleted after; the seeded demo catalog is never touched.
import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { PrismaClient } from "@/generated/prisma/client";
import {
  commitSale,
  OutOfStockError,
  releaseStock,
  reserveStock,
} from "./stock";

const databaseUrl = process.env.DATABASE_URL;

const PRODUCT_ID = "test-stock-product";
const VARIANT_A = "test-stock-variant-a";
const VARIANT_B = "test-stock-variant-b";

describe.skipIf(!databaseUrl)("stock reservation", () => {
  const db = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl }),
  });

  beforeEach(async () => {
    // Recreate the fixture from scratch so every test starts from a known
    // balance and a clean ledger. Movements cascade with the variants.
    // Initial stock arrives as a PURCHASE movement (CLAUDE.md rule 3), which
    // also keeps the global ledger reconciliation in parity.test.ts honest if
    // both files hit the database in the same run.
    await db.product.deleteMany({ where: { id: PRODUCT_ID } });
    await db.product.create({
      data: {
        id: PRODUCT_ID,
        slug: "test-stock-product",
        name: "Test stock product",
        variants: {
          create: [
            {
              id: VARIANT_A,
              sku: "TEST-STOCK-A",
              optionKey: "test-a",
              priceCents: 50_000_00,
              stockOnHand: 5,
              movements: { create: { delta: 5, reason: "PURCHASE" } },
            },
            {
              id: VARIANT_B,
              sku: "TEST-STOCK-B",
              optionKey: "test-b",
              priceCents: 60_000_00,
              stockOnHand: 1,
              movements: { create: { delta: 1, reason: "PURCHASE" } },
            },
          ],
        },
      },
    });
  });

  afterAll(async () => {
    await db.product.deleteMany({ where: { id: PRODUCT_ID } });
    await db.$disconnect();
  });

  const variant = (id: string) =>
    db.productVariant.findUniqueOrThrow({
      where: { id },
      include: { movements: true },
    });

  // Ledger rows minus the fixture's initial PURCHASE, order-independent
  // (createMany gives no ordering guarantee within a timestamp).
  const ledgerOf = (v: Awaited<ReturnType<typeof variant>>) =>
    v.movements
      .filter((m) => m.reason !== "PURCHASE")
      .map((m) => [m.delta, m.reason] as const)
      .sort((a, b) => a[0] - b[0]);

  it("reserves within availability and writes the ledger row", async () => {
    await db.$transaction((tx) =>
      reserveStock(tx, null, [{ variantId: VARIANT_A, qty: 3 }]),
    );
    const a = await variant(VARIANT_A);
    expect(a.stockOnHand).toBe(5);
    expect(a.stockReserved).toBe(3);
    expect(ledgerOf(a)).toEqual([[-3, "RESERVATION"]]);
  });

  it("rejects a reservation beyond available, counting existing reservations", async () => {
    await db.$transaction((tx) =>
      reserveStock(tx, null, [{ variantId: VARIANT_A, qty: 3 }]),
    );
    // 5 on hand, 3 reserved → available is 2. Asking for 3 must fail even
    // though stockOnHand alone would allow it.
    await expect(
      db.$transaction((tx) =>
        reserveStock(tx, null, [{ variantId: VARIANT_A, qty: 3 }]),
      ),
    ).rejects.toThrow(OutOfStockError);
  });

  it("rolls back earlier lines when a later line is out of stock", async () => {
    await expect(
      db.$transaction((tx) =>
        reserveStock(tx, null, [
          { variantId: VARIANT_A, qty: 2 },
          { variantId: VARIANT_B, qty: 2 }, // only 1 on hand
        ]),
      ),
    ).rejects.toThrow(OutOfStockError);

    const a = await variant(VARIANT_A);
    expect(a.stockReserved).toBe(0);
    expect(ledgerOf(a)).toEqual([]);
  });

  it("rejects inactive variants and unknown ids", async () => {
    await db.productVariant.update({
      where: { id: VARIANT_A },
      data: { isActive: false },
    });
    await expect(
      db.$transaction((tx) =>
        reserveStock(tx, null, [{ variantId: VARIANT_A, qty: 1 }]),
      ),
    ).rejects.toThrow(OutOfStockError);
    await expect(
      db.$transaction((tx) =>
        reserveStock(tx, null, [{ variantId: "no-such-variant", qty: 1 }]),
      ),
    ).rejects.toThrow(OutOfStockError);
  });

  it("lets exactly one of N concurrent buyers win the last unit", async () => {
    const attempts = await Promise.allSettled(
      Array.from({ length: 8 }, () =>
        db.$transaction((tx) =>
          reserveStock(tx, null, [{ variantId: VARIANT_B, qty: 1 }]),
        ),
      ),
    );
    const wins = attempts.filter((r) => r.status === "fulfilled").length;
    expect(wins).toBe(1);

    const b = await variant(VARIANT_B);
    expect(b.stockReserved).toBe(1);
    expect(ledgerOf(b)).toEqual([[-1, "RESERVATION"]]);
  });

  it("releases a reservation back to the pool, and refuses to over-release", async () => {
    await db.$transaction((tx) =>
      reserveStock(tx, null, [{ variantId: VARIANT_A, qty: 2 }]),
    );
    await db.$transaction((tx) =>
      releaseStock(tx, null, [{ variantId: VARIANT_A, qty: 2 }], "expired"),
    );

    const a = await variant(VARIANT_A);
    expect(a.stockReserved).toBe(0);
    expect(ledgerOf(a)).toEqual([
      [-2, "RESERVATION"],
      [2, "RESERVATION_RELEASE"],
    ]);

    await expect(
      db.$transaction((tx) =>
        releaseStock(tx, null, [{ variantId: VARIANT_A, qty: 1 }]),
      ),
    ).rejects.toThrow(/not reserved/);
  });

  it("commits a sale: both balances drop, two ledger rows, everything reconciles", async () => {
    await db.$transaction((tx) =>
      reserveStock(tx, null, [{ variantId: VARIANT_A, qty: 2 }]),
    );
    await db.$transaction((tx) =>
      commitSale(tx, null, [{ variantId: VARIANT_A, qty: 2 }]),
    );

    const a = await variant(VARIANT_A);
    expect(a.stockOnHand).toBe(3);
    expect(a.stockReserved).toBe(0);
    expect(ledgerOf(a)).toEqual([
      [-2, "RESERVATION"],
      [-2, "SALE"],
      [2, "RESERVATION_RELEASE"],
    ]);

    // The same reconciliation parity.test.ts enforces globally: physical
    // reasons sum to stockOnHand, reservation reasons negate to reserved.
    let onHand = 0;
    let reserved = 0;
    for (const m of a.movements) {
      if (m.reason === "RESERVATION" || m.reason === "RESERVATION_RELEASE")
        reserved -= m.delta;
      else onHand += m.delta;
    }
    expect(onHand).toBe(a.stockOnHand);
    expect(reserved).toBe(a.stockReserved);
  });

  it("refuses to commit a sale that was never reserved", async () => {
    await expect(
      db.$transaction((tx) =>
        commitSale(tx, null, [{ variantId: VARIANT_A, qty: 1 }]),
      ),
    ).rejects.toThrow(/Cannot commit sale/);
  });
});
