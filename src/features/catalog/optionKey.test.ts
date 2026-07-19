import { describe, expect, it } from "vitest";

import { computeOptionKey } from "./optionKey";

describe("computeOptionKey", () => {
  it("is order-independent", () => {
    expect(computeOptionKey(["b", "a"])).toBe(computeOptionKey(["a", "b"]));
  });

  it("returns empty string for option-less products", () => {
    // n = 0 → the singleton variant, by construction.
    expect(computeOptionKey([])).toBe("");
  });

  it("does not mutate its input", () => {
    const ids = ["z", "a"];
    computeOptionKey(ids);
    expect(ids).toEqual(["z", "a"]);
  });
});
