-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETE', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "OutboxStatus" AS ENUM ('PENDING', 'SENDING', 'ACCEPTED', 'DELIVERED', 'READ', 'FAILED', 'UNKNOWN', 'CANCELLED');

-- CreateTable
CREATE TABLE "WhatsAppConnection" (
    "tenantId" UUID NOT NULL,
    "phoneNumberId" VARCHAR(40) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "graphVersion" VARCHAR(20) NOT NULL,
    "reviewReference" VARCHAR(200) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WhatsAppConnection_pkey" PRIMARY KEY ("tenantId")
);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "providerSenderId" VARCHAR(32) NOT NULL,
    "lastInboundAt" TIMESTAMPTZ(3) NOT NULL,
    "consentGrantedAt" TIMESTAMPTZ(3),
    "consentEvidence" VARCHAR(200),
    "optedOutAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InboundMessage" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "conversationId" UUID NOT NULL,
    "providerMessageId" VARCHAR(200) NOT NULL,
    "providerTimestamp" TIMESTAMPTZ(3) NOT NULL,
    "type" VARCHAR(30) NOT NULL,
    "body" VARCHAR(2000),
    "state" VARCHAR(40) NOT NULL DEFAULT 'PENDING',
    "outcome" VARCHAR(500),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InboundMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutboxMessage" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "conversationId" UUID NOT NULL,
    "logicalActionKey" VARCHAR(150) NOT NULL,
    "recipient" VARCHAR(32) NOT NULL,
    "body" VARCHAR(2000),
    "payloadHash" VARCHAR(64) NOT NULL,
    "approvalRef" UUID,
    "proactive" BOOLEAN NOT NULL DEFAULT false,
    "workflowId" UUID,
    "status" "OutboxStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "notBefore" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "providerMessageId" VARCHAR(200),
    "sendingAt" TIMESTAMPTZ(3),
    "failureCode" VARCHAR(60),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OutboxMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageStatusEvent" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "providerMessageId" VARCHAR(200) NOT NULL,
    "status" "OutboxStatus" NOT NULL,
    "providerTimestamp" TIMESTAMPTZ(3) NOT NULL,
    "dedupKey" VARCHAR(64) NOT NULL,
    "errorCode" VARCHAR(40),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageStatusEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChannelApprovalControl" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "identityId" UUID NOT NULL,
    "proposalId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "payloadHash" VARCHAR(64) NOT NULL,
    "tokenHash" VARCHAR(64) NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "consumedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChannelApprovalControl_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerUpdateProposal" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "ownerUserId" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "recipient" VARCHAR(32) NOT NULL,
    "body" VARCHAR(2000) NOT NULL,
    "payloadHash" VARCHAR(64) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "ProposalStatus" NOT NULL DEFAULT 'READY',
    "orderVersion" INTEGER NOT NULL,
    "workflowId" UUID,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "approvedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerUpdateProposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Job" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "type" VARCHAR(40) NOT NULL,
    "entityId" UUID NOT NULL,
    "executionKey" VARCHAR(150) NOT NULL,
    "runAt" TIMESTAMPTZ(3) NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "leaseUntil" TIMESTAMPTZ(3),
    "leaseToken" UUID,
    "failureCode" VARCHAR(60),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateLimitBucket" (
    "key" VARCHAR(200) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "RateLimitBucket_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppConnection_phoneNumberId_key" ON "WhatsAppConnection"("phoneNumberId");

-- CreateIndex
CREATE UNIQUE INDEX "Conversation_tenantId_providerSenderId_key" ON "Conversation"("tenantId", "providerSenderId");

-- CreateIndex
CREATE UNIQUE INDEX "Conversation_tenantId_id_key" ON "Conversation"("tenantId", "id");

