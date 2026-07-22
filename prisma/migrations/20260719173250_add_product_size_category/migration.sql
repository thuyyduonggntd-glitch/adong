-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "sizeCategoryId" TEXT;

-- CreateIndex
CREATE INDEX "Product_categoryId_idx" ON "Product"("categoryId");
CREATE INDEX "Product_sizeCategoryId_idx" ON "Product"("sizeCategoryId");

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_sizeCategoryId_fkey" FOREIGN KEY ("sizeCategoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
