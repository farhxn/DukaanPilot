import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../src/generated/prisma/client.ts";
import { createBusiness } from "../../src/server/domain/business.ts";
import { createContact } from "../../src/server/domain/contacts.ts";
import { createProposal, approveProposal } from "../../src/server/domain/proposals.ts";
import { enableFollowUp, processWorkflow, stopFollowUp } from "../../src/server/workflows/engine.ts";
import { createCustomerUpdate, decideCustomerUpdate, recordConsent } from "../../src/server/whatsapp/updates.ts";
import { dispatchOne } from "../../src/server/whatsapp/outbox.ts";
import { completeJob, failJob, type ClaimedJob } from "../../src/server/jobs.ts";
import { HOUR } from "../../src/server/workflows/state.ts";

const url = new URL(process.env.DATABASE_URL!);
if (url.hostname !== "127.0.0.1" || url.pathname !== "/dukaanpilot_test") throw new Error("Isolated test database required.");
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.toString(), max: 5 }) });
after(async () => db.$disconnect());
const mutation = () => ({ key: randomUUID(), requestId: randomUUID() });
const ownerSender = "923001234567", customerSender = "923051234567";
async function setup() {
  const now = new Date(); now.setUTCHours(4, 0, 0, 0); if (now < new Date()) now.setUTCDate(now.getUTCDate() + 1);
  const uid = randomUUID(), actor = { uid, subject: `firebase:demo-dukaanpilot:${uid}`, email: uid + "@example.test", name: "Synthetic" };
  const business = await createBusiness(db, actor, mutation(), { name: "Workflow fixture shop", businessType: "Retail", city: "Karachi" });
  const tenantId = business.id as string, member = await db.tenantUser.findUniqueOrThrow({ where: { tenantId } });
  await db.whatsAppConnection.create({ data: { tenantId, phoneNumberId: "1" + Date.now() + String(Math.floor(Math.random() * 100000)), active: true, graphVersion: "v25.0", reviewReference: "Synthetic workflow test only" } });
  await db.ownerChannelIdentity.create({ data: { tenantId, userId: member.userId, providerSenderId: ownerSender } });
  await db.conversation.create({ data: { tenantId, providerSenderId: ownerSender, lastInboundAt: now, consentGrantedAt: now, consentEvidence: "Synthetic owner permission" } });
  await db.conversation.create({ data: { tenantId, providerSenderId: customerSender, lastInboundAt: now, consentGrantedAt: now, consentEvidence: "Synthetic customer permission" } });
  const customer = await createContact(db, actor, "customers", mutation(), { name: "Ali", phoneE164: "+" + customerSender });
  const proposal = await createProposal(db, actor, mutation(), { intent: "CREATE_ORDER", payload: { customerId: customer.id, totalPaisa: "65000", items: [{ description: "Cake", quantity: "1" }], dueAt: new Date(now.getTime() + 24 * HOUR).toISOString() } });
  const result = await approveProposal(db, actor, proposal.id, mutation(), { version: proposal.version, payloadHash: proposal.payloadHash });
  await db.outboxMessage.updateMany({ where: { status: "PENDING" }, data: { status: "CANCELLED", failureCode: "TEST_FIXTURE_CLOSED" } });
  const workflow = await enableFollowUp(db, actor, result.orderId as string, mutation(), {}, now);
  return { actor, tenantId, now, orderId: result.orderId as string, workflow };
}
async function check(f: Awaited<ReturnType<typeof setup>>, now: Date, type = "FOLLOW_UP") {
  const job = await db.job.findFirst({ where: { tenantId: f.tenantId, entityId: f.workflow.id, type, status: "PENDING", runAt: { lte: now } }, orderBy: { runAt: "asc" } });
  if (!job) return null;
  const claimed = await db.job.update({ where: { tenantId_id: { tenantId: f.tenantId, id: job.id } }, data: { status: "RUNNING", attempts: { increment: 1 }, leaseToken: randomUUID(), leaseUntil: new Date(now.getTime() + 120000) } }) as ClaimedJob;
  await Promise.all([processWorkflow(db, claimed, true, now), processWorkflow(db, claimed, true, now)]); await completeJob(db, claimed); return claimed;
}
const accepted = async () => ({ kind: "ACCEPTED" as const, providerMessageId: "wamid." + randomUUID() });
async function state(f: Awaited<ReturnType<typeof setup>>) { return db.workflowInstance.findUniqueOrThrow({ where: { tenantId_id: { tenantId: f.tenantId, id: f.workflow.id } } }); }

