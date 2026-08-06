import type { Prisma } from "@/generated/prisma/client";

// Stock reservation — spec §6.4, CLAUDE.md rules 2 and 3.
//
// available = stockOnHand - stockReserved, and that subtraction is exactly
// what a Prisma `where` cannot express (a column compared against another
// column plus a parameter), so the guard is one raw conditional UPDATE:
// atomic, no read-then-write window, no FOR UPDATE needed. Everything else
// in the transaction stays Prisma.
//
// Ledger semantics — one row per balance change, split by reason:
//   stockOnHand   = Σ delta over PURCHASE, SALE, RETURN, MANUAL_ADJUST, DAMAGE
//   stockReserved = -Σ delta over RESERVATION, RESERVATION_RELEASE
// A reservation "leaves" the sellable pool, so its delta is negative; a
// release gives it back. A paid order changes both balances and therefore
// writes two rows: RESERVATION_RELEASE (+qty) and SALE (-qty).
// parity.test.ts enforces both reconciliations against every variant.

export class OutOfStockError extends Error {
  constructor(readonly variantId: string) {
    super(`Insufficient available stock for variant ${variantId}`);
    this.name = "OutOfStockError";
  }
}

export type StockLine = {
  variantId: string;
  qty: number;
};

/**
 * Reserves stock for every line or throws, inside the caller's transaction.
 * On OutOfStockError the caller's transaction rolls back, so partial
 * reservations from earlier lines never survive.
 */
export async function reserveStock(
  tx: Prisma.TransactionClient,
  orderId: string | null,
  lines: StockLine[],
): Promise<void> {
  for (const { variantId, qty } of lines) {
    const updated = await tx.$executeRaw`
      UPDATE "ProductVariant"
      SET "stockReserved" = "stockReserved" + ${qty}, "updatedAt" = now()
      WHERE "id" = ${variantId}
        AND "isActive" = true
        AND "stockOnHand" - "stockReserved" >= ${qty}`;
    if (updated !== 1) throw new OutOfStockError(variantId);
  }
  await tx.inventoryMovement.createMany({
    data: lines.map(({ variantId, qty }) => ({
      variantId,
      delta: -qty,
      reason: "RESERVATION" as const,
      orderId,
    })),
  });
}

/**
 * Returns reserved stock to the sellable pool — declined payment, expired
 * reservation, cancelled order. Throws if the reservation being released
 * does not exist, because silently under-releasing corrupts the balance.
 */
export async function releaseStock(
  tx: Prisma.TransactionClient,
  orderId: string | null,
  lines: StockLine[],
  note?: string,
): Promise<void> {
  for (const { variantId, qty } of lines) {
    const updated = await tx.$executeRaw`
      UPDATE "ProductVariant"
      SET "stockReserved" = "stockReserved" - ${qty}, "updatedAt" = now()
      WHERE "id" = ${variantId}
        AND "stockReserved" >= ${qty}`;
    if (updated !== 1) {
      throw new Error(
        `Cannot release ${qty} units of variant ${variantId}: not reserved`,
      );
    }
  }
  await tx.inventoryMovement.createMany({
    data: lines.map(({ variantId, qty }) => ({
      variantId,
      delta: qty,
      reason: "RESERVATION_RELEASE" as const,
      orderId,
      note,
    })),
  });
}

/**
 * Converts a reservation into a sale — payment approved, or a contra
 * entrega delivery confirmed. Both balances change, so two ledger rows:
 * the release (+qty) and the sale (-qty).
 */
export async function commitSale(
  tx: Prisma.TransactionClient,
  orderId: string | null,
  lines: StockLine[],
): Promise<void> {
  for (const { variantId, qty } of lines) {
    const updated = await tx.$executeRaw`
      UPDATE "ProductVariant"
      SET "stockOnHand" = "stockOnHand" - ${qty},
          "stockReserved" = "stockReserved" - ${qty},
          "updatedAt" = now()
      WHERE "id" = ${variantId}
        AND "stockReserved" >= ${qty}
        AND "stockOnHand" >= ${qty}`;
    if (updated !== 1) {
      throw new Error(
        `Cannot commit sale of ${qty} units of variant ${variantId}`,
      );
    }
  }
  await tx.inventoryMovement.createMany({
    data: lines.flatMap(({ variantId, qty }) => [
      {
        variantId,
        delta: qty,
        reason: "RESERVATION_RELEASE" as const,
        orderId,
        note: "consumed by sale",
      },
      { variantId, delta: -qty, reason: "SALE" as const, orderId },
    ]),
  });
}

/**
 * Puts sold units back on the shelf — a refund after the goods came back.
 * Only stockOnHand moves: the reservation was already consumed by the sale,
 * so there is nothing reserved left to release.
 *
 * Deliberately not the mirror of commitSale. Returned stock is physically
 * back and sellable, so it is not conditional on anything; if the units did
 * not actually come back, the correction is a DAMAGE or MANUAL_ADJUST row,
 * which keeps the reason column meaning what it says.
 */
export async function returnStock(
  tx: Prisma.TransactionClient,
  orderId: string | null,
  lines: StockLine[],
  note?: string,
): Promise<void> {
  for (const { variantId, qty } of lines) {
    await tx.$executeRaw`
      UPDATE "ProductVariant"
      SET "stockOnHand" = "stockOnHand" + ${qty}, "updatedAt" = now()
      WHERE "id" = ${variantId}`;
  }
  await tx.inventoryMovement.createMany({
    data: lines.map(({ variantId, qty }) => ({
      variantId,
      delta: qty,
      reason: "RETURN" as const,
      orderId,
      note,
    })),
  });
}
