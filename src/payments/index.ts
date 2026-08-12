import type { PaymentProvider } from "./payment-provider";
import { MockProvider } from "./providers/mock";
import { WompiProvider, wompiConfigFromEnv } from "./providers/wompi";

// Factory — reads PAYMENT_PROVIDER from the environment.
// "mock" until a merchant account is confirmed. Wompi is the primary target and
// PayU the documented fallback — ADR 002 flipped that ordering, superseding the
// spec §2 text. Never "stripe": prohibited category, see CLAUDE.md.
export function getPaymentProvider(): PaymentProvider {
  const provider = process.env.PAYMENT_PROVIDER ?? "mock";

  switch (provider) {
    case "mock":
      return new MockProvider();
    case "wompi":
      // El adaptador existe pero NO está verificado contra el sandbox: correr
      // una transacción de prueba con llaves `pub_test_` antes de prender esto
      // en cualquier entorno. Ver la cabecera de providers/wompi.ts.
      return new WompiProvider(wompiConfigFromEnv());
    // case "payu": — fallback documentado, entra si Wompi rechaza la categoría
    default:
      throw new Error(`Unknown PAYMENT_PROVIDER: ${provider}`);
  }
}

export type { PaymentProvider } from "./payment-provider";
export type {
  CreatePaymentInput,
  CreatePaymentResult,
  WebhookEvent,
} from "./types";
