import Link from "next/link";

import type { BrandSummary } from "../dto";

// Brand is a primary navigation axis in this category — buyers arrive knowing
// the brand — so each one gets real surface, not a filter buried in a menu.
export function BrandTile({ brand }: { brand: BrandSummary }) {
  const count =
    brand.productCount === 1 ? "1 producto" : `${brand.productCount} productos`;
  return (
    <Link
      href={`/tienda?marca=${brand.slug}`}
      className="flex min-h-16 items-center justify-between gap-4 rounded-xl bg-surface p-4 transition-colors hover:bg-surface/70"
    >
      <span className="text-heading text-bone">{brand.name}</span>
      <span className="tabular shrink-0 font-mono text-small text-bone/60">
        {count}
      </span>
    </Link>
  );
}
