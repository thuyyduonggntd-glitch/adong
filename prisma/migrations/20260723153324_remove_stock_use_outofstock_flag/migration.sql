-- AlterTable: drop unused top-level Product stock counter
ALTER TABLE "Product" DROP COLUMN "stock";

-- AlterTable: ProductVariant — replace numeric stock with a simple out-of-stock flag
ALTER TABLE "ProductVariant" ADD COLUMN "isOutOfStock" BOOLEAN NOT NULL DEFAULT false;
UPDATE "ProductVariant" SET "isOutOfStock" = true WHERE "stock" <= 0;
ALTER TABLE "ProductVariant" DROP COLUMN "stock";

-- AlterTable: OrderItem — stockSnapshot no longer needed (no numeric stock to snapshot/restore)
ALTER TABLE "OrderItem" DROP COLUMN "stockSnapshot";
