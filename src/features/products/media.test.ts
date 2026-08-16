// Ordering and removal logic against a real Postgres, like stock-adjust:
// resequencing is a write path, so it gets exercised where writes happen.
// Skips when DATABASE_URL is absent. URLs here are non-Cloudinary on purpose
// — removal only reaches for the Cloudinary API on panel-namespace URLs, and
// the real-account round trip lives in media.cloudinary.test.ts.
import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { PrismaClient } from "@/generated/prisma/client";
import { publicIdFromDeliveryUrl } from "@/lib/cloudinary";
import { moveProductMedia, removeProductMedia } from "./media";

const databaseUrl = process.env.DATABASE_URL;

const PRODUCT_ID = "test-media-product";

describe("publicIdFromDeliveryUrl", () => {
  it("recovers the public_id from a stored delivery URL", () => {
    expect(
      publicIdFromDeliveryUrl(
        "https://res.cloudinary.com/demo/image/upload/c_pad,ar_4:5,b_rgb:F1E7D8,f_auto,q_auto/v1/secreto/productos/panel/abc123",
      ),
    ).toBe("secreto/productos/panel/abc123");
    expect(
      publicIdFromDeliveryUrl(
        "https://res.cloudinary.com/demo/image/upload/c_pad,ar_4:5,b_rgb:F1E7D8,f_auto,q_auto/secreto/productos/distrisex/def456",
      ),
    ).toBe("secreto/productos/distrisex/def456");
  });

  it("returns null for URLs this project did not mint", () => {
    expect(publicIdFromDeliveryUrl("https://example.com/foto.jpg")).toBeNull();
  });
});

describe.skipIf(!databaseUrl)("product media ordering", () => {
  const db = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl }),
  });

  const mediaIds = { a: "", b: "", c: "" };

  beforeEach(async () => {
    await db.product.deleteMany({ where: { id: PRODUCT_ID } });
    const product = await db.product.create({
      data: {
        id: PRODUCT_ID,
        slug: "test-media-product",
        name: "Test media product",
        variants: {
          create: {
            sku: "TEST-MEDIA-A",
            optionKey: "test-media-a",
            priceCents: 50_000_00,
          },
        },
        media: {
          create: [
            // Deliberate gaps and a tie: legacy data must normalize on write.
            { url: "https://example.com/a.jpg", alt: "a", position: 0 },
            { url: "https://example.com/b.jpg", alt: "b", position: 5 },
            { url: "https://example.com/c.jpg", alt: "c", position: 5 },
          ],
        },
      },
      select: { media: { orderBy: [{ position: "asc" }, { id: "asc" }] } },
    });
    [mediaIds.a, mediaIds.b, mediaIds.c] = product.media.map((m) => m.id);
  });

  afterAll(async () => {
    await db.product.deleteMany({ where: { id: PRODUCT_ID } });
    await db.$disconnect();
  });

  async function order() {
    const rows = await db.productMedia.findMany({
      where: { productId: PRODUCT_ID },
      orderBy: [{ position: "asc" }, { id: "asc" }],
      select: { alt: true, position: true },
    });
    return rows.map((r) => `${r.alt}${r.position}`);
  }

  it("swaps with the previous item and resequences to 0..n-1", async () => {
    const outcome = await moveProductMedia(db, {
      mediaId: mediaIds.c,
      direction: "up",
    });
    expect(outcome).toEqual({ ok: true });
    expect(await order()).toEqual(["a0", "c1", "b2"]);
  });

  it("refuses to move past the edges", async () => {
    expect(
      await moveProductMedia(db, { mediaId: mediaIds.a, direction: "up" }),
    ).toEqual({ ok: false, code: "AT_EDGE" });
    expect(
      await moveProductMedia(db, { mediaId: mediaIds.c, direction: "down" }),
    ).toEqual({ ok: false, code: "AT_EDGE" });
  });

  it("removes a row and closes the gap it leaves", async () => {
    const outcome = await removeProductMedia(db, { mediaId: mediaIds.b });
    expect(outcome).toEqual({ ok: true, destroyedAsset: false });
    expect(await order()).toEqual(["a0", "c1"]);
  });

  it("answers NOT_FOUND for a media row that is gone", async () => {
    await removeProductMedia(db, { mediaId: mediaIds.b });
    expect(await removeProductMedia(db, { mediaId: mediaIds.b })).toEqual({
      ok: false,
      code: "NOT_FOUND",
    });
    expect(
      await moveProductMedia(db, { mediaId: mediaIds.b, direction: "up" }),
    ).toEqual({ ok: false, code: "NOT_FOUND" });
  });
});