-- CreateIndex
CREATE INDEX "InboundMessage_tenantId_createdAt_idx" ON "InboundMessage"("tenantId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "InboundMessage_tenantId_providerMessageId_key" ON "InboundMessage"("tenantId", "providerMessageId");

-- CreateIndex
CREATE UNIQUE INDEX "InboundMessage_tenantId_id_key" ON "InboundMessage"("tenantId", "id");

-- CreateIndex
CREATE INDEX "OutboxMessage_status_notBefore_idx" ON "OutboxMessage"("status", "notBefore");

-- CreateIndex
CREATE UNIQUE INDEX "OutboxMessage_tenantId_logicalActionKey_key" ON "OutboxMessage"("tenantId", "logicalActionKey");

-- CreateIndex
CREATE UNIQUE INDEX "OutboxMessage_tenantId_providerMessageId_key" ON "OutboxMessage"("tenantId", "providerMessageId");

-- CreateIndex
CREATE UNIQUE INDEX "OutboxMessage_tenantId_id_key" ON "OutboxMessage"("tenantId", "id");

-- CreateIndex
CREATE INDEX "MessageStatusEvent_tenantId_providerMessageId_idx" ON "MessageStatusEvent"("tenantId", "providerMessageId");

-- CreateIndex
CREATE UNIQUE INDEX "MessageStatusEvent_tenantId_dedupKey_key" ON "MessageStatusEvent"("tenantId", "dedupKey");

-- CreateIndex
CREATE UNIQUE INDEX "ChannelApprovalControl_tokenHash_key" ON "ChannelApprovalControl"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "ChannelApprovalControl_tenantId_id_key" ON "ChannelApprovalControl"("tenantId", "id");

-- CreateIndex
CREATE INDEX "CustomerUpdateProposal_tenantId_status_idx" ON "CustomerUpdateProposal"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerUpdateProposal_tenantId_id_key" ON "CustomerUpdateProposal"("tenantId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Job_executionKey_key" ON "Job"("executionKey");

-- CreateIndex
CREATE INDEX "Job_status_runAt_idx" ON "Job"("status", "runAt");

-- CreateIndex
CREATE UNIQUE INDEX "Job_tenantId_id_key" ON "Job"("tenantId", "id");

-- AddForeignKey
ALTER TABLE "WhatsAppConnection" ADD CONSTRAINT "WhatsAppConnection_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboundMessage" ADD CONSTRAINT "InboundMessage_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboundMessage" ADD CONSTRAINT "InboundMessage_tenantId_conversationId_fkey" FOREIGN KEY ("tenantId", "conversationId") REFERENCES "Conversation"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutboxMessage" ADD CONSTRAINT "OutboxMessage_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutboxMessage" ADD CONSTRAINT "OutboxMessage_tenantId_conversationId_fkey" FOREIGN KEY ("tenantId", "conversationId") REFERENCES "Conversation"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutboxMessage" ADD CONSTRAINT "OutboxMessage_tenantId_approvalRef_fkey" FOREIGN KEY ("tenantId", "approvalRef") REFERENCES "CustomerUpdateProposal"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageStatusEvent" ADD CONSTRAINT "MessageStatusEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelApprovalControl" ADD CONSTRAINT "ChannelApprovalControl_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelApprovalControl" ADD CONSTRAINT "ChannelApprovalControl_tenantId_identityId_fkey" FOREIGN KEY ("tenantId", "identityId") REFERENCES "OwnerChannelIdentity"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelApprovalControl" ADD CONSTRAINT "ChannelApprovalControl_tenantId_proposalId_fkey" FOREIGN KEY ("tenantId", "proposalId") REFERENCES "AIActionProposal"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerUpdateProposal" ADD CONSTRAINT "CustomerUpdateProposal_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerUpdateProposal" ADD CONSTRAINT "CustomerUpdateProposal_tenantId_ownerUserId_fkey" FOREIGN KEY ("tenantId", "ownerUserId") REFERENCES "TenantUser"("tenantId", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerUpdateProposal" ADD CONSTRAINT "CustomerUpdateProposal_tenantId_orderId_fkey" FOREIGN KEY ("tenantId", "orderId") REFERENCES "Order"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
