// Demo catalog for the Phase 0 design review — real SECRETO products at real
// prices, not lorem ipsum. Covers all three families so every picker state
// (two axes, one axis, zero axes) exists in the database.
//
// The products are declared in src/features/catalog/demo-catalog.ts, which
// fixtures.ts also reads. This script only writes them to Postgres, IDs
// included, so a seeded database and the database-less preview serve byte
// identical DTOs — see src/features/catalog/parity.test.ts.
import { PrismaPg } from "@prisma/adapter-pg";
import {
  demoBrands,
  demoCategories,
  demoProducts,
} from "../src/features/catalog/demo-catalog";
import { computeOptionKey } from "../src/features/catalog/optionKey";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter });

const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env and point it at a local Postgres.",
    );
  }

  // Refuse to wipe a database that holds real orders. This is not an FK
  // problem — it is worse: deleting variants SetNulls OrderItem.variantId and
  // the movement wipe below erases the inventory ledger those orders wrote,
  // which is the audit trail (CLAUDE.md rule 3). Silent corruption, no error.
  const orderCount = await db.order.count();
  if (orderCount > 0 && process.env.SEED_ALLOW_ORDER_WIPE !== "1") {
    throw new Error(
      `Refusing to seed: this database holds ${orderCount} order(s). ` +
        "Seeding wipes the catalog and the inventory ledger those orders reference. " +
        "If you are certain this is a disposable database, re-run with SEED_ALLOW_ORDER_WIPE=1.",
    );
  }

  // Wipe in dependency order — seed is only ever run against dev databases.
  await db.inventoryMovement.deleteMany();
  await db.variantOptionValue.deleteMany();
  await db.productVariant.deleteMany();
  await db.productOptionValue.deleteMany();
  await db.productOption.deleteMany();
  await db.productSpec.deleteMany();
  await db.productMedia.deleteMany();
  await db.product.deleteMany();
  await db.category.deleteMany();
  await db.brand.deleteMany();

  await db.brand.createMany({
    data: demoBrands.map((b) => ({ id: b.id, name: b.name, slug: b.slug })),
  });

  await db.category.createMany({
    data: demoCategories.map((c, position) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      position,
    })),
  });

  for (const product of demoProducts) {
    // Options and their values first: the variants below reference the value
    // IDs, and nested writes give no ordering guarantee between siblings.
    await db.product.create({
      data: {
        id: product.id,
        slug: product.slug,
        name: product.name,
        description: product.description,
        status: "ACTIVE",
        publishedAt: daysAgo(product.publishedDaysAgo),
        supplierRef: product.supplierRef ?? null,
        brandId: product.brandId ?? null,
        categoryId: product.categoryId,
        minPriceCents: product.minPriceCents,
        options: {
          create: (product.options ?? []).map((option, position) => ({
            id: option.id,
            name: option.name,
            position,
            values: {
              create: option.values.map((value, valuePosition) => ({
                id: value.id,
                value: value.value,
                hex: value.hex ?? null,
                position: valuePosition,
              })),
            },
          })),
        },
        specs: {
          create: (product.specs ?? []).map((spec, position) => ({
            id: `${product.id}-spec-${position}`,
            label: spec.label,
            value: spec.value,
            position,
          })),
        },
      },
    });

    for (const variant of product.variants) {
      const valueIds = variant.valueIds ?? [];

      // Opening stock is a stock change like any other, so it goes through the
      // ledger in the same transaction as the balance it explains (CLAUDE.md
      // rule 3). Skipping this in the seed would make the demo database the one
      // place in the system where the ledger doesn't reconcile.
      await db.$transaction(async (tx) => {
        await tx.productVariant.create({
          data: {
            id: variant.id,
            productId: product.id,
            sku: variant.sku,
            priceCents: variant.priceCents,
            compareAtCents: variant.compareAtCents ?? null,
            stockOnHand: variant.stockOnHand,
            optionKey: computeOptionKey(valueIds),
            optionValues: {
              create: valueIds.map((optionValueId) => ({ optionValueId })),
            },
          },
        });

        if (variant.stockOnHand > 0) {
          await tx.inventoryMovement.create({
            data: {
              variantId: variant.id,
              delta: variant.stockOnHand,
              reason: "PURCHASE",
              note: "Carga inicial del catálogo de demostración",
            },
          });
        }
      });
    }
  }

  console.log("Seeded:", {
    brands: await db.brand.count(),
    categories: await db.category.count(),
    products: await db.product.count(),
    variants: await db.productVariant.count(),
    movements: await db.inventoryMovement.count(),
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
