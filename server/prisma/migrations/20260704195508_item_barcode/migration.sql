-- AlterTable
ALTER TABLE "clothing_items" ADD COLUMN     "barcode" TEXT;

-- CreateIndex
CREATE INDEX "clothing_items_userId_barcode_idx" ON "clothing_items"("userId", "barcode");

