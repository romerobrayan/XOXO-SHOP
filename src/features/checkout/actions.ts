"use server";

import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { actionClient } from "@/lib/safe-action";
import { getPaymentProvider } from "@/payments";
import { releaseExpiredReservations } from "./expiry";
import { generateOrderNumber } from "./order-number";
import { initiateOnlinePayment } from "./payment-initiation";
import { createOrderSchema } from "./schemas";
import { SHIPPING_CENTS } from "./shipping";
import { OutOfStockError, reserveStock } from "./stock";

// Reservation windows, in hours. Contra entrega follows spec §6.4 option 2
// (72h, auto-release; the client's real no-show rate tunes this later).
// ONLINE through a real gateway redirect holds for 30 minutes — the buyer is
// mid-payment or gone, and the link itself expires at the same instant
// (createPayment's expiresAt), so the gateway refuses money for released
// stock. With PAYMENT_PROVIDER=mock there is no real redirect: an advisor
// coordinates payment over WhatsApp, exactly like manual transfer, so the
// mock keeps the contra entrega window.
const RESERVATION_HOURS = {
  CASH_ON_DELIVERY: 72,
  ONLINE_GATEWAY: 0.5,
  ONLINE_MOCK: 72,
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
  // checkoutUrl is present exactly when the customer still owes an online
  // payment: the UI's next move is to send them there. Absent for contra
  // entrega and for retries that find the order already past PENDING.
  | { ok: true; orderId: string; orderNumber: string; checkoutUrl?: string }
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

    // Constructing the provider validates its config, so a deployment with a
    // missing gateway key fails HERE — before an order exists and stock is
    // reserved for a payment that can never start.
    const provider = paymentMethod === "ONLINE" ? getPaymentProvider() : null;

    // A retried request (double-tap, flaky network) finds the order the
    // first attempt created instead of creating a second one. If that order
    // is still waiting for its online payment, the customer needs somewhere
    // to pay: re-derive the same signed link (deterministic reference +
    // stored expiry ⇒ byte-identical URL). Past PENDING there is nothing
    // left to pay or the sweep already cancelled — no link.
    const existing = await db.order.findUnique({
      where: { idempotencyKey },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        totalCents: true,
        guestEmail: true,
        reservationExpiresAt: true,
      },
    });
    if (existing) {
      if (provider && existing.status === "PENDING") {
        const checkoutUrl = await initiateOnlinePayment(provider, existing);
        return {
          ok: true,
          orderId: existing.id,
          orderNumber: existing.orderNumber,
          checkoutUrl,
        };
      }
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
    const reservationHours =
      paymentMethod === "CASH_ON_DELIVERY"
        ? RESERVATION_HOURS.CASH_ON_DELIVERY
        : provider!.name === "mock"
          ? RESERVATION_HOURS.ONLINE_MOCK
          : RESERVATION_HOURS.ONLINE_GATEWAY;
    const reservationExpiresAt = new Date(
      Date.now() + reservationHours * 60 * 60 * 1000,
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
        // Outside the transaction on purpose: a future adapter may create the
        // payment over HTTP, and a gateway round-trip must never hold row
        // locks. If this throws, the order stands (PENDING, reserved) and the
        // retry path above re-initiates against it — self-healing.
        if (provider) {
          const checkoutUrl = await initiateOnlinePayment(provider, {
            id: order.id,
            orderNumber: order.orderNumber,
            totalCents,
            guestEmail: delivery.email ?? null,
            reservationExpiresAt,
          });
          return {
            ok: true,
            orderId: order.id,
            orderNumber: order.orderNumber,
            checkoutUrl,
          };
        }
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
            // Lost a race against our own retry — the order exists. Same
            // deal as the early-return above: an online order still in
            // PENDING gets its (identical) payment link re-derived.
            const winner = await db.order.findUnique({
              where: { idempotencyKey },
              select: {
                id: true,
                orderNumber: true,
                status: true,
                totalCents: true,
                guestEmail: true,
                reservationExpiresAt: true,
              },
            });
            if (winner) {
              if (provider && winner.status === "PENDING") {
                const checkoutUrl = await initiateOnlinePayment(
                  provider,
                  winner,
                );
                return {
                  ok: true,
                  orderId: winner.id,
                  orderNumber: winner.orderNumber,
                  checkoutUrl,
                };
              }
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
