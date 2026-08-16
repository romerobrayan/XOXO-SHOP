// Render-time Cloudinary delivery-transform swap. ProductMedia.url is
// immutable once stored — the import pipeline keys idempotency on the exact
// URL (promote reuses assets by URL match) — so the card crop is applied at
// render time, never persisted.
//
// Stored format, written by src/lib/cloudinary.ts deliveryUrl():
//   https://res.cloudinary.com/<cloud>/image/upload/<PAD_TRANSFORM>/v1/<id>

/** Mirror of BRAND_TRANSFORM in src/lib/cloudinary.ts. Duplicated on
 * purpose: this module reaches client components, and importing the SDK
 * module there would drag cloudinary into the client bundle.
 * cloudinary-url.test.ts pins the string so drift fails loudly. */
const PAD_TRANSFORM = "c_pad,ar_4:5,b_rgb:F1E7D8,f_auto,q_auto";

/** Cards crop-to-fill: subject-centered 4:5, no arena letterbox. The gallery
 * keeps the stored padded version — the full piece matters in detail. */
export const CARD_TRANSFORM = "c_fill,ar_4:5,g_auto,f_auto,q_auto";

/** Swap the stored pad transform for the card crop. URLs that do not carry
 * the exact stored transform pass through unchanged, which also makes the
 * function idempotent and safe for non-Cloudinary sources. */
export function toCardImageUrl(url: string): string {
  return url.replace(
    `/image/upload/${PAD_TRANSFORM}/`,
    `/image/upload/${CARD_TRANSFORM}/`,
  );
}
