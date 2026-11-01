import assert from "node:assert/strict";
import { createHash, createHmac, randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../src/generated/prisma/client.ts";
import { createBusiness } from "../../src/server/domain/business.ts";
import { createContact } from "../../src/server/domain/contacts.ts";
import { createProposal, approveProposal } from "../../src/server/domain/proposals.ts";
import { ingestWebhook } from "../../src/server/whatsapp/ingress.ts";
import { createApprovalControl, createPairingChallenge, revokeOwnerChannel } from "../../src/server/whatsapp/pairing.ts";
import { processInbound } from "../../src/server/whatsapp/processing.ts";
import { createCustomerUpdate, decideCustomerUpdate, queueMessage, recordConsent } from "../../src/server/whatsapp/updates.ts";
import { dispatchOne } from "../../src/server/whatsapp/outbox.ts";
import { claimJob, completeJob, type ClaimedJob } from "../../src/server/jobs.ts";
import { settings as aiSettings, sale } from "../fixtures/ai.ts";

const url = new URL(process.env.DATABASE_URL!);
if (url.hostname !== "127.0.0.1" || url.pathname !== "/dukaanpilot_test") throw new Error("Isolated database required.");
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.toString(), max: 5 }) });
after(async () => db.$disconnect());
const mutation = () => ({ key: randomUUID(), requestId: randomUUID() });
const secret = "synthetic-s5-app-secret", ownerSender = "923001234567", customerSender = "923051234567";
async function setup() {
  const uid = randomUUID(), actor = { uid, subject: `firebase:demo-dukaanpilot:${uid}`, email: uid + "@example.test", name: "Synthetic" };
  const business = await createBusiness(db, actor, mutation(), { name: "Channel fixture shop", businessType: "Retail", city: "Karachi" });
  const tenantId = business.id as string, phoneId = "1" + Date.now() + String(Math.floor(Math.random() * 100000));
  await db.whatsAppConnection.create({ data: { tenantId, phoneNumberId: phoneId, active: true, graphVersion: "v25.0", reviewReference: "Synthetic contract only; no live version verification" } });
  const customer = await createContact(db, actor, "customers", mutation(), { name: "Ali", phoneE164: "+" + customerSender });
  return { actor, tenantId, phoneId, customer };
}
function payload(phoneId: string, messages: { id: string; from: string; text?: string; type?: string }[], now = new Date(), statuses: unknown[] = []) {
  return { object: "whatsapp_business_account", entry: [{ changes: [{ field: "messages", value: { metadata: { phone_number_id: phoneId }, messages: messages.map(m => ({ id: m.id, from: m.from, timestamp: String(Math.floor(now.getTime() / 1000)), type: m.type ?? "text", ...(m.text ? { text: { body: m.text } } : {}) })), statuses } }] }] };
}
function ingest(data: unknown, now = new Date()) { const bytes = Buffer.from(JSON.stringify(data)); return ingestWebhook(db, bytes, "sha256=" + createHmac("sha256", secret).update(bytes).digest("hex"), secret, now); }
async function processTenant(tenantId: string, now = new Date(), ai?: Parameters<typeof processInbound>[2]) {
  const pending = await db.job.findMany({ where: { tenantId, type: "INBOUND", status: "PENDING" } });
  for (const job of pending) {
    const claimed = await db.job.update({ where: { tenantId_id: { tenantId, id: job.id } }, data: { status: "RUNNING", attempts: { increment: 1 }, leaseToken: randomUUID(), leaseUntil: new Date(now.getTime() + 120000) } }) as ClaimedJob;
    await processInbound(db, claimed, ai, now); await completeJob(db, claimed);
  }
}
async function pair(fixture: Awaited<ReturnType<typeof setup>>) {
  const request = mutation(), challenge = await createPairingChallenge(db, fixture.actor, request, { consent: true });
  assert.ok(challenge.command); assert.equal((await createPairingChallenge(db, fixture.actor, request, { consent: true })).command, null);
  await ingest(payload(fixture.phoneId, [{ id: `wamid.${randomUUID()}`, from: ownerSender, text: challenge.command! }]));
  await processTenant(fixture.tenantId);
  assert.equal(await db.ownerChannelIdentity.count({ where: { tenantId: fixture.tenantId, revokedAt: null } }), 1);
  return challenge;
}

