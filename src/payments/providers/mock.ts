import type { PaymentStatus } from "@/generated/prisma/enums";
import type { PaymentProvider } from "../payment-provider";
import type {
  CreatePaymentInput,
  CreatePaymentResult,
  WebhookEvent,
} from "../types";

// Phase 0 / local dev provider. Approves everything instantly so the whole
// checkout flow can be built and demoed before a merchant account exists.
export class MockProvider implements PaymentProvider {
  readonly name = "mock";

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    return {
      providerReference: `mock_${input.orderNumber}`,
      checkoutUrl: `${input.redirectUrl}?mock=approved`,
    };
  }

  async verifyWebhook(rawBody: string): Promise<WebhookEvent | null> {
    try {
      const payload = JSON.parse(rawBody) as {
        providerReference?: string;
        status?: string;
      };
      if (!payload.providerReference) return null;
      return {
        providerReference: payload.providerReference,
        status: this.mapStatus(payload.status ?? "APPROVED"),
        rawPayload: payload,
      };
    } catch {
      return null;
    }
  }

  mapStatus(providerStatus: string): PaymentStatus {
    switch (providerStatus) {
      case "APPROVED":
        return "APPROVED";
      case "DECLINED":
        return "DECLINED";
      case "VOIDED":
        return "VOIDED";
      default:
        return "PENDING";
    }
  }
}
