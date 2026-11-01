import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../src/generated/prisma/client.ts";
import { createBusiness } from "../../src/server/domain/business.ts";
import { createContact } from "../../src/server/domain/contacts.ts";
import { processInstruction } from "../../src/server/ai/assistant.ts";
import { reserveAI, usage } from "../../src/server/ai/metering.ts";
import { settings, sale } from "../fixtures/ai.ts";
import type { ModelAdapter } from "../../src/server/ai/gemini.ts";
import { approveProposal } from "../../src/server/domain/proposals.ts";
import { nextMonthFirst } from "../../src/lib/instruction-date.ts";
import { matchCustomer } from "../../src/server/ai/customer-match.ts";

const url = new URL(process.env.DATABASE_URL!);
if (url.hostname !== "127.0.0.1" || url.pathname !== "/dukaanpilot_test") throw new Error("Use isolated test database.");
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.toString(), max: 5 }) });
after(async () => db.$disconnect());
const mutation = (key = randomUUID()) => ({ key, requestId: randomUUID() });

async function setup() {
  const uid = randomUUID(), actor = { uid, subject: `firebase:demo-dukaanpilot:${uid}`, email: uid + "@example.test", name: "Synthetic" };
  const business = await createBusiness(db, actor, mutation(), { name: "AI fixture shop", businessType: "Retail", city: "Karachi" });
  await createContact(db, actor, "customers", mutation(), { name: "Ali" });
  return { actor, tenantId: business.id as string };
}
const runYear = 2100 + Math.floor(Math.random() * 5000);
let sequence = 0;
function clock() { return new Date(Date.UTC(runYear, 0, 1 + sequence++, 8)); }

test("AI returns an owner-review proposal, replay consumes one unit, never posts", async () => {
  const { actor, tenantId } = await setup(), now = clock(), request = mutation(); let calls = 0;
  const adapter: ModelAdapter = async () => { calls++; return { extraction: sale, inputTokens: 1000, outputTokens: 200 }; };
  const result = await processInstruction(db, actor, request, { text: "Ali sale 650 received 0" }, settings, adapter, now);
  assert.equal(result.kind, "proposal"); assert.equal(await db.sale.count({ where: { tenantId } }), 0);
  assert.deepEqual(await processInstruction(db, actor, request, { text: "Ali sale 650 received 0" }, settings, adapter, now), result);
  assert.equal(calls, 1); assert.equal((await usage(db, actor, now)).monthlyUsed, 1);
  await assert.rejects(() => processInstruction(db, actor, request, { text: "changed instruction" }, settings, adapter, now), { code: "IDEMPOTENCY_CONFLICT" });
  const meter = await db.aIExecution.findFirstOrThrow({ where: { tenantId } }); assert.equal(meter.chargedNanoUsd, 180000n);
});

test("written repayment dates and absent-date defaults survive approval; a model date cannot override source", async () => {
  const { actor, tenantId } = await setup(), now = new Date();
  const adapter: ModelAdapter = async () => ({ extraction: { ...sale, statedTotalPaisa: "60000", dueAtCandidate: "2030-01-01T12:00:00Z", missingFields: ["dueAt"], clarification: "Please specify a due date and time." }, inputTokens: 100, outputTokens: 100 });
  const explicit = await processInstruction(db, actor, mutation(), { text: "ali ko 600 udhare diye hain udhar mai add kardo 1 december 2026 ko wapis kareyga" }, settings, adapter, now);
  assert.equal(explicit.kind, "proposal", explicit.message);
  if (explicit.kind !== "proposal") throw new Error("Expected dated credit proposal.");
  const proposal = await db.aIActionProposal.findFirstOrThrow({ where: { tenantId, id: explicit.proposalId } });
  assert.equal((proposal.payload as { dueAt: string }).dueAt, "2026-12-01T04:00:00.000Z");
  assert.equal(await db.sale.count({ where: { tenantId } }), 0);
  await approveProposal(db, actor, proposal.id, mutation(), { version: proposal.version, payloadHash: proposal.payloadHash });
  const posted = await db.sale.findFirstOrThrow({ where: { tenantId } });
  assert.equal(posted.dueAt?.toISOString(), "2026-12-01T04:00:00.000Z");
  await assert.rejects(() => db.sale.update({ where: { tenantId_id: { tenantId, id: posted.id } }, data: { dueAt: new Date("2027-01-01"), version: { increment: 1 } } }));
  const defaulted = await processInstruction(db, actor, mutation(), { text: "Ali ko 600 ki credit sale, cash received 0" }, settings, adapter, now);
  assert.equal(defaulted.kind, "proposal");
  if (defaulted.kind !== "proposal") throw new Error("Expected default-date credit proposal.");
  const next = await db.aIActionProposal.findFirstOrThrow({ where: { tenantId, id: defaulted.proposalId } });
  assert.equal((next.payload as { dueAt: string }).dueAt, nextMonthFirst(now));
});

