import type { PaymentMethod, PaymentStatus } from "@/generated/prisma/enums";

export interface CreatePaymentInput {
  orderId: string;
  orderNumber: string;
  amountCents: number;
  currency: "COP";
  customerEmail: string;
  /** Where the gateway should send the customer after paying. */
  redirectUrl: string;
  /**
   * When the payment link stops being payable — the order's reservation
   * expiry. A gateway that honors it (Wompi's expiration-time) refuses the
   * payment after the sweep releases the stock, closing the race where money
   * arrives for an order that was already cancelled.
   */
  expiresAt?: Date;
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
  /**
   * The rail the customer actually paid with (CARD / PSE / NEQUI…), which
   * only the gateway knows — checkout never asks. Null when the provider
   * reports a rail our enum does not model; rawPayload keeps the truth.
   */
  method: PaymentMethod | null;
  rawPayload: unknown;
}
