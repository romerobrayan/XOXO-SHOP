// The sale definition, executed against a real Postgres: paid orders count,
// delivered contra entrega counts, in-flight contra entrega and anything
// cancelled/refunded does not. Asserted as DELTAS over whatever the local
// database already holds — the suite shares it with e2e runs and the demo.
import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaClient } from "@/generated/prisma/client";
import { getDashboardData, type DashboardData } from "./metrics";

const databaseUrl = process.env.DATABASE_URL;

const ORDER_PREFIX = "SECRETO-TEST-DASH";
const PRODUCT_ID = "test-dash-low-product";

const totalRevenue = (d: DashboardData) =>
  d.daily.reduce((sum, b) => sum + b.revenueCents, 0);
const totalCount = (d: DashboardData) =>
  d.daily.reduce((sum, b) => sum + b.count, 0);

describe.skipIf(!databaseUrl)("dashboard metrics", () => {
  const db = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl }),
  });

  let before: DashboardData;

  async function cleanup() {
    await db.order.deleteMany({
      where: { orderNumber: { startsWith: ORDER_PREFIX } },
    });
    await db.product.deleteMany({ where: { id: PRODUCT_ID } });
  }

  beforeAll(async () => {
    await cleanup();
    before = await getDashboardData(db);

    const order = (
      n: number,
      data: {
        status: "PAID" | "SHIPPED" | "DELIVERED" | "CANCELLED";
        paidAt: Date | null;
        totalCents: number;
        itemName: string;
      },
    ) =>
      db.order.create({
        data: {
          orderNumber: `${ORDER_PREFIX}${n}`,
          status: data.status,
          paidAt: data.paidAt,
          subtotalCents: data.totalCents,
          totalCents: data.totalCents,
          items: {
            create: {
              productName: data.itemName,
              variantSku: `TEST-DASH-${n}`,
              variantLabel: "",
              unitPriceCents: data.totalCents,
              quantity: 1,
              totalCents: data.totalCents,
            },
          },
        },
      });

    // Counts: paid online today + delivered contra entrega today.
    await order(1, {
      status: "PAID",
      paidAt: new Date(),
      totalCents: 900_000_00,
      itemName: "Test dash pagado online",
    });
    await order(2, {
      status: "DELIVERED",
      paidAt: null,
      totalCents: 700_000_00,
      itemName: "Test dash contra entrega entregado",
    });
    // Does not count: contra entrega still on the truck…
    await order(3, {
      status: "SHIPPED",
      paidAt: null,
      totalCents: 500_000_00,
      itemName: "Test dash contra entrega en camino",
    });
    // …nor an order that was paid and then cancelled.
    await order(4, {
      status: "CANCELLED",
      paidAt: new Date(),
      totalCents: 300_000_00,
      itemName: "Test dash cancelado",
    });

    // Low stock: an active product whose only variant sits at its threshold.
    await db.product.create({
      data: {
        id: PRODUCT_ID,
        slug: "test-dash-low-product",
        name: "Test dash poco stock",
        status: "ACTIVE",
        publishedAt: new Date(),
        variants: {
          create: {
            sku: "TEST-DASH-LOW",
            optionKey: "test-dash-low",
            priceCents: 50_000_00,
            stockOnHand: 1,
            lowStockAt: 3,
          },
        },
      },
    });
  });

  afterAll(async () => {
    await cleanup();
    await db.$disconnect();
  });

  it("counts exactly the paid and the delivered-COD orders, at today's bucket", async () => {
    const after = await getDashboardData(db);

    expect(totalCount(after) - totalCount(before)).toBe(2);
    expect(totalRevenue(after) - totalRevenue(before)).toBe(
      900_000_00 + 700_000_00,
    );

    const today = after.daily[after.daily.length - 1];
    const todayBefore = before.daily[before.daily.length - 1];
    expect(today.count - todayBefore.count).toBe(2);

    expect(after.kpis.hoy.count - before.kpis.hoy.count).toBe(2);
    expect(after.kpis.ultimos30.revenueCents - before.kpis.ultimos30.revenueCents).toBe(
      1_600_000_00,
    );
  });

  it("top products only see counted sales", async () => {
    const after = await getDashboardData(db);
    const names = after.topProducts.map((p) => p.productName);
    expect(names).toContain("Test dash pagado online");
    expect(names).toContain("Test dash contra entrega entregado");
    expect(names).not.toContain("Test dash contra entrega en camino");
    expect(names).not.toContain("Test dash cancelado");
  });

  it("low stock lists the variant at its threshold", async () => {
    const after = await getDashboardData(db);
    const entry = after.lowStock.find((v) => v.sku === "TEST-DASH-LOW");
    expect(entry).toMatchObject({ available: 1, lowStockAt: 3 });
  });
});
