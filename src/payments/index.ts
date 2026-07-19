import type { PaymentProvider } from "./payment-provider";
import { MockProvider } from "./providers/mock";

// Factory — reads PAYMENT_PROVIDER from the environment.
// "mock" until a merchant account is confirmed (PayU first, Wompi second — spec §2).
// Never "stripe": prohibited category, see CLAUDE.md.
export function getPaymentProvider(): PaymentProvider {
  const provider = process.env.PAYMENT_PROVIDER ?? "mock";

  switch (provider) {
    case "mock":
      return new MockProvider();
    // case "payu":  — Phase 3, once the merchant account is approved
    // case "wompi": — Phase 3, second conversation
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
