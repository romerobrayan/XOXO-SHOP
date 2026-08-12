import type { PaymentStatus } from "@/generated/prisma/enums";
import type {
  CreatePaymentInput,
  CreatePaymentResult,
  WebhookEvent,
} from "./types";

// The port. Checkout talks to this interface only — gateway SDKs and HTTP
// calls live exclusively in src/payments/providers/. See spec §2.
export interface PaymentProvider {
  readonly name: string;

  /** Creates a payment intent/transaction and returns where to send the customer. */
  createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult>;

  /** Verifies webhook authenticity. Every gateway signs differently. */
  verifyWebhook(
    rawBody: string,
    headers: Headers,
  ): Promise<WebhookEvent | null>;

  /** Normalizes a provider status into our own PaymentStatus enum. */
  mapStatus(providerStatus: string): PaymentStatus;
}
