// The one rule for "which image represents this product". Cards, the cart and
// the order snapshot all need the same answer, and they reach it from three
// different shapes (Prisma rows, DTOs, action payloads) — so the rule lives
// here, on the smallest possible surface: no Prisma import, no server-only,
// safe to pull into a client bundle.
import { toCardImageUrl } from "@/lib/cloudinary-url";

// Structural, not nominal: ProductMedia rows and MediaDTO both satisfy it.
export type CoverSource = {
  type: "IMAGE" | "VIDEO";
  url: string;
  posterUrl: string | null;
  alt: string;
};

/**
 * The cover of an ordered media list, already swapped to the card crop.
 * A leading video falls back to its poster frame (a grid or a cart row never
 * autoplays), and a video with no poster yields null — the caller renders the
 * striped placeholder, never a stock photo (CLAUDE.md).
 */
export function coverImage(
  media: readonly CoverSource[],
): { url: string; alt: string } | null {
  const primary = media[0];
  if (!primary) return null;
  if (primary.type === "VIDEO") {
    return primary.posterUrl
      ? { url: toCardImageUrl(primary.posterUrl), alt: primary.alt }
      : null;
  }
  return { url: toCardImageUrl(primary.url), alt: primary.alt };
}
