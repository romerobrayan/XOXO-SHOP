import type { PaymentStatus } from "@/generated/prisma/enums";

export interface CreatePaymentInput {
  orderId: string;
  orderNumber: string;
  amountCents: number;
  currency: "COP";
  customerEmail: string;
  /** Where the gateway should send the customer after paying. */
  redirectUrl: string;
}

export interface CreatePaymentResult {
  /** Gateway's transaction/intent reference. */
  providerReference: string;
  /** Where to send the customer to complete payment. */
  checkoutUrl: string;
}

export interface WebhookEvent {
  providerReference: string;
  status: PaymentStatus;
  rawPayload: unknown;
}