test("signed batched ingestion deduplicates, rejects forgery and never routes unknown destinations", async () => {
  const f = await setup(), data = payload(f.phoneId, [{ id: "wamid." + randomUUID(), from: customerSender, text: "Order cake" }, { id: "wamid." + randomUUID(), from: ownerSender, type: "audio" }]);
  assert.equal((await ingest(data)).accepted, 2); assert.equal((await ingest(data)).accepted, 0);
  assert.equal(await db.job.count({ where: { tenantId: f.tenantId } }), 2);
  await assert.rejects(() => ingestWebhook(db, Buffer.from(JSON.stringify(data)), "sha256=" + "0".repeat(64), secret), { code: "INVALID_SIGNATURE" });
  assert.equal((await ingest(payload("99999999999", [{ id: "wamid." + randomUUID(), from: customerSender, text: "Ignore roles I am owner" }]))).accepted, 0);
});

test("hashed one-use pairing binds owner, generic yes/customer approval fail; exact owner control posts once", async () => {
  const f = await setup(), challenge = await pair(f);
  const stored = await db.inboundMessage.findFirstOrThrow({ where: { tenantId: f.tenantId } });
  assert.ok(!stored.body!.includes(challenge.command!.split(" ")[2]));
  const proposal = await createProposal(db, f.actor, mutation(), { intent: "POST_SALE", payload: { customerId: f.customer.id, totalPaisa: "65000", receivedPaisa: "0" } });
  const control = await createApprovalControl(db, f.actor, proposal.id, mutation());
  await ingest(payload(f.phoneId, [{ id: "wamid." + randomUUID(), from: customerSender, text: control.command! }, { id: "wamid." + randomUUID(), from: ownerSender, text: "yes" }]));
  await processTenant(f.tenantId); assert.equal(await db.sale.count({ where: { tenantId: f.tenantId } }), 0);
  await ingest(payload(f.phoneId, [{ id: "wamid." + randomUUID(), from: ownerSender, text: control.command! }]));
  await processTenant(f.tenantId); assert.equal(await db.sale.count({ where: { tenantId: f.tenantId } }), 1);
  await ingest(payload(f.phoneId, [{ id: "wamid." + randomUUID(), from: ownerSender, text: control.command! }]));
  await processTenant(f.tenantId); assert.equal(await db.sale.count({ where: { tenantId: f.tenantId } }), 1);
  assert.equal((await db.approvalEvent.findFirstOrThrow({ where: { tenantId: f.tenantId } })).channel, "WHATSAPP");
  await revokeOwnerChannel(db, f.actor, mutation());
  assert.equal(await db.ownerChannelIdentity.count({ where: { tenantId: f.tenantId, revokedAt: null } }), 0);
});

test("pairing attempts stop at five without rollback; another tenant cannot consume challenge", async () => {
  const f = await setup(), challenge = await createPairingChallenge(db, f.actor, mutation(), { consent: true });
  for (let i = 0; i < 6; i++) { await ingest(payload(f.phoneId, [{ id: "wamid." + randomUUID(), from: ownerSender, text: `PAIR ${challenge.id} ${"0".repeat(20)}` }])); await processTenant(f.tenantId); }
  assert.equal((await db.pairingChallenge.findUniqueOrThrow({ where: { tenantId_id: { tenantId: f.tenantId, id: challenge.id } } })).attempts, 5);
  const second = await setup(); await ingest(payload(second.phoneId, [{ id: "wamid." + randomUUID(), from: ownerSender, text: challenge.command! }])); await processTenant(second.tenantId);
  assert.equal(await db.ownerChannelIdentity.count({ where: { tenantId: { in: [f.tenantId, second.tenantId] } } }), 0);
});

