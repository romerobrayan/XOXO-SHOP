// The publish contract, exercised against a real Postgres — the same core
// runs under the CLI promote and under the panel's Publicar, so this is the
// test for both. Synthetic Climax products keep it offline: no Woo variation
// enrichment (that path needs the supplier's API) and no images (Cloudinary
// has its own real-account test in media.cloudinary.test.ts).
import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { PrismaClient } from "@/generated/prisma/client";
import { computeSalePriceCents, type PromotePricing } from "./pricing";
import {
  ensureCatalogCategories,
  promoteStagedProduct,
} from "./promote-core";
import type { StagedProduct } from "./staging";

const databaseUrl = process.env.DATABASE_URL;

const REF = "climax:test-promote-core";
const PRICING: PromotePricing = {
  marginPct: { distrisex: 50, climax: 100 },
  roundUpToCOP: 500,
};

function stagedFixture(overrides?: Partial<StagedProduct>): StagedProduct {
  return {
    supplierRef: REF,
    supplier: "climax",
    supplierUrl: "https://climax.com.co/products/test-promote-core",
    name: "Producto de prueba promote",
    descriptionText: "Descripción del proveedor.",
    brand: null,
    supplierCategories: ["Lencería"],
    tags: [],
    suggestedCategorySlug: "lenceria",
    supplierPriceCents: 40_000_00,
    suggestedRetailCents: null,
    priceVariesByVariant: true,
    options: [
      {
        name: "Talla",
        values: [
          { value: "S", hex: null },
          { value: "M", hex: null },
        ],
      },
    ],
    specs: [{ label: "Material", value: "Encaje" }],
    images: [],
    variants: [
      {
        supplierVariantId: "v-s",
        sku: "TEST-PROMOTE-S",
        options: { Talla: "S" },
        supplierPriceCents: 40_000_00,
        supplierCompareAtCents: null,
        available: true,
      },
      {
        supplierVariantId: "v-m",
        sku: "TEST-PROMOTE-M",
        options: { Talla: "M" },
        supplierPriceCents: 46_000_00,
        supplierCompareAtCents: null,
        available: true,
      },
    ],
    ...overrides,
  };
}

