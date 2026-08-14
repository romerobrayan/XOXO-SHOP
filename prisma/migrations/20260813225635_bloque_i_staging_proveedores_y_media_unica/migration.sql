-- CreateEnum
CREATE TYPE "StagingStatus" AS ENUM ('PENDING', 'PUBLISHED');

-- CreateTable
CREATE TABLE "SupplierStagingProduct" (
    "id" TEXT NOT NULL,
    "supplierRef" TEXT NOT NULL,
    "supplier" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "brand" TEXT,
    "suggestedCategorySlug" TEXT,
    "supplierPriceCents" INTEGER NOT NULL,
    "suggestedRetailCents" INTEGER,
    "priceVariesByVariant" BOOLEAN NOT NULL DEFAULT false,
    "optionCount" INTEGER NOT NULL DEFAULT 0,
    "imageCount" INTEGER NOT NULL DEFAULT 0,
    "previewImageUrl" TEXT,
    "available" BOOLEAN NOT NULL DEFAULT true,
    "payload" JSONB NOT NULL,
    "searchText" TEXT NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL,
    "status" "StagingStatus" NOT NULL DEFAULT 'PENDING',
    "publishedProductId" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierStagingProduct_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SupplierStagingProduct_supplierRef_key" ON "SupplierStagingProduct"("supplierRef");

-- CreateIndex
CREATE INDEX "SupplierStagingProduct_supplier_status_idx" ON "SupplierStagingProduct"("supplier", "status");

-- CreateIndex
CREATE INDEX "SupplierStagingProduct_status_suggestedCategorySlug_idx" ON "SupplierStagingProduct"("status", "suggestedCategorySlug");

-- CreateIndex
CREATE INDEX "SupplierStagingProduct_publishedProductId_idx" ON "SupplierStagingProduct"("publishedProductId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductMedia_productId_url_key" ON "ProductMedia"("productId", "url");

-- AddForeignKey
ALTER TABLE "SupplierStagingProduct" ADD CONSTRAINT "SupplierStagingProduct_publishedProductId_fkey" FOREIGN KEY ("publishedProductId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