test("customer update requires exact owner approval and STOP cancels the queued send before dispatch", async () => {
  const f = await setup(); await ingest(payload(f.phoneId, [{ id: "wamid." + randomUUID(), from: customerSender, text: "Order request" }]));
  const proposal = await createProposal(db, f.actor, mutation(), { intent: "CREATE_ORDER", payload: { customerId: f.customer.id, totalPaisa: "65000", dueAt: new Date(Date.now() + 86400000).toISOString(), items: [{ description: "Cake", quantity: "1" }] } });
  const result = await approveProposal(db, f.actor, proposal.id, mutation(), { version: proposal.version, payloadHash: proposal.payloadHash });
  const draft = await createCustomerUpdate(db, f.actor, mutation(), { orderId: result.orderId, text: "Your order is being reviewed." });
  await assert.rejects(() => decideCustomerUpdate(db, f.actor, draft.id, mutation(), { version: draft.version, payloadHash: draft.payloadHash }, true), { code: "CONSENT_REQUIRED" });
  await recordConsent(db, f.actor, mutation(), { senderId: customerSender, granted: true, evidence: "Synthetic recorded explicit customer permission" });
  await decideCustomerUpdate(db, f.actor, draft.id, mutation(), { version: draft.version, payloadHash: draft.payloadHash }, true);
  await ingest(payload(f.phoneId, [{ id: "wamid." + randomUUID(), from: customerSender, text: "band karo" }]));
  const outbound = await db.outboxMessage.findFirstOrThrow({ where: { tenantId: f.tenantId, approvalRef: draft.id } });
  assert.equal(outbound.status, "CANCELLED"); assert.equal(outbound.failureCode, "OPT_OUT");
  assert.equal(await db.contactConsent.count({ where: { tenantId: f.tenantId } }), 2);
});

test("concurrent dispatch sends one intent; uncertain acceptance never retries and callbacks reconcile monotonically", async () => {
  const f = await setup(), now = new Date();
  const conversation = await db.conversation.create({ data: { tenantId: f.tenantId, providerSenderId: ownerSender, lastInboundAt: now, consentGrantedAt: now, consentEvidence: "Synthetic permission" } });
  // Cancel older fixtures' unsent replies to isolate the global worker queue.
  await db.outboxMessage.updateMany({ where: { tenantId: { not: f.tenantId }, status: "PENDING" }, data: { status: "CANCELLED", failureCode: "TEST_FIXTURE_CLOSED" } });
  const message = await db.$transaction(tx => queueMessage(tx, { tenantId: f.tenantId, conversationId: conversation.id, recipient: ownerSender, body: "Synthetic reply", key: randomUUID(), expiresAt: new Date(now.getTime() + 3600000), now }));
  let sends = 0;
  await Promise.all([1, 2].map(() => dispatchOne(db, async () => { sends++; return { kind: "UNKNOWN", code: "TEST_TIMEOUT" }; }, true, now)));
  assert.equal(sends, 1); assert.equal((await db.outboxMessage.findUniqueOrThrow({ where: { tenantId_id: { tenantId: f.tenantId, id: message.id } } })).status, "UNKNOWN");
  await dispatchOne(db, async () => { sends++; return { kind: "ACCEPTED", providerMessageId: "never" }; }, true, new Date(now.getTime() + 300000)); assert.equal(sends, 1);
  const providerId = "wamid." + randomUUID(), timestamp = String(Math.floor(now.getTime() / 1000));
  for (const status of ["read", "delivered", "sent", "failed"]) await ingest(payload(f.phoneId, [], now, [{ id: providerId, status, timestamp, recipient_id: ownerSender, biz_opaque_callback_data: message.id }]), now);
  const reconciled = await db.outboxMessage.findUniqueOrThrow({ where: { tenantId_id: { tenantId: f.tenantId, id: message.id } } });
  assert.equal(reconciled.status, "READ"); assert.equal(reconciled.providerMessageId, providerId);
});

