"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

// The return page renders while the gateway's webhook is still in flight —
// usually seconds. Re-fetch the server component on an interval so the
// "confirmando tu pago" state resolves without the buyer touching anything,
// and stop after a bounded window instead of polling forever: past that
// point the honest channel is WhatsApp, which the page already offers.
export function RefreshWhilePending({
  intervalMs = 4000,
  maxMs = 120_000,
}: {
  intervalMs?: number;
  maxMs?: number;
}) {
  const router = useRouter();

  useEffect(() => {
    const startedAt = Date.now();
    const id = setInterval(() => {
      if (Date.now() - startedAt > maxMs) {
        clearInterval(id);
        return;
      }
      router.refresh();
    }, intervalMs);
    return () => clearInterval(id);
  }, [router, intervalMs, maxMs]);

  return null;
}
