import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { OrderStatusBadge } from "@/features/orders/components/OrderStatusBadge";
import { StatusActions } from "@/features/orders/components/StatusActions";
import { getOrder } from "@/features/orders/queries";
import { formatCOP } from "@/lib/money";

export const metadata: Metadata = {
  title: "Pedido",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const dateTime = new Intl.DateTimeFormat("es-CO", {
  dateStyle: "medium",
  timeStyle: "short",
});

const PAYMENT_LABEL: Record<string, string> = {
  CARD: "Tarjeta",
  PSE: "PSE",
  NEQUI: "Nequi",
  DAVIPLATA: "Daviplata",
  BANCOLOMBIA_TRANSFER: "Transferencia Bancolombia",
  CASH_ON_DELIVERY: "Contra entrega",
  BANK_TRANSFER_MANUAL: "Transferencia con comprobante",
};

export default async function PedidoPage({
  params,
}: {
  params: Promise<{ orderNumber: string }>;
}) {
  const { orderNumber } = await params;
  const order = await getOrder(decodeURIComponent(orderNumber));

  if (!order) notFound();

  return (
    <section className="grid gap-6">
      <div>
        <Link
          href="/admin/pedidos"
          className="text-[13px] font-medium tracking-boton text-cuerpo uppercase transition-colors duration-150 hover:text-vino"
        >
          ← Pedidos
        </Link>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <h1 className="font-[family-name:--font-display] text-[32px] tabular-nums">
            {order.orderNumber}
          </h1>
          <OrderStatusBadge status={order.status} />
        </div>
        <p className="mt-1 text-sm font-light text-suave tabular-nums">
          Creado el {dateTime.format(order.createdAt)}
          {order.shippedAt
            ? ` · enviado el ${dateTime.format(order.shippedAt)}`
            : ""}
        </p>
      </div>

      <Card title="Estado">
        <StatusActions orderId={order.id} status={order.status} />
        {order.status === "PENDING" && order.reservationExpiresAt ? (
          <p className="mt-3 text-[13px] font-light text-tenue tabular-nums">
            El stock queda reservado hasta el{" "}
            {dateTime.format(order.reservationExpiresAt)}. Después se libera
            solo.
          </p>
        ) : null}
      </Card>

      <Card title="Artículos">
        <ul className="grid gap-3">
          {order.items.map((item) => (
            <li
              key={item.id}
              className="flex flex-wrap items-baseline justify-between gap-2 border-b border-linea pb-3 last:border-0 last:pb-0"
            >
              <div className="grid gap-0.5">
                <span className="font-medium">{item.productName}</span>
                <span className="text-[13px] font-light text-suave">
                  {item.brandName ? `${item.brandName} · ` : ""}
                  {item.variantSku}
                  {item.variantLabel ? ` · ${item.variantLabel}` : ""}
                </span>
              </div>
              <div className="text-right">
                <div className="tabular-nums">
                  {item.quantity} × {formatCOP(item.unitPriceCents)}
                </div>
                <div className="font-semibold text-vino tabular-nums">
                  {formatCOP(item.totalCents)}
                </div>
              </div>
            </li>
          ))}
        </ul>

        <dl className="mt-4 grid gap-1 border-t border-linea pt-4 text-sm">
          <Row label="Subtotal" value={formatCOP(order.subtotalCents)} />
          <Row label="Envío" value={formatCOP(order.shippingCents)} />
          {order.discountCents > 0 ? (
            <Row
              label="Descuento"
              value={`− ${formatCOP(order.discountCents)}`}
            />
          ) : null}
          <div className="mt-1 flex justify-between border-t border-linea pt-2">
            <dt className="font-medium">Total</dt>
            <dd className="font-semibold text-vino tabular-nums">
              {formatCOP(order.totalCents)}
            </dd>
          </div>
        </dl>
      </Card>

      <Card title="Entrega">
        {order.address ? (
          <dl className="grid gap-1 text-sm">
            <Row label="Nombre" value={order.address.fullName} />
            <Row label="Celular" value={order.address.phone} />
            <Row
              label="Documento"
              value={`${order.address.documentType} ${order.address.documentId}`}
            />
            <Row
              label="Dirección"
              value={`${order.address.line1}${
                order.address.neighborhood
                  ? `, ${order.address.neighborhood}`
                  : ""
              }`}
            />
            <Row
              label="Ciudad"
              value={`${order.address.city}, ${order.address.department}`}
            />
            {order.address.notes ? (
              <Row label="Notas" value={order.address.notes} />
            ) : null}
            {order.guestEmail ? (
              <Row label="Correo" value={order.guestEmail} />
            ) : null}
          </dl>
        ) : (
          <p className="text-sm font-light text-suave">
            Este pedido no tiene dirección asociada.
          </p>
        )}
        {order.discreetPackaging ? (
          <p className="mt-3 text-[13px] font-light text-exito">
            Empaque neutro — sin marca ni descripción visible.
          </p>
        ) : null}
      </Card>

      <Card title="Pago">
        {order.payments.length === 0 ? (
          <p className="text-sm font-light text-suave">
            Pago en línea: la pasarela todavía no registra un intento. Coordina
            por WhatsApp mientras tanto.
          </p>
        ) : (
          <ul className="grid gap-2 text-sm">
            {order.payments.map((payment) => (
              <li
                key={payment.id}
                className="flex flex-wrap justify-between gap-2"
              >
                <span>
                  {payment.method
                    ? (PAYMENT_LABEL[payment.method] ?? payment.method)
                    : // Initiated at the gateway but no event yet — the rail
                      // (tarjeta, Nequi, PSE) is the gateway's to report.
                      "En línea · riel por confirmar"}
                  <span className="text-suave"> · {payment.provider}</span>
                </span>
                <span className="tabular-nums">
                  {formatCOP(payment.amountCents)} · {payment.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </section>
  );
}

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[4px] border border-linea bg-crema p-5">
      <h2 className="mb-4 text-[12px] font-medium tracking-kicker text-cobre uppercase">
        {title}
      </h2>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="font-light text-suave">{label}</dt>
      <dd className="text-right tabular-nums">{value}</dd>
    </div>
  );
}
