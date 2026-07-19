import Link from "next/link";

import { tintFor } from "@/lib/tint";
import type { CategorySummary } from "../dto";

// Visual category surface for the home: the same slug-derived tint system as
// the image placeholder, so tiles vary without pretending to have photography.
// When real category imagery exists it replaces the tint layer.
export function CategoryTile({ category }: { category: CategorySummary }) {
  const tint = tintFor(category.slug);
  const count =
    category.productCount === 1
      ? "1 producto"
      : `${category.productCount} productos`;
  return (
    <Link
      href={`/tienda?categoria=${category.slug}`}
      className="relative flex min-h-24 flex-col justify-center gap-1 overflow-hidden rounded-xl bg-surface p-5"
    >
      <span
        aria-hidden="true"
        className="absolute inset-0 opacity-[0.09]"
        style={{
          background: `radial-gradient(140% 120% at 85% 20%, ${tint}, transparent 65%)`,
        }}
      />
      <span className="relative text-heading text-bone">{category.name}</span>
      <span className="tabular relative font-mono text-small text-bone/60">
        {count}
      </span>
    </Link>
  );
}
