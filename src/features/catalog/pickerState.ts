// Pure selection logic for the option picker — shared by the client component
// and its tests. Works only on DTOs (no Prisma types, no stock columns).
//
// The variant space is a subset of the Cartesian product of the option value
// sets (V ⊆ V₁ × … × Vₙ). For n = 0 there is exactly one variant with no
// option values — the same code paths cover it with no branching.

export type PickerValue = { id: string; value: string; hex: string | null };
export type PickerOption = { id: string; name: string; values: PickerValue[] };
export type PickerVariant = {
  id: string;
  priceCents: number;
  compareAtCents: number | null;
  available: number;
  lowStockAt: number;
  optionValueIds: string[];
};

// optionId -> selected valueId. Empty object for option-less products.
export type Selection = Record<string, string>;

function variantHasValue(variant: PickerVariant, valueId: string): boolean {
  return variant.optionValueIds.includes(valueId);
}

// Deterministic variant order: by the position of each of its values along the
// option axes (Talla S→XL, then Color, …). The DB include has no orderBy for
// variants, so this is the single source of ordering truth.
export function sortVariants(
  options: PickerOption[],
  variants: PickerVariant[],
): PickerVariant[] {
  const rank = new Map<string, number>();
  options.forEach((option, optionIdx) => {
    option.values.forEach((value, valueIdx) => {
      rank.set(value.id, optionIdx * 1000 + valueIdx);
    });
  });
  const key = (v: PickerVariant) =>
    v.optionValueIds
      .map((id) => rank.get(id) ?? 0)
      .sort((a, b) => a - b)
      .map((n) => String(n).padStart(6, "0"))
      .join("|");
  return [...variants].sort((a, b) => key(a).localeCompare(key(b)));
}

// The variant matching a complete selection, if the combination is stocked.
export function variantForSelection(
  options: PickerOption[],
  variants: PickerVariant[],
  selection: Selection,
): PickerVariant | undefined {
  const selected = options.map((o) => selection[o.id]).filter(Boolean);
  if (selected.length !== options.length) return undefined;
  return variants.find(
    (v) =>
      v.optionValueIds.length === selected.length &&
      selected.every((id) => variantHasValue(v, id)),
  );
}

// Chip state for one value, given the current selection on the OTHER axes.
// "not-offered": no stocked combination includes this value — it exists in the
// catalog but the store never stocked it. "sold-out": combinations exist but
// none has stock. Both render disabled AND visible — hiding a size reads as
// the product not existing (DESIGN_BRIEF_PDP.md).
export type ValueAvailability = "selectable" | "sold-out" | "not-offered";

export function valueAvailability(
  options: PickerOption[],
  variants: PickerVariant[],
  optionId: string,
  valueId: string,
  selection: Selection,
): ValueAvailability {
  const otherSelections = options
    .filter((o) => o.id !== optionId)
    .map((o) => selection[o.id])
    .filter((id): id is string => Boolean(id));

  const candidates = variants.filter(
    (v) =>
      variantHasValue(v, valueId) &&
      otherSelections.every((id) => variantHasValue(v, id)),
  );
  if (candidates.length === 0) return "not-offered";
  return candidates.some((v) => v.available > 0) ? "selectable" : "sold-out";
}

// Initial state: the first available variant in deterministic order, so the
// buyer lands on a complete, purchasable state. Falls back to the first
// variant when everything is sold out.
export function defaultSelection(
  options: PickerOption[],
  variants: PickerVariant[],
): Selection {
  if (options.length === 0) return {};
  const ordered = sortVariants(options, variants);
  const target = ordered.find((v) => v.available > 0) ?? ordered[0];
  if (!target) return {};

  const owner = new Map<string, string>();
  for (const option of options) {
    for (const value of option.values) owner.set(value.id, option.id);
  }
  const selection: Selection = {};
  for (const valueId of target.optionValueIds) {
    const optionId = owner.get(valueId);
    if (optionId) selection[optionId] = valueId;
  }
  return selection;
}

export function priceRange(variants: PickerVariant[]): {
  min: number;
  max: number;
} {
  const prices = variants.map((v) => v.priceCents);
  return { min: Math.min(...prices), max: Math.max(...prices) };
}

// Media filtered to the current selection: null optionValueId applies to the
// whole product; a set one shows only while that value is selected.
export function mediaForSelection<T extends { optionValueId: string | null }>(
  media: T[],
  selection: Selection,
): T[] {
  const selected = new Set(Object.values(selection));
  const scoped = media.filter(
    (m) => m.optionValueId === null || selected.has(m.optionValueId),
  );
  return scoped;
}
