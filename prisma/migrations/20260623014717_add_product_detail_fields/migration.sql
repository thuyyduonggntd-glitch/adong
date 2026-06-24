-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "discountRate" INTEGER,
ADD COLUMN     "gender" TEXT,
ADD COLUMN     "isOnSale" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "material" TEXT,
ADD COLUMN     "productNumber" TEXT,
ADD COLUMN     "productType" TEXT,
ADD COLUMN     "salePrice" INTEGER,
ADD COLUMN     "season" TEXT,
ADD COLUMN     "sizeImages" TEXT[],
ADD COLUMN     "wholesalePrice" INTEGER;
