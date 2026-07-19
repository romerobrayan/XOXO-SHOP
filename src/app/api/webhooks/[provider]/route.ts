import { NextResponse } from "next/server";

import { getPaymentProvider } from "@/payments";

// Payment webhook endpoint. The provider adapter verifies the signature —
// every gateway signs differently — and normalizes the event. Order state
// transitions (stock decrement, PAID, movements) land in Sprint 4.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params;
  const paymentProvider = getPaymentProvider();

  if (provider !== paymentProvider.name) {
    return NextResponse.json({ error: "Unknown provider" }, { status: 404 });
  }

  const rawBody = await request.text();
  const event = await paymentProvider.verifyWebhook(rawBody, request.headers);

  if (!event) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // TODO(sprint-4): idempotent order transition inside prisma.$transaction —
  // decrement stockOnHand + stockReserved, write SALE movement, set PAID.
  return NextResponse.json({ received: true });
}
