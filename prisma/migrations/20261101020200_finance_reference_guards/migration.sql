-- DropForeignKey
ALTER TABLE "LedgerEntry" DROP CONSTRAINT "LedgerEntry_tenantId_paymentId_fkey";

-- DropForeignKey
ALTER TABLE "LedgerEntry" DROP CONSTRAINT "LedgerEntry_tenantId_reversalOfId_fkey";

-- DropForeignKey
ALTER TABLE "LedgerEntry" DROP CONSTRAINT "LedgerEntry_tenantId_saleId_fkey";

-- DropForeignKey
ALTER TABLE "Sale" DROP CONSTRAINT "Sale_tenantId_orderId_fkey";

-- CreateIndex
CREATE UNIQUE INDEX "LedgerEntry_tenantId_id_customerId_key" ON "LedgerEntry"("tenantId", "id", "customerId");

-- CreateIndex
CREATE UNIQUE INDEX "LedgerEntry_tenantId_reversalOfId_customerId_key" ON "LedgerEntry"("tenantId", "reversalOfId", "customerId");

-- CreateIndex
CREATE UNIQUE INDEX "Order_tenantId_id_customerId_key" ON "Order"("tenantId", "id", "customerId");

-- CreateIndex
CREATE UNIQUE INDEX "Sale_tenantId_orderId_customerId_key" ON "Sale"("tenantId", "orderId", "customerId");

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_tenantId_orderId_customerId_fkey" FOREIGN KEY ("tenantId", "orderId", "customerId") REFERENCES "Order"("tenantId", "id", "customerId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_tenantId_saleId_customerId_fkey" FOREIGN KEY ("tenantId", "saleId", "customerId") REFERENCES "Sale"("tenantId", "id", "customerId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_tenantId_paymentId_customerId_fkey" FOREIGN KEY ("tenantId", "paymentId", "customerId") REFERENCES "Payment"("tenantId", "id", "customerId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_tenantId_reversalOfId_customerId_fkey" FOREIGN KEY ("tenantId", "reversalOfId", "customerId") REFERENCES "LedgerEntry"("tenantId", "id", "customerId") ON DELETE RESTRICT ON UPDATE CASCADE;

