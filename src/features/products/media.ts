import type { PrismaClient } from "@/generated/prisma/client";
import {
  PANEL_FOLDER,
  assertCloudinaryConfigured,
  deliveryUrl,
  destroyAsset,
  publicIdForBytes,
  publicIdFromDeliveryUrl,
  uploadImage,
} from "@/lib/cloudinary";

// Media management core, separated from the Server Actions so a test can
// drive it against real Postgres — and the upload against the real Cloudinary
// account — without a request context (same discipline as stock-adjust.ts).
//
// Ordering contract: positions are always resequenced to 0..n-1 on every
// write that changes order, so the storefront gallery (orderBy position) and
// the panel agree without depending on historical gaps.

/** The gallery works best under ~8 (the import caps supplier photos there);
 * the owner gets some slack for her own shots before it stops being a
 * product page and starts being a camera roll. */
export const MAX_MEDIA_PER_PRODUCT = 12;

export type AddImageOutcome =
  | { ok: true; mediaId: string; url: string; reusedAsset: boolean }
  | {
      ok: false;
      code: "NOT_FOUND" | "ALREADY_IN_PRODUCT" | "LIMIT_REACHED";
    };

export async function addProductImage(
  db: PrismaClient,
  params: { productId: string; buffer: Buffer; contentType: string },
): Promise<AddImageOutcome> {
  const product = await db.product.findUnique({
    where: { id: params.productId },
    select: {
      name: true,
      media: { select: { url: true, position: true } },
    },
  });
  if (!product) return { ok: false, code: "NOT_FOUND" };
  if (product.media.length >= MAX_MEDIA_PER_PRODUCT) {
    return { ok: false, code: "LIMIT_REACHED" };
  }

  // Content-addressed: the same photo picked twice maps to the same asset,
  // and the same stored URL — so "already there" is knowable before touching
  // the network.
  const publicId = publicIdForBytes(params.buffer);
  const url = deliveryUrl(publicId);
  if (product.media.some((m) => m.url === url)) {
    return { ok: false, code: "ALREADY_IN_PRODUCT" };
  }

  // Fail on credentials before uploading, not mid-flight with a vague error.
  assertCloudinaryConfigured();
  const uploaded = await uploadImage({
    buffer: params.buffer,
    contentType: params.contentType,
    publicId,
    sourceRef: `panel:${params.productId}`,
  });

  const position =
    product.media.length === 0
      ? 0
      : Math.max(...product.media.map((m) => m.position)) + 1;
  try {
    const media = await db.productMedia.create({
      data: {
        productId: params.productId,
        url,
        alt: product.name,
        position,
        type: "IMAGE",
      },
      select: { id: true },
    });
    return { ok: true, mediaId: media.id, url, reusedAsset: uploaded.existed };
  } catch (e) {
    // @@unique([productId, url]) — a concurrent upload of the same photo won.
    if (isUniqueViolation(e)) return { ok: false, code: "ALREADY_IN_PRODUCT" };
    throw e;
  }
}

export type MoveOutcome =
  | { ok: true }
  | { ok: false; code: "NOT_FOUND" | "AT_EDGE" };

export async function moveProductMedia(
  db: PrismaClient,
  params: { mediaId: string; direction: "up" | "down" },
): Promise<MoveOutcome> {
  return db.$transaction(async (tx) => {
    const media = await tx.productMedia.findUnique({
      where: { id: params.mediaId },
      select: { productId: true },
    });
    if (!media) return { ok: false, code: "NOT_FOUND" as const };

    const all = await tx.productMedia.findMany({
      where: { productId: media.productId },
      orderBy: [{ position: "asc" }, { id: "asc" }],
      select: { id: true, position: true },
    });
    const index = all.findIndex((m) => m.id === params.mediaId);
    const target = params.direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= all.length) {
      return { ok: false, code: "AT_EDGE" as const };
    }

    const order = [...all];
    [order[index], order[target]] = [order[target], order[index]];
    // Resequence the whole reel — normalizes any historical gaps or ties in
    // the same write that reorders.
    for (const [position, m] of order.entries()) {
      if (m.position !== position) {
        await tx.productMedia.update({
          where: { id: m.id },
          data: { position },
        });
      }
    }
    return { ok: true as const };
  });
}

export type RemoveOutcome =
  | { ok: true; destroyedAsset: boolean }
  | { ok: false; code: "NOT_FOUND" };

export async function removeProductMedia(
  db: PrismaClient,
  params: { mediaId: string },
): Promise<RemoveOutcome> {
  const removed = await db.$transaction(async (tx) => {
    const media = await tx.productMedia.findUnique({
      where: { id: params.mediaId },
      select: { productId: true, url: true },
    });
    if (!media) return null;

    await tx.productMedia.delete({ where: { id: params.mediaId } });
    const remaining = await tx.productMedia.findMany({
      where: { productId: media.productId },
      orderBy: [{ position: "asc" }, { id: "asc" }],
      select: { id: true, position: true },
    });
    for (const [position, m] of remaining.entries()) {
      if (m.position !== position) {
        await tx.productMedia.update({
          where: { id: m.id },
          data: { position },
        });
      }
    }
    return media;
  });
  if (!removed) return { ok: false, code: "NOT_FOUND" };

  // Storage hygiene, outside the transaction: a panel-uploaded asset nobody
  // references anymore is garbage. Supplier assets are NEVER destroyed —
  // re-promoting a staged product relies on them existing (one asset per
  // source URL, "re-correr no re-sube"). A failed destroy leaves an orphan
  // asset, which costs storage, not correctness — log and move on.
  const publicId = publicIdFromDeliveryUrl(removed.url);
  if (!publicId || !publicId.startsWith(`${PANEL_FOLDER}/`)) {
    return { ok: true, destroyedAsset: false };
  }
  const stillReferenced = await db.productMedia.count({
    where: { url: removed.url },
  });
  if (stillReferenced > 0) return { ok: true, destroyedAsset: false };
  try {
    await destroyAsset(publicId);
    return { ok: true, destroyedAsset: true };
  } catch (e) {
    console.error(
      `[media] Cloudinary destroy failed for ${publicId} — orphan asset left behind`,
      e,
    );
    return { ok: true, destroyedAsset: false };
  }
}

function isUniqueViolation(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    "code" in e &&
    (e as { code?: string }).code === "P2002"
  );
}
