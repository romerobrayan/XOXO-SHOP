import type { PrismaClient } from "@/generated/prisma/client";

// Sales metrics for the panel dashboard — aggregate queries over the
// database, which already has everything. No third-party analytics anywhere:
// the published privacy policy promises no data sharing and no profiling,
// and in this category purchase history is sensitive data (Ley 1581).
//
// WHAT COUNTS AS A SALE — the one definition, shown verbatim in the UI:
// an order counts once its money is certain. Online and transfer orders
// count when they are marked paid (paidAt); contra entrega collects at the
// door, so those count when they are marked delivered. Cancelled and
// refunded orders never count. The sale's date is paidAt when it exists,
// otherwise the moment the order was marked delivered.
export const SALE_DEFINITION =
  "Una venta es un pedido pagado (en línea o por transferencia) o, en contra entrega, un pedido entregado. Cancelados y reembolsados no cuentan.";

/** Colombia has no DST — days start at Bogotá midnight, not UTC midnight. */
const TZ = "America/Bogota";

// The qualifying filter, as SQL: paid orders that were not unmade, plus
// delivered cash-on-delivery orders. `paidAt IS NULL AND status DELIVERED`
// is exactly "collected at the door". updatedAt stands in for the delivery
// timestamp — transitions are the only writers of a DELIVERED order.
const VENTAS_CTE = `
  SELECT COALESCE(o."paidAt", o."updatedAt") AS sold_at, o."totalCents"
  FROM "Order" o
  WHERE (o."paidAt" IS NOT NULL
         AND o.status::text IN ('PAID','PROCESSING','SHIPPED','DELIVERED'))
     OR (o."paidAt" IS NULL AND o.status::text = 'DELIVERED')
`;

export type SalesBucket = {
  bucket: string;
  count: number;
  revenueCents: number;
};

export type DashboardData = {
  kpis: {
    hoy: { count: number; revenueCents: number };
    ultimos7: { count: number; revenueCents: number };
    ultimos30: { count: number; revenueCents: number };
  };
  daily: SalesBucket[]; // last 14 days, zero-filled, oldest first
  weekly: SalesBucket[]; // last 8 ISO weeks
  monthly: SalesBucket[]; // last 6 months
  topProducts: { productName: string; units: number; revenueCents: number }[];
  recentOrders: {
    orderNumber: string;
    status: string;
    totalCents: number;
    createdAt: Date;
  }[];
  openByStatus: { status: string; count: number }[];
  lowStock: {
    productId: string;
    productName: string;
    sku: string;
    variantLabel: string;
    available: number;
    lowStockAt: number;
  }[];
};

type RawBucket = { bucket: string; count: number; revenue: bigint | number };

const toBuckets = (rows: RawBucket[]): SalesBucket[] =>
  rows.map((r) => ({
    bucket: r.bucket,
    count: Number(r.count),
    revenueCents: Number(r.revenue),
  }));

async function salesSeries(
  db: PrismaClient,
  unit: "day" | "week" | "month",
  steps: number,
  label: string,
): Promise<SalesBucket[]> {
  const rows = await db.$queryRawUnsafe<RawBucket[]>(
    `WITH ventas AS (${VENTAS_CTE})
     SELECT to_char(d.bucket, '${label}') AS bucket,
            COUNT(v.sold_at)::int AS count,
            COALESCE(SUM(v."totalCents"), 0)::bigint AS revenue
     FROM generate_series(
            date_trunc('${unit}', now() AT TIME ZONE '${TZ}') - interval '${steps - 1} ${unit}',
            date_trunc('${unit}', now() AT TIME ZONE '${TZ}'),
            interval '1 ${unit}'
          ) AS d(bucket)
     LEFT JOIN ventas v
       ON date_trunc('${unit}', (v.sold_at AT TIME ZONE 'UTC') AT TIME ZONE '${TZ}') = d.bucket
     GROUP BY d.bucket
     ORDER BY d.bucket`,
  );
  return toBuckets(rows);
}

