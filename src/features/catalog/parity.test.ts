// Two data sources serve the same storefront: fixtures (no DATABASE_URL, the
// Vercel preview) and Postgres (seeded). A page that renders correctly against
// one and wrongly against the other is the failure this file exists to catch.
//
// The first suite always runs and checks that the demo catalog is internally
// consistent — the invariants the schema can't express. The second connects to
// Postgres and compares the two sources through the real DTO mappers; it is
// skipped when DATABASE_URL is absent, so `npm run test` stays green on a
// machine with no database.
import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, describe, expect, it } from "vitest";

import { PrismaClient, type Prisma } from "@/generated/prisma/client";
import { slugify } from "@/lib/slug";
import {
  demoBrands,
  demoCategories,
  demoProducts,
  type DemoProduct,
} from "./demo-catalog";
import { toProductCard, toProductDetail, type ProductDetailDTO } from "./dto";
import { fixtureBrands, fixtureCategories, fixtureProducts } from "./fixtures";
import { computeOptionKey } from "./optionKey";
import { productCardInclude, productDetailInclude } from "./shapes";

type CategoryRow = Prisma.CategoryGetPayload<Record<string, never>>;

const duplicates = (values: string[]) =>
  values.filter((value, i) => values.indexOf(value) !== i);

const optionValueIdsOf = (product: DemoProduct) =>
  (product.options ?? []).flatMap((o) => o.values.map((v) => v.id));

describe("demo catalog invariants", () => {
  it("has globally unique IDs, slugs, and SKUs", () => {
    // IDs are written to Postgres verbatim, so a collision here is a seed that
    // fails halfway through rather than a subtle rendering difference.
    expect(duplicates(demoBrands.map((b) => b.id))).toEqual([]);
    expect(duplicates(demoCategories.map((c) => c.id))).toEqual([]);
    expect(duplicates(demoProducts.map((p) => p.id))).toEqual([]);
    expect(duplicates(demoProducts.map((p) => p.slug))).toEqual([]);
    expect(
      duplicates(demoProducts.flatMap((p) => p.variants.map((v) => v.id))),
    ).toEqual([]);
    expect(
      duplicates(demoProducts.flatMap((p) => p.variants.map((v) => v.sku))),
    ).toEqual([]);
    expect(
      duplicates(
        demoProducts.flatMap((p) => (p.options ?? []).map((o) => o.id)),
      ),
    ).toEqual([]);
    expect(duplicates(demoProducts.flatMap(optionValueIdsOf))).toEqual([]);
  });

  it("derives every slug from its name", () => {
    for (const brand of demoBrands)
      expect(brand.slug).toBe(slugify(brand.name));
    for (const category of demoCategories) {
      expect(category.slug).toBe(slugify(category.name));
    }
    for (const product of demoProducts) {
      expect(product.slug).toBe(slugify(product.name));
    }
  });

  it("points every foreign key at something that exists", () => {
    const brandIds = new Set(demoBrands.map((b) => b.id));
    const categoryIds = new Set(demoCategories.map((c) => c.id));
    for (const product of demoProducts) {
      if (product.brandId) expect(brandIds.has(product.brandId)).toBe(true);
      expect(categoryIds.has(product.categoryId)).toBe(true);
    }
  });

  it("gives every product at least one variant", () => {
    // V ⊆ V₁ × … × Vₙ, and for n = 0 the empty product is the singleton — so a
    // product with no options still has exactly one variant, by construction.
    for (const product of demoProducts) {
      expect(product.variants.length).toBeGreaterThan(0);
      if (!product.options?.length) {
        expect(product.variants).toHaveLength(1);
        expect(product.variants[0].valueIds ?? []).toEqual([]);
      }
    }
  });

  it("selects exactly one value per option in every variant", () => {
    for (const product of demoProducts) {
      const options = product.options ?? [];
      for (const variant of product.variants) {
        const valueIds = variant.valueIds ?? [];
        expect(valueIds).toHaveLength(options.length);
        for (const option of options) {
          const owned = option.values.filter((v) => valueIds.includes(v.id));
          expect(owned).toHaveLength(1);
        }
      }
    }
  });

  it("keeps optionKey unique within a product", () => {
    // The denormalized key backing @@unique([productId, optionKey]) — a
    // duplicate would make the seed fail on the constraint.
    for (const product of demoProducts) {
      const keys = product.variants.map((v) =>
        computeOptionKey(v.valueIds ?? []),
      );
      expect(duplicates(keys)).toEqual([]);
    }
  });

  it("prices in whole COP cents, with minPriceCents matching the cheapest variant", () => {
    for (const product of demoProducts) {
      const prices = product.variants.map((v) => v.priceCents);
      expect(product.minPriceCents).toBe(Math.min(...prices));
      for (const variant of product.variants) {
        expect(Number.isInteger(variant.priceCents)).toBe(true);
        expect(variant.priceCents).toBeGreaterThan(0);
        expect(Number.isInteger(variant.stockOnHand)).toBe(true);
        expect(variant.stockOnHand).toBeGreaterThanOrEqual(0);
        if (variant.compareAtCents !== undefined) {
          // A compare-at below the price would render a negative discount.
          expect(variant.compareAtCents).toBeGreaterThan(variant.priceCents);
        }
      }
    }
  });

  it("staggers publication so newest-first ordering is deterministic", () => {
    const days = demoProducts.map((p) => p.publishedDaysAgo);
    expect(days).toEqual([...days].sort((a, b) => a - b));
    expect(duplicates(days.map(String))).toEqual([]);
  });

  it("covers every picker shape the storefront has to render", () => {
    const axes = demoProducts.map((p) => p.options?.length ?? 0);
    expect(axes).toContain(0);
    expect(axes).toContain(1);
    expect(axes).toContain(2);
    // Sold-out states: one combination inside a stocked product, and a product
    // with nothing left at all.
    expect(
      demoProducts.some(
        (p) =>
          p.variants.some((v) => v.stockOnHand === 0) &&
          p.variants.some((v) => v.stockOnHand > 0),
      ),
    ).toBe(true);
    expect(
      demoProducts.some((p) => p.variants.every((v) => v.stockOnHand === 0)),
    ).toBe(true);
    expect(
      demoProducts.some((p) =>
        p.variants.some((v) => v.compareAtCents !== undefined),
      ),
    ).toBe(true);
  });
});

