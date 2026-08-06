"use server";

import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { actionClient } from "@/lib/safe-action";
import { releaseExpiredReservations } from "./expiry";
import { generateOrderNumber } from "./order-number";
import { createOrderSchema } from "./schemas";
import { SHIPPING_CENTS } from "./shipping";
import { OutOfStockError, reserveStock } from "./stock";

// Reservation windows, in hours. Contra entrega follows spec §6.4 option 2
// (72h, auto-release; the client's real no-show rate tunes this later).
// ONLINE also runs 72h for now: with PAYMENT_PROVIDER=mock an advisor
// coordinates payment over WhatsApp, exactly like manual transfer. Bloque F
// drops it to 30 minutes when a real gateway redirect exists.
const RESERVATION_HOURS = {
  CASH_ON_DELIVERY: 72,
  ONLINE: 72,
} as const;

// Expected outcomes travel in the typed result; only genuine bugs use the
// serverError channel. The UI branches on `code`, never on message text.
export type LineConflict = {
  variantId: string;
  productName: string | null;
  reason: "NOT_FOUND" | "INACTIVE" | "PRICE_CHANGED" | "OUT_OF_STOCK";
  currentPriceCents?: number;
};

export type CreateOrderResult =
  | { ok: true; orderId: string; orderNumber: string }
  // DATABASE_URL unset — the fixtures-only preview. The bag works, orders
  // cannot: fail with an honest message instead of a crash.
  | { ok: false; code: "DEMO_MODE" }
  | { ok: false; code: "CONFLICTS"; conflicts: LineConflict[] };

