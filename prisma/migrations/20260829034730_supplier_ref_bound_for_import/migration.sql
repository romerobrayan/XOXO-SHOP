-- Widen Product.supplierRef, and re-assert the bounds of
-- 20260818202449_product_field_bounds.
--
-- WHY THIS MIGRATION RE-STATES WORK ANOTHER MIGRATION ALREADY DID:
-- product_field_bounds capped supplierRef at VARCHAR(40), a bound taken from
-- the panel's Zod schema, where a human types a supplier code like "11362".
-- It missed the column's other writer: promote-core copies the staging ref in
-- verbatim, and normalize-climax builds that as `climax:${handle}` — a full
-- product slug with no length bound of its own. The first Climax product to
-- reach production carried a 46-character ref, so the ALTER could never apply
-- to the deployed database.
--
-- Because that database was already serving a released build whose pages read
-- tables only later migrations create, product_field_bounds was recorded there
-- with `prisma migrate resolve --applied` rather than run, to unblock the
-- deploy without mutating a live row whose value is the import pipeline's
-- idempotency key. That leaves the deployed schema WITHOUT the bounds the
-- history claims, while every other environment has them. This migration is
-- what makes the two converge: every statement below is written to be safe
-- whether or not product_field_bounds actually ran.

-- Idempotent: re-stating a type a column already has is a no-op.
ALTER TABLE "Product" ALTER COLUMN "name" SET DATA TYPE VARCHAR(100);
ALTER TABLE "ProductVariant" ALTER COLUMN "sku" SET DATA TYPE VARCHAR(60);

-- The actual change. 80 fits "climax:" plus a long Spanish product slug;
-- stagedProductSchema caps the pipeline at the same 80 so an over-long ref
-- fails Zod validation with a readable message instead of a Postgres error.
-- The panel's own .max(40) stays: that is a UX rule for a human typing a
-- reference, not a statement about what the column can hold.
ALTER TABLE "Product" ALTER COLUMN "supplierRef" SET DATA TYPE VARCHAR(80);

-- Postgres has no ADD CONSTRAINT IF NOT EXISTS. Drop-then-add is the
-- idempotent form, and at this table size the revalidation scan is free.
-- Bounds unchanged from product_field_bounds: COP 1.500 is Wompi's documented
-- minimum transaction amount, COP 10.000.000 its per-transaction ceiling for
-- the "persona juridica" tier. Mirrors PRICE_MIN_CENTS / PRICE_MAX_CENTS in
-- src/features/products/schemas.ts — keep both in sync if either changes.
ALTER TABLE "ProductVariant" DROP CONSTRAINT IF EXISTS "ProductVariant_priceCents_range";
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_priceCents_range"
  CHECK ("priceCents" >= 150000 AND "priceCents" <= 1000000000);

ALTER TABLE "ProductVariant" DROP CONSTRAINT IF EXISTS "ProductVariant_compareAtCents_range";
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_compareAtCents_range"
  CHECK ("compareAtCents" IS NULL OR ("compareAtCents" >= 150000 AND "compareAtCents" <= 1000000000));
