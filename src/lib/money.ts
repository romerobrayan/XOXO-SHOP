// Money is always Int in minor units (cents). Formatting is a presentation
// concern — this is the only place COP formatting lives.
export const formatCOP = (cents: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(cents / 100);
