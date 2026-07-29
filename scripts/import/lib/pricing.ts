// Sale-price proposal. The supplier price is REFERENCE data (Climax is a
// retail competitor; DistriSex publishes wholesale) — the client owns the sale
// price. seleccion.json can pin an exact price per product; otherwise this
// margin applies. Margin per category is an open business decision
// (docs/ESTADO-Y-SIGUIENTE-SESION.md); the defaults live in seleccion.json.
export function computeSalePriceCents(
  supplierPriceCents: number,
  marginPct: number,
  roundUpToCOP: number,
): number {
  const raw = supplierPriceCents * (1 + marginPct / 100);
  const stepCents = roundUpToCOP * 100;
  return Math.max(stepCents, Math.ceil(raw / stepCents) * stepCents);
}
