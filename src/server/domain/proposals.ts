import { ProposalIntent, type PrismaClient } from "../../generated/prisma/client.ts";
import { DomainError } from "../errors.ts";
import type { VerifiedIdentity } from "./identity.ts";
import { normalizeFinancial, sourcePayload, type FinancialPayload } from "./financial-normalization.ts";
import { executeFinancial } from "./financial-posting.ts";
import { audit, mutate, requestHash, withOwner, type Mutation } from "./tenancy.ts";
import { invalid, object, text, uuid } from "./validation.ts";
import { proposalTtlMs } from "./policy.ts";

export function jsonSafe<T>(value: T) { return JSON.parse(JSON.stringify(value, (_, item) => typeof item === "bigint" ? item.toString() : item)); }
function intentInput(value: unknown): ProposalIntent {
  const intent = text(value, "intent", 40);
  if (!Object.values(ProposalIntent).includes(intent as ProposalIntent) || intent === "SEND_CUSTOMER_UPDATE") invalid("intent", "Choose a supported business action.");
  return intent as ProposalIntent;
}
function versionInput(value: unknown) { if (!Number.isInteger(value) || (value as number) < 1) invalid("version", "Supply the version shown in the preview."); return value as number; }

export function createProposal(db: PrismaClient, identity: VerifiedIdentity, mutation: Mutation, body: unknown) {
  const input = object(body, ["intent", "payload"]), intent = intentInput(input.intent);
  return mutate(db, identity, mutation, "POST/proposals", input, async (tx, owner) => {
    const payload = await normalizeFinancial(tx, owner, intent, input.payload);
    const proposal = await tx.aIActionProposal.create({ data: { tenantId: owner.tenantId, ownerUserId: owner.userId, intent, payload: jsonSafe(payload), payloadHash: requestHash({ intent, payload }), expiresAt: new Date(Date.now() + proposalTtlMs()) } });
    await audit(tx, owner, mutation, "PROPOSAL_CREATED", "AIActionProposal", proposal.id, ["intent", "payloadHash"]);
    return jsonSafe(proposal);
  });
}

export function getProposal(db: PrismaClient, identity: VerifiedIdentity, id: string) {
  uuid(id);
  return withOwner(db, identity, async (tx, owner) => {
    const proposal = await tx.aIActionProposal.findFirst({ where: { tenantId: owner.tenantId, id } });
    if (!proposal) throw new DomainError("NOT_FOUND", 404, "Proposal not found.");
    return jsonSafe(proposal);
  });
}

export function editProposal(db: PrismaClient, identity: VerifiedIdentity, id: string, mutation: Mutation, body: unknown) {
  uuid(id);
  const input = object(body, ["version", "payload"]), version = versionInput(input.version);
  return mutate(db, identity, mutation, `PATCH/proposals/${id}`, input, async (tx, owner) => {
    const proposal = await tx.aIActionProposal.findFirst({ where: { tenantId: owner.tenantId, id } });
    if (!proposal) throw new DomainError("NOT_FOUND", 404, "Proposal not found.");
    if (proposal.status !== "READY" || proposal.version !== version) throw new DomainError("STALE_VERSION", 409, "This preview changed or is closed. Open the current version.");
    const payload = await normalizeFinancial(tx, owner, proposal.intent, input.payload);
    const edited = await tx.aIActionProposal.update({ where: { tenantId_id: { tenantId: owner.tenantId, id } }, data: { payload: jsonSafe(payload), payloadHash: requestHash({ intent: proposal.intent, payload }), version: { increment: 1 }, expiresAt: new Date(Date.now() + proposalTtlMs()) } });
    await audit(tx, owner, mutation, "PROPOSAL_EDITED", "AIActionProposal", id, ["version", "payloadHash"]);
    return jsonSafe(edited);
  });
}

