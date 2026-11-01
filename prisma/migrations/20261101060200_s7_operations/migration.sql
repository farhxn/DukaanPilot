-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "operationsPausedAt" TIMESTAMPTZ(3);

-- CreateTable
CREATE TABLE "OperatorEvent" (
    "id" UUID NOT NULL,
    "tenantId" UUID,
    "actorRef" VARCHAR(200) NOT NULL,
    "action" VARCHAR(60) NOT NULL,
    "reviewReference" VARCHAR(200) NOT NULL,
    "metadata" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OperatorEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrivacyRequest" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "ownerUserId" UUID NOT NULL,
    "kind" VARCHAR(20) NOT NULL,
    "status" VARCHAR(30) NOT NULL DEFAULT 'REQUESTED',
    "reviewReference" VARCHAR(200),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrivacyRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OperatorEvent_tenantId_createdAt_idx" ON "OperatorEvent"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "PrivacyRequest_tenantId_createdAt_idx" ON "PrivacyRequest"("tenantId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PrivacyRequest_tenantId_id_key" ON "PrivacyRequest"("tenantId", "id");

-- AddForeignKey
ALTER TABLE "OperatorEvent" ADD CONSTRAINT "OperatorEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrivacyRequest" ADD CONSTRAINT "PrivacyRequest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrivacyRequest" ADD CONSTRAINT "PrivacyRequest_tenantId_ownerUserId_fkey" FOREIGN KEY ("tenantId", "ownerUserId") REFERENCES "TenantUser"("tenantId", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE TRIGGER "OperatorEvent_immutable" BEFORE UPDATE OR DELETE ON "OperatorEvent" FOR EACH ROW EXECUTE FUNCTION prevent_audit_mutation();
ALTER TABLE "PrivacyRequest" ADD CONSTRAINT "privacy_request_kind" CHECK (kind IN ('EXPORT','DELETE') AND status IN ('REQUESTED','REVIEWING','FROZEN','COMPLETE','DECLINED'));
