import { describe, expect, it } from "vitest";

import { WompiProvider, wompiConfigFromEnv, type WompiConfig } from "./wompi";

// Los dos digests de abajo NO se calculan con el código bajo prueba: salieron
// de `sha256sum` sobre la cadena concatenada a mano. Si el adaptador cambiara
// el orden de concatenación, estas pruebas fallan — que es justo lo que un
// test tautológico (rehacer el hash con la misma función) no atraparía.
//
//   printf '%s' 'SECRETO-7J5VZ6920000COPtest_integrity_secret' | sha256sum
//   printf '%s' 'SECRETO-7J5VZ6920000COP2026-09-01T12:00:00.000Ztest_integrity_secret' | sha256sum
//   printf '%s' 'abc-123APPROVED9200001730000000test_events_secret' | sha256sum
const INTEGRITY_DIGEST =
  "2fdc4916178891fcc790108d368db423943e4e7a03824318c0dff85eaad657d1";
const INTEGRITY_DIGEST_WITH_EXPIRATION =
  "e94272a653cbbc012078b9f68cc457428abe9e198425da99ff0e0558b943dcba";
const EVENT_CHECKSUM =
  "87050b52b6096a26c2ca9a351ccdc9092b698309306266a2830f2ab7f5d20535";

const CONFIG: WompiConfig = {
  publicKey: "pub_test_llave",
  integritySecret: "test_integrity_secret",
  eventsSecret: "test_events_secret",
};

const provider = new WompiProvider(CONFIG);

const INPUT = {
  orderId: "ord_1",
  orderNumber: "SECRETO-7J5VZ6",
  amountCents: 9_200_00,
  currency: "COP" as const,
  customerEmail: "compradora@ejemplo.co",
  redirectUrl: "https://secretxoxo-shop.vercel.app/checkout/gracias",
};

/** Evento válido, listo para que cada prueba lo deforme a su gusto. */
function evento(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    event: "transaction.updated",
    data: {
      transaction: {
        id: "abc-123",
        status: "APPROVED",
        amount_in_cents: 9_200_00,
        reference: "SECRETO-7J5VZ6",
        currency: "COP",
      },
    },
    timestamp: 1_730_000_000,
    signature: {
      properties: [
        "transaction.id",
        "transaction.status",
        "transaction.amount_in_cents",
      ],
      checksum: EVENT_CHECKSUM,
    },
    environment: "test",
    ...overrides,
  });
}

describe("createPayment", () => {
  it("firma referencia + monto + moneda + secreto de integridad", async () => {
    const { checkoutUrl } = await provider.createPayment(INPUT);
    const params = new URL(checkoutUrl).searchParams;

    expect(params.get("signature:integrity")).toBe(INTEGRITY_DIGEST);
  });

  it("manda el monto en unidades menores tal cual, sin multiplicar", async () => {
    // amountCents ya ES amount-in-cents. Multiplicar acá cobraría 100 veces.
    const { checkoutUrl } = await provider.createPayment(INPUT);
    const params = new URL(checkoutUrl).searchParams;

    expect(params.get("amount-in-cents")).toBe("920000");
  });

  it("arma el enlace de Web Checkout con todo lo que Wompi necesita", async () => {
    const { checkoutUrl, providerReference } =
      await provider.createPayment(INPUT);
    const url = new URL(checkoutUrl);

    expect(url.origin + url.pathname).toBe("https://checkout.wompi.co/p/");
    expect(url.searchParams.get("public-key")).toBe("pub_test_llave");
    expect(url.searchParams.get("currency")).toBe("COP");
    expect(url.searchParams.get("reference")).toBe("SECRETO-7J5VZ6");
    expect(url.searchParams.get("redirect-url")).toBe(INPUT.redirectUrl);
    // En Web Checkout no existe id de transacción todavía: la referencia
    // nuestra es la llave con la que el evento va a encontrar el Payment.
    expect(providerReference).toBe("SECRETO-7J5VZ6");
    // Sin expiresAt, el parámetro no viaja — mandarlo vacío rompe el widget.
    expect(url.searchParams.has("expiration-time")).toBe(false);
  });

  it("con expiración: la fecha entra al enlace Y a la firma, en ISO8601 UTC", async () => {
    const { checkoutUrl } = await provider.createPayment({
      ...INPUT,
      expiresAt: new Date("2026-09-01T12:00:00.000Z"),
    });
    const params = new URL(checkoutUrl).searchParams;

    // La cadena firmada es <referencia><monto><moneda><expiración><secreto>:
    // la expiración va ENTRE la moneda y el secreto, no al final ni ausente.
    expect(params.get("expiration-time")).toBe("2026-09-01T12:00:00.000Z");
    expect(params.get("signature:integrity")).toBe(
      INTEGRITY_DIGEST_WITH_EXPIRATION,
    );
  });
});

