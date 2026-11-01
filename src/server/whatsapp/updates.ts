import type { PrismaClient } from "../../generated/prisma/client.ts";
import type { VerifiedIdentity } from "../domain/identity.ts";
import { DomainError } from "../errors.ts";
import { audit, lock, mutate, requestHash, withOwner, type Mutation, type Tx } from "../domain/tenancy.ts";
import { object, text, uuid } from "../domain/validation.ts";
import { jsonSafe } from "../domain/proposals.ts";
import { senderId } from "./policy.ts";
import { isActive } from "../workflows/state.ts";
import { stopForRecipient } from "../workflows/persistence.ts";
import { proposalTtlMs } from "../domain/policy.ts";

export async function queueMessage(tx: Tx, input: { tenantId: string; conversationId: string; recipient: string; body: string; key: string; expiresAt: Date; proactive?: boolean; approvalRef?: string; workflowId?: string; now?: Date }) {
  const hash = requestHash({ recipient: input.recipient, body: input.body });
  const existing = await tx.outboxMessage.findUnique({ where: { tenantId_logicalActionKey: { tenantId: input.tenantId, logicalActionKey: input.key } } });
  if (existing) { if (existing.payloadHash !== hash) throw new DomainError("MESSAGE_CONFLICT", 409, "This message key has different approved content."); return existing; }
  const now = input.now ?? new Date();
  return tx.outboxMessage.create({ data: { tenantId: input.tenantId, conversationId: input.conversationId, recipient: input.recipient, body: input.body, logicalActionKey: input.key, payloadHash: hash, expiresAt: input.expiresAt, proactive: input.proactive ?? false, approvalRef: input.approvalRef, workflowId: input.workflowId, notBefore: now, createdAt: now } });
}

export function createCustomerUpdate(db: PrismaClient, identity: VerifiedIdentity, mutation: Mutation, body: unknown) {
  const input = object(body, ["orderId", "text"]), message = text(input.text, "text", 2000);
  const orderId = text(input.orderId, "orderId", 36); uuid(orderId);
  return mutate(db, identity, mutation, "POST/customer-updates/proposals", input, async (tx, owner) => {
    const order = await tx.order.findFirst({ where: { tenantId: owner.tenantId, id: orderId }, include: { customer: true } });
    if (!order || order.customer.archivedAt || !order.customer.phoneE164) throw new DomainError("RECIPIENT_REQUIRED", 422, "Choose an order with an active customer phone number.");
    const recipient = senderId(order.customer.phoneE164.slice(1));
    const workflow = await tx.workflowInstance.findUnique({ where: { tenantId_orderId: { tenantId: owner.tenantId, orderId } } });
    if (workflow && (!isActive(workflow.state) || workflow.expiresAt <= new Date() || workflow.customerUpdatesUsed >= workflow.maxCustomerUpdates)) throw new DomainError("WORKFLOW_UPDATE_CLOSED", 409, "This order’s follow-up update allowance is closed. Follow up manually outside this workflow.");
    const preview = await tx.customerUpdateProposal.create({ data: { tenantId: owner.tenantId, ownerUserId: owner.userId, orderId, recipient, body: message, orderVersion: order.version, workflowId: workflow?.id, payloadHash: requestHash({ recipient, body: message, orderId, orderVersion: order.version, workflowId: workflow?.id ?? null }), expiresAt: new Date(Math.min(Date.now() + proposalTtlMs(), workflow?.expiresAt.getTime() ?? Infinity)) } });
    await audit(tx, owner, mutation, "CUSTOMER_UPDATE_DRAFTED", "CustomerUpdateProposal", preview.id, ["recipient", "body", "payloadHash"]);
    return jsonSafe(preview);
  });
}
export function decideCustomerUpdate(db: PrismaClient, identity: VerifiedIdentity, id: string, mutation: Mutation, body: unknown, approve: boolean) {
  uuid(id); const input = object(body, ["version", "payloadHash"]);
  return mutate(db, identity, mutation, `POST/customer-updates/${id}/${approve ? "approve" : "reject"}`, input, async (tx, owner) => {
    await lock(tx, `channel:${owner.tenantId}`);
    const proposal = await tx.customerUpdateProposal.findFirst({ where: { tenantId: owner.tenantId, id, ownerUserId: owner.userId } });
    if (!proposal) throw new DomainError("NOT_FOUND", 404, "Message draft not found.");
    if (proposal.body === null) throw new DomainError("PROPOSAL_CLOSED", 409, "This older message content was removed by retention policy.");
    if (input.version !== proposal.version || input.payloadHash !== proposal.payloadHash) throw new DomainError("STALE_VERSION", 409, "Review the current recipient and message before approving.");
    if (proposal.status === (approve ? "EXECUTED" : "REJECTED")) return { id, status: proposal.status };
    if (proposal.status !== "READY" || proposal.expiresAt <= new Date()) throw new DomainError("PROPOSAL_CLOSED", 409, "This message draft is closed or expired.");
    if (!approve) {
      await tx.customerUpdateProposal.update({ where: { tenantId_id: { tenantId: owner.tenantId, id } }, data: { status: "REJECTED" } });
    } else {
      if (proposal.workflowId) {
        const workflow = await tx.workflowInstance.findFirst({ where: { tenantId: owner.tenantId, id: proposal.workflowId, orderId: proposal.orderId } });
        if (!workflow || !isActive(workflow.state) || workflow.expiresAt <= new Date() || workflow.customerUpdatesUsed >= workflow.maxCustomerUpdates) throw new DomainError("WORKFLOW_UPDATE_CLOSED", 409, "The follow-up deadline or customer update allowance is closed.");
        await tx.workflowInstance.update({ where: { tenantId_id: { tenantId: owner.tenantId, id: workflow.id } }, data: { customerUpdatesUsed: { increment: 1 } } });
      }
      const order = await tx.order.findFirst({ where: { tenantId: owner.tenantId, id: proposal.orderId }, include: { customer: true } });
      if (!order || order.version !== proposal.orderVersion || order.customer.archivedAt || order.customer.phoneE164?.slice(1) !== proposal.recipient) throw new DomainError("STALE_RECORD", 409, "The order or customer changed. Create a fresh message preview.");
      const conversation = await tx.conversation.findUnique({ where: { tenantId_providerSenderId: { tenantId: owner.tenantId, providerSenderId: proposal.recipient } } });
      if (!conversation || conversation.optedOutAt || !conversation.consentGrantedAt) throw new DomainError("CONSENT_REQUIRED", 422, "Record the customer’s permission before approving a WhatsApp update.");
      await tx.customerUpdateProposal.update({ where: { tenantId_id: { tenantId: owner.tenantId, id } }, data: { status: "EXECUTED", approvedAt: new Date() } });
      await queueMessage(tx, { tenantId: owner.tenantId, conversationId: conversation.id, recipient: proposal.recipient, body: proposal.body, key: `customer-update:${id}`, expiresAt: proposal.expiresAt, proactive: true, approvalRef: id, ...(proposal.workflowId ? { workflowId: proposal.workflowId } : {}) });
    }
    await audit(tx, owner, mutation, approve ? "CUSTOMER_UPDATE_APPROVED" : "CUSTOMER_UPDATE_REJECTED", "CustomerUpdateProposal", id, ["version", "payloadHash"]);
    return { id, status: approve ? "EXECUTED" : "REJECTED" };
  });
}

