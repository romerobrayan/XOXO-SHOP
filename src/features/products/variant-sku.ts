import { slugify } from "@/lib/slug";

// Proposed SKU for a generated variant: the product's base code plus one
// fragment per option value, uppercased and diacritic-free —
// ("11362", ["M", "Negro"]) → "11362-M-NEGRO". The base keeps its own
// dashes — supplier refs like "PL-4720" arrive that way — while each value
// compacts to a single fragment so the dash stays the separator between
// parts. A proposal only: the table leaves it editable.
export function proposeVariantSku(base: string, values: string[]): string {
  const parts = [
    slugify(base).toUpperCase(),
    ...values.map((v) => slugify(v).toUpperCase().replace(/-/g, "")),
  ];
  return parts.filter(Boolean).join("-");
}

// The Cartesian product of the option value sets — the space the variant set
// is a subset of (V ⊆ V₁ × … × Vₙ, CLAUDE.md). Empty input yields [[]]: the
// singleton, which is exactly why an option-less product has one variant.
export function cartesian<T>(sets: T[][]): T[][] {
  return sets.reduce<T[][]>(
    (acc, set) => acc.flatMap((combo) => set.map((item) => [...combo, item])),
    [[]],
  );
}