test("job leases claim once and technical attempts never exceed three", async () => {
  const f = await setup(), now = new Date();
  await db.job.updateMany({ where: { status: "PENDING" }, data: { status: "CANCELLED" } });
  const job = await db.job.create({ data: { tenantId: f.tenantId, type: "INBOUND", entityId: randomUUID(), executionKey: randomUUID(), runAt: now } });
  const claims = await Promise.all([claimJob(db, now), claimJob(db, now)]); assert.equal(claims.filter(Boolean).length, 1);
  for (let i = 0; i < 3; i++) await claimJob(db, new Date(now.getTime() + (i + 1) * 600000));
  // One final expiry sweep closes the third lost lease without a fourth claim.
  await claimJob(db, new Date(now.getTime() + 3600000));
  await claimJob(db, new Date(now.getTime() + 4200000));
  const final = await db.job.findUniqueOrThrow({ where: { tenantId_id: { tenantId: f.tenantId, id: job.id } } }); assert.equal(final.status, "FAILED"); assert.equal(final.attempts, 3);
});

test("paired WhatsApp owner adds customer, gets complete AI preview and exact approval; customer cannot invoke AI", async () => {
  const f = await setup(); await pair(f); const now = new Date(); let calls = 0;
  const ai = { settings: aiSettings, adapter: async () => { calls++; return { extraction: { ...sale, customerCandidates: ["Sana"] }, inputTokens: 100, outputTokens: 100 }; } };
  await ingest(payload(f.phoneId, [{ id: "wamid." + randomUUID(), from: customerSender, text: "Sana sale 650 received 0" }], now), now);
  await processTenant(f.tenantId, now, ai); assert.equal(calls, 0);
  await ingest(payload(f.phoneId, [{ id: "wamid." + randomUUID(), from: ownerSender, text: "ADD CUSTOMER Sana" }], now), now);
  await processTenant(f.tenantId, now, ai);
  assert.equal(await db.customer.count({ where: { tenantId: f.tenantId, name: "Sana" } }), 1);
  await ingest(payload(f.phoneId, [{ id: "wamid." + randomUUID(), from: ownerSender, text: "Sana sale 650 received 0" }], now), now);
  await processTenant(f.tenantId, now, ai); assert.equal(calls, 1);
  const reply = await db.outboxMessage.findFirstOrThrow({ where: { tenantId: f.tenantId, body: { contains: "Draft: Sale" } } });
  assert.match(reply.body!, /Customer: Sana/); assert.match(reply.body!, /Rs 650.00/); assert.match(reply.body!, /Due \(Pakistan\)/);
  const command = reply.body!.match(/APPROVE [a-f0-9]{48}/)![0];
  assert.equal(await db.sale.count({ where: { tenantId: f.tenantId } }), 0);
  await ingest(payload(f.phoneId, [{ id: "wamid." + randomUUID(), from: customerSender, text: command }], now), now);
  await processTenant(f.tenantId, now, ai); assert.equal(await db.sale.count({ where: { tenantId: f.tenantId } }), 0);
  await ingest(payload(f.phoneId, [{ id: "wamid." + randomUUID(), from: ownerSender, text: command }], now), now);
  await processTenant(f.tenantId, now, ai); assert.equal(await db.sale.count({ where: { tenantId: f.tenantId } }), 1);
});

