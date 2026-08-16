"use server";

import { revalidatePath } from "next/cache";

import { requireStaff } from "@/features/admin/session";
import { db } from "@/lib/db";
import { actionClient } from "@/lib/safe-action";
import { applyOrderTransition } from "./apply-transition";
import { changeOrderStatusSchema } from "./schemas";
import { findTransition } from "./transitions";

export type ChangeOrderStatusResult =
  | { ok: true }
  // Someone else moved the order — an expiry sweep, a webhook, another tab.
  | { ok: false; code: "STALE"; currentStatus: string }
  | { ok: false; code: "NOT_ALLOWED" };

export const changeOrderStatus = actionClient
  .inputSchema(changeOrderStatusSchema)
  .action(async ({ parsedInput }): Promise<ChangeOrderStatusResult> => {
    // Every panel action re-checks. The layout gate proves who loaded the
    // page; it says nothing about who sent this request.
    await requireStaff();

    const { orderId, from, to } = parsedInput;

    const transition = findTransition(from, to);
    if (!transition) return { ok: false, code: "NOT_ALLOWED" };

    // The CAS, the timestamps and the stock effect live in
    // applyOrderTransition — shared with the payment webhook, so the panel
    // and the gateway can never disagree on what a transition does.
    const result = await db.$transaction(async (tx) =>
      applyOrderTransition(tx, orderId, from, to),
    );

    if (!result.won) {
      return {
        ok: false,
        code: "STALE",
        currentStatus: result.currentStatus,
      };
    }

    revalidatePath("/admin/pedidos");
    return { ok: true };
  });
