import { Prisma, type PrismaClient, type WorkflowState } from "../../generated/prisma/client.ts";
import type { VerifiedIdentity } from "../domain/identity.ts";
import { DomainError } from "../errors.ts";
import { audit, lock, mutate, withOwner, type Mutation } from "../domain/tenancy.ts";
import { object, uuid } from "../domain/validation.ts";
import { jsonSafe } from "../domain/proposals.ts";
import { entitlement } from "../ai/metering.ts";
import { queueMessage } from "../whatsapp/updates.ts";
import { dispatchPolicy } from "../whatsapp/policy.ts";
import type { ClaimedJob } from "../jobs.ts";
import { HOUR, isActive, workflowStop, workflowWindow } from "./state.ts";
import { terminateWorkflow, workflowEvent } from "./persistence.ts";

export type WorkflowLimits = { checks: number; reminders: number; updates: number; lifetimeHours: number; reminderIntervalHours?: number };
const defaults: WorkflowLimits = { checks: 3, reminders: 2, updates: 1, lifetimeHours: 72 };
export function enableFollowUp(db: PrismaClient, identity: VerifiedIdentity, orderId: string, mutation: Mutation, body: unknown, now = new Date(), limits = defaults) {
  uuid(orderId); object(body, []);
  return mutate(db, identity, mutation, `POST/orders/${orderId}/follow-up`, {}, async (tx, owner) => {
    await lock(tx, `channel:${owner.tenantId}`);
    const order = await tx.order.findFirst({ where: { tenantId: owner.tenantId, id: orderId } });
    if (!order || order.status !== "PENDING") throw new DomainError("ORDER_NOT_ELIGIBLE", 409, "Follow-up needs an approved pending order.");
    if (await tx.workflowInstance.findUnique({ where: { tenantId_orderId: { tenantId: owner.tenantId, orderId } } })) throw new DomainError("WORKFLOW_ALREADY_EXISTS", 409, "This order already has a follow-up lifetime. Review it manually; it cannot restart.");
    const window = workflowWindow(now, order.dueAt, limits.lifetimeHours);
    if (window.expiresAt <= now) throw new DomainError("ORDER_EXPIRED", 409, "This order’s follow-up deadline has already passed.");
    const plan = await entitlement(tx, owner.tenantId, now);
    const active = await tx.workflowInstance.count({ where: { tenantId: owner.tenantId, state: { in: ["SCHEDULED", "CHECKING", "WAITING_OWNER"] } } });
    if (active >= plan.workflows) throw new DomainError("WORKFLOW_QUOTA", 429, "Your plan’s concurrent follow-up limit is reached. Manual follow-up remains available.");
    const workflow = await tx.workflowInstance.create({ data: { tenantId: owner.tenantId, ownerUserId: owner.userId, orderId, enabledAt: now, createdAt: now, ...window, dueAtSnapshot: order.dueAt, nextRunAt: window.startAt, maxChecks: Math.min(3, limits.checks), maxOwnerReminders: Math.min(2, limits.reminders), maxCustomerUpdates: Math.min(1, limits.updates), reminderIntervalHours: Math.max(12, limits.reminderIntervalHours ?? 12) } });
    await tx.job.createMany({ data: [{ tenantId: owner.tenantId, type: "FOLLOW_UP", entityId: workflow.id, executionKey: `workflow:${workflow.id}:check:1`, runAt: window.startAt }, { tenantId: owner.tenantId, type: "WORKFLOW_EXPIRE", entityId: workflow.id, executionKey: `workflow:${workflow.id}:expiry`, runAt: window.expiresAt }] });
    await workflowEvent(tx, workflow, "ENABLED", "enabled", { orderId }, now);
    await audit(tx, owner, mutation, "ORDER_FOLLOW_UP_ENABLED", "WorkflowInstance", workflow.id, ["startAt", "expiresAt", "limits"]);
    return jsonSafe(workflow);
  });
}

export function stopFollowUp(db: PrismaClient, identity: VerifiedIdentity, id: string, mutation: Mutation, now = new Date()) {
  uuid(id);
  return mutate(db, identity, mutation, `POST/workflows/${id}/stop`, {}, async (tx, owner) => {
    await lock(tx, `channel:${owner.tenantId}`);
    const workflow = await tx.workflowInstance.findFirst({ where: { tenantId: owner.tenantId, id } });
    if (!workflow) throw new DomainError("NOT_FOUND", 404, "Follow-up not found.");
    await terminateWorkflow(tx, workflow, "CANCELLED", "OWNER_STOPPED", now);
    await audit(tx, owner, mutation, "ORDER_FOLLOW_UP_STOPPED", "WorkflowInstance", id, ["state"]);
    return { stopped: true };
  });
}
export function listWorkflows(db: PrismaClient, identity: VerifiedIdentity) {
  return withOwner(db, identity, async (tx, owner) => jsonSafe(await tx.workflowInstance.findMany({ where: { tenantId: owner.tenantId }, orderBy: { enabledAt: "desc" }, take: 100, include: { order: { select: { id: true, status: true, dueAt: true, customer: { select: { name: true } } } }, events: { orderBy: { occurredAt: "desc" }, take: 10 } } })));
}

