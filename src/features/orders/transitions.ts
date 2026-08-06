import type { OrderStatus } from "@/generated/prisma/enums";

// Which status can follow which, and what each move does to inventory.
//
// Kept as data, and kept pure, because this is the part of the panel that can
// silently corrupt the ledger. The owner taps a button in a stockroom; the
// question "does this transition move stock, and which way" has to have one
// answer that a test can read, not one buried in a component.
//
// The stock effect is named, not inferred from the pair, so that adding a
// status later cannot quietly acquire a default behaviour.

export type StockEffect =
  // Reserved units go back to the sellable pool.
  | "release"
  // Reservation becomes a sale: both balances drop.
  | "commit"
  // Sold units come back on the shelf.
  | "return"
  | "none";

export type Transition = {
  to: OrderStatus;
  effect: StockEffect;
  /** Imperative, in the client's vocabulary — this is the button label. */
  label: string;
  /** Shown before a move that cannot be undone with another button. */
  confirm?: string;
};

// Note there is no PENDING → SHIPPED shortcut. Shipping is what consumes the
// reservation, and skipping straight to it from PENDING would ship goods for
// an order nobody confirmed was payable.
const TRANSITIONS: Record<OrderStatus, Transition[]> = {
  PENDING: [
    { to: "PAID", effect: "none", label: "Marcar pagado" },
    // Contra entrega collects on delivery, so preparing an unpaid order is
    // the normal path in Medellín, not an exception.
    { to: "PROCESSING", effect: "none", label: "Preparar" },
    {
      to: "CANCELLED",
      effect: "release",
      label: "Cancelar",
      confirm: "Se cancela el pedido y el stock vuelve a quedar disponible.",
    },
  ],
  PAID: [
    { to: "PROCESSING", effect: "none", label: "Preparar" },
    {
      to: "CANCELLED",
      effect: "release",
      label: "Cancelar",
      confirm: "Se cancela el pedido y el stock vuelve a quedar disponible.",
    },
  ],
  PROCESSING: [
    {
      to: "SHIPPED",
      effect: "commit",
      label: "Marcar enviado",
      confirm: "El stock sale del inventario al enviar.",
    },
    {
      to: "CANCELLED",
      effect: "release",
      label: "Cancelar",
      confirm: "Se cancela el pedido y el stock vuelve a quedar disponible.",
    },
  ],
  SHIPPED: [
    { to: "DELIVERED", effect: "none", label: "Marcar entregado" },
    {
      to: "REFUNDED",
      effect: "return",
      label: "Reembolsar",
      confirm: "Solo si la mercancía volvió: el stock se suma de nuevo.",
    },
  ],
  DELIVERED: [
    {
      to: "REFUNDED",
      effect: "return",
      label: "Reembolsar",
      confirm: "Solo si la mercancía volvió: el stock se suma de nuevo.",
    },
  ],
  CANCELLED: [],
  REFUNDED: [],
};

export function transitionsFrom(status: OrderStatus): Transition[] {
  return TRANSITIONS[status] ?? [];
}

export function findTransition(
  from: OrderStatus,
  to: OrderStatus,
): Transition | undefined {
  return transitionsFrom(from).find((t) => t.to === to);
}

export const STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING: "Pendiente",
  PAID: "Pagado",
  PROCESSING: "En preparación",
  SHIPPED: "Enviado",
  DELIVERED: "Entregado",
  CANCELLED: "Cancelado",
  REFUNDED: "Reembolsado",
};
