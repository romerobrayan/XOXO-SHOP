import { describe, expect, it } from "vitest";

import { cartesian, proposeVariantSku } from "./variant-sku";

describe("proposeVariantSku", () => {
  it("joins base and values, uppercased and diacritic-free", () => {
    expect(proposeVariantSku("11362", ["M", "Negro"])).toBe("11362-M-NEGRO");
  });

  it("survives accents and spaces in values", () => {
    expect(proposeVariantSku("babydoll", ["Talla única", "Café"])).toBe(
      "BABYDOLL-TALLAUNICA-CAFE",
    );
  });

  it("keeps the base's own dashes — supplier refs arrive that way", () => {
    expect(proposeVariantSku("PL-4720", ["M", "Vino tinto"])).toBe(
      "PL-4720-M-VINOTINTO",
    );
  });

  it("handles the option-less product: base alone", () => {
    expect(proposeVariantSku("LUSH3", [])).toBe("LUSH3");
  });
});

describe("cartesian", () => {
  it("yields the singleton for zero sets — |V| = 1 when n = 0", () => {
    expect(cartesian([])).toEqual([[]]);
  });

  it("multiplies sizes", () => {
    const combos = cartesian([
      ["S", "M", "L"],
      ["Negro", "Rojo"],
    ]);
    expect(combos).toHaveLength(6);
    expect(combos).toContainEqual(["M", "Rojo"]);
  });

  it("keeps set order stable within each combo", () => {
    for (const combo of cartesian([["a", "b"], ["1", "2"], ["x"]])) {
      expect(combo).toHaveLength(3);
      expect(["a", "b"]).toContain(combo[0]);
      expect(["1", "2"]).toContain(combo[1]);
      expect(combo[2]).toBe("x");
    }
  });

  it("yields nothing when any set is empty — no half-defined combos", () => {
    expect(cartesian([["S", "M"], []])).toEqual([]);
  });
});
