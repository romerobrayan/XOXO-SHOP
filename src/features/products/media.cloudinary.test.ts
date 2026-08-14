// The panel upload against the REAL Cloudinary account — same spirit as
// `npm run import:check`, but through the exact code path the owner's phone
// uses. Needs both DATABASE_URL and CLOUDINARY_URL; with them present it
// always runs (the local .env carries both), so a broken credential or a
// regression in the EXIF promise fails the suite instead of hiding.
//
// The privacy assertion is the one that matters: the fixture is a real JPEG
// with a GPS EXIF block (generated once with GDI+ — tags GPSLatitudeRef "N"
// and GPSLatitude 6°14'0", roughly Medellín), and the delivered derivative
// must not carry it. Cloudinary strips metadata on derived images unless
// asked otherwise; this pins that behavior against the live account.
import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, describe, expect, it } from "vitest";

import { PrismaClient } from "@/generated/prisma/client";
import {
  BRAND_TRANSFORM,
  PANEL_FOLDER,
  destroyAsset,
  publicIdForBytes,
  publicIdFromDeliveryUrl,
} from "@/lib/cloudinary";
import { addProductImage, removeProductMedia } from "./media";

const databaseUrl = process.env.DATABASE_URL;
const cloudinaryUrl = process.env.CLOUDINARY_URL;

const PRODUCT_ID = "test-media-cloudinary";

// 4×5 arena-colored JPEG, 724 bytes, with an EXIF APP1 segment carrying a GPS
// IFD. Regenerate (PowerShell + System.Drawing) only if the shape must change.
const JPEG_WITH_GPS_EXIF = Buffer.from(
  "/9j/4AAQSkZJRgABAQEAYABgAAD/4QBaRXhpZgAATU0AKgAAAAgAAYglAAQAAAABAAAAGgAAAAAAAgABAAIAAAACTgAAAAACAAUAAAADAAAAOAAAAAAAAAAGAAAAAQAAAA4AAAABAAAAAAAAAAEAAP/bAEMACAYGBwYFCAcHBwkJCAoMFA0MCwsMGRITDxQdGh8eHRocHCAkLicgIiwjHBwoNyksMDE0NDQfJzk9ODI8LjM0Mv/bAEMBCQkJDAsMGA0NGDIhHCEyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMv/AABEIAAUABAMBIgACEQEDEQH/xAAfAAABBQEBAQEBAQAAAAAAAAAAAQIDBAUGBwgJCgv/xAC1EAACAQMDAgQDBQUEBAAAAX0BAgMABBEFEiExQQYTUWEHInEUMoGRoQgjQrHBFVLR8CQzYnKCCQoWFxgZGiUmJygpKjQ1Njc4OTpDREVGR0hJSlNUVVZXWFlaY2RlZmdoaWpzdHV2d3h5eoOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4eLj5OXm5+jp6vHy8/T19vf4+fr/xAAfAQADAQEBAQEBAQEBAAAAAAAAAQIDBAUGBwgJCgv/xAC1EQACAQIEBAMEBwUEBAABAncAAQIDEQQFITEGEkFRB2FxEyIygQgUQpGhscEJIzNS8BVictEKFiQ04SXxFxgZGiYnKCkqNTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqCg4SFhoeIiYqSk5SVlpeYmZqio6Slpqeoqaqys7S1tre4ubrCw8TFxsfIycrS09TV1tfY2dri4+Tl5ufo6ery8/T19vf4+fr/2gAMAwEAAhEDEQA/APaKKKK5zU//2Q==",
  "base64",
);

describe.skipIf(!databaseUrl || !cloudinaryUrl)(
  "panel upload against the real Cloudinary account",
  () => {
    const db = new PrismaClient({
      adapter: new PrismaPg({ connectionString: databaseUrl }),
    });
    const publicId = publicIdForBytes(JPEG_WITH_GPS_EXIF);

    afterAll(async () => {
      await db.product.deleteMany({ where: { id: PRODUCT_ID } });
      // Idempotent: fine whether the remove-path already destroyed it or an
      // earlier failed run left it behind.
      await destroyAsset(publicId).catch(() => {});
      await db.$disconnect();
    });

    it("uploads, delivers the brand derivative without EXIF, dedupes, removes", async () => {
      // The fixture really carries EXIF before the round trip.
      expect(JPEG_WITH_GPS_EXIF.includes(Buffer.from("Exif"))).toBe(true);

      await db.product.deleteMany({ where: { id: PRODUCT_ID } });
      await db.product.create({
        data: {
          id: PRODUCT_ID,
          slug: "test-media-cloudinary",
          name: "Test Cloudinary product",
          variants: {
            create: {
              sku: "TEST-MEDIA-CLD",
              optionKey: "test-media-cld",
              priceCents: 50_000_00,
            },
          },
        },
      });

      const added = await addProductImage(db, {
        productId: PRODUCT_ID,
        buffer: JPEG_WITH_GPS_EXIF,
        contentType: "image/jpeg",
      });
      if (!added.ok) throw new Error(`upload failed: ${added.code}`);

      // Stored URL: brand transformation baked in, panel namespace.
      expect(added.url).toContain(`/image/upload/${BRAND_TRANSFORM}/`);
      expect(publicIdFromDeliveryUrl(added.url)).toBe(publicId);
      expect(publicId.startsWith(`${PANEL_FOLDER}/`)).toBe(true);

      // The derivative the storefront serves answers 200…
      const stored = await fetch(added.url);
      expect(stored.status).toBe(200);

      // …and a JPEG derivative of it carries no EXIF marker: the GPS block
      // from the phone photo never reaches a visitor. (f_jpg pins the format
      // so the marker scan is meaningful.)
      const jpgUrl = added.url.replace("f_auto", "f_jpg");
      const derived = await fetch(jpgUrl);
      expect(derived.status).toBe(200);
      const derivedBytes = Buffer.from(await derived.arrayBuffer());
      expect(derivedBytes.includes(Buffer.from("Exif"))).toBe(false);

      // Same bytes again: content-addressed dedupe answers without a second
      // asset or a second row.
      const again = await addProductImage(db, {
        productId: PRODUCT_ID,
        buffer: JPEG_WITH_GPS_EXIF,
        contentType: "image/jpeg",
      });
      expect(again).toEqual({ ok: false, code: "ALREADY_IN_PRODUCT" });

      // Removing the only reference also cleans the panel asset up.
      const removed = await removeProductMedia(db, { mediaId: added.mediaId });
      expect(removed).toEqual({ ok: true, destroyedAsset: true });
      expect(
        await db.productMedia.count({ where: { productId: PRODUCT_ID } }),
      ).toBe(0);
    }, 60_000);
  },
);
