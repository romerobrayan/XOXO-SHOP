// The only place the import pipeline talks to Cloudinary. Product photography
// never enters the repo and is never hotlinked from a supplier (CLAUDE.md):
// bytes are downloaded from the supplier and re-uploaded here.
//
// Delivery uses the brand-guide transformation — 4:5 padded onto the arena
// background — so supplier photos on white arrive storefront-ready without
// manual preprocessing (Bloque E).
import { createHash } from "node:crypto";
import { v2 as cloudinary } from "cloudinary";
import type { Supplier } from "./config";

/** From design_handoff_web_secreto: 4:5 on arena #F1E7D8, auto format/quality. */
export const BRAND_TRANSFORM = "c_pad,ar_4:5,b_rgb:F1E7D8,f_auto,q_auto";

/** The SDK reads CLOUDINARY_URL (cloudinary://KEY:SECRET@CLOUD) from the
 * environment on its own; this only verifies it is complete and turns on
 * https. Never log the secret. */
export function assertCloudinaryConfigured(): { cloudName: string } {
  cloudinary.config({ secure: true });
  const cfg = cloudinary.config();
  if (!cfg.cloud_name || !cfg.api_key || !cfg.api_secret) {
    throw new Error(
      "CLOUDINARY_URL is missing or incomplete in .env — expected cloudinary://API_KEY:API_SECRET@CLOUD_NAME",
    );
  }
  return { cloudName: cfg.cloud_name };
}

/** Deterministic id from the source URL (query stripped — Shopify appends a
 * cache-busting ?v= that changes without the asset changing). Re-running the
 * import maps the same supplier photo to the same Cloudinary asset. */
export function publicIdForSource(supplier: Supplier, sourceUrl: string): string {
  const canonical = sourceUrl.split("?")[0];
  const hash = createHash("sha1").update(canonical).digest("hex").slice(0, 16);
  return `secreto/productos/${supplier}/${hash}`;
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

export async function uploadImage(params: {
  buffer: Buffer;
  contentType: string;
  publicId: string;
  supplierRef: string;
}): Promise<{ publicId: string; bytes: number; existed: boolean }> {
  const dataUri = `data:${params.contentType};base64,${params.buffer.toString("base64")}`;
  const res = await cloudinary.uploader.upload(dataUri, {
    public_id: params.publicId,
    // An asset already uploaded for this source URL is final — re-runs return
    // the existing asset instead of writing again.
    overwrite: false,
    resource_type: "image",
    tags: ["import", params.supplierRef.split(":")[0]],
    context: { supplierRef: params.supplierRef },
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
