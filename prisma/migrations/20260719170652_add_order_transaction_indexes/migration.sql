-- CreateIndex
CREATE INDEX "Order_status_idx" ON "Order"("status");
CREATE INDEX "Order_createdAt_idx" ON "Order"("createdAt");
CREATE INDEX "Order_userId_idx" ON "Order"("userId");

-- CreateIndex
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");
CREATE INDEX "OrderItem_productId_idx" ON "OrderItem"("productId");
CREATE INDEX "OrderItem_arrivedAt_idx" ON "OrderItem"("arrivedAt");
CREATE INDEX "OrderItem_outOfStockAt_idx" ON "OrderItem"("outOfStockAt");
CREATE INDEX "OrderItem_unshippedAt_idx" ON "OrderItem"("unshippedAt");
CREATE INDEX "OrderItem_cancelledAt_idx" ON "OrderItem"("cancelledAt");

-- CreateIndex
CREATE INDEX "Transaction_userId_idx" ON "Transaction"("userId");
CREATE INDEX "Transaction_date_idx" ON "Transaction"("date");
CREATE INDEX "Transaction_type_idx" ON "Transaction"("type");
