import { randomBytes, timingSafeEqual } from "node:crypto";
import { Prisma, type PrismaClient } from "../../generated/prisma/client.ts";
import type { VerifiedIdentity } from "../domain/identity.ts";
import { DomainError } from "../errors.ts";
import { audit, digest, lock, mutate, requestHash, withOwner, type Mutation } from "../domain/tenancy.ts";
import { object, uuid } from "../domain/validation.ts";
import { rateLimit } from "./ingress.ts";
import { senderId } from "./policy.ts";
import { stopForRecipient } from "../workflows/persistence.ts";

export async function createPairingChallenge(db: PrismaClient, identity: VerifiedIdentity, mutation: Mutation, body: unknown, now = new Date()) {
  const input = object(body, ["consent"]);
  if (input.consent !== true) throw new DomainError("CONSENT_REQUIRED", 422, "Confirm that this is your number and you want operational WhatsApp messages.");
  let code: string | null = null;
  const result = await mutate(db, identity, mutation, "POST/whatsapp/pairing-challenges", input, async (tx, owner) => {
    const connection = await tx.whatsAppConnection.findUnique({ where: { tenantId: owner.tenantId } });
    if (!connection?.active) throw new DomainError("CHANNEL_NOT_CONFIGURED", 503, "Your dedicated WhatsApp number needs operator setup first.");
    if (!await rateLimit(tx, `challenge:${owner.tenantId}`, 3, 3600000, now)) throw new DomainError("PAIRING_RATE_LIMIT", 429, "Wait before requesting another pairing code.");
    await tx.pairingChallenge.updateMany({ where: { tenantId: owner.tenantId, consumedAt: null, revokedAt: null }, data: { revokedAt: now } });
    code = randomBytes(10).toString("hex");
    const challenge = await tx.pairingChallenge.create({ data: { tenantId: owner.tenantId, userId: owner.userId, codeHash: digest(code), expiresAt: new Date(now.getTime() + 600000) } });
    await audit(tx, owner, mutation, "PAIRING_CHALLENGE_CREATED", "PairingChallenge", challenge.id, ["expiresAt", "ownerConsent"]);
    return { id: challenge.id, expiresAt: challenge.expiresAt.toISOString() };
  });
  // Only the initial response contains the secret. Idempotent replay contains no
  // code; neither challenge nor IdempotencyRecord stores the plaintext secret.
  return { ...result, command: code ? `PAIR ${result.id} ${code}` : null };
}

export async function consumePairingChallenge(db: PrismaClient, tenantId: string, sender: string, conversationId: string, command: string, now = new Date()) {
  senderId(sender);
  const parsed = /^PAIR_HASH ([0-9a-f-]{36}) ([0-9a-f]{64})$/.exec(command.trim());
  return db.$transaction(async tx => {
    const owners = await tx.$queryRaw<{ userId: string }[]>(Prisma.sql`SELECT m."userId" FROM "TenantUser" m JOIN "Tenant" t ON t.id=m."tenantId" WHERE m."tenantId"=${tenantId}::uuid AND m.status='ACTIVE' AND t.status='ACTIVE' FOR UPDATE OF m,t`);
    if (!owners[0]) return false;
    await lock(tx, `channel:${tenantId}`);
    if (!await rateLimit(tx, `pair-attempt:${tenantId}:${sender}`, 5, 60000, now)) return false;
    if (!parsed) return false;
    const challenge = await tx.pairingChallenge.findFirst({ where: { tenantId, id: parsed[1], consumedAt: null, revokedAt: null, expiresAt: { gt: now }, attempts: { lt: 5 }, owner: { status: "ACTIVE", tenant: { status: "ACTIVE" } } } });
    if (!challenge) return false;
    await tx.pairingChallenge.update({ where: { tenantId_id: { tenantId, id: challenge.id } }, data: { attempts: { increment: 1 } } });
    if (!timingSafeEqual(Buffer.from(parsed[2], "hex"), Buffer.from(challenge.codeHash, "hex"))) return false;
    const conversation = await tx.conversation.findFirst({ where: { tenantId, id: conversationId, providerSenderId: sender } });
    if (!conversation) return false;
    await tx.ownerChannelIdentity.updateMany({ where: { tenantId, revokedAt: null }, data: { revokedAt: now } });
    await tx.channelApprovalControl.updateMany({ where: { tenantId, consumedAt: null }, data: { consumedAt: now } });
    await tx.pairingChallenge.update({ where: { tenantId_id: { tenantId, id: challenge.id } }, data: { consumedAt: now } });
    const paired = await tx.ownerChannelIdentity.create({ data: { tenantId, userId: challenge.userId, providerSenderId: sender } });
    await tx.contactConsent.create({ data: { tenantId, conversationId: conversation.id, granted: true, purpose: "OWNER_OPERATIONAL", source: "OWNER_PAIRING", evidence: `challenge:${challenge.id}` } });
    await tx.conversation.update({ where: { tenantId_id: { tenantId, id: conversation.id } }, data: { consentGrantedAt: now, consentEvidence: `owner-pairing:${challenge.id}`, optedOutAt: null } });
    await audit(tx, { tenantId, userId: challenge.userId }, { key: `pair-${challenge.id}`, requestId: challenge.id }, "OWNER_CHANNEL_PAIRED", "OwnerChannelIdentity", paired.id, ["providerSenderId", "ownerConsent"]);
    return true;
  });
}

