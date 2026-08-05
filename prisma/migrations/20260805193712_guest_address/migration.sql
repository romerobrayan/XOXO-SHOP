-- DropForeignKey
ALTER TABLE "Address" DROP CONSTRAINT "Address_customerId_fkey";

-- AlterTable
ALTER TABLE "Address" ALTER COLUMN "customerId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Address" ADD CONSTRAINT "Address_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

