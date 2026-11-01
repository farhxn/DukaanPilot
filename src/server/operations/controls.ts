import "server-only";
import { Prisma, type PrismaClient } from "../../generated/prisma/client.ts";
import { DomainError } from "../errors.ts";
import { lock, type Tx } from "../domain/tenancy.ts";
import { text, uuid } from "../domain/validation.ts";
import { terminateWorkflow } from "../workflows/persistence.ts";
export type Operator = { actorRef: string; reviewReference: string };
export async function operatorEvent(tx: Tx, operator: Operator, action: string, tenantId: string | null, metadata: Prisma.InputJsonObject) {
  text(operator.actorRef, "operator", 200); text(operator.reviewReference, "reviewReference", 200);
  await tx.operatorEvent.create({ data: { tenantId, actorRef: operator.actorRef, reviewReference: operator.reviewReference, action, metadata } });
}
export async function pauseTenant(db: PrismaClient, tenantId: string, operator: Operator, now = new Date()) {
  uuid(tenantId);
  return db.$transaction(async tx => {
    const members = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`SELECT m.id FROM "TenantUser" m JOIN "Tenant" t ON t.id=m."tenantId" WHERE t.id=${tenantId}::uuid FOR UPDATE OF m,t`);
    if (!members.length) throw new DomainError("NOT_FOUND", 404, "Workspace not found.");
    await lock(tx, `channel:${tenantId}`);
    await tx.tenant.update({ where: { id: tenantId }, data: { operationsPausedAt: now } });
    await tx.pairingChallenge.updateMany({ where: { tenantId, revokedAt: null, consumedAt: null }, data: { revokedAt: now } });
    await tx.channelApprovalControl.updateMany({ where: { tenantId, consumedAt: null }, data: { consumedAt: now } });
    await tx.ownerChannelIdentity.updateMany({ where: { tenantId, revokedAt: null }, data: { revokedAt: now } });
    const workflows = await tx.workflowInstance.findMany({ where: { tenantId, state: { in: ["SCHEDULED", "CHECKING", "WAITING_OWNER"] } } });
    for (const workflow of workflows) await terminateWorkflow(tx, workflow, "NEEDS_HUMAN", "OPERATIONS_PAUSED", now);
    await tx.outboxMessage.updateMany({ where: { tenantId, status: "PENDING" }, data: { status: "CANCELLED", failureCode: "OPERATIONS_PAUSED" } });
    await tx.job.updateMany({ where: { tenantId, status: { in: ["PENDING", "RUNNING"] } }, data: { status: "CANCELLED", leaseToken: null, leaseUntil: null, failureCode: "OPERATIONS_PAUSED" } });
    await operatorEvent(tx, operator, "TENANT_OPERATIONS_PAUSED", tenantId, { historyRemainsReadable: true });
    return { paused: true };
  });
}
export async function setPilotPlan(db: PrismaClient, tenantId: string, plan: string, expiresAt: Date, operator: Operator) {
  uuid(tenantId);
  if (!["FREE", "SMART", "PRO", "BUSINESS"].includes(plan) || !Number.isFinite(expiresAt.getTime()) || expiresAt <= new Date() || expiresAt.getTime() > Date.now() + 90 * 86400000) throw new DomainError("INVALID_ENTITLEMENT", 422, "Choose a pilot plan and expiry within 90 days. No payment is collected.");
  return db.$transaction(async tx => {
    await tx.subscription.upsert({ where: { tenantId }, create: { tenantId, plan: plan as "FREE" | "SMART" | "PRO" | "BUSINESS", expiresAt }, update: { plan: plan as "FREE" | "SMART" | "PRO" | "BUSINESS", expiresAt } });
    await operatorEvent(tx, operator, "PILOT_ENTITLEMENT_GRANTED", tenantId, { plan, expiresAt: expiresAt.toISOString(), evidenceOfPayment: false });
    return { granted: true };
  });
}
export async function resumeTenant(db: PrismaClient, tenantId: string, operator: Operator) {
  uuid(tenantId);
  return db.$transaction(async tx => {
    await tx.$queryRaw(Prisma.sql`SELECT m.id FROM "TenantUser" m JOIN "Tenant" t ON t.id=m."tenantId" WHERE t.id=${tenantId}::uuid FOR UPDATE OF m,t`);
    await lock(tx, `channel:${tenantId}`);
    await tx.tenant.update({ where: { id: tenantId }, data: { operationsPausedAt: null } });
    await operatorEvent(tx, operator, "TENANT_OPERATIONS_RESUMED", tenantId, { cancelledWorkNotReplayed: true });
    return { resumed: true, cancelledWorkNotReplayed: true };
  });
}
export async function provisionChannel(db: PrismaClient, tenantId: string, phoneNumberId: string, graphVersion: string, operator: Operator) {
  uuid(tenantId);
  if (!/^[1-9]\d{5,39}$/.test(phoneNumberId) || !/^v\d{2}\.0$/.test(graphVersion)) throw new DomainError("INVALID_CHANNEL", 422, "Provide reviewed Meta number and Graph version settings.");
  return db.$transaction(async tx => {
    await lock(tx, `channel:${tenantId}`);
    const existing = await tx.whatsAppConnection.findUnique({ where: { tenantId } });
    if (existing && existing.phoneNumberId !== phoneNumberId) throw new DomainError("CHANNEL_CHANGE_REVIEW", 409, "Changing a workspace’s existing number needs a migration and consent review.");
    await tx.whatsAppConnection.upsert({ where: { tenantId }, create: { tenantId, phoneNumberId, graphVersion, reviewReference: operator.reviewReference, active: true }, update: { graphVersion, reviewReference: operator.reviewReference, active: true } });
    await operatorEvent(tx, operator, "DEDICATED_CHANNEL_PROVISIONED", tenantId, { graphVersion, dedicatedNumber: true });
    return { configured: true, outboundRequiresSeparateFlag: true };
  });
}
export function operationsMetrics(db: PrismaClient, now = new Date()) {
  return db.$transaction(async tx => ({ at: now.toISOString(), pendingJobs: await tx.job.count({ where: { status: "PENDING" } }), failedJobs: await tx.job.count({ where: { status: "FAILED" } }), oldestPendingJob: (await tx.job.findFirst({ where: { status: "PENDING" }, orderBy: { runAt: "asc" }, select: { runAt: true } }))?.runAt.toISOString() ?? null, uncertainMessages: await tx.outboxMessage.count({ where: { status: "UNKNOWN" } }), failedMessages: await tx.outboxMessage.count({ where: { status: "FAILED" } }), heldAIReservations: await tx.aIExecution.count({ where: { status: { in: ["RESERVED", "PROCESSING"] }, createdAt: { lt: new Date(now.getTime() - 120000) } } }), pausedWorkspaces: await tx.tenant.count({ where: { operationsPausedAt: { not: null } } }) }));
}
export async function maintainRetention(db: PrismaClient, operator: Operator, now = new Date(), messageDays = 30) {
  if (!Number.isInteger(messageDays) || messageDays < 1 || messageDays > 30) throw new DomainError("INVALID_RETENTION", 422, "Message retention must be 1–30 days.");
  const bodyCutoff = new Date(now.getTime() - messageDays * 86400000), temporaryCutoff = new Date(now.getTime() - 86400000);
  return db.$transaction(async tx => {
    await tx.inboundMessage.updateMany({ where: { createdAt: { lt: bodyCutoff }, state: "PENDING" }, data: { state: "NEEDS_HUMAN", outcome: "BODY_RETENTION_EXPIRED" } });
    const inbound = await tx.inboundMessage.updateMany({ where: { createdAt: { lt: bodyCutoff }, body: { not: null } }, data: { body: null } });
    await tx.outboxMessage.updateMany({ where: { createdAt: { lt: bodyCutoff }, status: "PENDING" }, data: { status: "CANCELLED", failureCode: "BODY_RETENTION_EXPIRED" } });
    await tx.outboxMessage.updateMany({ where: { createdAt: { lt: bodyCutoff }, status: "SENDING" }, data: { status: "UNKNOWN", failureCode: "BODY_RETENTION_EXPIRED" } });
    const outbound = await tx.outboxMessage.updateMany({ where: { createdAt: { lt: bodyCutoff }, status: { notIn: ["PENDING", "SENDING"] }, body: { not: null } }, data: { body: null } });
    const sessions = await tx.authSession.deleteMany({ where: { expiresAt: { lt: temporaryCutoff } } });
    const challenges = await tx.pairingChallenge.deleteMany({ where: { expiresAt: { lt: temporaryCutoff } } });
    const buckets = await tx.rateLimitBucket.deleteMany({ where: { expiresAt: { lt: now } } });
    const expired = await tx.aIActionProposal.updateMany({ where: { status: "READY", expiresAt: { lte: now } }, data: { status: "EXPIRED" } });
    await tx.customerUpdateProposal.updateMany({ where: { status: "READY", expiresAt: { lte: now } }, data: { status: "EXPIRED" } });
    await tx.customerUpdateProposal.updateMany({ where: { createdAt: { lt: bodyCutoff }, status: { not: "READY" } }, data: { body: null } });
    await tx.$executeRaw(Prisma.sql`UPDATE "AIExecution" SET result=jsonb_build_object('kind','unavailable','message','This older result was removed by retention policy. View posted records in your ledger.') WHERE "createdAt"<${bodyCutoff} AND status IN ('COMPLETED','FAILED')`);
    await tx.$executeRaw(Prisma.sql`UPDATE "IdempotencyRecord" i SET result='{"expired":true,"retainedMetadata":true}'::jsonb FROM "CustomerUpdateProposal" p WHERE i."tenantId"=p."tenantId" AND i.result->>'id'=p.id::text AND p.body IS NULL AND p."createdAt"<${bodyCutoff}`);
    const unapproved = await tx.aIActionProposal.updateMany({ where: { status: { in: ["REJECTED", "EXPIRED", "FAILED"] }, expiresAt: { lt: bodyCutoff } }, data: { payload: {} } });
    await tx.$executeRaw(Prisma.sql`UPDATE "IdempotencyRecord" i SET result='{"expired":true,"retainedMetadata":true}'::jsonb FROM "AIActionProposal" p WHERE i."tenantId"=p."tenantId" AND i.result->>'id'=p.id::text AND p.status IN ('REJECTED','EXPIRED','FAILED') AND p."expiresAt"<${bodyCutoff}`);
    const result = { inboundBodies: inbound.count, outboundBodies: outbound.count, expiredSessions: sessions.count, temporaryChallenges: challenges.count, rateBuckets: buckets.count, expiredProposals: expired.count, unapprovedPayloads: unapproved.count };
    await operatorEvent(tx, operator, "RETENTION_MAINTENANCE", null, result); return result;
  }, { timeout: 30000 });
}