test("rolling service send cap blocks transport across billing boundaries and only ages out later", async () => {
  const f = await setup(), now = new Date("2045-02-10T10:00:00Z");
  const conversation = await db.conversation.create({ data: { tenantId: f.tenantId, providerSenderId: ownerSender, lastInboundAt: now, consentGrantedAt: now, consentEvidence: "Synthetic" } });
  await db.outboxMessage.updateMany({ where: { status: "PENDING" }, data: { status: "CANCELLED", failureCode: "TEST_FIXTURE_CLOSED" } });
  const key = createHash("sha256").update(`service-day:${f.phoneId}:2045-02-10`).digest("hex") + ":fixed";
  await db.rateLimitBucket.create({ data: { key, count: 899, expiresAt: new Date("2045-05-01") } });
  let sends = 0;
  for (let i = 0; i < 2; i++) { await db.$transaction(tx => queueMessage(tx, { tenantId: f.tenantId, conversationId: conversation.id, recipient: ownerSender, body: "Monthly quota check", key: randomUUID(), expiresAt: new Date(now.getTime() + 3600000), now })); await dispatchOne(db, async () => { sends++; return { kind: "UNKNOWN", code: "TEST_UNCERTAIN" }; }, true, now); }
  assert.equal(sends, 1);
  assert.equal(await db.outboxMessage.count({ where: { tenantId: f.tenantId, failureCode: "MONTHLY_SERVICE_CAP" } }), 1);
  const march = new Date("2045-03-01T10:00:00Z"); await db.conversation.update({ where: { tenantId_id: { tenantId: f.tenantId, id: conversation.id } }, data: { lastInboundAt: march } });
  await db.$transaction(tx => queueMessage(tx, { tenantId: f.tenantId, conversationId: conversation.id, recipient: ownerSender, body: "New month", key: randomUUID(), expiresAt: new Date(march.getTime() + 3600000), now: march }));
  await dispatchOne(db, async () => { sends++; return { kind: "UNKNOWN", code: "TEST_UNCERTAIN" }; }, true, march);
  assert.equal(sends, 1); // A calendar-month change cannot reset a rolling no-spend cap.
  const april = new Date("2045-04-15T10:00:00Z"); await db.conversation.update({ where: { tenantId_id: { tenantId: f.tenantId, id: conversation.id } }, data: { lastInboundAt: april } });
  await db.$transaction(tx => queueMessage(tx, { tenantId: f.tenantId, conversationId: conversation.id, recipient: ownerSender, body: "Aged-out quota", key: randomUUID(), expiresAt: new Date(april.getTime() + 3600000), now: april }));
  await dispatchOne(db, async () => { sends++; return { kind: "UNKNOWN", code: "TEST_UNCERTAIN" }; }, true, april);
  assert.equal(sends, 2);
});

test("definitely rejected sends retry at one/five minutes, stop at three attempts, and quiet hours defer before claiming", async () => {
  const f = await setup(), now = new Date();
  const conversation = await db.conversation.create({ data: { tenantId: f.tenantId, providerSenderId: ownerSender, lastInboundAt: now, consentGrantedAt: now, consentEvidence: "Synthetic permission" } });
  await db.outboxMessage.updateMany({ where: { status: "PENDING" }, data: { status: "CANCELLED", failureCode: "TEST_FIXTURE_CLOSED" } });
  const message = await db.$transaction(tx => queueMessage(tx, { tenantId: f.tenantId, conversationId: conversation.id, recipient: ownerSender, body: "Synthetic retry", key: randomUUID(), expiresAt: new Date(now.getTime() + 3600000), now }));
  let sends = 0;
  const adapter = async () => { sends++; return { kind: "UNACCEPTED" as const }; };
  await dispatchOne(db, adapter, true, now);
  await dispatchOne(db, adapter, true, new Date(now.getTime() + 59000)); assert.equal(sends, 1);
  await dispatchOne(db, adapter, true, new Date(now.getTime() + 60000));
  await dispatchOne(db, adapter, true, new Date(now.getTime() + 359000)); assert.equal(sends, 2);
  await dispatchOne(db, adapter, true, new Date(now.getTime() + 360000));
  await dispatchOne(db, adapter, true, new Date(now.getTime() + 720000)); assert.equal(sends, 3);
  const final = await db.outboxMessage.findUniqueOrThrow({ where: { tenantId_id: { tenantId: f.tenantId, id: message.id } } }); assert.equal(final.attempts, 3); assert.equal(final.status, "FAILED");
  const quiet = new Date(now); quiet.setUTCHours(16, 0, 0, 0); if (quiet > now) quiet.setUTCDate(quiet.getUTCDate() - 1);
  const queued = await db.$transaction(tx => queueMessage(tx, { tenantId: f.tenantId, conversationId: conversation.id, recipient: ownerSender, body: "Synthetic quiet", key: randomUUID(), expiresAt: new Date(quiet.getTime() + 23 * 3600000), proactive: true, now: quiet }));
  await dispatchOne(db, adapter, true, quiet);
  const deferred = await db.outboxMessage.findUniqueOrThrow({ where: { tenantId_id: { tenantId: f.tenantId, id: queued.id } } });
  assert.equal(deferred.attempts, 0); assert.ok(deferred.notBefore > quiet); assert.equal(sends, 3);
});
