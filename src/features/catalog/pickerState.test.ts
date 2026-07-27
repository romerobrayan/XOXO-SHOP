import { describe, expect, it } from "vitest";

import {
  defaultSelection,
  mediaForSelection,
  priceRange,
  sortVariants,
  valueAvailability,
  variantForSelection,
  type PickerOption,
  type PickerVariant,
} from "./pickerState";

// Mirrors the Conjunto Tiras fixture: Talla (S/M/L/XL) × Color (Negro/Rojo),
// 5 of the 8 combinations stocked, L/Negro stocked but sold out.
const options: PickerOption[] = [
  {
    id: "talla",
    name: "Talla",
    values: [
      { id: "s", value: "S", hex: null },
      { id: "m", value: "M", hex: null },
      { id: "l", value: "L", hex: null },
      { id: "xl", value: "XL", hex: null },
    ],
  },
  {
    id: "color",
    name: "Color",
    values: [
      { id: "negro", value: "Negro", hex: "#1A1A1A" },
      { id: "rojo", value: "Rojo", hex: "#C0182B" },
    ],
  },
];

const variant = (
  id: string,
  optionValueIds: string[],
  available: number,
): PickerVariant => ({
  id,
  priceCents: 45_000_00,
  compareAtCents: null,
  available,
  lowStockAt: 3,
  optionValueIds,
});

const variants: PickerVariant[] = [
  variant("s-negro", ["s", "negro"], 4),
  variant("m-negro", ["m", "negro"], 6),
  variant("l-negro", ["l", "negro"], 0),
  variant("xl-negro", ["xl", "negro"], 2),
  variant("m-rojo", ["m", "rojo"], 3),
];

describe("variantForSelection", () => {
  it("resolves a complete selection to its variant", () => {
    expect(
      variantForSelection(options, variants, { talla: "m", color: "rojo" })?.id,
    ).toBe("m-rojo");
  });

  it("returns undefined while the selection is incomplete", () => {
    expect(
      variantForSelection(options, variants, { talla: "m" }),
    ).toBeUndefined();
  });

  it("returns undefined for an unstocked combination", () => {
    expect(
      variantForSelection(options, variants, { talla: "s", color: "rojo" }),
    ).toBeUndefined();
  });
});

describe("valueAvailability", () => {
  it("marks a stocked-but-sold-out combination as sold-out, not hidden", () => {
    // With Negro selected, L exists in the catalog and is sold out — the chip
    // must stay visible and announce that state (docs/archive/DESIGN_BRIEF_PDP.md).
    expect(
      valueAvailability(options, variants, "talla", "l", { color: "negro" }),
    ).toBe("sold-out");
  });

  it("marks a never-stocked combination as not-offered", () => {
    expect(
      valueAvailability(options, variants, "color", "rojo", { talla: "s" }),
    ).toBe("not-offered");
  });

  it("stays selectable when the cross-axis combination has stock", () => {
    expect(
      valueAvailability(options, variants, "color", "rojo", { talla: "m" }),
    ).toBe("selectable");
  });

  it("evaluates against all variants when nothing else is selected", () => {
    // L only exists in Negro with zero stock → sold out even with no color chosen.
    expect(valueAvailability(options, variants, "talla", "l", {})).toBe(
      "sold-out",
    );
    expect(valueAvailability(options, variants, "talla", "m", {})).toBe(
      "selectable",
    );
  });
});

describe("defaultSelection", () => {
  it("preselects the first available variant in axis order", () => {
    expect(defaultSelection(options, variants)).toEqual({
      talla: "s",
      color: "negro",
    });
  });

  it("falls back to the first variant when everything is sold out", () => {
    const soldOut = variants.map((v) => ({ ...v, available: 0 }));
    expect(defaultSelection(options, soldOut)).toEqual({
      talla: "s",
      color: "negro",
    });
  });

  it("is empty for a zero-option product", () => {
    const single = [variant("only", [], 3)];
    expect(defaultSelection([], single)).toEqual({});
    // The same selection resolves to the single variant — no special casing.
    expect(variantForSelection([], single, {})?.id).toBe("only");
  });
});

describe("sortVariants", () => {
  it("orders by option value positions, sizes before colors", () => {
    const shuffled = [...variants].reverse();
    expect(sortVariants(options, shuffled).map((v) => v.id)).toEqual([
      "s-negro",
      "m-negro",
      "m-rojo",
      "l-negro",
      "xl-negro",
    ]);
  });
});

describe("priceRange", () => {
  it("spans min and max across variants", () => {
    const priced = [
      { ...variant("a", [], 1), priceCents: 45_000_00 },
      { ...variant("b", [], 1), priceCents: 80_000_00 },
    ];
    expect(priceRange(priced)).toEqual({ min: 45_000_00, max: 80_000_00 });
  });
});

describe("mediaForSelection", () => {
  const media = [
    { id: "all", optionValueId: null },
    { id: "negro-only", optionValueId: "negro" },
    { id: "rojo-only", optionValueId: "rojo" },
  ];

  it("keeps product-wide media and the selected color's media", () => {
    expect(
      mediaForSelection(media, { color: "negro" }).map((m) => m.id),
    ).toEqual(["all", "negro-only"]);
  });

  it("keeps only product-wide media with no selection", () => {
    expect(mediaForSelection(media, {}).map((m) => m.id)).toEqual(["all"]);
  });
});
