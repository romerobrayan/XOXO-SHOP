import type { Metadata } from "next";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import {
  getDashboardData,
  SALE_DEFINITION,
} from "@/features/dashboard/metrics";
import { OrderStatusBadge } from "@/features/orders/components/OrderStatusBadge";
import { STATUS_LABEL } from "@/features/orders/transitions";
import type { OrderStatus } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { formatCOP } from "@/lib/money";

export const metadata: Metadata = {
  title: "Inicio",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const MES = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic",
];

function diaCorto(bucket: string): string {
  return bucket.slice(8);
}

function semanaLabel(bucket: string): string {
  const [, month, day] = bucket.split("-");
  return `del ${Number(day)} ${MES[Number(month) - 1]}`;
}

function mesLabel(bucket: string): string {
  const [year, month] = bucket.split("-");
  return `${MES[Number(month) - 1]} ${year}`;
}

export default async function AdminInicioPage() {
  const data = await getDashboardData(db);
  const maxDaily = Math.max(1, ...data.daily.map((d) => d.revenueCents));

  return (
    <section className="grid gap-6">
      <div>
        <h1 className="font-[family-name:--font-display] text-[32px]">
          Inicio
        </h1>
        <p className="mt-1 max-w-2xl text-sm font-light text-suave">
          {SALE_DEFINITION} Todo sale de tu propia base de datos — acá no hay
          rastreadores de terceros.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {(
          [
            ["Hoy", data.kpis.hoy],
            ["Últimos 7 días", data.kpis.ultimos7],
            ["Últimos 30 días", data.kpis.ultimos30],
          ] as const
        ).map(([label, kpi]) => (
          <div
            key={label}
            className="rounded-[4px] border border-linea bg-crema p-4"
          >
            <p className="text-[12px] font-medium tracking-kicker text-cobre uppercase">
              {label}
            </p>
            <p className="mt-2 text-[24px] font-semibold text-vino tabular-nums">
              {formatCOP(kpi.revenueCents)}
            </p>
            <p className="text-[13px] font-light text-tenue">
              {kpi.count} venta{kpi.count === 1 ? "" : "s"}
            </p>
          </div>
        ))}
      </div>

      <div className="rounded-[4px] border border-linea bg-crema p-4">
        <h2 className="mb-4 text-[12px] font-medium tracking-kicker text-cobre uppercase">
          Ventas por día — últimas dos semanas
        </h2>
        <div className="flex items-end gap-1 sm:gap-2" aria-hidden="true">
          {data.daily.map((d) => (
            <div key={d.bucket} className="grid flex-1 gap-1">
              <div className="grid h-28 items-end">
                <div
                  className="rounded-t-[2px] bg-vino/80"
                  style={{
                    height: `${Math.max(d.revenueCents > 0 ? 6 : 1, Math.round((d.revenueCents / maxDaily) * 100))}%`,
                  }}
                  title={`${d.bucket}: ${formatCOP(d.revenueCents)} · ${d.count} venta${d.count === 1 ? "" : "s"}`}
                />
              </div>
              <span className="text-center text-[11px] font-light text-tenue tabular-nums">
                {diaCorto(d.bucket)}
              </span>
            </div>
          ))}
        </div>
        <table className="sr-only">
          <caption>Ventas por día</caption>
          <thead>
            <tr>
              <th>Día</th>
              <th>Ventas</th>
              <th>Ingresos</th>
            </tr>
          </thead>
          <tbody>
            {data.daily.map((d) => (
              <tr key={d.bucket}>
                <td>{d.bucket}</td>
                <td>{d.count}</td>
                <td>{formatCOP(d.revenueCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-[4px] border border-linea bg-crema p-4">
          <h2 className="mb-3 text-[12px] font-medium tracking-kicker text-cobre uppercase">
            Por semana
          </h2>
          <ul className="grid gap-2">
            {[...data.weekly].reverse().map((w) => (
              <li
                key={w.bucket}
                className="flex items-baseline justify-between gap-3 border-b border-linea pb-2 text-sm last:border-b-0 last:pb-0"
              >
                <span className="font-light text-suave">
                  Semana {semanaLabel(w.bucket)}
                </span>
                <span className="text-right">
                  <span className="font-semibold text-vino tabular-nums">
                    {formatCOP(w.revenueCents)}
                  </span>
                  <span className="ml-2 text-[13px] font-light text-tenue tabular-nums">
                    {w.count} venta{w.count === 1 ? "" : "s"}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-[4px] border border-linea bg-crema p-4">
          <h2 className="mb-3 text-[12px] font-medium tracking-kicker text-cobre uppercase">
            Por mes
          </h2>
          <ul className="grid gap-2">
            {[...data.monthly].reverse().map((m) => (
              <li
                key={m.bucket}
                className="flex items-baseline justify-between gap-3 border-b border-linea pb-2 text-sm last:border-b-0 last:pb-0"
              >
                <span className="font-light text-suave">{mesLabel(m.bucket)}</span>
                <span className="text-right">
                  <span className="font-semibold text-vino tabular-nums">
                    {formatCOP(m.revenueCents)}
                  </span>
                  <span className="ml-2 text-[13px] font-light text-tenue tabular-nums">
                    {m.count} venta{m.count === 1 ? "" : "s"}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-[4px] border border-linea bg-crema p-4">
          <h2 className="mb-3 text-[12px] font-medium tracking-kicker text-cobre uppercase">
            Más vendidos — últimos 30 días
          </h2>
          {data.topProducts.length === 0 ? (
            <p className="text-sm font-light text-suave">
              Todavía no hay ventas en el período.
            </p>
          ) : (
            <ol className="grid gap-2">
              {data.topProducts.map((p, i) => (
                <li
                  key={p.productName}
                  className="flex items-baseline justify-between gap-3 border-b border-linea pb-2 text-sm last:border-b-0 last:pb-0"
                >
                  <span className="font-light">
                    <span className="mr-2 text-[13px] text-tenue tabular-nums">
                      {i + 1}.
                    </span>
                    {p.productName}
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="font-semibold text-vino tabular-nums">
                      {formatCOP(p.revenueCents)}
                    </span>
                    <span className="ml-2 text-[13px] font-light text-tenue tabular-nums">
                      {p.units} und.
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>

        <div className="rounded-[4px] border border-linea bg-crema p-4">
          <h2 className="mb-3 text-[12px] font-medium tracking-kicker text-cobre uppercase">
            Stock bajo
          </h2>
          {data.lowStock.length === 0 ? (
            <p className="text-sm font-light text-suave">
              Ninguna variante activa está en su umbral.
            </p>
          ) : (
            <ul className="grid gap-2">
              {data.lowStock.map((v) => (
                <li key={v.sku}>
                  <Link
                    href={`/admin/productos/${v.productId}`}
                    className="flex items-baseline justify-between gap-3 border-b border-linea pb-2 text-sm transition-colors duration-150 last:border-b-0 last:pb-0 hover:text-vino"
                  >
                    <span className="font-light">
                      {v.productName}
                      {v.variantLabel ? (
                        <span className="text-[13px] text-tenue">
                          {" "}
                          · {v.variantLabel}
                        </span>
                      ) : null}
                    </span>
                    {v.available <= 0 ? (
                      <Badge variant="error">Agotado</Badge>
                    ) : (
                      <Badge variant="oro">Quedan {v.available}</Badge>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="rounded-[4px] border border-linea bg-crema p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[12px] font-medium tracking-kicker text-cobre uppercase">
            Pedidos recientes
          </h2>
          <div className="flex flex-wrap gap-2">
            {data.openByStatus.map((g) => (
              <span
                key={g.status}
                className="text-[13px] font-light text-tenue"
              >
                {STATUS_LABEL[g.status as OrderStatus] ?? g.status}:{" "}
                <span className="font-medium text-cuerpo tabular-nums">
                  {g.count}
                </span>
              </span>
            ))}
          </div>
        </div>
        {data.recentOrders.length === 0 ? (
          <p className="text-sm font-light text-suave">Sin pedidos todavía.</p>
        ) : (
          <ul className="grid gap-2">
            {data.recentOrders.map((o) => (
              <li key={o.orderNumber}>
                <Link
                  href={`/admin/pedidos/${o.orderNumber}`}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-[4px] border border-linea bg-marfil p-3 transition-shadow duration-150 hover:shadow-card"
                >
                  <span className="flex items-center gap-3">
                    <span className="font-medium tabular-nums">
                      {o.orderNumber}
                    </span>
                    <OrderStatusBadge status={o.status as OrderStatus} />
                  </span>
                  <span className="font-semibold text-vino tabular-nums">
                    {formatCOP(o.totalCents)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3">
          <Link
            href="/admin/pedidos"
            className="text-[13px] font-medium tracking-boton text-cobre uppercase transition-colors duration-150 hover:text-vino"
          >
            Todos los pedidos →
          </Link>
        </p>
      </div>
    </section>
  );
}