export function processWorkflow(db: PrismaClient, job: ClaimedJob, outboundEnabled: boolean, now = new Date()) {
  return db.$transaction(async tx => {
    // All owner writes acquire membership then channel mutex, in this order.
    await tx.$queryRaw(Prisma.sql`SELECT m.id FROM "TenantUser" m JOIN "Tenant" t ON t.id=m."tenantId" WHERE m."tenantId"=${job.tenantId}::uuid FOR UPDATE OF m,t`);
    await lock(tx, `channel:${job.tenantId}`);
    const ownedLease = await tx.job.findFirst({ where: { tenantId: job.tenantId, id: job.id, status: "RUNNING", leaseToken: job.leaseToken, leaseUntil: { gt: now } } });
    if (!ownedLease) return;
    const workflow = await tx.workflowInstance.findFirst({ where: { tenantId: job.tenantId, id: job.entityId }, include: { order: { include: { customer: true } }, owner: true, tenant: true } });
    if (!workflow || !isActive(workflow.state)) return;
    const customerConversation = workflow.order.customer.phoneE164 ? await tx.conversation.findUnique({ where: { tenantId_providerSenderId: { tenantId: job.tenantId, providerSenderId: workflow.order.customer.phoneE164.slice(1) } } }) : null;
    const stop = workflowStop(workflow, workflow.order, now, workflow.tenant.status === "ACTIVE" && !workflow.tenant.operationsPausedAt && workflow.owner.status === "ACTIVE", !!customerConversation?.optedOutAt);
    if (stop) { await terminateWorkflow(tx, workflow, stop.state as WorkflowState, stop.reason, now); return; }
    if (job.type === "WORKFLOW_EXPIRE") return;
    const number = Number(job.executionKey.match(/:check:(\d)$/)?.[1]);
    if (number !== workflow.checksUsed + 1 || number > workflow.maxChecks || now < workflow.startAt) return;
    await tx.workflowInstance.update({ where: { tenantId_id: { tenantId: job.tenantId, id: workflow.id } }, data: { checksUsed: { increment: 1 }, nextRunAt: null, state: "WAITING_OWNER" } });
    await workflowEvent(tx, workflow, "BUSINESS_CHECK", `check:${number}`, { number, orderStatus: workflow.order.status }, now);
    const current = { ...workflow, checksUsed: number, state: "WAITING_OWNER" as const };
    if (workflow.ownerRemindersUsed >= workflow.maxOwnerReminders || number >= workflow.maxChecks) { await terminateWorkflow(tx, current, "NEEDS_HUMAN", "CHECKS_OR_REMINDERS_EXHAUSTED", now); return; }
    const ownerChannel = await tx.ownerChannelIdentity.findFirst({ where: { tenantId: job.tenantId, userId: workflow.ownerUserId, revokedAt: null } });
    const conversation = ownerChannel ? await tx.conversation.findUnique({ where: { tenantId_providerSenderId: { tenantId: job.tenantId, providerSenderId: ownerChannel.providerSenderId } } }) : null;
    const connection = await tx.whatsAppConnection.findUnique({ where: { tenantId: job.tenantId } });
    const policy = conversation ? dispatchPolicy({ now, expiresAt: workflow.expiresAt, active: outboundEnabled && !!connection?.active, optedOutAt: conversation.optedOutAt, consentGrantedAt: conversation.consentGrantedAt, lastInboundAt: conversation.lastInboundAt, proactive: true }) : null;
    if (!conversation || !policy || !policy.allowed && policy.reason !== "QUIET_HOURS") {
      await workflowEvent(tx, workflow, "DASHBOARD_REMINDER", `dashboard:${number}`, { reason: policy && !policy.allowed ? policy.reason : "OWNER_CHANNEL_REQUIRED" }, now);
      await terminateWorkflow(tx, current, "NEEDS_HUMAN", policy && !policy.allowed ? policy.reason : "OWNER_CHANNEL_REQUIRED", now); return;
    }
    const reminder = workflow.ownerRemindersUsed + 1;
    await tx.workflowInstance.update({ where: { tenantId_id: { tenantId: job.tenantId, id: workflow.id } }, data: { ownerRemindersUsed: { increment: 1 } } });
    await queueMessage(tx, { tenantId: job.tenantId, conversationId: conversation.id, recipient: conversation.providerSenderId, body: `Pending order for ${workflow.order.customer.name}. Due ${new Intl.DateTimeFormat("en-PK", { timeZone: "Asia/Karachi", dateStyle: "medium", timeStyle: "short" }).format(workflow.order.dueAt)} Pakistan time. Review fulfillment or cancellation in the dashboard. This does not record a sale or receipt.`, key: `workflow:${workflow.id}:owner:${reminder}`, workflowId: workflow.id, proactive: true, expiresAt: new Date(Math.min(workflow.expiresAt.getTime(), now.getTime() + 24 * HOUR)), now });
    await workflowEvent(tx, workflow, "OWNER_REMINDER_QUEUED", `reminder:${reminder}`, { reminder }, now);
  }, { timeout: 15000 });
}
