-- ProductColorCode: sequence(Int) -> code(String), preserving existing values as zero-padded 3-digit text
ALTER TABLE "ProductColorCode" ADD COLUMN "code" TEXT;
UPDATE "ProductColorCode" SET "code" = LPAD("sequence"::text, 3, '0');
ALTER TABLE "ProductColorCode" ALTER COLUMN "code" SET NOT NULL;
ALTER TABLE "ProductColorCode" DROP COLUMN "sequence";

-- ProductColorImage: allow multiple images per color (add sequence, default 1 for existing rows)
ALTER TABLE "ProductColorImage" ADD COLUMN "sequence" INTEGER NOT NULL DEFAULT 1;
DROP INDEX "ProductColorImage_productId_color_key";
CREATE UNIQUE INDEX "ProductColorImage_productId_color_sequence_key" ON "ProductColorImage"("productId" ASC, "color" ASC, "sequence" ASC);
