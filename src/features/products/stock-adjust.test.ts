// Exercises the adjustment guard against a real Postgres, like
// checkout/stock.test.ts: the conditional UPDATE only means anything under
// actual concurrency. Skips when DATABASE_URL is absent. The fixture product
// is created here and deleted after; the seeded demo catalog is untouched.
import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { PrismaClient } from "@/generated/prisma/client";
import { applyStockAdjustment } from "./stock-adjust";

const databaseUrl = process.env.DATABASE_URL;

const PRODUCT_ID = "test-adjust-product";
const VARIANT_ID = "test-adjust-variant";

describe.skipIf(!databaseUrl)("stock adjustment", () => {
  const db = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl }),
  });

  beforeEach(async () => {
    await db.product.deleteMany({ where: { id: PRODUCT_ID } });
    await db.product.create({
      data: {
        id: PRODUCT_ID,
        slug: "test-adjust-product",
        name: "Test adjust product",
        variants: {
          create: {
            id: VARIANT_ID,
            sku: "TEST-ADJUST-A",
            optionKey: "test-adjust-a",
            priceCents: 50_000_00,
            stockOnHand: 5,
            stockReserved: 2,
            movements: { create: { delta: 5, reason: "PURCHASE" } },
          },
        },
      },
    });
  });

  afterAll(async () => {
    await db.product.deleteMany({ where: { id: PRODUCT_ID } });
    await db.$disconnect();
  });

  it("applies a restock and writes exactly one PURCHASE row", async () => {
    const outcome = await applyStockAdjustment(db, {
      variantId: VARIANT_ID,
      delta: 10,
      reason: "PURCHASE",
      note: "llegó caja del proveedor",
    });
    expect(outcome).toMatchObject({ ok: true, stockOnHand: 15 });

    const movements = await db.inventoryMovement.findMany({
      where: { variantId: VARIANT_ID, reason: "PURCHASE", delta: 10 },
    });
    expect(movements).toHaveLength(1);
    expect(movements[0].note).toBe("llegó caja del proveedor");
  });

  it("lets a count correction come down to exactly the reserved floor", async () => {
    const outcome = await applyStockAdjustment(db, {
      variantId: VARIANT_ID,
      delta: -3, // 5 → 2, exactly stockReserved
      reason: "MANUAL_ADJUST",
    });
    expect(outcome).toMatchObject({ ok: true, stockOnHand: 2 });
  });

  it("refuses to drop below what open orders reserve, and writes nothing", async () => {
    const outcome = await applyStockAdjustment(db, {
      variantId: VARIANT_ID,
      delta: -4, // 5 → 1 < stockReserved 2
      reason: "DAMAGE",
    });
    expect(outcome).toEqual({
      ok: false,
      code: "WOULD_BREAK_RESERVATIONS",
    });

    const variant = await db.productVariant.findUniqueOrThrow({
      where: { id: VARIANT_ID },
    });
    expect(variant.stockOnHand).toBe(5); // untouched
    const damage = await db.inventoryMovement.count({
      where: { variantId: VARIANT_ID, reason: "DAMAGE" },
    });
    expect(damage).toBe(0); // no ledger row for a refused move
  });

  it("distinguishes a missing variant from a blocked one", async () => {
    const outcome = await applyStockAdjustment(db, {
      variantId: "no-such-variant",
      delta: 1,
      reason: "PURCHASE",
    });
    expect(outcome).toEqual({ ok: false, code: "NOT_FOUND" });
  });

  it("keeps the ledger reconciling with the balance under concurrent taps", async () => {
    // Eight advisors tap −1 at once with only 3 units above the reserved
    // floor. Exactly 3 must win; the balance and the ledger must agree.
    const outcomes = await Promise.all(
      Array.from({ length: 8 }, () =>
        applyStockAdjustment(db, {
          variantId: VARIANT_ID,
          delta: -1,
          reason: "MANUAL_ADJUST",
        }),
      ),
    );

    const wins = outcomes.filter((o) => o.ok).length;
    expect(wins).toBe(3);

    const variant = await db.productVariant.findUniqueOrThrow({
      where: { id: VARIANT_ID },
    });
    expect(variant.stockOnHand).toBe(2);

    const sum = await db.inventoryMovement.aggregate({
      where: {
        variantId: VARIANT_ID,
        reason: { in: ["PURCHASE", "SALE", "RETURN", "MANUAL_ADJUST", "DAMAGE"] },
      },
      _sum: { delta: true },
    });
    expect(sum._sum.delta).toBe(variant.stockOnHand);
  });
});