test("three persisted checks/two reminders survive duplicate execution; quiet deferral anchors next check to actual send", async () => {
  const f = await setup(), first = await check(f, f.now);
  await processWorkflow(db, first!, true, f.now); // old/complete lease cannot repeat the check
  assert.equal((await state(f)).checksUsed, 1);
  await dispatchOne(db, accepted, true, f.now);
  const secondTime = new Date(f.now.getTime() + 12 * HOUR);
  await check(f, secondTime); await dispatchOne(db, accepted, true, secondTime); // 21:00 Pakistan
  let wf = await state(f); assert.equal(wf.ownerRemindersUsed, 2); assert.equal(wf.lastOwnerReminderAt?.getTime(), f.now.getTime()); assert.equal(wf.nextRunAt, null);
  const dispatchTime = new Date(f.now.getTime() + 24 * HOUR);
  // Only this recipient's new inbound message renews its window.
  await db.conversation.update({ where: { tenantId_providerSenderId: { tenantId: f.tenantId, providerSenderId: ownerSender } }, data: { lastInboundAt: dispatchTime } });
  await dispatchOne(db, accepted, true, dispatchTime);
  wf = await state(f); assert.equal(wf.nextRunAt?.getTime(), dispatchTime.getTime() + 12 * HOUR);
  await check(f, new Date(dispatchTime.getTime() + 12 * HOUR));
  wf = await state(f); assert.equal(wf.state, "NEEDS_HUMAN"); assert.equal(wf.checksUsed, 3); assert.equal(wf.ownerRemindersUsed, 2);
  assert.equal(await db.outboxMessage.count({ where: { tenantId: f.tenantId, workflowId: wf.id } }), 2);
  assert.equal(await db.ledgerEntry.count({ where: { tenantId: f.tenantId } }), 0); assert.equal(await db.aIExecution.count({ where: { tenantId: f.tenantId } }), 0);
  await assert.rejects(() => enableFollowUp(db, f.actor, f.orderId, mutation(), {}, f.now), { code: "WORKFLOW_ALREADY_EXISTS" });
});

test("fulfillment and due edits atomically cancel unsent follow-up; another tenant cannot stop it", async () => {
  const f = await setup(); await check(f, f.now);
  const other = await setup(); await assert.rejects(() => stopFollowUp(db, other.actor, f.workflow.id, mutation()), { code: "NOT_FOUND" });
  const proposal = await createProposal(db, f.actor, mutation(), { intent: "CHANGE_ORDER_STATUS", payload: { orderId: f.orderId, status: "FULFILLED" } });
  await approveProposal(db, f.actor, proposal.id, mutation(), { version: proposal.version, payloadHash: proposal.payloadHash });
  assert.equal((await state(f)).state, "RESOLVED"); assert.equal(await db.outboxMessage.count({ where: { tenantId: f.tenantId, workflowId: f.workflow.id, status: "PENDING" } }), 0);
  const before = (await state(other)).expiresAt.getTime();
  const change = await createProposal(db, other.actor, mutation(), { intent: "UPDATE_ORDER", payload: { orderId: other.orderId, totalPaisa: "65000", items: [{ description: "Cake", quantity: "1" }], dueAt: new Date(other.now.getTime() + 25 * HOUR).toISOString() } });
  await approveProposal(db, other.actor, change.id, mutation(), { version: change.version, payloadHash: change.payloadHash });
  assert.equal((await state(other)).state, "NEEDS_HUMAN"); assert.equal((await state(other)).expiresAt.getTime(), before);
});

test("owner-approved workflow customer update consumes one lifetime slot; opt-out cancels everything", async () => {
  const f = await setup();
  const draft = await createCustomerUpdate(db, f.actor, mutation(), { orderId: f.orderId, text: "Your order is pending owner review." });
  assert.equal(draft.workflowId, f.workflow.id);
  await decideCustomerUpdate(db, f.actor, draft.id, mutation(), { version: draft.version, payloadHash: draft.payloadHash }, true);
  assert.equal((await state(f)).customerUpdatesUsed, 1);
  await assert.rejects(() => createCustomerUpdate(db, f.actor, mutation(), { orderId: f.orderId, text: "A second update" }), { code: "WORKFLOW_UPDATE_CLOSED" });
  await recordConsent(db, f.actor, mutation(), { senderId: customerSender, granted: false, evidence: "Synthetic opt-out" });
  assert.equal((await state(f)).state, "CANCELLED");
  assert.equal(await db.outboxMessage.count({ where: { tenantId: f.tenantId, workflowId: f.workflow.id, status: "PENDING" } }), 0);
});

test("expiry/restart/uncertain transport and third technical failure terminate without new allowances", async () => {
  const f = await setup(); await check(f, f.now);
  await dispatchOne(db, async () => ({ kind: "UNKNOWN", code: "TEST_TIMEOUT" }), true, f.now);
  assert.equal((await state(f)).state, "NEEDS_HUMAN"); assert.equal((await state(f)).ownerRemindersUsed, 1);
  const expired = await setup(); await check(expired, new Date(expired.workflow.expiresAt), "WORKFLOW_EXPIRE"); assert.equal((await state(expired)).state, "EXPIRED");
  const failed = await setup();
  const job = await db.job.findFirstOrThrow({ where: { tenantId: failed.tenantId, entityId: failed.workflow.id, type: "FOLLOW_UP" } });
  for (let attempt = 1; attempt <= 3; attempt++) {
    const claimed = await db.job.update({ where: { tenantId_id: { tenantId: failed.tenantId, id: job.id } }, data: { status: "RUNNING", attempts: attempt, leaseToken: randomUUID(), leaseUntil: new Date(failed.now.getTime() + 120000) } }) as ClaimedJob;
    await failJob(db, claimed, "SYNTHETIC_FAILURE", failed.now);
  }
  assert.equal((await state(failed)).state, "FAILED"); assert.equal((await state(failed)).checksUsed, 0);
  await assert.rejects(() => db.workflowInstance.update({ where: { tenantId_id: { tenantId: failed.tenantId, id: failed.workflow.id } }, data: { state: "SCHEDULED", checksUsed: 0 } }));
});
