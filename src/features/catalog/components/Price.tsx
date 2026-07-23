import { formatCOP } from "@/lib/money";
import { cn } from "@/lib/utils";

// Prices are always IBM Plex Mono with tabular figures — the column aligns
// down the grid and the number reads as a price list, not an Instagram offer.
// The current price comes first in the DOM; a visual strikethrough is not
// announced by screen readers, so sr-only prefixes carry the distinction.
export function Price({
  cents,
  compareAtCents,
  from = false,
  size = "sm",
  className,
}: {
  cents: number;
  compareAtCents?: number | null;
  // "Desde $45.000" when variants differ in price.
  from?: boolean;
  size?: "sm" | "lg";
  className?: string;
}) {
  const hasCompare = compareAtCents != null && compareAtCents > cents;
  return (
    <p
      className={cn(
        "tabular flex flex-wrap items-baseline gap-x-2 font-mono text-bone",
        size === "lg" ? "text-price" : "text-price-sm",
        className,
      )}
    >
      <span>
        <span className="sr-only">Precio actual:</span>
        {from && <span className="text-bone/70">Desde </span>}
        {formatCOP(cents)}
      </span>
      {hasCompare && (
        <s className={cn("text-bone/60", size === "lg" && "text-price-sm")}>
          <span className="sr-only">Precio anterior:</span>
          {formatCOP(compareAtCents)}
        </s>
      )}
    </p>
  );
}
