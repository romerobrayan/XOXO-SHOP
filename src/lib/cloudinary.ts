// The only module that talks to the Cloudinary SDK — the supplier import
// pipeline (scripts/import + src/features/import) and the admin panel's media
// manager both go through here. Product photography never enters the repo and
// is never hotlinked from a supplier (CLAUDE.md): bytes are downloaded from
// the supplier — or received from the owner's phone — and re-uploaded here.
//
// Delivery uses the brand-guide transformation — 4:5 padded onto the arena
// background. Derived (transformed) assets carry no metadata: Cloudinary
// strips EXIF/GPS from derivatives unless explicitly asked to keep it
// (fl_keep_iptc), which this project never does. The stored original keeps
// its bytes, but the storefront only ever serves the transformed URL, so a
// phone photo's GPS never reaches a visitor. media.cloudinary.test.ts proves
// it against the real account.
//
// Server-side only by convention, not by the "server-only" package: the tsx
// import scripts run outside Next and would trip on it. Never import this
// from a client component — the client-safe URL helper is cloudinary-url.ts,
// which knows the transform string but not the SDK.
import { createHash } from "node:crypto";
import { v2 as cloudinary } from "cloudinary";

/** From design_handoff_web_secreto: 4:5 on arena #F1E7D8, auto format/quality. */
export const BRAND_TRANSFORM = "c_pad,ar_4:5,b_rgb:F1E7D8,f_auto,q_auto";

/** Every image the panel uploads lives under this prefix; supplier imports
 * live under secreto/productos/<supplier>/. The namespace is what remove
 * logic keys on: panel assets may be destroyed when nothing references them,
 * supplier assets never are (re-promoting relies on them existing). */
export const PANEL_FOLDER = "secreto/productos/panel";

/** The SDK reads CLOUDINARY_URL (cloudinary://KEY:SECRET@CLOUD) from the
 * environment on its own; this only verifies it is complete and turns on
 * https. Never log the secret. */
export function assertCloudinaryConfigured(): { cloudName: string } {
  cloudinary.config({ secure: true });
  const cfg = cloudinary.config();
  if (!cfg.cloud_name || !cfg.api_key || !cfg.api_secret) {
    throw new Error(
      "CLOUDINARY_URL is missing or incomplete — expected cloudinary://API_KEY:API_SECRET@CLOUD_NAME",
    );
  }
  return { cloudName: cfg.cloud_name };
}

/** Deterministic id from the source URL (query stripped — Shopify appends a
 * cache-busting ?v= that changes without the asset changing). Re-running the
 * import maps the same supplier photo to the same Cloudinary asset. */
export function publicIdForSource(
  supplier: "distrisex" | "climax",
  sourceUrl: string,
): string {
  const canonical = sourceUrl.split("?")[0];
  const hash = createHash("sha1").update(canonical).digest("hex").slice(0, 16);
  return `secreto/productos/${supplier}/${hash}`;
}

/** Deterministic id from the bytes themselves — panel uploads have no source
 * URL, so the content is the identity. The same photo picked twice from the
 * phone's gallery maps to the same asset instead of a duplicate. */
export function publicIdForBytes(buffer: Buffer): string {
  const hash = createHash("sha1").update(buffer).digest("hex").slice(0, 16);
  return `${PANEL_FOLDER}/${hash}`;
}

/** Versionless delivery URL with the brand transformation baked in. The asset
 * behind a public_id never changes (overwrite: false), so the URL is stable —
 * it is what ProductMedia.url stores. The SDK appends an `?_a=` analytics
 * token that would make stored URLs differ across SDK versions; strip it. */
export function deliveryUrl(publicId: string): string {
  return cloudinary
    .url(publicId, { secure: true, raw_transformation: BRAND_TRANSFORM })
    .split("?")[0];
}

/** Inverse of deliveryUrl, for remove logic: the public_id a stored
 * ProductMedia.url points at, or null for URLs this project did not mint
 * (external sources pass through the media table untouched). */
export function publicIdFromDeliveryUrl(url: string): string | null {
  const match = url.match(/\/image\/upload\/[^/]+\/(?:v1\/)?(.+)$/);
  return match ? match[1] : null;
}

export async function uploadImage(params: {
  buffer: Buffer;
  contentType: string;
  publicId: string;
  /** Provenance recorded on the asset: "distrisex:123" · "climax:handle" ·
   * "panel:<productId>". The tag is the part before the colon. */
  sourceRef: string;
}): Promise<{ publicId: string; bytes: number; existed: boolean }> {
  const dataUri = `data:${params.contentType};base64,${params.buffer.toString("base64")}`;
  const origin = params.sourceRef.split(":")[0];
  const res = await cloudinary.uploader.upload(dataUri, {
    public_id: params.publicId,
    // An asset already uploaded for this content is final — re-runs return
    // the existing asset instead of writing again.
    overwrite: false,
    resource_type: "image",
    // Same tag shape the import pipeline has always written; panel uploads
    // get their own tag instead of masquerading as imports.
    tags: origin === "panel" ? ["panel"] : ["import", origin],
    context: { sourceRef: params.sourceRef },
  });
  return {
    publicId: res.public_id,
    bytes: res.bytes,
    existed: res.existing === true,
  };
}

export async function destroyAsset(publicId: string): Promise<void> {
  await cloudinary.uploader.destroy(publicId, {
    resource_type: "image",
    invalidate: true,
  });
}
