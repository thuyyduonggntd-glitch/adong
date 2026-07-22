-- AlterTable
ALTER TABLE "Notice" ADD COLUMN     "title_en" TEXT,
ADD COLUMN     "title_vi" TEXT,
ADD COLUMN     "title_th" TEXT,
ADD COLUMN     "title_ru" TEXT,
ADD COLUMN     "title_mn" TEXT,
ADD COLUMN     "title_es" TEXT,
ADD COLUMN     "content_en" TEXT,
ADD COLUMN     "content_vi" TEXT,
ADD COLUMN     "content_th" TEXT,
ADD COLUMN     "content_ru" TEXT,
ADD COLUMN     "content_mn" TEXT,
ADD COLUMN     "content_es" TEXT,
ADD COLUMN     "translatedAt" TIMESTAMP(3);
