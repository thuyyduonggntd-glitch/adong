-- Snapshot the product's sale state onto OrderItem/InboundItem at creation time,
-- so historical orders/inbound records don't retroactively appear "on sale" when
-- the linked product's live sale flag changes later.

ALTER TABLE "OrderItem" ADD COLUMN "isOnSale" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "OrderItem" ADD COLUMN "saleType" "SaleType";
ALTER TABLE "OrderItem" ADD COLUMN "saleValue" INTEGER;

ALTER TABLE "InboundItem" ADD COLUMN "isOnSale" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "InboundItem" ADD COLUMN "saleType" "SaleType";
ALTER TABLE "InboundItem" ADD COLUMN "saleValue" INTEGER;
