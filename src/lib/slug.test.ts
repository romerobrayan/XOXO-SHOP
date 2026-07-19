import { describe, expect, it } from "vitest";

import { slugify } from "./slug";

describe("slugify", () => {
  it("strips Spanish diacritics", () => {
    expect(slugify("Cosmética íntima")).toBe("cosmetica-intima");
  });

  it("collapses punctuation and whitespace", () => {
    expect(slugify("Juguetería y dispositivos")).toBe(
      "jugueteria-y-dispositivos",
    );
  });

  it("trims leading and trailing separators", () => {
    expect(slugify("  ¡Oferta!  ")).toBe("oferta");
  });
});
