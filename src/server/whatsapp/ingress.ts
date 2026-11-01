import { type PrismaClient, type OutboxStatus } from "../../generated/prisma/client.ts";
import { DomainError } from "../errors.ts";
import { digest, lock, requestHash, type Tx } from "../domain/tenancy.ts";
import { isOptOut, providerId, redactChannelCommand, senderId, statusProgress, verifySignature } from "./policy.ts";
import { afterWorkflowMessage, stopForRecipient } from "../workflows/persistence.ts";

type Inbound = { phoneId: string; id: string; sender: string; timestamp: Date; type: string; body: string | null };
type Status = { phoneId: string; id: string; timestamp: Date; status: OutboxStatus; errorCode: string | null; reference: string | null; recipient: string | null };
type Dict = Record<string, unknown>;
const dict = (value: unknown): Dict => value && typeof value === "object" && !Array.isArray(value) ? value as Dict : {};
function list(value: unknown, max: number) { if (!Array.isArray(value) || value.length > max) throw new DomainError("INVALID_WEBHOOK", 400, "Invalid webhook list."); return value; }
function timestamp(value: unknown, now: Date) {
  if (typeof value !== "string" || !/^\d{9,12}$/.test(value)) throw new DomainError("INVALID_WEBHOOK", 400, "Invalid provider timestamp.");
  const date = new Date(Number(value) * 1000);
  if (date.getTime() < Date.UTC(2000, 0, 1) || date.getTime() > now.getTime() + 300000) throw new DomainError("INVALID_WEBHOOK", 400, "Invalid provider timestamp.");
  return date > now ? now : date;
}
export function parseWebhook(raw: unknown, now = new Date()) {
  const root = dict(raw), messages: Inbound[] = [], statuses: Status[] = [];
  if (root.object !== "whatsapp_business_account") throw new DomainError("INVALID_WEBHOOK", 400, "Unsupported webhook object.");
  for (const entry of list(root.entry, 100)) for (const change of list(dict(entry).changes, 100)) {
    const c = dict(change); if (c.field !== "messages") continue;
    const v = dict(c.value), phoneId = senderId(dict(v.metadata).phone_number_id);
    for (const rawMessage of list(v.messages ?? [], 100)) {
      const m = dict(rawMessage), type = typeof m.type === "string" && /^[a-z_]{1,30}$/.test(m.type) ? m.type : "unknown";
      const interactive = dict(m.interactive);
      const body = type === "text" ? dict(m.text).body : type === "interactive" ? dict(interactive.button_reply).id : type === "button" ? dict(m.button).payload : null;
      messages.push({ phoneId, id: providerId(m.id), sender: senderId(m.from), timestamp: timestamp(m.timestamp, now), type, body: typeof body === "string" && body.length <= 2000 ? body : null });
      if (messages.length + statuses.length > 500) throw new DomainError("INVALID_WEBHOOK", 400, "Webhook batch exceeds processing limits.");
    }
    for (const rawStatus of list(v.statuses ?? [], 100)) {
      const s = dict(rawStatus), mapped: Record<string, OutboxStatus> = { sent: "ACCEPTED", delivered: "DELIVERED", read: "READ", failed: "FAILED" };
      if (typeof s.status !== "string" || !mapped[s.status]) continue;
      const error = dict(Array.isArray(s.errors) ? s.errors[0] : null).code;
      statuses.push({ phoneId, id: providerId(s.id), timestamp: timestamp(s.timestamp, now), status: mapped[s.status], errorCode: error === undefined ? null : String(error).replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40), reference: typeof s.biz_opaque_callback_data === "string" && /^[0-9a-f-]{36}$/.test(s.biz_opaque_callback_data) ? s.biz_opaque_callback_data : null, recipient: typeof s.recipient_id === "string" && /^[1-9]\d{5,19}$/.test(s.recipient_id) ? s.recipient_id : null });
      if (messages.length + statuses.length > 500) throw new DomainError("INVALID_WEBHOOK", 400, "Webhook batch exceeds processing limits.");
    }
  }
  return { messages, statuses };
}

export async function rateLimit(tx: Tx, key: string, max: number, windowMs: number, now: Date, fixedBucket = false) {
  const bucket = `${digest(key)}:${fixedBucket ? "fixed" : Math.floor(now.getTime() / windowMs)}`;
  const row = await tx.rateLimitBucket.upsert({ where: { key: bucket }, create: { key: bucket, expiresAt: new Date(now.getTime() + windowMs * 2) }, update: { count: { increment: 1 } } });
  return row.count <= max;
}
export async function applyStatusEvents(tx: Tx, tenantId: string, messageId: string, now = new Date()) {
  const message = await tx.outboxMessage.findFirst({ where: { tenantId, providerMessageId: messageId } });
  if (!message) return;
  const events = await tx.messageStatusEvent.findMany({ where: { tenantId, providerMessageId: messageId }, orderBy: { providerTimestamp: "asc" }, take: 100 });
  let status: string = message.status;
  for (const event of events) status = statusProgress(status, event.status);
  if (status !== message.status) await tx.outboxMessage.update({ where: { tenantId_id: { tenantId, id: message.id } }, data: { status: status as OutboxStatus } });
  if (["ACCEPTED", "DELIVERED", "READ"].includes(status)) await afterWorkflowMessage(tx, message, true, now);
  else if (status === "FAILED") await afterWorkflowMessage(tx, message, false, now);
}

