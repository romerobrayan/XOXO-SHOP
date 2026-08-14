import type { PrismaClient } from "@/generated/prisma/client";
import {
  PANEL_FOLDER,
  destroyAsset,
  publicIdFromDeliveryUrl,
} from "@/lib/cloudinary";

// Permanent deletion, separated from the Server Action so a test can prove
// the guard against a real Postgres. The rule it enforces (CLAUDE.md): a
// product with ANY order line or ledger row never deletes — deleting it
// would break order history and the inventory ledger's ability to reconcile.
// The check runs INSIDE the transaction: the UI's "no history" snapshot may
// be stale by the time the button lands.

export type DeleteOutcome =
  | { ok: true; slug: string }
  | { ok: false; code: "NOT_FOUND" | "HAS_HISTORY" };

export async function deleteProductPermanently(
  db: PrismaClient,
  productId: string,
): Promise<DeleteOutcome> {
  const mediaUrls: string[] = [];

  const outcome = await db.$transaction(async (tx) => {
    const product = await tx.product.findUnique({
      where: { id: productId },
      select: { slug: true, media: { select: { url: true } } },
    });
    if (!product) return { ok: false as const, code: "NOT_FOUND" as const };

    const [orderItems, movements] = await Promise.all([
      tx.orderItem.count({ where: { variant: { productId } } }),
      tx.inventoryMovement.count({ where: { variant: { productId } } }),
    ]);
    if (orderItems > 0 || movements > 0) {
      return { ok: false as const, code: "HAS_HISTORY" as const };
    }

    // A staged supplier product pointing here goes back to the curation
    // queue — the FK would go null on delete anyway, but silently keeping it
    // "PUBLISHED" would lie to the curator.
    await tx.supplierStagingProduct.updateMany({
      where: { publishedProductId: productId },
      data: { status: "PENDING", publishedAt: null },
    });

    mediaUrls.push(...product.media.map((m) => m.url));
    // Options, values, variants, media rows, and specs cascade with the
    // product row (schema onDelete: Cascade).
    await tx.product.delete({ where: { id: productId } });
    return { ok: true as const, slug: product.slug };
  });

  if (!outcome.ok) return outcome;

  // Panel-uploaded assets nobody references anymore are garbage — same
  // hygiene as removing a single photo. Best-effort, outside the
  // transaction: a failed destroy costs storage, never correctness.
  for (const url of mediaUrls) {
    const publicId = publicIdFromDeliveryUrl(url);
    if (!publicId || !publicId.startsWith(`${PANEL_FOLDER}/`)) continue;
    const stillReferenced = await db.productMedia.count({ where: { url } });
    if (stillReferenced > 0) continue;
    await destroyAsset(publicId).catch((e) =>
      console.error(`[products] destroy failed for ${publicId}`, e),
    );
  }

  return outcome;
}