export function approveProposal(db: PrismaClient, identity: VerifiedIdentity, id: string, mutation: Mutation, body: unknown, channel?: { identityId: string; controlId: string; tokenHash: string }) {
  uuid(id);
  const input = object(body, ["version", "payloadHash"]), version = versionInput(input.version);
  const hash = text(input.payloadHash, "payloadHash", 64);
  if (!/^[a-f0-9]{64}$/.test(hash)) invalid("payloadHash", "Use the hash from the exact preview.");
  return mutate(db, identity, mutation, `POST/proposals/${id}/approve`, input, async (tx, owner) => {
    const proposal = await tx.aIActionProposal.findFirst({ where: { tenantId: owner.tenantId, id, ownerUserId: owner.userId } });
    if (!proposal) throw new DomainError("NOT_FOUND", 404, "Proposal not found.");
    if (channel) {
      const active = await tx.ownerChannelIdentity.findFirst({ where: { tenantId: owner.tenantId, id: channel.identityId, userId: owner.userId, revokedAt: null } });
      const control = await tx.channelApprovalControl.findFirst({ where: { tenantId: owner.tenantId, id: channel.controlId, identityId: channel.identityId, proposalId: id, tokenHash: channel.tokenHash, version, payloadHash: hash, consumedAt: null, expiresAt: { gt: new Date() } } });
      if (!active || !control) throw new DomainError("CHANNEL_APPROVAL_REJECTED", 403, "That approval control is expired, used, or revoked. Open the dashboard to review.");
      await tx.channelApprovalControl.update({ where: { tenantId_id: { tenantId: owner.tenantId, id: control.id } }, data: { consumedAt: new Date() } });
    }
    if (proposal.version !== version || proposal.payloadHash !== hash) throw new DomainError("STALE_VERSION", 409, "This approval belongs to an older or different preview.");
    if (proposal.status === "EXECUTED") return jsonSafe(proposal.result);
    if (proposal.status !== "READY") throw new DomainError("PROPOSAL_CLOSED", 409, "This proposal is closed.");
    if (proposal.expiresAt.getTime() <= Date.now()) throw new DomainError("PROPOSAL_EXPIRED", 409, "This preview expired. Create or edit a fresh preview before approval.");
    let normalized: FinancialPayload;
    try { normalized = await normalizeFinancial(tx, owner, proposal.intent, sourcePayload(proposal.intent, proposal.payload as FinancialPayload)); }
    catch (error) {
      if (error instanceof DomainError) throw new DomainError("STALE_RECORD", 409, "Linked records or balances changed. Edit and review a fresh preview.");
      throw error;
    }
    if (requestHash({ intent: proposal.intent, payload: normalized }) !== hash) throw new DomainError("STALE_RECORD", 409, "Balances or linked records changed. Edit and review a fresh preview.");
    const result = await executeFinancial(tx, owner, id, proposal.intent, normalized);
    await tx.approvalEvent.create({ data: { tenantId: owner.tenantId, ownerUserId: owner.userId, proposalId: id, version, payloadHash: hash, decision: "APPROVED", channel: channel ? "WHATSAPP" : "WEB" } });
    await tx.aIActionProposal.update({ where: { tenantId_id: { tenantId: owner.tenantId, id } }, data: { status: "EXECUTED", result } });
    await tx.domainEvent.create({ data: { tenantId: owner.tenantId, type: proposal.intent, referenceId: id, logicalKey: `proposal-executed:${id}`, payload: result } });
    await audit(tx, owner, mutation, "PROPOSAL_EXECUTED", "AIActionProposal", id, ["intent", "version", "result"]);
    return result;
  });
}

export function rejectProposal(db: PrismaClient, identity: VerifiedIdentity, id: string, mutation: Mutation, body: unknown) {
  uuid(id);
  const input = object(body, ["version"]), version = versionInput(input.version);
  return mutate(db, identity, mutation, `POST/proposals/${id}/reject`, input, async (tx, owner) => {
    const proposal = await tx.aIActionProposal.findFirst({ where: { tenantId: owner.tenantId, id, ownerUserId: owner.userId } });
    if (!proposal) throw new DomainError("NOT_FOUND", 404, "Proposal not found.");
    if (proposal.version !== version) throw new DomainError("STALE_VERSION", 409, "This preview changed. Open the current version.");
    if (proposal.status === "REJECTED") return { rejected: true };
    if (proposal.status !== "READY") throw new DomainError("PROPOSAL_CLOSED", 409, "This proposal is already closed.");
    await tx.aIActionProposal.update({ where: { tenantId_id: { tenantId: owner.tenantId, id } }, data: { status: "REJECTED" } });
    await tx.approvalEvent.create({ data: { tenantId: owner.tenantId, ownerUserId: owner.userId, proposalId: id, version, payloadHash: proposal.payloadHash, decision: "REJECTED" } });
    await audit(tx, owner, mutation, "PROPOSAL_REJECTED", "AIActionProposal", id, ["version"]);
    return { rejected: true };
  });
}