export function revokeOwnerChannel(db: PrismaClient, identity: VerifiedIdentity, mutation: Mutation) {
  return mutate(db, identity, mutation, "DELETE/whatsapp/owner-identity", {}, async (tx, owner) => {
    await lock(tx, `channel:${owner.tenantId}`);
    const identities = await tx.ownerChannelIdentity.findMany({ where: { tenantId: owner.tenantId, revokedAt: null } });
    const now = new Date();
    for (const item of identities) await stopForRecipient(tx, owner.tenantId, item.providerSenderId, now);
    await tx.ownerChannelIdentity.updateMany({ where: { tenantId: owner.tenantId, revokedAt: null }, data: { revokedAt: now } });
    await tx.channelApprovalControl.updateMany({ where: { tenantId: owner.tenantId, consumedAt: null }, data: { consumedAt: now } });
    await tx.pairingChallenge.updateMany({ where: { tenantId: owner.tenantId, consumedAt: null, revokedAt: null }, data: { revokedAt: now } });
    for (const item of identities) {
      await tx.conversation.updateMany({ where: { tenantId: owner.tenantId, providerSenderId: item.providerSenderId }, data: { optedOutAt: now } });
      await tx.outboxMessage.updateMany({ where: { tenantId: owner.tenantId, recipient: item.providerSenderId, status: "PENDING" }, data: { status: "CANCELLED", failureCode: "OWNER_UNPAIRED" } });
    }
    await audit(tx, owner, mutation, "OWNER_CHANNEL_REVOKED", "Tenant", owner.tenantId, ["identities", "approvalControls"]);
    return { revoked: true };
  });
}

export async function createApprovalControl(db: PrismaClient, identity: VerifiedIdentity, proposalId: string, mutation: Mutation) {
  uuid(proposalId); let token: string | null = null;
  const result = await mutate(db, identity, mutation, `POST/proposals/${proposalId}/channel-control`, {}, async (tx, owner) => {
    const proposal = await tx.aIActionProposal.findFirst({ where: { tenantId: owner.tenantId, id: proposalId, ownerUserId: owner.userId, status: "READY", expiresAt: { gt: new Date() } } });
    const channel = await tx.ownerChannelIdentity.findFirst({ where: { tenantId: owner.tenantId, userId: owner.userId, revokedAt: null } });
    if (!proposal || !channel) throw new DomainError("CHANNEL_APPROVAL_UNAVAILABLE", 409, "Open a current proposal and pair your owner number first.");
    await tx.channelApprovalControl.updateMany({ where: { tenantId: owner.tenantId, proposalId, consumedAt: null }, data: { consumedAt: new Date() } });
    token = randomBytes(24).toString("hex");
    const control = await tx.channelApprovalControl.create({ data: { tenantId: owner.tenantId, identityId: channel.id, proposalId, version: proposal.version, payloadHash: proposal.payloadHash, tokenHash: digest(token), expiresAt: new Date(Math.min(proposal.expiresAt.getTime(), Date.now() + 600000)) } });
    await audit(tx, owner, mutation, "CHANNEL_APPROVAL_CONTROL_CREATED", "AIActionProposal", proposalId, ["version", "payloadHash", "expiresAt"]);
    return { id: control.id, expiresAt: control.expiresAt.toISOString(), proposalHash: requestHash({ id: proposalId, version: proposal.version, payloadHash: proposal.payloadHash }) };
  });
  return { ...result, command: token ? `APPROVE ${token}` : null };
}

export function channelStatus(db: PrismaClient, identity: VerifiedIdentity) {
  return withOwner(db, identity, async (tx, owner) => ({ connection: await tx.whatsAppConnection.findUnique({ where: { tenantId: owner.tenantId }, select: { active: true, phoneNumberId: true, graphVersion: true } }), identity: await tx.ownerChannelIdentity.findFirst({ where: { tenantId: owner.tenantId, userId: owner.userId, revokedAt: null }, select: { id: true, providerSenderId: true, createdAt: true } }) }));
}
