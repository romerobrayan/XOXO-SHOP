import type { PrismaClient } from "@/generated/prisma/client";
import { releaseStock } from "./stock";

// Reservation expiry — spec §6.4 step 3. An abandoned checkout must give its
// stock back or the store slowly sells itself out of nothing.
//
// Runs from two places: the cron route (backstop) and opportunistically at
// the top of createOrder (self-healing even on a Hobby-tier cron cadence).
// Both entry points race each other and the payment webhook, so the
// PENDING→CANCELLED transition is a conditional updateMany inside the same
// transaction that releases the stock: whoever loses the race updates zero
// rows and touches nothing.

export async function releaseExpiredReservations(
  db: PrismaClient,
  now = new Date(),
): Promise<{ released: number }> {
  const expired = await db.order.findMany({
    where: {
      status: "PENDING",
      reservationExpiresAt: { lt: now },
    },
    select: {
      id: true,
      orderNumber: true,
      items: { select: { variantId: true, quantity: true } },
    },
  });

  let released = 0;
  for (const order of expired) {
    await db.$transaction(async (tx) => {
      const won = await tx.order.updateMany({
        where: {
          id: order.id,
          status: "PENDING",
          reservationExpiresAt: { lt: now },
        },
        data: { status: "CANCELLED", reservationExpiresAt: null },
      });
      if (won.count === 0) return; // webhook or a concurrent sweep got here first

      // variantId is SetNull if a variant was deleted; nothing to release then.
      const lines = order.items
        .filter((i): i is { variantId: string; quantity: number } =>
          Boolean(i.variantId),
        )
        .map((i) => ({ variantId: i.variantId, qty: i.quantity }));

      if (lines.length > 0) {
        await releaseStock(tx, order.id, lines, "reservation expired");
      }
      released += 1;
    });
  }

  return { released };
}
