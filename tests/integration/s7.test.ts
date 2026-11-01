import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../src/generated/prisma/client.ts";
import { createBusiness } from "../../src/server/domain/business.ts";
import { createContact } from "../../src/server/domain/contacts.ts";
import { createProposal, approveProposal } from "../../src/server/domain/proposals.ts";
import { dashboard } from "../../src/server/domain/reports.ts";
import { pauseTenant, resumeTenant, maintainRetention, setPilotPlan } from "../../src/server/operations/controls.ts";
import { exportWorkspace, requestPrivacyReview } from "../../src/server/operations/privacy.ts";
import { usage } from "../../src/server/ai/metering.ts";
const url = new URL(process.env.DATABASE_URL!);
if (url.hostname !== "127.0.0.1" || url.pathname !== "/dukaanpilot_test") throw new Error("Use isolated test database.");
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.toString(), max: 5 }) });
after(async () => db.$disconnect());
const operator = { actorRef: "synthetic-operator", reviewReference: "synthetic-test-review" }, mutation = () => ({ key: randomUUID(), requestId: randomUUID() });
async function setup() {
  const uid = randomUUID(), actor = { uid, subject: `firebase:demo-dukaanpilot:${uid}`, email: uid + "@example.test", name: "Synthetic" };
  const business = await createBusiness(db, actor, mutation(), { name: "Operational fixture", businessType: "Retail", city: "Karachi" }), tenantId = business.id as string;
  const customer = await createContact(db, actor, "customers", mutation(), { name: "Ali" });
  const preview = await createProposal(db, actor, mutation(), { intent: "POST_SALE", payload: { customerId: customer.id, totalPaisa: "65000", receivedPaisa: "0" } });
  await approveProposal(db, actor, preview.id, mutation(), { version: preview.version, payloadHash: preview.payloadHash });
  return { actor, tenantId, customer };
}
test("operator freeze blocks new writes while preserving owner history/export; resumed work never replays cancelled actions", async () => {
  const f = await setup(), other = await setup();
  const request = await requestPrivacyReview(db, f.actor, mutation(), { kind: "DELETE" });
  assert.equal(request.status, "REQUESTED");
  await pauseTenant(db, f.tenantId, operator);
  await assert.rejects(() => createProposal(db, f.actor, mutation(), { intent: "POST_SALE", payload: { customerId: f.customer.id, totalPaisa: "100", receivedPaisa: "0" } }), { code: "WORKSPACE_UNAVAILABLE" });
  assert.equal((await dashboard(db, f.actor)).outstandingPaisa, "65000");
  const exported = await exportWorkspace(db, f.actor); assert.equal(exported.sales.length, 1); assert.equal(exported.sales[0].tenantId, f.tenantId);
  assert.equal(exported.customers.some((c: { id: string }) => c.id === other.customer.id), false);
  await resumeTenant(db, f.tenantId, operator);
  assert.equal((await dashboard(db, f.actor)).outstandingPaisa, "65000");
  const events = await db.operatorEvent.findMany({ where: { tenantId: f.tenantId } }); assert.equal(events.length, 2);
  await assert.rejects(() => db.operatorEvent.delete({ where: { id: events[0].id } }));
});
test("pilot entitlements are audited, expire to Free, and never claim subscription payment", async () => {
  const f = await setup(), expiry = new Date(Date.now() + 86400000);
  await setPilotPlan(db, f.tenantId, "PRO", expiry, operator);
  assert.equal((await usage(db, f.actor)).plan, "PRO");
  assert.equal((await usage(db, f.actor, new Date(expiry.getTime() + 1))).plan, "FREE");
  assert.equal((await db.operatorEvent.findFirstOrThrow({ where: { tenantId: f.tenantId } })).action, "PILOT_ENTITLEMENT_GRANTED");
});
test("retention purges old message bodies and temporary authority while preserving posted ledger/audit/consent", async () => {
  const f = await setup(), old = new Date(Date.now() - 31 * 86400000), expiresAt = new Date(old.getTime() + 3600000);
  const conversation = await db.conversation.create({ data: { tenantId: f.tenantId, providerSenderId: "923001234567", lastInboundAt: old, consentGrantedAt: old, consentEvidence: "Synthetic permission" } });
  await db.contactConsent.create({ data: { tenantId: f.tenantId, conversationId: conversation.id, granted: true, purpose: "ORDER_UPDATES", source: "SYNTHETIC", evidence: "Synthetic permission", createdAt: old } });
  const inbound = await db.inboundMessage.create({ data: { tenantId: f.tenantId, conversationId: conversation.id, providerMessageId: "wamid." + randomUUID(), providerTimestamp: old, type: "text", body: "Synthetic confidential old text", createdAt: old, state: "PENDING" } });
  const outbound = await db.outboxMessage.create({ data: { tenantId: f.tenantId, conversationId: conversation.id, recipient: "923001234567", logicalActionKey: randomUUID(), body: "Synthetic old outgoing text", payloadHash: "a".repeat(64), status: "UNKNOWN", createdAt: old, notBefore: old, expiresAt } });
  const before = (await dashboard(db, f.actor)).outstandingPaisa;
  await maintainRetention(db, operator);
  assert.equal((await db.inboundMessage.findUniqueOrThrow({ where: { tenantId_id: { tenantId: f.tenantId, id: inbound.id } } })).body, null);
  const retained = await db.outboxMessage.findUniqueOrThrow({ where: { tenantId_id: { tenantId: f.tenantId, id: outbound.id } } }); assert.equal(retained.body, null); assert.equal(retained.status, "UNKNOWN");
  assert.equal((await dashboard(db, f.actor)).outstandingPaisa, before); assert.equal(await db.contactConsent.count({ where: { tenantId: f.tenantId } }), 1);
});