async function salesTotalSince(
  db: PrismaClient,
  days: number,
): Promise<{ count: number; revenueCents: number }> {
  const rows = await db.$queryRawUnsafe<
    { count: number; revenue: bigint | number }[]
  >(
    `WITH ventas AS (${VENTAS_CTE})
     SELECT COUNT(*)::int AS count,
            COALESCE(SUM(v."totalCents"), 0)::bigint AS revenue
     FROM ventas v
     WHERE (v.sold_at AT TIME ZONE 'UTC') AT TIME ZONE '${TZ}'
           >= date_trunc('day', now() AT TIME ZONE '${TZ}') - interval '${days - 1} days'`,
  );
  const row = rows[0];
  return { count: Number(row?.count ?? 0), revenueCents: Number(row?.revenue ?? 0) };
}

export async function getDashboardData(db: PrismaClient): Promise<DashboardData> {
  const [hoy, ultimos7, ultimos30, daily, weekly, monthly] = await Promise.all([
    salesTotalSince(db, 1),
    salesTotalSince(db, 7),
    salesTotalSince(db, 30),
    salesSeries(db, "day", 14, "YYYY-MM-DD"),
    salesSeries(db, "week", 8, "YYYY-MM-DD"),
    salesSeries(db, "month", 6, "YYYY-MM"),
  ]);

  const [topRows, recentOrders, openGroups, lowStockVariants] =
    await Promise.all([
      db.$queryRawUnsafe<
        { productName: string; units: number; revenue: bigint | number }[]
      >(
        `WITH ventas AS (
           SELECT o.id, COALESCE(o."paidAt", o."updatedAt") AS sold_at
           FROM "Order" o
           WHERE (o."paidAt" IS NOT NULL
                  AND o.status::text IN ('PAID','PROCESSING','SHIPPED','DELIVERED'))
              OR (o."paidAt" IS NULL AND o.status::text = 'DELIVERED')
         )
         SELECT oi."productName" AS "productName",
                SUM(oi.quantity)::int AS units,
                SUM(oi."totalCents")::bigint AS revenue
         FROM "OrderItem" oi
         JOIN ventas v ON v.id = oi."orderId"
         WHERE (v.sold_at AT TIME ZONE 'UTC') AT TIME ZONE '${TZ}'
               >= date_trunc('day', now() AT TIME ZONE '${TZ}') - interval '29 days'
         GROUP BY oi."productName"
         ORDER BY revenue DESC
         LIMIT 5`,
      ),
      db.order.findMany({
        orderBy: { createdAt: "desc" },
        take: 8,
        select: {
          orderNumber: true,
          status: true,
          totalCents: true,
          createdAt: true,
        },
      }),
      db.order.groupBy({
        by: ["status"],
        where: { status: { in: ["PENDING", "PAID", "PROCESSING", "SHIPPED"] } },
        _count: { _all: true },
      }),
      db.productVariant.findMany({
        where: {
          isActive: true,
          product: { status: "ACTIVE" },
        },
        select: {
          sku: true,
          stockOnHand: true,
          stockReserved: true,
          lowStockAt: true,
          product: { select: { id: true, name: true } },
          optionValues: { select: { optionValue: { select: { value: true } } } },
        },
      }),
    ]);

  // available = stockOnHand - stockReserved, the only number the storefront
  // sells from. Computed here, filtered here — a variant at or under its
  // threshold is what the owner needs to reorder.
  const lowStock = lowStockVariants
    .map((v) => ({
      productId: v.product.id,
      productName: v.product.name,
      sku: v.sku,
      variantLabel: v.optionValues
        .map((ov) => ov.optionValue.value)
        .join(" / "),
      available: v.stockOnHand - v.stockReserved,
      lowStockAt: v.lowStockAt,
    }))
    .filter((v) => v.available <= v.lowStockAt)
    .sort((a, b) => a.available - b.available)
    .slice(0, 10);

  return {
    kpis: { hoy, ultimos7, ultimos30 },
    daily,
    weekly,
    monthly,
    topProducts: topRows.map((r) => ({
      productName: r.productName,
      units: Number(r.units),
      revenueCents: Number(r.revenue),
    })),
    recentOrders,
    openByStatus: openGroups.map((g) => ({
      status: g.status,
      count: g._count._all,
    })),
    lowStock,
  };
}
