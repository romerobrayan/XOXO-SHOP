-- CreateEnum
CREATE TYPE "ShippingZoneKind" AS ENUM ('SPECIFIC', 'GENERAL', 'NATIONAL');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "shippingZoneName" TEXT;

-- CreateTable
CREATE TABLE "ShippingZone" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "ShippingZoneKind" NOT NULL,
    "department" TEXT,
    "priceCents" INTEGER NOT NULL,
    "note" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShippingZone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShippingZoneArea" (
    "id" TEXT NOT NULL,
    "zoneId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "matchKey" TEXT NOT NULL,
    "department" TEXT NOT NULL,

    CONSTRAINT "ShippingZoneArea_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ShippingZone_isActive_kind_idx" ON "ShippingZone"("isActive", "kind");

-- CreateIndex
CREATE INDEX "ShippingZoneArea_zoneId_idx" ON "ShippingZoneArea"("zoneId");

-- CreateIndex
CREATE UNIQUE INDEX "ShippingZoneArea_department_matchKey_key" ON "ShippingZoneArea"("department", "matchKey");

-- AddForeignKey
ALTER TABLE "ShippingZoneArea" ADD CONSTRAINT "ShippingZoneArea_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "ShippingZone"("id") ON DELETE CASCADE ON UPDATE CASCADE;
