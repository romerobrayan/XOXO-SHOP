import { describe, expect, it } from "vitest";

import { formatCOP } from "./money";

describe("formatCOP", () => {
  it("formats cents in the brand's Colombian format, no space after the sign", () => {
    expect(formatCOP(45_000_00)).toBe("$45.000");
  });

  it("formats the top of the observed price range", () => {
    expect(formatCOP(120_000_00)).toBe("$120.000");
  });
});
