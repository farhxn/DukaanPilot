-- CreateEnum
CREATE TYPE "WorkflowState" AS ENUM ('SCHEDULED', 'CHECKING', 'WAITING_OWNER', 'RESOLVED', 'CANCELLED', 'NEEDS_HUMAN', 'EXPIRED', 'FAILED');

-- CreateTable
CREATE TABLE "WorkflowInstance" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "ownerUserId" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "state" "WorkflowState" NOT NULL DEFAULT 'SCHEDULED',
    "enabledAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startAt" TIMESTAMPTZ(3) NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "dueAtSnapshot" TIMESTAMPTZ(3) NOT NULL,
    "nextRunAt" TIMESTAMPTZ(3),
    "checksUsed" INTEGER NOT NULL DEFAULT 0,
    "ownerRemindersUsed" INTEGER NOT NULL DEFAULT 0,
    "customerUpdatesUsed" INTEGER NOT NULL DEFAULT 0,
    "maxChecks" INTEGER NOT NULL DEFAULT 3,
    "maxOwnerReminders" INTEGER NOT NULL DEFAULT 2,
    "maxCustomerUpdates" INTEGER NOT NULL DEFAULT 1,
    "lastOwnerReminderAt" TIMESTAMPTZ(3),
    "terminalReason" VARCHAR(60),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkflowInstance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowEvent" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "workflowId" UUID NOT NULL,
    "type" VARCHAR(60) NOT NULL,
    "logicalKey" VARCHAR(150) NOT NULL,
    "metadata" JSONB NOT NULL,
    "occurredAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkflowEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkflowInstance_state_nextRunAt_idx" ON "WorkflowInstance"("state", "nextRunAt");

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowInstance_tenantId_orderId_key" ON "WorkflowInstance"("tenantId", "orderId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowInstance_tenantId_id_key" ON "WorkflowInstance"("tenantId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowInstance_tenantId_id_orderId_key" ON "WorkflowInstance"("tenantId", "id", "orderId");

-- CreateIndex
CREATE INDEX "WorkflowEvent_tenantId_workflowId_occurredAt_idx" ON "WorkflowEvent"("tenantId", "workflowId", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowEvent_tenantId_workflowId_logicalKey_key" ON "WorkflowEvent"("tenantId", "workflowId", "logicalKey");

-- AddForeignKey
ALTER TABLE "OutboxMessage" ADD CONSTRAINT "OutboxMessage_tenantId_workflowId_fkey" FOREIGN KEY ("tenantId", "workflowId") REFERENCES "WorkflowInstance"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerUpdateProposal" ADD CONSTRAINT "CustomerUpdateProposal_tenantId_workflowId_orderId_fkey" FOREIGN KEY ("tenantId", "workflowId", "orderId") REFERENCES "WorkflowInstance"("tenantId", "id", "orderId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowInstance" ADD CONSTRAINT "WorkflowInstance_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowInstance" ADD CONSTRAINT "WorkflowInstance_tenantId_ownerUserId_fkey" FOREIGN KEY ("tenantId", "ownerUserId") REFERENCES "TenantUser"("tenantId", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowInstance" ADD CONSTRAINT "WorkflowInstance_tenantId_orderId_fkey" FOREIGN KEY ("tenantId", "orderId") REFERENCES "Order"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowEvent" ADD CONSTRAINT "WorkflowEvent_tenantId_workflowId_fkey" FOREIGN KEY ("tenantId", "workflowId") REFERENCES "WorkflowInstance"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkflowInstance" ADD CONSTRAINT "workflow_bounds" CHECK ("maxChecks" BETWEEN 1 AND 3 AND "maxOwnerReminders" BETWEEN 0 AND 2 AND "maxCustomerUpdates" BETWEEN 0 AND 1 AND "checksUsed" BETWEEN 0 AND "maxChecks" AND "ownerRemindersUsed" BETWEEN 0 AND "maxOwnerReminders" AND "customerUpdatesUsed" BETWEEN 0 AND "maxCustomerUpdates" AND "startAt">="enabledAt" AND "expiresAt">"startAt" AND "expiresAt"<="startAt"+interval '72 hours' AND "expiresAt"<="dueAtSnapshot"+interval '24 hours');
CREATE TRIGGER "WorkflowEvent_immutable" BEFORE UPDATE OR DELETE ON "WorkflowEvent" FOR EACH ROW EXECUTE FUNCTION prevent_audit_mutation();
CREATE FUNCTION protect_workflow_lifetime() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (NEW."tenantId",NEW."ownerUserId",NEW."orderId",NEW."enabledAt",NEW."startAt",NEW."expiresAt",NEW."dueAtSnapshot",NEW."maxChecks",NEW."maxOwnerReminders",NEW."maxCustomerUpdates") IS DISTINCT FROM (OLD."tenantId",OLD."ownerUserId",OLD."orderId",OLD."enabledAt",OLD."startAt",OLD."expiresAt",OLD."dueAtSnapshot",OLD."maxChecks",OLD."maxOwnerReminders",OLD."maxCustomerUpdates") OR NEW."checksUsed"<OLD."checksUsed" OR NEW."ownerRemindersUsed"<OLD."ownerRemindersUsed" OR NEW."customerUpdatesUsed"<OLD."customerUpdatesUsed" OR (OLD.state NOT IN ('SCHEDULED','CHECKING','WAITING_OWNER') AND NEW.state IS DISTINCT FROM OLD.state) THEN
    RAISE EXCEPTION 'Workflow lifetime, counters and terminal state cannot be reset' USING ERRCODE='integrity_constraint_violation';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "WorkflowInstance_lifetime" BEFORE UPDATE ON "WorkflowInstance" FOR EACH ROW EXECUTE FUNCTION protect_workflow_lifetime();