test("failed/invalid model processing stops after two calls and retains provider cost without a product unit", async () => {
  const { actor, tenantId } = await setup(), now = clock(); let calls = 0;
  const result = await processInstruction(db, actor, mutation(), { text: "Ali sale 650 received 0" }, settings, async () => { calls++; throw new Error("provider timeout"); }, now);
  assert.equal(result.kind, "unavailable"); assert.equal(calls, 2);
  const meter = await db.aIExecution.findFirstOrThrow({ where: { tenantId } });
  assert.equal(meter.calls, 2); assert.equal(meter.actionUnits, 0); assert.equal(meter.chargedNanoUsd, 1280000n); assert.equal(meter.status, "FAILED");
});

test("concurrent daily/product and global/spend reservations cannot oversubscribe", async () => {
  const { actor } = await setup(), now = clock();
  const results = await Promise.allSettled(Array.from({ length: 12 }, (_, i) => reserveAI(db, actor, mutation(), `instruction ${i}`, settings, now)));
  assert.equal(results.filter(r => r.status === "fulfilled").length, 10);
  assert.equal((await usage(db, actor, now)).reserved, 10);
  const second = await setup(), spendNow = clock(), capped = { ...settings, globalDaily: 1280000n, tenantDaily: 1280000n };
  const spendResults = await Promise.allSettled([actor, second.actor].map(a => reserveAI(db, a, mutation(), "another instruction", capped, spendNow)));
  assert.equal(spendResults.filter(r => r.status === "fulfilled").length, 1);
});

test("ambiguous customer, invented amount and pending executions cannot post or blindly retry", async () => {
  const { actor, tenantId } = await setup(), now = clock();
  await createContact(db, actor, "customers", mutation(), { name: "Ali" });
  const result = await processInstruction(db, actor, mutation(), { text: "Ali sale 650 received 0" }, settings, async () => ({ extraction: sale, inputTokens: 100, outputTokens: 100 }), now);
  assert.equal(result.kind, "customer_required"); assert.equal(await db.aIActionProposal.count({ where: { tenantId } }), 0);
  const key = mutation(); await reserveAI(db, actor, key, "Ali sale 650 received 0", settings, now);
  await assert.rejects(() => processInstruction(db, actor, key, { text: "Ali sale 650 received 0" }, settings, async () => { throw new Error("Must not call"); }, now), { code: "AI_IN_PROGRESS" });
  const invented = await processInstruction(db, actor, mutation(), { text: "Ali sale 999 received 0" }, settings, async () => ({ extraction: sale, inputTokens: 100, outputTokens: 100 }), now);
  assert.equal(invented.kind, "clarification"); assert.equal(await db.sale.count({ where: { tenantId } }), 0);
});

