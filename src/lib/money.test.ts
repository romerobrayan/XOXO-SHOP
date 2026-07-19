import { describe, expect, it } from "vitest";

import { formatCOP } from "./money";

describe("formatCOP", () => {
  it("formats cents as COP without decimals", () => {
    // es-CO uses period as thousands separator and no decimals: $ 45.000
    expect(formatCOP(45_000_00).replace(/\s/g, "")).toBe("$45.000");
  });

  it("formats the top of the observed price range", () => {
    expect(formatCOP(120_000_00).replace(/\s/g, "")).toBe("$120.000");
  });
});