// ─── fixtures ↔ Postgres ────────────────────────────────────────────────────

const databaseUrl = process.env.DATABASE_URL;

// A variant's option value IDs carry no meaningful order — the picker matches
// them as a set — and the DB include doesn't order them, so normalize before
// comparing. Everything else in the DTO has a defined order and is compared
// as-is.
function normalize(detail: ProductDetailDTO): ProductDetailDTO {
  return {
    ...detail,
    variants: detail.variants.map((v) => ({
      ...v,
      optionValueIds: [...v.optionValueIds].sort(),
    })),
  };
}

describe.skipIf(!databaseUrl)("fixtures match a seeded Postgres", () => {
  const db = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl }),
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it("has been seeded", async () => {
    const count = await db.product.count();
    expect(
      count,
      "DATABASE_URL is set but the catalog is empty — run `npx prisma db seed`",
    ).toBeGreaterThan(0);
  });

  it("serves the same brands", async () => {
    const brands = await db.brand.findMany({ orderBy: { id: "asc" } });
    expect(brands).toEqual(
      [...fixtureBrands].sort((a, b) => a.id.localeCompare(b.id)),
    );
  });

  it("serves the same categories", async () => {
    // Timestamps are written by the database and pinned in the fixtures, and
    // nothing in the storefront reads them — compare everything else.
    const comparable = (c: CategoryRow) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      position: c.position,
      parentId: c.parentId,
    });
    const categories = await db.category.findMany({ orderBy: { id: "asc" } });
    expect(categories.map(comparable)).toEqual(
      [...fixtureCategories]
        .sort((a, b) => a.id.localeCompare(b.id))
        .map(comparable),
    );
  });

  it("serves the same catalog cards, in the same order", async () => {
    const rows = await db.product.findMany({
      where: { status: "ACTIVE" },
      include: productCardInclude,
      orderBy: { publishedAt: "desc" },
    });
    expect(rows.map(toProductCard)).toEqual(fixtureProducts.map(toProductCard));
  });

  it("serves the same product detail for every slug", async () => {
    for (const fixture of fixtureProducts) {
      const row = await db.product.findUnique({
        where: { slug: fixture.slug },
        include: productDetailInclude,
      });
      expect(row, `missing in Postgres: ${fixture.slug}`).not.toBeNull();
      expect(normalize(toProductDetail(row!))).toEqual(
        normalize(toProductDetail(fixture)),
      );
    }
  });

  it("reconciles the inventory ledger against the stock balances", async () => {
    // CLAUDE.md rule 3: the columns on the variant are the running balance and
    // the ledger explains it. If the seed writes stock without a movement, the
    // demo database is already lying about its own history.
    //
    // Two balances, one ledger, split by reason (see checkout/stock.ts):
    // physical movements reconcile stockOnHand; RESERVATION and
    // RESERVATION_RELEASE reconcile stockReserved (reservations carry a
    // negative delta — stock leaving the sellable pool — so the reserved
    // balance is the negated sum).
    const variants = await db.productVariant.findMany({
      include: { movements: true },
    });
    const reservationReasons = ["RESERVATION", "RESERVATION_RELEASE"];
    for (const variant of variants) {
      let onHand = 0;
      let reserved = 0;
      for (const m of variant.movements) {
        if (reservationReasons.includes(m.reason)) reserved -= m.delta;
        else onHand += m.delta;
      }
      expect(onHand, `on-hand ledger mismatch on ${variant.sku}`).toBe(
        variant.stockOnHand,
      );
      expect(reserved, `reserved ledger mismatch on ${variant.sku}`).toBe(
        variant.stockReserved,
      );
    }
  });
});