describe("verifyWebhook", () => {
  it("acepta un evento con checksum correcto", async () => {
    const event = await provider.verifyWebhook(evento());

    expect(event).not.toBeNull();
    expect(event?.providerReference).toBe("SECRETO-7J5VZ6");
    expect(event?.status).toBe("APPROVED");
  });

  it("extrae el riel de pago cuando calza con el enum, null cuando no", async () => {
    // payment_method_type NO está en las propiedades firmadas del evento de
    // arriba, así que cambiarlo no invalida el checksum — por eso el riel es
    // informativo (etiqueta del panel) y jamás decide una transición.
    const conRiel = await provider.verifyWebhook(
      evento({
        data: {
          transaction: {
            id: "abc-123",
            status: "APPROVED",
            amount_in_cents: 9_200_00,
            reference: "SECRETO-7J5VZ6",
            currency: "COP",
            payment_method_type: "NEQUI",
          },
        },
      }),
    );
    expect(conRiel?.method).toBe("NEQUI");

    const rielDesconocido = await provider.verifyWebhook(
      evento({
        data: {
          transaction: {
            id: "abc-123",
            status: "APPROVED",
            amount_in_cents: 9_200_00,
            reference: "SECRETO-7J5VZ6",
            currency: "COP",
            payment_method_type: "BANCOLOMBIA_COLLECT",
          },
        },
      }),
    );
    expect(rielDesconocido?.method).toBeNull();

    const sinRiel = await provider.verifyWebhook(evento());
    expect(sinRiel?.method).toBeNull();
  });

  it("rechaza un checksum equivocado", async () => {
    const body = evento();
    const tampered = body.replace(EVENT_CHECKSUM, "0".repeat(64));

    expect(await provider.verifyWebhook(tampered)).toBeNull();
  });

  it("rechaza si cambian el estado sin recalcular la firma", async () => {
    // El ataque obvio: un DECLINED convertido en APPROVED en tránsito.
    const body = evento().replace('"status":"APPROVED"', '"status":"DECLINED"');

    expect(await provider.verifyWebhook(body)).toBeNull();
  });

  it("rechaza si cambian el monto sin recalcular la firma", async () => {
    const body = evento().replace(
      '"amount_in_cents":920000',
      '"amount_in_cents":100',
    );

    expect(await provider.verifyWebhook(body)).toBeNull();
  });

  it("rechaza si mueven el timestamp", async () => {
    expect(await provider.verifyWebhook(evento({ timestamp: 1 }))).toBeNull();
  });

  it("rechaza una propiedad firmada que no existe en el evento", async () => {
    // Si se firmara "undefined", cualquiera podría reproducir el hash.
    const body = evento({
      signature: {
        properties: ["transaction.no_existe"],
        checksum: EVENT_CHECKSUM,
      },
    });

    expect(await provider.verifyWebhook(body)).toBeNull();
  });

  it("rechaza un cuerpo sin firma, sin transacción o que no es JSON", async () => {
    expect(await provider.verifyWebhook("no es json")).toBeNull();
    expect(await provider.verifyWebhook("{}")).toBeNull();
    expect(
      await provider.verifyWebhook(evento({ signature: { properties: [] } })),
    ).toBeNull();
    expect(await provider.verifyWebhook(evento({ data: {} }))).toBeNull();
  });

  it("no confunde el secreto de eventos con el de integridad", async () => {
    const cruzado = new WompiProvider({
      ...CONFIG,
      eventsSecret: CONFIG.integritySecret,
    });

    expect(await cruzado.verifyWebhook(evento())).toBeNull();
  });
});

describe("mapStatus", () => {
  it("traduce los estados que Wompi publica", () => {
    expect(provider.mapStatus("APPROVED")).toBe("APPROVED");
    expect(provider.mapStatus("DECLINED")).toBe("DECLINED");
    expect(provider.mapStatus("VOIDED")).toBe("VOIDED");
    expect(provider.mapStatus("ERROR")).toBe("ERROR");
    expect(provider.mapStatus("PENDING")).toBe("PENDING");
  });

  it("nunca adivina hacia APPROVED ante un estado desconocido", () => {
    expect(provider.mapStatus("QUIEN_SABE")).toBe("PENDING");
    expect(provider.mapStatus("")).toBe("PENDING");
  });
});

describe("wompiConfigFromEnv", () => {
  it("lee las tres llaves del entorno", () => {
    const config = wompiConfigFromEnv({
      WOMPI_PUBLIC_KEY: "pub_test_x",
      WOMPI_INTEGRITY_SECRET: "i",
      WOMPI_EVENTS_SECRET: "e",
    });

    expect(config.publicKey).toBe("pub_test_x");
  });

  it("falla nombrando lo que falta, y falla al construir, no al cobrar", () => {
    expect(() =>
      wompiConfigFromEnv({
        WOMPI_PUBLIC_KEY: "pub_test_x",
      }),
    ).toThrow(/WOMPI_INTEGRITY_SECRET, WOMPI_EVENTS_SECRET/);
  });
});
