-- CreateTable
CREATE TABLE "ProductColorCode" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,

    CONSTRAINT "ProductColorCode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProductColorCode_productId_color_key" ON "ProductColorCode"("productId", "color");

-- AddForeignKey
ALTER TABLE "ProductColorCode" ADD CONSTRAINT "ProductColorCode_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
