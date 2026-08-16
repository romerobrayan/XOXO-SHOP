import type { Metadata } from "next";
import Link from "next/link";

import { WhatsAppCta } from "@/components/commerce/WhatsAppCta";
import { Button } from "@/components/ui/button";
import { RefreshWhilePending } from "@/features/checkout/components/RefreshWhilePending";
import { buildGatewayCheckout } from "@/features/checkout/payment-initiation";
import {
  getOrderPaymentSummary,
  type OrderPaymentSummary,
} from "@/features/checkout/queries";
import { formatCOP } from "@/lib/money";
import { getPaymentProvider } from "@/payments";

// Where the gateway sends the buyer back. The redirect is a courtesy, not a
// confirmation — Wompi documents that explicitly — so this page only renders
// what the webhook has (or has not yet) recorded, and refreshes itself while
// the event is in flight. Reachable by anyone holding the order number,
// which is why it shows state and total, never a name or an address.
export const metadata: Metadata = {
  title: "Confirmación de pago",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type Estado =
  | "no-encontrado"
  | "confirmando"
  | "aprobado"
  | "fallido"
  | "expirado"
  | "pago-tras-expirar"
  | "reembolsado"
  // PAYMENT_PROVIDER=mock: there is no real gateway behind the link, so the
  // honest promise is the WhatsApp one — same as the inline confirmation.
  | "registrado";

function resolverEstado(summary: OrderPaymentSummary | null): Estado {
  if (!summary) return "no-encontrado";
  switch (summary.orderStatus) {
    case "PAID":
    case "PROCESSING":
    case "SHIPPED":
    case "DELIVERED":
      return "aprobado";
    case "REFUNDED":
      return "reembolsado";
    case "CANCELLED":
      return summary.gatewayPayment?.status === "APPROVED"
        ? "pago-tras-expirar"
        : "expirado";
    case "PENDING": {
      const payment = summary.gatewayPayment;
      if (payment?.provider === "mock") return "registrado";
      if (
        payment &&
        ["DECLINED", "VOIDED", "ERROR"].includes(payment.status)
      ) {
        return "fallido";
      }
      return "confirmando";
    }
  }
}

const TITULO: Record<Exclude<Estado, "no-encontrado">, string> = {
  confirmando: "Estamos confirmando tu pago",
  aprobado: "Pago confirmado",
  fallido: "Tu pago no se completó",
  expirado: "El tiempo de pago se agotó",
  "pago-tras-expirar": "Recibimos tu pago",
  reembolsado: "Pedido reembolsado",
  registrado: "Pedido registrado",
};

const CUERPO: Record<Exclude<Estado, "no-encontrado">, string> = {
  confirmando:
    "La confirmación del banco llega en unos segundos y esta página se actualiza sola. Guarda tu código de pedido.",
  aprobado:
    "Tu pedido quedó confirmado. Te escribimos por WhatsApp para coordinar la entrega. Recuerda: caja neutra, remitente genérico — tu secreto está a salvo.",
  fallido:
    "El banco no aprobó la transacción o el pago se canceló antes de terminar. No te preocupes: tu pedido sigue reservado por unos minutos y puedes intentarlo de nuevo.",
  expirado:
    "El pedido esperó su pago más tiempo del que podemos apartar las unidades, así que volvieron a estar disponibles. Arma tu bolsa de nuevo o escríbenos y lo resolvemos contigo.",
  "pago-tras-expirar":
    "Tu pago llegó cuando el pedido ya había expirado. No se pierde: escríbenos por WhatsApp con tu código y lo resolvemos de inmediato.",
  reembolsado:
    "Este pedido fue reembolsado. Si tienes preguntas sobre el reembolso, escríbenos por WhatsApp con tu código.",
  registrado:
    "Guarda este código. Te escribimos por WhatsApp para coordinar el pago y la entrega. Recuerda: caja neutra, remitente genérico — tu secreto está a salvo.",
};

export default async function GraciasPage({
  searchParams,
}: {
  searchParams: Promise<{ pedido?: string }>;
}) {
  const { pedido } = await searchParams;
  const summary = pedido ? await getOrderPaymentSummary(pedido) : null;
  const estado = resolverEstado(summary);

  if (estado === "no-encontrado" || !summary) {
    return (
      <Shell>
        <h1 className="text-2xl">No encontramos ese pedido</h1>
        <p className="mx-auto mt-4 max-w-[44ch] font-light">
          Revisa el enlace o escríbenos por WhatsApp con tu código de pedido y
          lo buscamos contigo.
        </p>
        <Acciones />
      </Shell>
    );
  }

  // A declined attempt is retryable while the reservation holds: same
  // reference, same amount, byte-identical signed link. Building it is pure
  // (no write); if the gateway is misconfigured the button simply degrades
  // to the WhatsApp path.
  let retryUrl: string | null = null;
  if (estado === "fallido" && summary.stillPayable) {
    try {
      const retry = await buildGatewayCheckout(getPaymentProvider(), summary);
      retryUrl = retry.checkoutUrl;
    } catch (error) {
      console.error("[checkout/gracias] retry link unavailable", error);
    }
  }

  return (
    <Shell>
      {estado === "confirmando" && <RefreshWhilePending />}
      {(estado === "aprobado" || estado === "registrado") && (
        <div
          aria-hidden="true"
          className="mx-auto mb-6 flex size-[88px] items-center justify-center rounded-full border-2 border-exito font-display text-3xl text-exito"
        >
          ✓
        </div>
      )}
      <h1 className="text-2xl">{TITULO[estado]}</h1>
      <p className="kicker mt-6">Tu pedido</p>
      <p className="mt-1 font-display text-2xl text-vino">
        {summary.orderNumber}
      </p>
      <p className="mt-2 text-sm text-suave">
        Total{" "}
        <span className="tabular font-semibold text-vino">
          {formatCOP(summary.totalCents)}
        </span>
      </p>
      <p className="mx-auto mt-4 max-w-[44ch] font-light">{CUERPO[estado]}</p>
      {estado === "confirmando" && (
        <p className="mt-3 text-sm font-light text-suave" aria-live="polite">
          Esta página se actualiza sola cada pocos segundos.
        </p>
      )}
      <Acciones retryUrl={retryUrl} />
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-[640px] px-4 py-12 text-center md:px-6 md:py-16">
      {children}
    </div>
  );
}

function Acciones({ retryUrl }: { retryUrl?: string | null }) {
  return (
    <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
      {retryUrl ? (
        <Button asChild>
          <a href={retryUrl}>Reintentar el pago</a>
        </Button>
      ) : null}
      <Button variant="outline" asChild>
        <Link href="/tienda">Volver a la tienda</Link>
      </Button>
      <WhatsAppCta message="Hola, tengo una pregunta sobre mi pedido">
        ¿Dudas? Escríbenos
      </WhatsAppCta>
    </div>
  );
}
