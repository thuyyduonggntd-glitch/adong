-- CreateEnum
CREATE TYPE "QnACategory" AS ENUM ('PRODUCT', 'ORDER', 'ARRIVAL', 'PAYMENT', 'DELIVERY', 'OTHER');

-- AlterTable
ALTER TABLE "QnA" ADD COLUMN     "category" "QnACategory" NOT NULL DEFAULT 'OTHER';
