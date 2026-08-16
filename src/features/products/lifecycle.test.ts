// The deletion guard against a real Postgres: history protects, emptiness
// deletes, and the staging back-reference returns to the curation queue.
import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { PrismaClient } from "@/generated/prisma/client";
import { deleteProductPermanently } from "./lifecycle";

const databaseUrl = process.env.DATABASE_URL;

const PRODUCT_ID = "test-lifecycle-product";
const VARIANT_ID = "test-lifecycle-variant";
const STAGING_REF = "climax:test-lifecycle";

describe.skipIf(!databaseUrl)("permanent product deletion", () => {
  const db = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl }),
  });

  async function cleanup() {
    await db.order.deleteMany({
      where: { orderNumber: { startsWith: "SECRETO-TEST-LC" } },
    });
    await db.supplierStagingProduct.deleteMany({
      where: { supplierRef: STAGING_REF },
    });
    await db.product.deleteMany({ where: { id: PRODUCT_ID } });
  }

  beforeEach(async () => {
    await cleanup();
    await db.product.create({
      data: {
        id: PRODUCT_ID,
        slug: "test-lifecycle-product",
        name: "Test lifecycle product",
        variants: {
          create: {
            id: VARIANT_ID,
            sku: "TEST-LC-A",
            optionKey: "test-lc-a",
            priceCents: 50_000_00,
          },
        },
        media: {
          create: { url: "https://example.com/lc.jpg", alt: "lc", position: 0 },
        },
        specs: { create: { label: "Material", value: "Prueba", position: 0 } },
      },
    });
  });

  afterAll(async () => {
    await cleanup();
    await db.$disconnect();
  });

  it("deletes a product with no history and resets its staging row to the queue", async () => {
    await db.supplierStagingProduct.create({
      data: {
        supplierRef: STAGING_REF,
        supplier: "climax",
        name: "Test lifecycle product",
        supplierPriceCents: 40_000_00,
        payload: {},
        searchText: "test lifecycle",
        fetchedAt: new Date(),
        status: "PUBLISHED",
        publishedProductId: PRODUCT_ID,
        publishedAt: new Date(),
      },
    });

    const outcome = await deleteProductPermanently(db, PRODUCT_ID);
    expect(outcome).toEqual({ ok: true, slug: "test-lifecycle-product" });

    expect(
      await db.product.findUnique({ where: { id: PRODUCT_ID } }),
    ).toBeNull();
    // Catalog satellites cascaded with the row.
    expect(
      await db.productVariant.findUnique({ where: { id: VARIANT_ID } }),
    ).toBeNull();
    expect(
      await db.productMedia.count({ where: { productId: PRODUCT_ID } }),
    ).toBe(0);

    const staging = await db.supplierStagingProduct.findUniqueOrThrow({
      where: { supplierRef: STAGING_REF },
    });
    expect(staging.status).toBe("PENDING");
    expect(staging.publishedProductId).toBeNull();
    expect(staging.publishedAt).toBeNull();
  });

  it("refuses when the ledger has a movement", async () => {
    await db.inventoryMovement.create({
      data: { variantId: VARIANT_ID, delta: 5, reason: "PURCHASE" },
    });
    expect(await deleteProductPermanently(db, PRODUCT_ID)).toEqual({
      ok: false,
      code: "HAS_HISTORY",
    });
    expect(
      await db.product.findUnique({ where: { id: PRODUCT_ID } }),
    ).not.toBeNull();
  });

  it("refuses when an order line references a variant", async () => {
    await db.order.create({
      data: {
        orderNumber: "SECRETO-TEST-LC1",
        subtotalCents: 50_000_00,
        totalCents: 50_000_00,
        items: {
          create: {
            variantId: VARIANT_ID,
            productName: "Test lifecycle product",
            variantSku: "TEST-LC-A",
            variantLabel: "",
            unitPriceCents: 50_000_00,
            quantity: 1,
            totalCents: 50_000_00,
          },
        },
      },
    });
    expect(await deleteProductPermanently(db, PRODUCT_ID)).toEqual({
      ok: false,
      code: "HAS_HISTORY",
    });
  });

  it("answers NOT_FOUND for a product that is already gone", async () => {
    await db.product.deleteMany({ where: { id: PRODUCT_ID } });
    expect(await deleteProductPermanently(db, PRODUCT_ID)).toEqual({
      ok: false,
      code: "NOT_FOUND",
    });
  });
});
