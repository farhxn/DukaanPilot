import "server-only";
import { Prisma, type PrismaClient } from "../../generated/prisma/client.ts";
import { digest, lock, requestHash } from "../domain/tenancy.ts";
import { applyStatusEvents, rateLimit } from "./ingress.ts";
import { dispatchPolicy } from "./policy.ts";
import { afterWorkflowMessage, checkWorkflowSend } from "../workflows/persistence.ts";

export type SendResult = { kind: "ACCEPTED"; providerMessageId: string } | { kind: "UNACCEPTED"; retryAfterMs?: number } | { kind: "FAILED" | "UNKNOWN"; code: string };
export type SendAdapter = (input: { phoneNumberId: string; graphVersion: string; recipient: string; body: string; reference: string }) => Promise<SendResult>;
export function metaAdapter(token: string, transport: typeof fetch = fetch): SendAdapter {
  return async input => {
    if (!/^\d{6,40}$/.test(input.phoneNumberId) || !/^v\d{2}\.0$/.test(input.graphVersion)) return { kind: "FAILED", code: "CHANNEL_CONFIG" };
    try {
      const response = await transport(`https://graph.facebook.com/${input.graphVersion}/${input.phoneNumberId}/messages`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", to: input.recipient, type: "text", text: { preview_url: false, body: input.body }, biz_opaque_callback_data: input.reference }), signal: AbortSignal.timeout(15000), redirect: "error" });
      const reader = response.body?.getReader();
      if (!reader) return { kind: "UNKNOWN", code: "INVALID_PROVIDER_RESPONSE" };
      const chunks: Uint8Array[] = []; let size = 0;
      while (true) {
        const chunk = await reader.read(); if (chunk.done) break;
        size += chunk.value.length;
        if (size > 65536) { await reader.cancel(); return { kind: "UNKNOWN", code: "OVERSIZED_RESPONSE" }; }
        chunks.push(chunk.value);
      }
      const content = Buffer.concat(chunks).toString("utf8");
      let data; try { data = JSON.parse(content); } catch { return { kind: "UNKNOWN", code: "INVALID_PROVIDER_RESPONSE" }; }
      if (response.ok && typeof data.messages?.[0]?.id === "string" && data.messages[0].id.length <= 200) return { kind: "ACCEPTED", providerMessageId: data.messages[0].id };
      if (response.status === 429 && [4, 130429, 80007].includes(data.error?.code)) {
        const seconds = Number(response.headers.get("retry-after"));
        return { kind: "UNACCEPTED", ...(Number.isFinite(seconds) && seconds > 0 ? { retryAfterMs: seconds * 1000 } : {}) };
      }
      if ([400, 401, 403, 404].includes(response.status) && data.error) return { kind: "FAILED", code: "PROVIDER_REJECTED" };
      return { kind: "UNKNOWN", code: "UNCERTAIN_PROVIDER_ACCEPTANCE" };
    } catch { return { kind: "UNKNOWN", code: "TRANSPORT_UNCERTAIN" }; }
  };
}

export async function dispatchOne(db: PrismaClient, adapter: SendAdapter, enabled: boolean, now = new Date()) {
  if (!enabled) return false;
  // Crashed SENDING requests may already have reached Meta. Never requeue them.
  const staleSends = await db.outboxMessage.findMany({ where: { status: "SENDING", sendingAt: { lt: new Date(now.getTime() - 60000) } }, take: 100 });
  for (const stale of staleSends) await db.$transaction(async tx => {
    await lock(tx, `channel:${stale.tenantId}`);
    const changed = await tx.outboxMessage.updateMany({ where: { tenantId: stale.tenantId, id: stale.id, status: "SENDING", sendingAt: { lt: new Date(now.getTime() - 60000) } }, data: { status: "UNKNOWN", failureCode: "SEND_LEASE_EXPIRED" } });
    if (changed.count) await afterWorkflowMessage(tx, stale, false, now);
  });
  const claimed = await db.$transaction(async tx => {
    const rows = await tx.$queryRaw<{ id: string; tenantId: string }[]>(Prisma.sql`SELECT id,"tenantId" FROM "OutboxMessage" WHERE status='PENDING' AND "notBefore"<=${now} ORDER BY "notBefore",id LIMIT 1`);
    if (!rows[0]) return null;
    const { id, tenantId } = rows[0];
    await tx.$queryRaw(Prisma.sql`SELECT m.id FROM "TenantUser" m JOIN "Tenant" t ON t.id=m."tenantId" WHERE m."tenantId"=${tenantId}::uuid FOR UPDATE OF m,t`);
    await lock(tx, `channel:${tenantId}`);
    const message = await tx.outboxMessage.findUniqueOrThrow({ where: { tenantId_id: { tenantId, id } }, include: { conversation: true, tenant: { include: { whatsapp: true, members: true } }, approval: { include: { order: { include: { customer: true } } } } } });
    if (message.status !== "PENDING" || message.notBefore > now) return null;
    const connection = message.tenant.whatsapp;
    const policy = dispatchPolicy({ now, expiresAt: message.expiresAt, active: !!connection?.active && !message.tenant.operationsPausedAt && message.tenant.status === "ACTIVE" && message.tenant.members.some(m => m.status === "ACTIVE"), optedOutAt: message.conversation.optedOutAt, consentGrantedAt: message.conversation.consentGrantedAt, lastInboundAt: message.conversation.lastInboundAt, proactive: message.proactive });
    let reason: string | null = !policy.allowed ? policy.reason : null;
    if (message.recipient !== message.conversation.providerSenderId || !message.body || message.payloadHash !== requestHash({ recipient: message.recipient, body: message.body })) reason = "CONTENT_MISMATCH";
    if (message.approvalRef) {
      const p = message.approval;
      if (!p || p.status !== "EXECUTED" || !p.approvedAt || p.expiresAt <= now || p.recipient !== message.recipient || p.body !== message.body || p.order.version !== p.orderVersion || p.order.customer.archivedAt || p.order.customer.phoneE164?.slice(1) !== p.recipient) reason = "APPROVAL_CHANGED";
    }
    const workflowReason = await checkWorkflowSend(tx, message, now);
    if (workflowReason) reason = workflowReason;
    if (message.attempts >= 3) reason = "ATTEMPTS_EXHAUSTED";
    if (reason) {
      if (reason === "QUIET_HOURS" && "deferUntil" in policy && policy.deferUntil && policy.deferUntil < message.expiresAt) await tx.outboxMessage.update({ where: { tenantId_id: { tenantId, id } }, data: { notBefore: policy.deferUntil } });
      else { await tx.outboxMessage.update({ where: { tenantId_id: { tenantId, id } }, data: { status: "CANCELLED", failureCode: reason } }); await afterWorkflowMessage(tx, message, false, now); }
      return null;
    }
    const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
    const total = await rateLimit(tx, `send-day:${tenantId}:${day}`, 100, 86400000, now, true);
    const recipient = await rateLimit(tx, `send-recipient-day:${tenantId}:${message.recipient}:${day}`, 20, 86400000, now, true);
    if (!total || !recipient) { await tx.outboxMessage.update({ where: { tenantId_id: { tenantId, id } }, data: { status: "CANCELLED", failureCode: "MESSAGE_RATE_LIMIT" } }); await afterWorkflowMessage(tx, message, false, now); return null; }
    // Since October 2026, service replies can be billed after the free monthly
    // allowance. Reserve every attempt (including uncertain/rejected requests)
    // before transport; never refund it automatically. Other apps' sends cannot
    // be measured here, so use a dedicated number and verify Meta's allowance.
    await lock(tx, `service-cap:${connection!.phoneNumberId}`);
    // Rolling 33 UTC days avoids resetting ahead of Meta's billing-month/timezone
    // boundary. Expiry is 66 days, so maintenance cannot erase active counters.
    const serviceKey = (date: Date) => `service-day:${connection!.phoneNumberId}:${date.toISOString().slice(0, 10)}`;
    const keys = Array.from({ length: 33 }, (_, offset) => digest(serviceKey(new Date(now.getTime() - offset * 86400000))) + ":fixed");
    const usage = await tx.rateLimitBucket.aggregate({ where: { key: { in: keys } }, _sum: { count: true } });
    if ((usage._sum.count ?? 0) >= 900) { await tx.outboxMessage.update({ where: { tenantId_id: { tenantId, id } }, data: { status: "CANCELLED", failureCode: "MONTHLY_SERVICE_CAP" } }); await afterWorkflowMessage(tx, message, false, now); return null; }
    await rateLimit(tx, serviceKey(now), 900, 33 * 86400000, now, true);
    await tx.outboxMessage.update({ where: { tenantId_id: { tenantId, id } }, data: { status: "SENDING", attempts: { increment: 1 }, sendingAt: now } });
    return { message, connection: connection! };
  }, { timeout: 15000 });
  if (!claimed) return false;
  const { message, connection } = claimed;
  let result: SendResult;
  try { result = await adapter({ phoneNumberId: connection.phoneNumberId, graphVersion: connection.graphVersion, recipient: message.recipient, body: message.body!, reference: message.id }); }
  catch { result = { kind: "UNKNOWN", code: "ADAPTER_UNCERTAIN" }; }
  await db.$transaction(async tx => {
    await lock(tx, `channel:${message.tenantId}`);
    const current = await tx.outboxMessage.findUniqueOrThrow({ where: { tenantId_id: { tenantId: message.tenantId, id: message.id } } });
    if (current.status !== "SENDING") { if (["ACCEPTED", "DELIVERED", "READ"].includes(current.status)) await afterWorkflowMessage(tx, current, true, now); return; }
    if (result.kind === "ACCEPTED") {
      await tx.outboxMessage.update({ where: { tenantId_id: { tenantId: message.tenantId, id: message.id } }, data: { status: "ACCEPTED", providerMessageId: result.providerMessageId } });
      await applyStatusEvents(tx, message.tenantId, result.providerMessageId, now);
      await afterWorkflowMessage(tx, current, true, now);
    } else if (result.kind === "UNACCEPTED") {
      const delay = Math.max(result.retryAfterMs ?? 0, current.attempts === 1 ? 60000 : 300000), next = new Date(now.getTime() + delay);
      await tx.outboxMessage.update({ where: { tenantId_id: { tenantId: message.tenantId, id: message.id } }, data: current.attempts < 3 && next < message.expiresAt ? { status: "PENDING", notBefore: next, failureCode: "DEFINITE_RATE_REJECTION" } : { status: "FAILED", failureCode: "ATTEMPTS_EXHAUSTED" } });
      if (current.attempts >= 3 || next >= message.expiresAt) await afterWorkflowMessage(tx, current, false, now);
    } else { await tx.outboxMessage.update({ where: { tenantId_id: { tenantId: message.tenantId, id: message.id } }, data: { status: result.kind, failureCode: result.code } }); await afterWorkflowMessage(tx, current, false, now); }
  });
  return true;
}
