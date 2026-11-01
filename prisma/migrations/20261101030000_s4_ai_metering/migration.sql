-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('FREE', 'SMART', 'PRO', 'BUSINESS');

-- CreateEnum
CREATE TYPE "AIExecutionStatus" AS ENUM ('RESERVED', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "Subscription" (
    "tenantId" UUID NOT NULL,
    "plan" "Plan" NOT NULL DEFAULT 'FREE',
    "expiresAt" TIMESTAMPTZ(3),
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("tenantId")
);

-- CreateTable
CREATE TABLE "AIExecution" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "ownerUserId" UUID NOT NULL,
    "key" VARCHAR(100) NOT NULL,
    "inputHash" VARCHAR(64) NOT NULL,
    "status" "AIExecutionStatus" NOT NULL DEFAULT 'RESERVED',
    "day" VARCHAR(10) NOT NULL,
    "month" VARCHAR(7) NOT NULL,
    "model" VARCHAR(100) NOT NULL,
    "promptVersion" VARCHAR(40) NOT NULL,
    "reservedNanoUsd" BIGINT NOT NULL,
    "chargedNanoUsd" BIGINT NOT NULL,
    "actionUnits" INTEGER NOT NULL DEFAULT 0,
    "calls" INTEGER NOT NULL DEFAULT 0,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "result" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "AIExecution_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AIExecution_day_status_idx" ON "AIExecution"("day", "status");

-- CreateIndex
CREATE INDEX "AIExecution_month_tenantId_idx" ON "AIExecution"("month", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "AIExecution_tenantId_key_key" ON "AIExecution"("tenantId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "AIExecution_tenantId_id_key" ON "AIExecution"("tenantId", "id");

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIExecution" ADD CONSTRAINT "AIExecution_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIExecution" ADD CONSTRAINT "AIExecution_tenantId_ownerUserId_fkey" FOREIGN KEY ("tenantId", "ownerUserId") REFERENCES "TenantUser"("tenantId", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;