export async function ingestWebhook(db: PrismaClient, bytes: Uint8Array, signature: string | null, secret: string, now = new Date()) {
  if (!verifySignature(bytes, signature, secret)) throw new DomainError("INVALID_SIGNATURE", 401, "Webhook signature is invalid.");
  let parsed: ReturnType<typeof parseWebhook>;
  try { parsed = parseWebhook(JSON.parse(Buffer.from(bytes).toString("utf8")), now); }
  catch (error) { if (error instanceof DomainError) throw error; throw new DomainError("INVALID_WEBHOOK", 400, "Invalid webhook JSON."); }
  return db.$transaction(async tx => {
    const phoneIds = [...new Set([...parsed.messages, ...parsed.statuses].map(m => m.phoneId))];
    const connections = await tx.whatsAppConnection.findMany({ where: { phoneNumberId: { in: phoneIds }, active: true }, orderBy: { tenantId: "asc" } });
    let accepted = 0;
    for (const connection of connections) {
      const tenantId = connection.tenantId;
      await lock(tx, `channel:${tenantId}`);
      for (const message of parsed.messages.filter(m => m.phoneId === connection.phoneNumberId)) {
        const previous = await tx.inboundMessage.findUnique({ where: { tenantId_providerMessageId: { tenantId, providerMessageId: message.id } } });
        if (previous) continue;
        const existing = await tx.conversation.findUnique({ where: { tenantId_providerSenderId: { tenantId, providerSenderId: message.sender } } });
        const conversation = existing ?? await tx.conversation.create({ data: { tenantId, providerSenderId: message.sender, lastInboundAt: message.timestamp } });
        if (message.timestamp > conversation.lastInboundAt) await tx.conversation.update({ where: { tenantId_id: { tenantId, id: conversation.id } }, data: { lastInboundAt: message.timestamp } });
        const limited = !await rateLimit(tx, `sender:${tenantId}:${message.sender}`, 30, 60000, now);
        const inbound = await tx.inboundMessage.create({ data: { tenantId, conversationId: conversation.id, providerMessageId: message.id, providerTimestamp: message.timestamp, type: message.type, body: redactChannelCommand(message.body), ...(limited ? { state: "NEEDS_HUMAN", outcome: "SENDER_RATE_LIMIT" } : {}) } });
        if (message.body && isOptOut(message.body)) {
          await tx.contactConsent.create({ data: { tenantId, conversationId: conversation.id, granted: false, purpose: "ALL_MESSAGES", source: "INBOUND_STOP", evidence: `inbound:${inbound.id}` } });
          await tx.conversation.update({ where: { tenantId_id: { tenantId, id: conversation.id } }, data: { optedOutAt: now } });
          await tx.outboxMessage.updateMany({ where: { tenantId, conversationId: conversation.id, status: "PENDING" }, data: { status: "CANCELLED", failureCode: "OPT_OUT" } });
          await stopForRecipient(tx, tenantId, message.sender, now);
          await tx.inboundMessage.update({ where: { tenantId_id: { tenantId, id: inbound.id } }, data: { state: "PROCESSED", outcome: "OPT_OUT_RECORDED" } });
        } else if (!limited) {
          await tx.job.create({ data: { tenantId, type: "INBOUND", entityId: inbound.id, executionKey: `inbound:${tenantId}:${inbound.id}`, runAt: now } });
        }
        accepted++;
      }
      for (const status of parsed.statuses.filter(s => s.phoneId === connection.phoneNumberId)) {
        const dedupKey = requestHash(status);
        await tx.messageStatusEvent.createMany({ data: [{ tenantId, providerMessageId: status.id, providerTimestamp: status.timestamp, status: status.status, errorCode: status.errorCode, dedupKey }], skipDuplicates: true });
        if (status.reference && status.recipient) await tx.outboxMessage.updateMany({ where: { tenantId, id: status.reference, recipient: status.recipient, providerMessageId: null, status: { in: ["SENDING", "UNKNOWN"] } }, data: { providerMessageId: status.id } });
        await applyStatusEvents(tx, tenantId, status.id, now);
      }
    }
    // Unknown destinations are acknowledged without retaining raw PII. They
    // never resolve a tenant and never create AI/jobs or authority.
    return { accepted };
  }, { timeout: 30000 });
}
