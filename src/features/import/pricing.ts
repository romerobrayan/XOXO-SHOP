// Sale-price proposal. The supplier price is REFERENCE data (Climax is a
// retail competitor; DistriSex publishes wholesale) — the client owns the sale
// price. seleccion.json (CLI) or the publish form (panel) can pin an exact
// price per product; otherwise this margin applies. Margin per category is an
// open business decision (docs/ESTADO-Y-SIGUIENTE-SESION.md).

import type { Supplier } from "./config";

export type PromotePricing = {
  /** Percentage margin over the supplier price, per supplier. */
  marginPct: Record<Supplier, number>;
  /** Sale prices round UP to this COP step (500 → $45.230 becomes $45.500). */
  roundUpToCOP: number;
};

/** Working defaults — wholesale to retail for DistriSex, match the
 * competitor's shelf for Climax. The panel prefills its margin field with
 * these; the CLI reads its own from seleccion.json. */
export const DEFAULT_PRICING: PromotePricing = {
  marginPct: { distrisex: 50, climax: 0 },
  roundUpToCOP: 500,
};

export function computeSalePriceCents(
  supplierPriceCents: number,
  marginPct: number,
  roundUpToCOP: number,
): number {
  const raw = supplierPriceCents * (1 + marginPct / 100);
  const stepCents = roundUpToCOP * 100;
  return Math.max(stepCents, Math.ceil(raw / stepCents) * stepCents);
}
