import type { PrismaClient } from "@/generated/prisma/client";
import type { AdjustReason } from "./schemas";

// The two-tap adjustment's core, separated from the Server Action so a test
// can drive it against a real Postgres without a request context. Same
// discipline as checkout (CLAUDE.md rules 2 and 3): one conditional UPDATE,
// no read-then-write window, and the ledger row in the same transaction.

export type StockAdjustment = {
  variantId: string;
  delta: number;
  reason: AdjustReason;
  note?: string;
};

export type AdjustOutcome =
  | { ok: true; stockOnHand: number; productId: string }
  | { ok: false; code: "NOT_FOUND" }
  // The decrement would leave fewer units on hand than are reserved — those
  // units already belong to confirmed orders.
  | { ok: false; code: "WOULD_BREAK_RESERVATIONS" };

export async function applyStockAdjustment(
  db: PrismaClient,
  { variantId, delta, reason, note }: StockAdjustment,
): Promise<AdjustOutcome> {
  const result = await db.$transaction(async (tx) => {
    const updated = await tx.$executeRaw`
      UPDATE "ProductVariant"
      SET "stockOnHand" = "stockOnHand" + ${delta}, "updatedAt" = now()
      WHERE "id" = ${variantId}
        AND "stockOnHand" + ${delta} >= "stockReserved"`;
    if (updated !== 1) return null;

    await tx.inventoryMovement.create({
      data: { variantId, delta, reason, note: note || null },
    });

    return tx.productVariant.findUniqueOrThrow({
      where: { id: variantId },
      select: { stockOnHand: true, productId: true },
    });
  });

  if (result) {
    return {
      ok: true,
      stockOnHand: result.stockOnHand,
      productId: result.productId,
    };
  }

  const exists = await db.productVariant.findUnique({
    where: { id: variantId },
    select: { id: true },
  });
  return exists
    ? { ok: false, code: "WOULD_BREAK_RESERVATIONS" }
    : { ok: false, code: "NOT_FOUND" };
}
