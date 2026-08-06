"use server";

import { revalidatePath } from "next/cache";

import { requireStaff } from "@/features/admin/session";
import { commitSale, releaseStock, returnStock } from "@/features/checkout/stock";
import { db } from "@/lib/db";
import { actionClient } from "@/lib/safe-action";
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

    return db.$transaction(async (tx) => {
      // Compare-and-set on the status the caller saw. The reservation-expiry
      // sweep cancels PENDING orders on its own schedule, so "cancel" from a
      // tab opened ten minutes ago can arrive after the order already left
      // PENDING — and applying its stock effect then would double-release.
      const won = await tx.order.updateMany({
        where: { id: orderId, status: from },
        data: {
          status: to,
          // A cancelled or shipped order has nothing left to expire; leaving
          // the timestamp set would let the sweep pick it up again.
          reservationExpiresAt: to === "PENDING" ? undefined : null,
          ...(to === "PAID" ? { paidAt: new Date() } : {}),
          ...(to === "SHIPPED" ? { shippedAt: new Date() } : {}),
        },
      });

      if (won.count === 0) {
        const current = await tx.order.findUnique({
          where: { id: orderId },
          select: { status: true },
        });
        return {
          ok: false as const,
          code: "STALE" as const,
          currentStatus: current?.status ?? "UNKNOWN",
        };
      }

      if (transition.effect !== "none") {
        const items = await tx.orderItem.findMany({
          where: { orderId },
          select: { variantId: true, quantity: true },
        });
        // variantId is SetNull if the variant was deleted; there is no balance
        // left to move for those lines.
        const lines = items
          .filter((i): i is { variantId: string; quantity: number } =>
            Boolean(i.variantId),
          )
          .map((i) => ({ variantId: i.variantId, qty: i.quantity }));

        if (lines.length > 0) {
          if (transition.effect === "release") {
            await releaseStock(tx, orderId, lines, `cancelled from ${from}`);
          } else if (transition.effect === "commit") {
            await commitSale(tx, orderId, lines);
          } else {
            await returnStock(tx, orderId, lines, "refunded");
          }
        }
      }

      revalidatePath("/admin/pedidos");
      return { ok: true as const };
    });
  });
