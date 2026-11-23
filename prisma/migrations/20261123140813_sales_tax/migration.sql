-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "taxCode" TEXT;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "taxTotal" INTEGER NOT NULL DEFAULT 0;
