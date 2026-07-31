import { describe, expect, it } from "vitest";
import { CARD_TRANSFORM, toCardImageUrl } from "./cloudinary-url";

const stored =
  "https://res.cloudinary.com/cs2uzjap/image/upload/c_pad,ar_4:5,b_rgb:F1E7D8,f_auto,q_auto/v1/secreto/productos/distrisex/abc123";

describe("toCardImageUrl", () => {
  it("swaps the stored pad transform for the card crop", () => {
    expect(toCardImageUrl(stored)).toBe(
      `https://res.cloudinary.com/cs2uzjap/image/upload/${CARD_TRANSFORM}/v1/secreto/productos/distrisex/abc123`,
    );
  });

  it("is idempotent", () => {
    const once = toCardImageUrl(stored);
    expect(toCardImageUrl(once)).toBe(once);
  });

  it("leaves non-Cloudinary URLs untouched", () => {
    const other = "https://example.com/fotos/producto.jpg";
    expect(toCardImageUrl(other)).toBe(other);
  });

  it("leaves Cloudinary URLs with a different transform untouched", () => {
    const custom =
      "https://res.cloudinary.com/cs2uzjap/image/upload/c_thumb,w_200/v1/secreto/productos/climax/def456";
    expect(toCardImageUrl(custom)).toBe(custom);
  });
});
