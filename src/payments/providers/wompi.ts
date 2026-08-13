import { createHash, timingSafeEqual } from "node:crypto";

import type { PaymentMethod, PaymentStatus } from "@/generated/prisma/enums";
import type { PaymentProvider } from "../payment-provider";
import type {
  CreatePaymentInput,
  CreatePaymentResult,
  WebhookEvent,
} from "../types";

// Wompi (Bancolombia) — the primary gateway per ADR 002. This adapter is the
// only place Wompi's protocol appears; everything upstream talks to the
// PaymentProvider port (CLAUDE.md rule 5).
//
// ─────────────────────────────────────────────────────────────────────────
// VERIFICADO CONTRA EL SANDBOX (2026-08-13, cuenta de prueba "SECRETO BTQ"):
//
// - Firma de integridad CONFIRMADA, con y sin expiration-time: transacciones
//   reales creadas contra sandbox.wompi.co con la firma exacta de este
//   adaptador — 4242… aprobó, 4111… rechazó, y un reintento sobre la misma
//   referencia tras un rechazo aprobó. Una firma equivocada falla ahí con
//   422, así que el sandbox ES el verificador.
// - Checksum de eventos CONFIRMADO contra eventos construidos con el formato
//   documentado, transacciones reales del sandbox y el secreto de eventos
//   real: aprobado, rechazado, duplicado y fuera de orden.
//
// Lo único no ejercitado es la ENTREGA HTTP del propio Wompi, porque exige
// registrar la URL de eventos en el panel (Desarrollo → Programadores → URL
// de Eventos, en modo prueba) apuntando a un despliegue público:
// https://<host>/api/webhooks/wompi. Hacerlo es parte de encender
// PAYMENT_PROVIDER=wompi en Preview; en Production, además, llaves prod_ y
// la URL de eventos en modo producción.
// ─────────────────────────────────────────────────────────────────────────

const DEFAULT_CHECKOUT_URL = "https://checkout.wompi.co/p/";

export type WompiConfig = {
  /** `pub_test_…` en sandbox, `pub_prod_…` en producción. */
  publicKey: string;
  /** Secreto de integridad — firma el enlace de pago. */
  integritySecret: string;
  /** Secreto de eventos — verifica los webhooks. Es OTRO secreto. */
  eventsSecret: string;
  /** Se sobreescribe solo en pruebas. */
  checkoutUrl?: string;
};

export function wompiConfigFromEnv(
  // Solo se leen tres llaves de texto, así que el tipo es el mínimo que las
  // cubre — y `process.env` encaja sin castear.
  env: Record<string, string | undefined> = process.env,
): WompiConfig {
  const missing = [
    "WOMPI_PUBLIC_KEY",
    "WOMPI_INTEGRITY_SECRET",
    "WOMPI_EVENTS_SECRET",
  ].filter((key) => !env[key]);

  if (missing.length > 0) {
    // Falla al construir y no al cobrar: un checkout que llega hasta la
    // pasarela y ahí descubre que le falta una llave ya perdió al comprador.
    throw new Error(
      `PAYMENT_PROVIDER=wompi requires ${missing.join(", ")} in the environment`,
    );
  }

  return {
    publicKey: env.WOMPI_PUBLIC_KEY!,
    integritySecret: env.WOMPI_INTEGRITY_SECRET!,
    eventsSecret: env.WOMPI_EVENTS_SECRET!,
    checkoutUrl: env.WOMPI_CHECKOUT_URL,
  };
}

const sha256 = (value: string) =>
  createHash("sha256").update(value, "utf8").digest("hex");

