import type { WorkflowState, WorkflowInstance, OutboxMessage } from "../../generated/prisma/client.ts";
import { lock, type Tx } from "../domain/tenancy.ts";
import { HOUR, isActive, workflowStop } from "./state.ts";

export async function workflowEvent(tx: Tx, workflow: Pick<WorkflowInstance, "tenantId" | "id">, type: string, key: string, metadata: Record<string, string | number | boolean>, now: Date) {
  return tx.workflowEvent.createMany({ data: [{ tenantId: workflow.tenantId, workflowId: workflow.id, type, logicalKey: key, metadata, occurredAt: now }], skipDuplicates: true });
}
export async function terminateWorkflow(tx: Tx, workflow: WorkflowInstance, state: WorkflowState, reason: string, now: Date) {
  if (!isActive(workflow.state)) return;
  await tx.workflowInstance.update({ where: { tenantId_id: { tenantId: workflow.tenantId, id: workflow.id } }, data: { state, terminalReason: reason, nextRunAt: null } });
  await tx.job.updateMany({ where: { tenantId: workflow.tenantId, entityId: workflow.id, type: { in: ["FOLLOW_UP", "WORKFLOW_EXPIRE"] }, status: { in: ["PENDING", "RUNNING"] } }, data: { status: "CANCELLED", leaseToken: null, leaseUntil: null, failureCode: reason } });
  await tx.outboxMessage.updateMany({ where: { tenantId: workflow.tenantId, workflowId: workflow.id, status: "PENDING" }, data: { status: "CANCELLED", failureCode: reason } });
  await tx.customerUpdateProposal.updateMany({ where: { tenantId: workflow.tenantId, workflowId: workflow.id, status: "READY" }, data: { status: "EXPIRED" } });
  await workflowEvent(tx, workflow, state, "terminal", { reason, dashboardOnly: true }, now);
}
export async function stopForOrder(tx: Tx, tenantId: string, orderId: string, state: WorkflowState, reason: string, now = new Date()) {
  await lock(tx, `channel:${tenantId}`);
  const workflow = await tx.workflowInstance.findUnique({ where: { tenantId_orderId: { tenantId, orderId } } });
  if (workflow) await terminateWorkflow(tx, workflow, state, reason, now);
}
export async function stopForRecipient(tx: Tx, tenantId: string, recipient: string, now: Date) {
  const workflows = await tx.workflowInstance.findMany({ where: { tenantId, state: { in: ["SCHEDULED", "CHECKING", "WAITING_OWNER"] }, OR: [{ order: { customer: { phoneE164: "+" + recipient } } }, { owner: { identities: { some: { providerSenderId: recipient, revokedAt: null } } } }] }, take: 100 });
  for (const workflow of workflows) await terminateWorkflow(tx, workflow, "CANCELLED", "CONTACT_OPTED_OUT", now);
}
export async function checkWorkflowSend(tx: Tx, message: OutboxMessage, now: Date) {
  if (!message.workflowId) return null;
  const wf = await tx.workflowInstance.findFirst({ where: { tenantId: message.tenantId, id: message.workflowId }, include: { order: { include: { customer: true } }, owner: true, tenant: true } });
  if (!wf) return "WORKFLOW_NOT_FOUND";
  const customerConversation = wf.order.customer.phoneE164 ? await tx.conversation.findUnique({ where: { tenantId_providerSenderId: { tenantId: wf.tenantId, providerSenderId: wf.order.customer.phoneE164.slice(1) } } }) : null;
  const stop = workflowStop(wf, wf.order, now, wf.tenant.status === "ACTIVE" && !wf.tenant.operationsPausedAt && wf.owner.status === "ACTIVE", !!customerConversation?.optedOutAt);
  if (stop) { if (stop.reason !== "ALREADY_TERMINAL") await terminateWorkflow(tx, wf, stop.state as WorkflowState, stop.reason, now); return stop.reason; }
  if (message.approvalRef) {
    if (wf.customerUpdatesUsed < 1 || wf.customerUpdatesUsed > wf.maxCustomerUpdates) return "WORKFLOW_UPDATE_LIMIT";
  } else {
    const paired = await tx.ownerChannelIdentity.findFirst({ where: { tenantId: wf.tenantId, userId: wf.ownerUserId, providerSenderId: message.recipient, revokedAt: null } });
    if (!paired) return "OWNER_UNPAIRED";
    if (wf.ownerRemindersUsed < 1 || wf.ownerRemindersUsed > wf.maxOwnerReminders || wf.checksUsed > wf.maxChecks) return "WORKFLOW_REMINDER_LIMIT";
    if (wf.lastOwnerReminderAt && now.getTime() < wf.lastOwnerReminderAt.getTime() + wf.reminderIntervalHours * HOUR) return "REMINDER_SPACING";
  }
  return null;
}
export async function afterWorkflowMessage(tx: Tx, message: OutboxMessage, accepted: boolean, now: Date) {
  if (!message.workflowId) return;
  const wf = await tx.workflowInstance.findFirst({ where: { tenantId: message.tenantId, id: message.workflowId } });
  if (!wf || !isActive(wf.state)) return;
  if (now >= wf.expiresAt) { await terminateWorkflow(tx, wf, "EXPIRED", "DEADLINE_REACHED", now); return; }
  if (!accepted) { await terminateWorkflow(tx, wf, "NEEDS_HUMAN", "DELIVERY_REQUIRES_REVIEW", now); return; }
  const event = await workflowEvent(tx, wf, message.approvalRef ? "CUSTOMER_UPDATE_DISPATCHED" : "OWNER_REMINDER_DISPATCHED", `dispatch:${message.id}`, { messageId: message.id }, message.sendingAt ?? now);
  if (!event.count || message.approvalRef) return;
  const dispatchedAt = message.sendingAt ?? now, next = new Date(Math.max(now.getTime(), dispatchedAt.getTime() + wf.reminderIntervalHours * HOUR));
  await tx.workflowInstance.update({ where: { tenantId_id: { tenantId: wf.tenantId, id: wf.id } }, data: { lastOwnerReminderAt: dispatchedAt, ...(next < wf.expiresAt && wf.checksUsed < wf.maxChecks ? { nextRunAt: next, state: "SCHEDULED" } : { nextRunAt: null, state: "WAITING_OWNER" }) } });
  if (next < wf.expiresAt && wf.checksUsed < wf.maxChecks) await tx.job.createMany({ data: [{ tenantId: wf.tenantId, type: "FOLLOW_UP", entityId: wf.id, executionKey: `workflow:${wf.id}:check:${wf.checksUsed + 1}`, runAt: next }], skipDuplicates: true });
}
