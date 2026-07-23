// Availability is a derived value, never raw stock. The storefront only ever
// sees `available = stockOnHand - stockReserved`, computed here on the server —
// stockOnHand itself must not cross into page props or client components.

export const DEFAULT_LOW_STOCK_AT = 3;

export type StockCounts = { stockOnHand: number; stockReserved: number };

export function availableOf(stock: StockCounts): number {
  return Math.max(0, stock.stockOnHand - stock.stockReserved);
}

export type AvailabilityBand =
  | { state: "available" }
  | { state: "low"; units: number }
  | { state: "out" };

// Three states, one rule: plain in-stock above the low-stock threshold, an
// exact remaining count at or below it, sold out at zero. The count shown is
// always the derived available value.
export function bandFor(
  available: number,
  lowStockAt: number = DEFAULT_LOW_STOCK_AT,
): AvailabilityBand {
  if (available <= 0) return { state: "out" };
  if (available <= lowStockAt) return { state: "low", units: available };
  return { state: "available" };
}

export function availabilityLabel(band: AvailabilityBand): string {
  switch (band.state) {
    case "available":
      return "Disponible";
    case "low":
      return band.units === 1
        ? "Queda 1 unidad"
        : `Quedan ${band.units} unidades`;
    case "out":
      return "Agotado";
  }
}
