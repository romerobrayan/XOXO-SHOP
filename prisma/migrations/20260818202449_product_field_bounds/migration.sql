-- Column-length bounds matching the Zod schemas in
-- src/features/products/schemas.ts (createProductSchema, updateProductSchema,
-- updateVariantSchema): the app-layer rule becomes a DB-layer guarantee, so a
-- write that bypasses the Server Action (a script, a future API, a manual
-- fix) still can't exceed it.
-- AlterTable
ALTER TABLE "Product" ALTER COLUMN "name" SET DATA TYPE VARCHAR(100),
ALTER COLUMN "supplierRef" SET DATA TYPE VARCHAR(40);

-- AlterTable
ALTER TABLE "ProductVariant" ALTER COLUMN "sku" SET DATA TYPE VARCHAR(60);

-- Price bounds sourced from Wompi's documented Agregador-model limits (not
-- arbitrary): COP 1.500 is Wompi's documented minimum transaction amount,
-- COP 10.000.000 is its per-transaction ceiling for the "persona jurídica"
-- tier. Mirrors PRICE_MIN_CENTS / PRICE_MAX_CENTS in
-- src/features/products/schemas.ts — keep both in sync if either changes.
-- https://soporte.wompi.co/hc/es-419/articles/360038824313
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_priceCents_range"
  CHECK ("priceCents" >= 150000 AND "priceCents" <= 1000000000);

ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_compareAtCents_range"
  CHECK ("compareAtCents" IS NULL OR ("compareAtCents" >= 150000 AND "compareAtCents" <= 1000000000));
