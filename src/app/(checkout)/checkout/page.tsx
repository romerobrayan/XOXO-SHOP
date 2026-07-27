import type { Metadata } from "next";

import { CheckoutFlow } from "@/features/checkout/components/CheckoutFlow";

export const metadata: Metadata = { title: "Checkout" };

// Guest checkout is mandatory — no account, no registration, ever.
export default function CheckoutPage() {
  return (
    <div className="mx-auto w-full max-w-[1000px] px-4 py-8 md:px-6 md:py-10">
      <CheckoutFlow />
    </div>
  );
}
