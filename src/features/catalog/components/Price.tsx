import { formatCOP } from "@/lib/money";
import { cn } from "@/lib/utils";

// .precio del design system: Archivo semibold en vino, formato colombiano
// $120.000. The current price comes first in the DOM; a visual strikethrough
// is not announced by screen readers, so sr-only prefixes carry the
// distinction.
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
        "tabular flex flex-wrap items-baseline gap-x-2 font-semibold text-vino",
        size === "lg" ? "text-xl" : "text-base",
        className,
      )}
    >
      <span>
        <span className="sr-only">Precio actual:</span>
        {from && <span className="font-normal text-suave">Desde </span>}
        {formatCOP(cents)}
      </span>
      {hasCompare && (
        <s className="text-sm font-normal text-tenue">
          <span className="sr-only">Precio anterior:</span>
          {formatCOP(compareAtCents)}
        </s>
      )}
    </p>
  );
}
