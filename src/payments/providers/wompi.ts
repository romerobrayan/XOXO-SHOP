import { createHash, timingSafeEqual } from "node:crypto";

import type { PaymentStatus } from "@/generated/prisma/enums";
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
// SIN VERIFICAR CONTRA EL SANDBOX. El ADR 002 manda escribir este adaptador
// antes de que exista la cuenta, para sacar la pasarela de la ruta crítica —
// esto es eso. Las firmas están implementadas según el esquema publicado por
// Wompi y probadas contra vectores calculados a mano (wompi.test.ts), lo que
// prueba que la implementación es consistente, NO que el esquema sea el que
// Wompi usa hoy.
//
// Antes de poner PAYMENT_PROVIDER=wompi en cualquier entorno: correr una
// transacción de prueba con llaves `pub_test_` y un evento real del sandbox.
// El modo de falla es cerrado —un esquema equivocado rechaza el webhook, no
// acepta uno falso— así que la confirmación es un paso de verificación, no un
// riesgo abierto.
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

    const signature = sha256(
      `${reference}${amountInCents}${input.currency}${this.config.integritySecret}`,
    );

    const url = new URL(this.config.checkoutUrl ?? DEFAULT_CHECKOUT_URL);
    url.searchParams.set("public-key", this.config.publicKey);
    url.searchParams.set("currency", input.currency);
    url.searchParams.set("amount-in-cents", amountInCents);
    url.searchParams.set("reference", reference);
    url.searchParams.set("signature:integrity", signature);
    url.searchParams.set("redirect-url", input.redirectUrl);
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
