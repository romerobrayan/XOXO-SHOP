import type { Metadata } from "next";
import Link from "next/link";

import { OrderStatusBadge } from "@/features/orders/components/OrderStatusBadge";
import { countByStatus, listOrders, ORDER_PAGE_SIZE } from "@/features/orders/queries";
import { STATUS_LABEL } from "@/features/orders/transitions";
import { OrderStatus } from "@/generated/prisma/enums";
import { formatCOP } from "@/lib/money";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Pedidos",
  robots: { index: false, follow: false },
};

// Orders are written by customers at any time, so nothing here can be cached.
export const dynamic = "force-dynamic";

const dateFormat = new Intl.DateTimeFormat("es-CO", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

function isOrderStatus(value: string | undefined): value is OrderStatus {
  return value !== undefined && value in OrderStatus;
}

export default async function PedidosPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string }>;
}) {
  const { estado } = await searchParams;
  const status = isOrderStatus(estado) ? estado : undefined;

  const [orders, counts] = await Promise.all([
    listOrders(status),
    countByStatus(),
  ]);

  const total = [...counts.values()].reduce((a, b) => a + b, 0);

  return (
    <section className="grid gap-6">
      <div>
        <h1 className="font-[family-name:--font-display] text-[32px]">
          Pedidos
        </h1>
        <p className="mt-1 text-sm font-light text-suave">
          {total === 0
            ? "Todavía no hay pedidos."
            : `${total} pedido${total === 1 ? "" : "s"} en total.`}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <FilterChip href="/admin/pedidos" label="Todos" active={!status} />
        {Object.values(OrderStatus).map((s) => {
          const count = counts.get(s) ?? 0;
          if (count === 0 && s !== status) return null;
          return (
            <FilterChip
              key={s}
              href={`/admin/pedidos?estado=${s}`}
              label={`${STATUS_LABEL[s]} (${count})`}
              active={status === s}
            />
          );
        })}
      </div>

      {orders.length === 0 ? (
        <p className="rounded-[4px] border border-linea bg-crema p-6 text-sm font-light text-suave">
          No hay pedidos con este estado.
        </p>
      ) : (
        <ul className="grid gap-2">
          {orders.map((order) => (
            <li key={order.id}>
              <Link
                href={`/admin/pedidos/${order.orderNumber}`}
                className="grid gap-2 rounded-[4px] border border-linea bg-crema p-4 transition-shadow duration-150 hover:shadow-card sm:grid-cols-[1fr_auto] sm:items-center"
              >
                <div className="grid gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium tabular-nums">
                      {order.orderNumber}
                    </span>
                    <OrderStatusBadge status={order.status} />
                  </div>
                  <span className="text-sm font-light text-suave">
                    {order.address?.fullName ?? "Sin datos de envío"}
                    {order.address?.city ? ` · ${order.address.city}` : ""}
                    {" · "}
                    {order._count.items} artículo
                    {order._count.items === 1 ? "" : "s"}
                    {order.payments.some(
                      (p) => p.method === "CASH_ON_DELIVERY",
                    )
                      ? " · contra entrega"
                      : ""}
                  </span>
                </div>
                <div className="grid gap-1 sm:justify-items-end">
                  <span className="font-semibold text-vino tabular-nums">
                    {formatCOP(order.totalCents)}
                  </span>
                  <span className="text-[13px] font-light text-tenue tabular-nums">
                    {dateFormat.format(order.createdAt)}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {orders.length === ORDER_PAGE_SIZE ? (
        <p className="text-[13px] font-light text-tenue">
          Mostrando los {ORDER_PAGE_SIZE} más recientes.
        </p>
      ) : null}
    </section>
  );
}

function FilterChip({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "rounded-full border px-3 py-[5px] text-[11px] tracking-[1px] uppercase transition-colors duration-150",
        active
          ? "border-vino bg-vino text-marfil"
          : "border-linea bg-crema text-suave hover:text-vino",
      )}
    >
      {label}
    </Link>
  );
}
