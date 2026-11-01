-- CreateEnum
CREATE TYPE "ProposalIntent" AS ENUM ('CREATE_ORDER', 'UPDATE_ORDER', 'CHANGE_ORDER_STATUS', 'POST_SALE', 'RECORD_PAYMENT', 'REVERSE_SALE', 'REVERSE_PAYMENT', 'SEND_CUSTOMER_UPDATE');

-- CreateEnum
CREATE TYPE "ProposalStatus" AS ENUM ('DRAFT', 'NEEDS_CLARIFICATION', 'READY', 'EXECUTED', 'REJECTED', 'EXPIRED', 'FAILED');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'FULFILLED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PostingStatus" AS ENUM ('POSTED', 'REVERSED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'BANK_TRANSFER', 'OTHER');

-- CreateEnum
CREATE TYPE "LedgerDirection" AS ENUM ('DEBIT', 'CREDIT');

-- CreateEnum
CREATE TYPE "LedgerKind" AS ENUM ('SALE', 'PAYMENT', 'SALE_REVERSAL', 'PAYMENT_REVERSAL');

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "isWalkIn" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "AIActionProposal" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "ownerUserId" UUID NOT NULL,
    "intent" "ProposalIntent" NOT NULL,
    "origin" VARCHAR(20) NOT NULL DEFAULT 'WEB',
    "payload" JSONB NOT NULL,
    "payloadHash" VARCHAR(64) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "ProposalStatus" NOT NULL DEFAULT 'READY',
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "result" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "AIActionProposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalEvent" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "proposalId" UUID NOT NULL,
    "ownerUserId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "payloadHash" VARCHAR(64) NOT NULL,
    "decision" VARCHAR(20) NOT NULL,
    "channel" VARCHAR(20) NOT NULL DEFAULT 'WEB',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApprovalEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "proposalId" UUID NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "dueAt" TIMESTAMPTZ(3) NOT NULL,
    "totalPaisa" BIGINT NOT NULL,
    "pricingMode" VARCHAR(20) NOT NULL,
    "notes" VARCHAR(2000),
    "version" INTEGER NOT NULL DEFAULT 1,
    "fulfilledAt" TIMESTAMPTZ(3),
    "cancelledAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "description" VARCHAR(200) NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "unitPricePaisa" BIGINT,
    "lineTotalPaisa" BIGINT,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sale" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "orderId" UUID,
    "proposalId" UUID NOT NULL,
    "totalPaisa" BIGINT NOT NULL,
    "status" "PostingStatus" NOT NULL DEFAULT 'POSTED',
    "version" INTEGER NOT NULL DEFAULT 1,
    "businessDate" VARCHAR(10) NOT NULL,
    "postedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Sale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "proposalId" UUID NOT NULL,
    "amountPaisa" BIGINT NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "status" "PostingStatus" NOT NULL DEFAULT 'POSTED',
    "version" INTEGER NOT NULL DEFAULT 1,
    "receivedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentAllocation" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "saleId" UUID NOT NULL,
    "paymentId" UUID NOT NULL,
    "amountPaisa" BIGINT NOT NULL,
    "reversedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LedgerEntry" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "saleId" UUID,
    "paymentId" UUID,
    "direction" "LedgerDirection" NOT NULL,
    "kind" "LedgerKind" NOT NULL,
    "amountPaisa" BIGINT NOT NULL,
    "reversalOfId" UUID,
    "effectiveAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reversal" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "ownerUserId" UUID NOT NULL,
    "proposalId" UUID NOT NULL,
    "saleId" UUID,
    "paymentId" UUID,
    "reason" VARCHAR(500) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Reversal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DomainEvent" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "type" VARCHAR(60) NOT NULL,
    "referenceId" UUID NOT NULL,
    "logicalKey" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMPTZ(3),

    CONSTRAINT "DomainEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AIActionProposal_tenantId_status_createdAt_idx" ON "AIActionProposal"("tenantId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AIActionProposal_tenantId_id_key" ON "AIActionProposal"("tenantId", "id");

-- CreateIndex
CREATE INDEX "ApprovalEvent_tenantId_createdAt_idx" ON "ApprovalEvent"("tenantId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ApprovalEvent_tenantId_proposalId_version_decision_key" ON "ApprovalEvent"("tenantId", "proposalId", "version", "decision");

-- CreateIndex
CREATE INDEX "Order_tenantId_status_dueAt_idx" ON "Order"("tenantId", "status", "dueAt");

-- CreateIndex
CREATE UNIQUE INDEX "Order_tenantId_id_key" ON "Order"("tenantId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Order_tenantId_proposalId_key" ON "Order"("tenantId", "proposalId");

-- CreateIndex
CREATE INDEX "OrderItem_tenantId_orderId_idx" ON "OrderItem"("tenantId", "orderId");

-- CreateIndex
CREATE UNIQUE INDEX "OrderItem_tenantId_id_key" ON "OrderItem"("tenantId", "id");

-- CreateIndex
CREATE INDEX "Sale_tenantId_customerId_postedAt_idx" ON "Sale"("tenantId", "customerId", "postedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Sale_tenantId_id_key" ON "Sale"("tenantId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Sale_tenantId_id_customerId_key" ON "Sale"("tenantId", "id", "customerId");

-- CreateIndex
CREATE UNIQUE INDEX "Sale_tenantId_orderId_key" ON "Sale"("tenantId", "orderId");

-- CreateIndex
CREATE UNIQUE INDEX "Sale_tenantId_proposalId_key" ON "Sale"("tenantId", "proposalId");

-- CreateIndex
CREATE INDEX "Payment_tenantId_customerId_receivedAt_idx" ON "Payment"("tenantId", "customerId", "receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_tenantId_id_key" ON "Payment"("tenantId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_tenantId_id_customerId_key" ON "Payment"("tenantId", "id", "customerId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_tenantId_proposalId_key" ON "Payment"("tenantId", "proposalId");

-- CreateIndex
CREATE INDEX "PaymentAllocation_tenantId_saleId_reversedAt_idx" ON "PaymentAllocation"("tenantId", "saleId", "reversedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentAllocation_tenantId_id_key" ON "PaymentAllocation"("tenantId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentAllocation_tenantId_paymentId_saleId_key" ON "PaymentAllocation"("tenantId", "paymentId", "saleId");

-- CreateIndex
CREATE INDEX "LedgerEntry_tenantId_customerId_effectiveAt_idx" ON "LedgerEntry"("tenantId", "customerId", "effectiveAt");

-- CreateIndex
CREATE UNIQUE INDEX "LedgerEntry_tenantId_id_key" ON "LedgerEntry"("tenantId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "LedgerEntry_tenantId_reversalOfId_key" ON "LedgerEntry"("tenantId", "reversalOfId");

-- CreateIndex
CREATE UNIQUE INDEX "LedgerEntry_tenantId_kind_saleId_key" ON "LedgerEntry"("tenantId", "kind", "saleId");

-- CreateIndex
CREATE UNIQUE INDEX "LedgerEntry_tenantId_kind_paymentId_key" ON "LedgerEntry"("tenantId", "kind", "paymentId");

-- CreateIndex
CREATE UNIQUE INDEX "Reversal_tenantId_id_key" ON "Reversal"("tenantId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Reversal_tenantId_proposalId_key" ON "Reversal"("tenantId", "proposalId");

-- CreateIndex
CREATE UNIQUE INDEX "Reversal_tenantId_saleId_key" ON "Reversal"("tenantId", "saleId");

-- CreateIndex
CREATE UNIQUE INDEX "Reversal_tenantId_paymentId_key" ON "Reversal"("tenantId", "paymentId");

-- CreateIndex
CREATE UNIQUE INDEX "DomainEvent_logicalKey_key" ON "DomainEvent"("logicalKey");

-- CreateIndex
CREATE INDEX "DomainEvent_tenantId_createdAt_idx" ON "DomainEvent"("tenantId", "createdAt");

-- AddForeignKey
ALTER TABLE "AIActionProposal" ADD CONSTRAINT "AIActionProposal_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIActionProposal" ADD CONSTRAINT "AIActionProposal_tenantId_ownerUserId_fkey" FOREIGN KEY ("tenantId", "ownerUserId") REFERENCES "TenantUser"("tenantId", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalEvent" ADD CONSTRAINT "ApprovalEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalEvent" ADD CONSTRAINT "ApprovalEvent_tenantId_proposalId_fkey" FOREIGN KEY ("tenantId", "proposalId") REFERENCES "AIActionProposal"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalEvent" ADD CONSTRAINT "ApprovalEvent_tenantId_ownerUserId_fkey" FOREIGN KEY ("tenantId", "ownerUserId") REFERENCES "TenantUser"("tenantId", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_tenantId_customerId_fkey" FOREIGN KEY ("tenantId", "customerId") REFERENCES "Customer"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_tenantId_proposalId_fkey" FOREIGN KEY ("tenantId", "proposalId") REFERENCES "AIActionProposal"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_tenantId_orderId_fkey" FOREIGN KEY ("tenantId", "orderId") REFERENCES "Order"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_tenantId_customerId_fkey" FOREIGN KEY ("tenantId", "customerId") REFERENCES "Customer"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_tenantId_orderId_fkey" FOREIGN KEY ("tenantId", "orderId") REFERENCES "Order"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_tenantId_proposalId_fkey" FOREIGN KEY ("tenantId", "proposalId") REFERENCES "AIActionProposal"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_tenantId_customerId_fkey" FOREIGN KEY ("tenantId", "customerId") REFERENCES "Customer"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_tenantId_proposalId_fkey" FOREIGN KEY ("tenantId", "proposalId") REFERENCES "AIActionProposal"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_tenantId_customerId_fkey" FOREIGN KEY ("tenantId", "customerId") REFERENCES "Customer"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_tenantId_saleId_customerId_fkey" FOREIGN KEY ("tenantId", "saleId", "customerId") REFERENCES "Sale"("tenantId", "id", "customerId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_tenantId_paymentId_customerId_fkey" FOREIGN KEY ("tenantId", "paymentId", "customerId") REFERENCES "Payment"("tenantId", "id", "customerId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_tenantId_customerId_fkey" FOREIGN KEY ("tenantId", "customerId") REFERENCES "Customer"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_tenantId_saleId_fkey" FOREIGN KEY ("tenantId", "saleId") REFERENCES "Sale"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_tenantId_paymentId_fkey" FOREIGN KEY ("tenantId", "paymentId") REFERENCES "Payment"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_tenantId_reversalOfId_fkey" FOREIGN KEY ("tenantId", "reversalOfId") REFERENCES "LedgerEntry"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reversal" ADD CONSTRAINT "Reversal_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reversal" ADD CONSTRAINT "Reversal_tenantId_ownerUserId_fkey" FOREIGN KEY ("tenantId", "ownerUserId") REFERENCES "TenantUser"("tenantId", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reversal" ADD CONSTRAINT "Reversal_tenantId_proposalId_fkey" FOREIGN KEY ("tenantId", "proposalId") REFERENCES "AIActionProposal"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reversal" ADD CONSTRAINT "Reversal_tenantId_saleId_fkey" FOREIGN KEY ("tenantId", "saleId") REFERENCES "Sale"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reversal" ADD CONSTRAINT "Reversal_tenantId_paymentId_fkey" FOREIGN KEY ("tenantId", "paymentId") REFERENCES "Payment"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DomainEvent" ADD CONSTRAINT "DomainEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