/** Compara dos hex de igual semántica sin filtrar información por tiempo. */
function checksumsMatch(a: string, b: string): boolean {
  const left = Buffer.from(a.toLowerCase(), "utf8");
  const right = Buffer.from(b.toLowerCase(), "utf8");
  // timingSafeEqual exige la misma longitud; distinta longitud ya es un no.
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/** Resuelve "transaction.status" contra el objeto `data` del evento. */
function resolvePath(data: unknown, path: string): unknown {
  return path
    .split(".")
    .reduce<unknown>(
      (node, key) =>
        node && typeof node === "object"
          ? (node as Record<string, unknown>)[key]
          : undefined,
      data,
    );
}

type WompiEventBody = {
  event?: string;
  data?: { transaction?: Record<string, unknown> };
  timestamp?: number;
  signature?: { properties?: string[]; checksum?: string };
};

// El riel lo elige el comprador dentro del checkout de Wompi; el checkout
// nuestro nunca lo pregunta. Estos son los payment_method_type que calzan
// 1:1 con nuestro enum — cualquier otro (BANCOLOMBIA_COLLECT, PCOL, QR…)
// queda como null y el rawPayload conserva el valor exacto.
const WOMPI_METHOD_TO_ENUM: Record<string, PaymentMethod> = {
  CARD: "CARD",
  PSE: "PSE",
  NEQUI: "NEQUI",
  DAVIPLATA: "DAVIPLATA",
  BANCOLOMBIA_TRANSFER: "BANCOLOMBIA_TRANSFER",
};

function mapPaymentMethodType(value: unknown): PaymentMethod | null {
  return typeof value === "string"
    ? (WOMPI_METHOD_TO_ENUM[value] ?? null)
    : null;
}

export class WompiProvider implements PaymentProvider {
  readonly name = "wompi";

  constructor(private readonly config: WompiConfig) {}

  /**
   * Web Checkout: no se crea una transacción del lado de Wompi, se arma un
   * enlace firmado y el comprador vuelve con un evento. Por eso el
   * `providerReference` que devolvemos es NUESTRA referencia y no un id de
   * Wompi: el id de transacción solo existe cuando llega el evento, y ahí
   * queda guardado en `rawPayload` para conciliación.
   */
  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    const reference = input.orderNumber;

    // amountCents ya está en unidades menores (CLAUDE.md regla 1), que es
    // exactamente lo que Wompi llama amount-in-cents. No se multiplica nada.
    const amountInCents = String(input.amountCents);

    // Con expiración, la fecha entra a la firma ENTRE la moneda y el secreto:
    // "<referencia><monto><moneda><expiración><secreto>", ISO8601 UTC — el
    // formato exacto de Date.toISOString(). Sin expiración, se omite entera.
    const expiration = input.expiresAt?.toISOString();
    const signature = sha256(
      `${reference}${amountInCents}${input.currency}${expiration ?? ""}${this.config.integritySecret}`,
    );

    const url = new URL(this.config.checkoutUrl ?? DEFAULT_CHECKOUT_URL);
    url.searchParams.set("public-key", this.config.publicKey);
    url.searchParams.set("currency", input.currency);
    url.searchParams.set("amount-in-cents", amountInCents);
    url.searchParams.set("reference", reference);
    url.searchParams.set("signature:integrity", signature);
    url.searchParams.set("redirect-url", input.redirectUrl);
    if (expiration) {
      url.searchParams.set("expiration-time", expiration);
    }
    if (input.customerEmail) {
      url.searchParams.set("customer-data:email", input.customerEmail);
    }

    return {
      providerReference: reference,
      checkoutUrl: url.toString(),
    };
  }

  /**
   * El evento trae su propia firma en el cuerpo: la lista de propiedades que
   * entraron al hash, en orden, más el timestamp y el secreto de eventos.
   * Devolver `null` es rechazar — la ruta responde 400 y Wompi reintenta.
   *
   * Wompi documenta explícitamente que el redirect NO sirve para dar por
   * buena una transacción; solo el evento. Por eso toda la confianza vive acá.
   */
  async verifyWebhook(rawBody: string): Promise<WebhookEvent | null> {
    let body: WompiEventBody;
    try {
      body = JSON.parse(rawBody) as WompiEventBody;
    } catch {
      return null;
    }

    const properties = body.signature?.properties;
    const checksum = body.signature?.checksum;
    const transaction = body.data?.transaction;

    if (
      !Array.isArray(properties) ||
      properties.length === 0 ||
      typeof checksum !== "string" ||
      typeof body.timestamp !== "number" ||
      !transaction
    ) {
      return null;
    }

    // Una propiedad que no resuelve haría que se firme "undefined" y el hash
    // coincidiría con el de un atacante que mande la misma basura. Se rechaza.
    const values: string[] = [];
    for (const path of properties) {
      const value = resolvePath(body.data, path);
      if (value === undefined || value === null) return null;
      values.push(String(value));
    }

    const expected = sha256(
      `${values.join("")}${body.timestamp}${this.config.eventsSecret}`,
    );

    if (!checksumsMatch(expected, checksum)) return null;

    const reference = transaction.reference;
    if (typeof reference !== "string" || reference.length === 0) return null;

    return {
      providerReference: reference,
      status: this.mapStatus(String(transaction.status ?? "")),
      method: mapPaymentMethodType(transaction.payment_method_type),
      rawPayload: body,
    };
  }

  mapStatus(providerStatus: string): PaymentStatus {
    switch (providerStatus) {
      case "APPROVED":
        return "APPROVED";
      case "DECLINED":
        return "DECLINED";
      case "VOIDED":
        return "VOIDED";
      case "ERROR":
        return "ERROR";
      case "PENDING":
        return "PENDING";
      default:
        // Un estado que no conocemos no se adivina hacia APPROVED.
        return "PENDING";
    }
  }
}