test("customer recovery covers missing, case/space, phone, duplicate, archived and foreign selections", async () => {
  const { actor, tenantId } = await setup(), now = clock();
  assert.ok((await matchCustomer(db, actor, "  aLi ")).customer);
  const missing = await processInstruction(db, actor, mutation(), { text: "Sana sale 650 received 0" }, settings, async () => ({ extraction: { ...sale, customerCandidates: ["Sana"] }, inputTokens: 100, outputTokens: 100 }), now);
  assert.equal(missing.kind, "customer_required");
  if (missing.kind !== "customer_required") throw new Error("Expected customer recovery.");
  assert.equal(missing.reason, "missing"); assert.equal(missing.customerName, "Sana");
  const contact = await createContact(db, actor, "customers", mutation(), { name: "Sana", phoneE164: "03001234567" });
  assert.equal((await matchCustomer(db, actor, "0300-1234567")).customer?.id, contact.id);
  assert.equal((await matchCustomer(db, actor, "+923001234567")).customer?.id, contact.id);
  const duplicate = await createContact(db, actor, "customers", mutation(), { name: "Sana" });
  const ambiguous = await matchCustomer(db, actor, "sana"); assert.equal(ambiguous.reason, "ambiguous"); assert.equal(ambiguous.matches.length, 2);
  const selected = await processInstruction(db, actor, mutation(), { text: "Sana sale 650 received 0", customerId: duplicate.id }, settings, async () => ({ extraction: { ...sale, customerCandidates: ["Sana"] }, inputTokens: 100, outputTokens: 100 }), now);
  assert.equal(selected.kind, "proposal");
  const other = await setup(); let called = false;
  const foreign = await createContact(db, other.actor, "customers", mutation(), { name: "Sana" });
  await assert.rejects(() => processInstruction(db, actor, mutation(), { text: "Sana sale 650 received 0", customerId: foreign.id }, settings, async () => { called = true; throw new Error("Must not call"); }, now), { code: "NOT_FOUND" });
  assert.equal(called, false);
  await db.customer.updateMany({ where: { tenantId, name: "Sana" }, data: { archivedAt: new Date() } });
  assert.equal((await matchCustomer(db, actor, "Sana")).reason, "archived");
  assert.equal(await db.sale.count({ where: { tenantId } }), 0);
});

test("unsupported financial inputs never call the model or post, while malformed selection is rejected", async () => {
  const { actor, tenantId } = await setup(); let calls = 0;
  const adapter: ModelAdapter = async () => { calls++; throw new Error("Unexpected provider call"); };
  for (const text of ["Ali sale USD 650", "Ali sale -600", "Ali cash loan 600", "Ali advance 600"]) {
    assert.equal((await processInstruction(db, actor, mutation(), { text }, settings, adapter)).kind, "clarification");
  }
  await assert.rejects(() => processInstruction(db, actor, mutation(), { text: "Ali sale 650", customerId: "not-an-id" }, settings, adapter));
  await assert.rejects(() => processInstruction(db, actor, mutation(), { text: "Ali sale 650\u0000" }, settings, adapter), { code: "VALIDATION_ERROR" });
  assert.equal(calls, 0); assert.equal(await db.aIExecution.count({ where: { tenantId } }), 0); assert.equal(await db.sale.count({ where: { tenantId } }), 0);
});

test("receipt methods, per-customer balances and invalid repayment dates have explicit outcomes", async () => {
  const { actor, tenantId } = await setup(), now = clock();
  const reply: ModelAdapter = async () => ({ extraction: { ...sale, statedReceivedPaisa: "65000" }, inputTokens: 100, outputTokens: 100 });
  const bank = await processInstruction(db, actor, mutation(), { text: "Ali sale 650 received 650 by bank" }, settings, reply, now);
  assert.equal(bank.kind, "proposal");
  if (bank.kind !== "proposal") throw new Error("Expected bank draft.");
  const proposal = await db.aIActionProposal.findFirstOrThrow({ where: { tenantId, id: bank.proposalId } });
  assert.equal((proposal.payload as { method: string }).method, "BANK_TRANSFER");
  const split = await processInstruction(db, actor, mutation(), { text: "Ali sale 650 received 650 cash and bank" }, settings, reply, now);
  assert.equal(split.kind, "clarification"); assert.match(split.message, /Several receipt methods/);
  const summary = await processInstruction(db, actor, mutation(), { text: "Ali ka total udhar kitna hai?" }, settings, async () => ({ extraction: { ...sale, intent: "query_summary", statedTotalPaisa: null, statedReceivedPaisa: null }, inputTokens: 100, outputTokens: 100 }), now);
  assert.equal(summary.kind, "summary"); assert.match(summary.message, /Ali: outstanding Rs 0.00/);
  const customer = await db.customer.findFirstOrThrow({ where: { tenantId, name: "Ali" } });
  const { createProposal } = await import("../../src/server/domain/proposals.ts");
  await assert.rejects(() => createProposal(db, actor, mutation(), { intent: "POST_SALE", payload: { customerId: customer.id, totalPaisa: "65000", dueAt: "2027-02-30T09:00:00+05:00" } }), { code: "VALIDATION_ERROR" });
  assert.equal(await db.sale.count({ where: { tenantId } }), 0);
});