export function recordConsent(db: PrismaClient, identity: VerifiedIdentity, mutation: Mutation, body: unknown) {
  const input = object(body, ["senderId", "granted", "evidence"]), sender = senderId(input.senderId), evidence = text(input.evidence, "evidence", 200);
  if (typeof input.granted !== "boolean") throw new DomainError("CONSENT_REQUIRED", 422, "State whether permission was granted or revoked.");
  return mutate(db, identity, mutation, "POST/whatsapp/consent", input, async (tx, owner) => {
    await lock(tx, `channel:${owner.tenantId}`);
    const conversation = await tx.conversation.findUnique({ where: { tenantId_providerSenderId: { tenantId: owner.tenantId, providerSenderId: sender } } });
    if (!conversation) throw new DomainError("NOT_FOUND", 404, "Have this contact message your business number first.");
    const now = new Date();
    await tx.contactConsent.create({ data: { tenantId: owner.tenantId, conversationId: conversation.id, granted: input.granted as boolean, purpose: "ORDER_UPDATES", source: "OWNER_RECORDED", evidence } });
    await tx.conversation.update({ where: { tenantId_id: { tenantId: owner.tenantId, id: conversation.id } }, data: input.granted ? { consentGrantedAt: now, consentEvidence: evidence, optedOutAt: null } : { optedOutAt: now } });
    if (!input.granted) await tx.outboxMessage.updateMany({ where: { tenantId: owner.tenantId, conversationId: conversation.id, status: "PENDING" }, data: { status: "CANCELLED", failureCode: "CONSENT_REVOKED" } });
    if (!input.granted) await stopForRecipient(tx, owner.tenantId, sender, now);
    await audit(tx, owner, mutation, input.granted ? "CONTACT_CONSENT_GRANTED" : "CONTACT_CONSENT_REVOKED", "Conversation", conversation.id, ["consentEvidence", "optedOutAt"]);
    return { recorded: true };
  });
}
export function listChannelMessages(db: PrismaClient, identity: VerifiedIdentity) {
  return withOwner(db, identity, async (tx, owner) => jsonSafe({
    inbound: await tx.inboundMessage.findMany({ where: { tenantId: owner.tenantId }, orderBy: { createdAt: "desc" }, take: 50, include: { conversation: { select: { providerSenderId: true, consentGrantedAt: true, optedOutAt: true } } } }),
    outbound: await tx.outboxMessage.findMany({ where: { tenantId: owner.tenantId }, orderBy: { createdAt: "desc" }, take: 50 }),
    proposals: await tx.customerUpdateProposal.findMany({ where: { tenantId: owner.tenantId, status: "READY" }, orderBy: { createdAt: "desc" }, take: 50 }),
  }));
}