describe.skipIf(!databaseUrl)("promote core (shared CLI + panel path)", () => {
  const db = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl }),
  });

  async function cleanup() {
    await db.product.deleteMany({ where: { supplierRef: { startsWith: REF } } });
  }

  beforeEach(async () => {
    await cleanup();
    await ensureCatalogCategories(db);
  });
  afterAll(async () => {
    await cleanup();
    await db.$disconnect();
  });

  it("creates an ACTIVE product with per-variant margin pricing", async () => {
    const outcome = await promoteStagedProduct(db, {
      staged: stagedFixture(),
      entry: { supplierRef: REF },
      pricing: PRICING,
    });

    expect(outcome.action).toBe("created");
    expect(outcome.variantsCreated).toBe(2);

    const product = await db.product.findFirstOrThrow({
      where: { supplierRef: REF },
      include: { variants: true, specs: true, category: true },
    });
    expect(product.status).toBe("ACTIVE");
    expect(product.publishedAt).not.toBeNull();
    expect(product.category?.slug).toBe("lenceria");
    expect(product.specs).toHaveLength(1);

    const priceS = computeSalePriceCents(40_000_00, 100, 500);
    const priceM = computeSalePriceCents(46_000_00, 100, 500);
    const bySku = new Map(product.variants.map((v) => [v.sku, v.priceCents]));
    expect(bySku.get("TEST-PROMOTE-S")).toBe(priceS);
    expect(bySku.get("TEST-PROMOTE-M")).toBe(priceM);
    expect(product.minPriceCents).toBe(Math.min(priceS, priceM));
  });

  it("a manual sale price pins every variant to the same number", async () => {
    await promoteStagedProduct(db, {
      staged: stagedFixture(),
      entry: { supplierRef: REF, salePriceCOP: 99_500 },
      pricing: PRICING,
    });
    const product = await db.product.findFirstOrThrow({
      where: { supplierRef: REF },
      include: { variants: true },
    });
    expect(new Set(product.variants.map((v) => v.priceCents))).toEqual(
      new Set([99_500_00]),
    );
  });

  it("re-publishing updates catalog data but never duplicates, never reprices, never touches stock", async () => {
    await promoteStagedProduct(db, {
      staged: stagedFixture(),
      entry: { supplierRef: REF },
      pricing: PRICING,
    });
    const before = await db.product.findFirstOrThrow({
      where: { supplierRef: REF },
      include: { variants: true },
    });

    // The owner receives units and tunes a price by hand.
    const variantS = before.variants.find((v) => v.sku === "TEST-PROMOTE-S")!;
    await db.productVariant.update({
      where: { id: variantS.id },
      data: {
        stockOnHand: 7,
        priceCents: 123_000_00,
        movements: { create: { delta: 7, reason: "PURCHASE" } },
      },
    });

    // Supplier refreshes name/description; a third size appears; margins
    // change. Publish again — with an opening stock for the NEW variant.
    const refreshed = stagedFixture({
      name: "Producto de prueba promote (nuevo nombre)",
      descriptionText: "Descripción refrescada.",
      options: [
        {
          name: "Talla",
          values: [
            { value: "S", hex: null },
            { value: "M", hex: null },
            { value: "L", hex: null },
          ],
        },
      ],
      variants: [
        ...stagedFixture().variants,
        {
          supplierVariantId: "v-l",
          sku: "TEST-PROMOTE-L",
          options: { Talla: "L" },
          supplierPriceCents: 50_000_00,
          supplierCompareAtCents: null,
          available: true,
        },
      ],
    });
    const outcome = await promoteStagedProduct(db, {
      staged: refreshed,
      entry: { supplierRef: REF, initialStock: 3 },
      pricing: { marginPct: { distrisex: 50, climax: 10 }, roundUpToCOP: 500 },
    });

    expect(outcome.action).toBe("updated");
    expect(outcome.variantsKept).toBe(2);
    expect(outcome.variantsCreated).toBe(1);

    const after = await db.product.findFirstOrThrow({
      where: { supplierRef: REF },
      include: {
        variants: { include: { movements: true } },
        options: { include: { values: true } },
      },
    });
    // Same product, same slug, refreshed words.
    expect(after.id).toBe(before.id);
    expect(after.slug).toBe(before.slug);
    expect(after.name).toBe("Producto de prueba promote (nuevo nombre)");
    // No duplicates: 2 kept + 1 new.
    expect(after.variants).toHaveLength(3);
    // The hand-tuned price and the received stock survive untouched.
    const afterS = after.variants.find((v) => v.sku === "TEST-PROMOTE-S")!;
    expect(afterS.priceCents).toBe(123_000_00);
    expect(afterS.stockOnHand).toBe(7);
    // The new variant got its opening stock through the ledger.
    const afterL = after.variants.find((v) => v.sku === "TEST-PROMOTE-L")!;
    expect(afterL.stockOnHand).toBe(3);
    expect(afterL.movements).toHaveLength(1);
    expect(afterL.movements[0]).toMatchObject({ delta: 3, reason: "PURCHASE" });
    // The option axis grew additively.
    expect(after.options[0].values.map((v) => v.value).sort()).toEqual([
      "L",
      "M",
      "S",
    ]);
  });

  it("discards supplier variations left incomplete by Woo's 'any' and reports it", async () => {
    const staged = stagedFixture({
      variants: [
        ...stagedFixture().variants,
        {
          supplierVariantId: "v-any",
          sku: null,
          // The staging schema already dropped the null-valued "Talla" —
          // what reaches the core is an empty combination on an optioned
          // product.
          options: {},
          supplierPriceCents: 40_000_00,
          supplierCompareAtCents: null,
          available: true,
        },
      ],
    });
    const outcome = await promoteStagedProduct(db, {
      staged,
      entry: { supplierRef: REF },
      pricing: PRICING,
    });
    expect(outcome.variantsCreated).toBe(2);
    expect(
      outcome.warnings.some((w) => w.includes("incomplete supplier duplicate")),
    ).toBe(true);
    const product = await db.product.findFirstOrThrow({
      where: { supplierRef: REF },
      include: { variants: true },
    });
    expect(product.variants).toHaveLength(2);
  });
});