export const createOrder = actionClient
  .inputSchema(createOrderSchema)
  .action(async ({ parsedInput }): Promise<CreateOrderResult> => {
    const { idempotencyKey, items, delivery, paymentMethod } = parsedInput;

    if (!process.env.DATABASE_URL) {
      return { ok: false, code: "DEMO_MODE" };
    }

    // Opportunistic sweep: expired reservations release even if the cron
    // backstop runs rarely. Usually a no-op; never blocks the order.
    try {
      await releaseExpiredReservations(db);
    } catch (error) {
      console.error("[checkout] expiry sweep failed", error);
    }

    // A retried request (double-tap, flaky network) finds the order the
    // first attempt created instead of creating a second one.
    const existing = await db.order.findUnique({
      where: { idempotencyKey },
      select: { id: true, orderNumber: true },
    });
    if (existing) {
      return { ok: true, orderId: existing.id, orderNumber: existing.orderNumber };
    }

    const variants = await db.productVariant.findMany({
      where: { id: { in: items.map((i) => i.variantId) } },
      include: {
        product: {
          include: {
            brand: true,
            media: { orderBy: { position: "asc" }, take: 1 },
          },
        },
        optionValues: { include: { optionValue: { include: { option: true } } } },
      },
    });
    const byId = new Map(variants.map((v) => [v.id, v]));

    // The bag can go stale between add-to-bag and confirm: a variant sold
    // out, was retired, or changed price. Charging silently at a price the
    // customer did not see is the one failure worse than an error message,
    // so mismatches come back as per-line conflicts for the UI to show.
    const conflicts: LineConflict[] = [];
    for (const item of items) {
      const variant = byId.get(item.variantId);
      if (!variant) {
        conflicts.push({
          variantId: item.variantId,
          productName: null,
          reason: "NOT_FOUND",
        });
      } else if (!variant.isActive || variant.product.status !== "ACTIVE") {
        conflicts.push({
          variantId: item.variantId,
          productName: variant.product.name,
          reason: "INACTIVE",
        });
      } else if (
        item.expectedPriceCents !== undefined &&
        item.expectedPriceCents !== variant.priceCents
      ) {
        conflicts.push({
          variantId: item.variantId,
          productName: variant.product.name,
          reason: "PRICE_CHANGED",
          currentPriceCents: variant.priceCents,
        });
      }
    }
    if (conflicts.length > 0) {
      return { ok: false, code: "CONFLICTS", conflicts };
    }

    const subtotalCents = items.reduce(
      (sum, item) => sum + byId.get(item.variantId)!.priceCents * item.qty,
      0,
    );
    const totalCents = subtotalCents + SHIPPING_CENTS;

    // OrderItem stores snapshots (CLAUDE.md rule 4): catalog edits must
    // never rewrite what this customer bought at what price.
    const itemRows = items.map((item) => {
      const variant = byId.get(item.variantId)!;
      const values = variant.optionValues
        .map((v) => v.optionValue)
        .sort((a, b) => a.option.position - b.option.position);
      const primary = variant.product.media[0];
      return {
        variantId: variant.id,
        productName: variant.product.name,
        brandName: variant.product.brand?.name ?? null,
        variantSku: variant.sku,
        variantLabel: values
          .map((v) => `${v.option.name}: ${v.value}`)
          .join(" · "),
        optionsSnapshot:
          values.length > 0
            ? values.map((v) => ({
                option: v.option.name,
                value: v.value,
                hex: v.hex,
              }))
            : undefined,
        imageUrl: primary
          ? primary.type === "VIDEO"
            ? (primary.posterUrl ?? null)
            : primary.url
          : null,
        unitPriceCents: variant.priceCents,
        quantity: item.qty,
        totalCents: variant.priceCents * item.qty,
      };
    });

    const lines = items.map(({ variantId, qty }) => ({ variantId, qty }));
    const reservationExpiresAt = new Date(
      Date.now() + RESERVATION_HOURS[paymentMethod] * 60 * 60 * 1000,
    );

    // Two attempts: the only reason to retry is an orderNumber collision.
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const order = await db.$transaction(async (tx) => {
          // Guest address — no Customer row behind it, by design.
          const address = await tx.address.create({
            data: {
              fullName: delivery.nombre,
              phone: delivery.celular,
              documentType: delivery.documentType,
              documentId: delivery.documentId,
              department: delivery.department,
              city: delivery.ciudad,
              line1: delivery.direccion,
              neighborhood: delivery.barrio,
              notes: delivery.notas,
            },
          });
          const created = await tx.order.create({
            data: {
              orderNumber: generateOrderNumber(),
              idempotencyKey,
              addressId: address.id,
              guestEmail: delivery.email,
              guestPhone: delivery.celular,
              subtotalCents,
              shippingCents: SHIPPING_CENTS,
              totalCents,
              reservationExpiresAt,
              items: { create: itemRows },
            },
            select: { id: true, orderNumber: true },
          });
          // Contra entrega is the one method known at checkout time, so it is
          // the one that gets a Payment row here: the panel has to be able to
          // tell an advisor "collect on delivery" without guessing. ONLINE
          // deliberately gets none — the gateway picks the actual rail
          // (CARD / PSE / NEQUI) and its webhook writes the row (spec §2), and
          // inventing a value now would put a wrong rail in the ledger.
          if (paymentMethod === "CASH_ON_DELIVERY") {
            await tx.payment.create({
              data: {
                orderId: created.id,
                provider: "manual",
                method: "CASH_ON_DELIVERY",
                status: "PENDING",
                amountCents: totalCents,
              },
            });
          }
          await reserveStock(tx, created.id, lines);
          return created;
        });
        return { ok: true, orderId: order.id, orderNumber: order.orderNumber };
      } catch (error) {
        if (error instanceof OutOfStockError) {
          const variant = byId.get(error.variantId);
          return {
            ok: false,
            code: "CONFLICTS",
            conflicts: [
              {
                variantId: error.variantId,
                productName: variant?.product.name ?? null,
                reason: "OUT_OF_STOCK",
              },
            ],
          };
        }
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
          const target = String(error.meta?.target ?? "");
          if (target.includes("idempotencyKey")) {
            // Lost a race against our own retry — the order exists.
            const winner = await db.order.findUnique({
              where: { idempotencyKey },
              select: { id: true, orderNumber: true },
            });
            if (winner) {
              return {
                ok: true,
                orderId: winner.id,
                orderNumber: winner.orderNumber,
              };
            }
          }
          if (target.includes("orderNumber")) continue;
        }
        throw error;
      }
    }
    throw new Error("orderNumber collision persisted after retry");
  });
