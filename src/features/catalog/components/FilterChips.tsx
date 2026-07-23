import Link from "next/link";

import { cn } from "@/lib/utils";

export type FilterChip = {
  key: string;
  label: string;
  href: string;
  active: boolean;
};

// Server-rendered filters: each chip is a plain link driven by searchParams —
// zero client JS, native keyboard support, shareable URLs. The active chip is
// marked with aria-current; the row bleeds full width so a clipped chip
// signals there is more to scroll.
export function FilterChips({
  label,
  chips,
}: {
  label: string;
  chips: FilterChip[];
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="font-mono text-micro uppercase text-bone/60">{label}</p>
      <div className="scroll-row -mx-4 flex gap-2 overflow-x-auto px-4 py-1.5">
        {chips.map((chip) => (
          <Link
            key={chip.key}
            href={chip.href}
            aria-current={chip.active ? "true" : undefined}
            className={cn(
              "inline-flex h-11 shrink-0 items-center rounded-lg px-4 text-small whitespace-nowrap transition-colors",
              chip.active
                ? "bg-bone font-medium text-ink"
                : "border border-bone/20 text-bone/80 hover:bg-surface hover:text-bone",
            )}
          >
            {chip.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
