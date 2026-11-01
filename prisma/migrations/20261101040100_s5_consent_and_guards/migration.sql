-- CreateTable
CREATE TABLE "ContactConsent" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "conversationId" UUID NOT NULL,
    "granted" BOOLEAN NOT NULL,
    "purpose" VARCHAR(30) NOT NULL,
    "source" VARCHAR(30) NOT NULL,
    "evidence" VARCHAR(200) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContactConsent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContactConsent_tenantId_conversationId_createdAt_idx" ON "ContactConsent"("tenantId", "conversationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ContactConsent_tenantId_id_key" ON "ContactConsent"("tenantId", "id");

-- AddForeignKey
ALTER TABLE "ContactConsent" ADD CONSTRAINT "ContactConsent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactConsent" ADD CONSTRAINT "ContactConsent_tenantId_conversationId_fkey" FOREIGN KEY ("tenantId", "conversationId") REFERENCES "Conversation"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OutboxMessage" ADD CONSTRAINT "outbox_limits" CHECK (attempts BETWEEN 0 AND 3 AND "payloadHash" ~ '^[a-f0-9]{64}$' AND recipient ~ '^[1-9][0-9]{5,19}$' AND "expiresAt" > "createdAt" AND "expiresAt" <= "createdAt" + interval '24 hours');
ALTER TABLE "Job" ADD CONSTRAINT "job_attempt_lease_bounds" CHECK (attempts BETWEEN 0 AND 3 AND ((status='RUNNING' AND "leaseToken" IS NOT NULL AND "leaseUntil" IS NOT NULL) OR (status<>'RUNNING' AND "leaseToken" IS NULL AND "leaseUntil" IS NULL)));
ALTER TABLE "ChannelApprovalControl" ADD CONSTRAINT "control_limits" CHECK (version>0 AND "payloadHash" ~ '^[a-f0-9]{64}$' AND "tokenHash" ~ '^[a-f0-9]{64}$' AND "expiresAt">"createdAt" AND "expiresAt"<="createdAt"+interval '10 minutes');
ALTER TABLE "CustomerUpdateProposal" ADD CONSTRAINT "customer_update_bounds" CHECK (version>0 AND "orderVersion">0 AND "payloadHash" ~ '^[a-f0-9]{64}$' AND recipient ~ '^[1-9][0-9]{5,19}$' AND length(btrim(body))>0 AND "expiresAt">"createdAt" AND "expiresAt"<="createdAt"+interval '24 hours');
ALTER TABLE "WhatsAppConnection" ADD CONSTRAINT "connection_config" CHECK ("phoneNumberId" ~ '^[1-9][0-9]{5,39}$' AND "graphVersion" ~ '^v[0-9]{2}\.0$' AND length(btrim("reviewReference"))>0);
ALTER TABLE "Conversation" ADD CONSTRAINT "conversation_sender" CHECK ("providerSenderId" ~ '^[1-9][0-9]{5,19}$');
CREATE TRIGGER "MessageStatusEvent_immutable" BEFORE UPDATE OR DELETE ON "MessageStatusEvent" FOR EACH ROW EXECUTE FUNCTION prevent_audit_mutation();
CREATE TRIGGER "ContactConsent_immutable" BEFORE UPDATE OR DELETE ON "ContactConsent" FOR EACH ROW EXECUTE FUNCTION prevent_audit_mutation();
