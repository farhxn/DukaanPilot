import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../src/generated/prisma/client.ts";
import { createBusiness } from "../../src/server/domain/business.ts";
import { createContact } from "../../src/server/domain/contacts.ts";
import { createProposal, approveProposal } from "../../src/server/domain/proposals.ts";
import { dashboard, exportLedger } from "../../src/server/domain/reports.ts";
const url = new URL(process.env.DATABASE_URL!);
if (url.hostname !== "127.0.0.1" || url.pathname !== "/dukaanpilot_test") throw new Error("Isolated synthetic database required.");
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.toString(), max: 5 }) });
after(async () => db.$disconnect());
const mutation = () => ({ key: randomUUID(), requestId: randomUUID() });
async function setup() {
  const uid = randomUUID(), actor = { uid, subject: `firebase:demo-dukaanpilot:${uid}`, email: uid + "@example.test", name: "Synthetic" };
  const business = await createBusiness(db, actor, mutation(), { name: "Final acceptance fixture", businessType: "Retail", city: "Karachi" }), tenantId = business.id as string;
  const customer = await createContact(db, actor, "customers", mutation(), { name: "Acceptance Ali" });
  return { actor, tenantId, customer };
}
test("one paisa/maximum amounts post exactly; advances, overpayments, inconsistent lines and foreign allocations are rejected", async () => {
  const f = await setup(), other = await setup();
  for (const amount of ["1", "1000000000"]) {
    const preview = await createProposal(db, f.actor, mutation(), { intent: "POST_SALE", payload: { customerId: f.customer.id, totalPaisa: amount, receivedPaisa: "0" } });
    await approveProposal(db, f.actor, preview.id, mutation(), { version: preview.version, payloadHash: preview.payloadHash });
  }
  assert.equal((await dashboard(db, f.actor)).outstandingPaisa, "1000000001");
  await assert.rejects(() => createProposal(db, f.actor, mutation(), { intent: "RECORD_PAYMENT", payload: { customerId: other.customer.id, amountPaisa: "1" } }), { code: "NOT_FOUND" });
  await assert.rejects(() => createProposal(db, other.actor, mutation(), { intent: "RECORD_PAYMENT", payload: { customerId: other.customer.id, amountPaisa: "1" } }), { code: "VALIDATION_ERROR" });
  await assert.rejects(() => createProposal(db, f.actor, mutation(), { intent: "POST_SALE", payload: { customerId: f.customer.id, totalPaisa: "1", receivedPaisa: "2" } }), { code: "VALIDATION_ERROR" });
  await assert.rejects(() => createProposal(db, f.actor, mutation(), { intent: "CREATE_ORDER", payload: { customerId: f.customer.id, items: [{ description: "Cake", quantity: "2", unitPricePaisa: "100" }], totalPaisa: "199", dueAt: new Date(Date.now() + 86400000).toISOString() } }), { code: "VALIDATION_ERROR" });
});

test("report SQL and CSV use half-open Pakistan midnight and reversal date without changing current outstanding", async () => {
  const f = await setup(), owner = await db.tenantUser.findUniqueOrThrow({ where: { tenantId: f.tenantId } });
  const beforeMidnight = new Date("2030-01-01T18:59:59.999Z"), afterMidnight = new Date("2030-01-01T19:00:00.000Z");
  // Synthetic historical fixture inserts explicit effective times. No posted
  // row is edited to simulate a date; production uses approval services only.
  async function historicalSale(amount: bigint, date: Date) {
    const proposal = await db.aIActionProposal.create({ data: { tenantId: f.tenantId, ownerUserId: owner.userId, intent: "POST_SALE", payload: { synthetic: true }, payloadHash: "a".repeat(64), status: "EXECUTED", expiresAt: new Date(Date.now() + 86400000) } });
    const sale = await db.sale.create({ data: { tenantId: f.tenantId, customerId: f.customer.id, proposalId: proposal.id, totalPaisa: amount, businessDate: date < afterMidnight ? "2030-01-01" : "2030-01-02", postedAt: date } });
    const entry = await db.ledgerEntry.create({ data: { tenantId: f.tenantId, customerId: f.customer.id, saleId: sale.id, kind: "SALE", direction: "DEBIT", amountPaisa: amount, effectiveAt: date } });
    return { sale, entry };
  }
  await historicalSale(100n, beforeMidnight); const second = await historicalSale(200n, afterMidnight);
  await db.sale.update({ where: { tenantId_id: { tenantId: f.tenantId, id: second.sale.id } }, data: { status: "REVERSED", version: { increment: 1 } } });
  await db.ledgerEntry.create({ data: { tenantId: f.tenantId, customerId: f.customer.id, saleId: second.sale.id, kind: "SALE_REVERSAL", direction: "CREDIT", amountPaisa: 200n, reversalOfId: second.entry.id, effectiveAt: new Date("2030-01-02T19:00:00Z") } });
  assert.equal((await dashboard(db, f.actor, "2030-01-01")).salesPaisa, "100");
  assert.equal((await dashboard(db, f.actor, "2030-01-02")).salesPaisa, "200");
  const third = await dashboard(db, f.actor, "2030-01-03"); assert.equal(third.salesPaisa, "-200"); assert.equal(third.outstandingPaisa, "100");
  const exported = await exportLedger(db, f.actor, randomUUID(), new URLSearchParams({ from: "2030-01-02", to: "2030-01-02" }));
  assert.ok(exported.csv.includes(second.entry.id));
});
