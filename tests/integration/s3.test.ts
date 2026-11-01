import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../src/generated/prisma/client.ts";
import { createBusiness } from "../../src/server/domain/business.ts";
import { createContact } from "../../src/server/domain/contacts.ts";
import { createProposal, approveProposal, editProposal, rejectProposal, getProposal } from "../../src/server/domain/proposals.ts";
import { dashboard, ledger, exportLedger } from "../../src/server/domain/reports.ts";
import type { VerifiedIdentity } from "../../src/server/domain/identity.ts";

const url = new URL(process.env.DATABASE_URL!);
if (url.hostname !== "127.0.0.1" || url.pathname !== "/dukaanpilot_test") throw new Error("Use the isolated test database.");
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.toString(), max: 5 }) });
const mutation = (key = randomUUID()) => ({ key, requestId: randomUUID() });
const code = (expected: string) => (error: unknown) => !!error && typeof error === "object" && "code" in error && error.code === expected;
after(async () => db.$disconnect());
async function setup(name = "Synthetic financial shop") {
  const uid = randomUUID();
  const actor: VerifiedIdentity = { uid, subject: `firebase:demo-dukaanpilot:${uid}`, email: uid + "@example.test", name: "Synthetic" };
  const business = await createBusiness(db, actor, mutation(), { name, businessType: "Retail", city: "Karachi" });
  const customer = await createContact(db, actor, "customers", mutation(), { name: "Ali" });
  return { actor, tenantId: business.id as string, customer };
}
async function propose(actor: VerifiedIdentity, intent: string, payload: unknown) { return createProposal(db, actor, mutation(), { intent, payload }); }
async function approve(actor: VerifiedIdentity, proposal: { id: string; version: number; payloadHash: string }, request = mutation()) { return approveProposal(db, actor, proposal.id, request, { version: proposal.version, payloadHash: proposal.payloadHash }); }

test("preview has no financial effect; repeated and concurrent approvals post once", async () => {
  const { actor, tenantId, customer } = await setup();
  const proposal = await propose(actor, "POST_SALE", { customerId: customer.id, totalPaisa: "65000", receivedPaisa: "0" });
  assert.equal(await db.sale.count({ where: { tenantId } }), 0);
  const results = await Promise.all([1, 2, 3].map(() => approve(actor, proposal)));
  assert.equal(new Set(results.map(result => result.saleId)).size, 1);
  assert.equal(await db.sale.count({ where: { tenantId } }), 1);
  assert.equal(await db.approvalEvent.count({ where: { tenantId, decision: "APPROVED" } }), 1);
  assert.equal((await ledger(db, actor, customer.id, new URLSearchParams())).balancePaisa, "65000");
});

test("credit sale, partial receipt and cash sale produce exact independent totals", async () => {
  const { actor, customer, tenantId } = await setup();
  await approve(actor, await propose(actor, "POST_SALE", { customerId: customer.id, totalPaisa: "65000" }));
  await approve(actor, await propose(actor, "RECORD_PAYMENT", { customerId: customer.id, amountPaisa: "20000", method: "CASH" }));
  assert.equal((await ledger(db, actor, customer.id, new URLSearchParams())).balancePaisa, "45000");
  const walkIn = await db.customer.findFirstOrThrow({ where: { tenantId, isWalkIn: true } });
  await approve(actor, await propose(actor, "POST_SALE", { customerId: walkIn.id, totalPaisa: "65000", receivedPaisa: "65000" }));
  const summary = await dashboard(db, actor);
  assert.equal(summary.salesPaisa, "130000"); assert.equal(summary.collectionsPaisa, "85000"); assert.equal(summary.outstandingPaisa, "45000");
  assert.equal((await ledger(db, actor, walkIn.id, new URLSearchParams())).balancePaisa, "0");
  await assert.rejects(propose(actor, "RECORD_PAYMENT", { customerId: customer.id, amountPaisa: "70000" }), code("VALIDATION_ERROR"));
  await assert.rejects(propose(actor, "POST_SALE", { customerId: walkIn.id, totalPaisa: "10000", receivedPaisa: "0" }), code("VALIDATION_ERROR"));
});

test("competing repayments cannot overallocate or silently reduce an approved amount", async () => {
  const { actor, customer } = await setup();
  await approve(actor, await propose(actor, "POST_SALE", { customerId: customer.id, totalPaisa: "65000" }));
  const drafts = await Promise.all([1, 2].map(() => propose(actor, "RECORD_PAYMENT", { customerId: customer.id, amountPaisa: "40000" })));
  const results = await Promise.allSettled(drafts.map(draft => approve(actor, draft)));
  assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
  assert.equal(results.filter(result => result.status === "rejected" && code("STALE_RECORD")(result.reason)).length, 1);
  assert.equal((await ledger(db, actor, customer.id, new URLSearchParams())).balancePaisa, "25000");
});

test("edited, expired, rejected and foreign-owner approvals cannot post", async () => {
  const { actor, customer, tenantId } = await setup(), other = await setup();
  const draft = await propose(actor, "POST_SALE", { customerId: customer.id, totalPaisa: "65000" });
  const edited = await editProposal(db, actor, draft.id, mutation(), { version: draft.version, payload: { customerId: customer.id, totalPaisa: "60000" } });
  await assert.rejects(approve(actor, draft), code("STALE_VERSION"));
  await assert.rejects(approve(other.actor, edited), code("NOT_FOUND"));
  await db.aIActionProposal.update({ where: { id: draft.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
  await assert.rejects(approve(actor, edited), code("PROPOSAL_EXPIRED"));
  const rejected = await propose(actor, "POST_SALE", { customerId: customer.id, totalPaisa: "10000" });
  await rejectProposal(db, actor, rejected.id, mutation(), { version: rejected.version });
  await assert.rejects(approve(actor, rejected), code("PROPOSAL_CLOSED"));
  assert.equal(await db.sale.count({ where: { tenantId } }), 0);
});

test("orders and fulfillment do not post sales; conversion is separate and unique", async () => {
  const { actor, customer, tenantId } = await setup();
  const created = await approve(actor, await propose(actor, "CREATE_ORDER", { customerId: customer.id, items: [{ description: "Half unit", quantity: "0.5", unitPricePaisa: "101" }], dueAt: new Date(Date.now() + 86400000).toISOString() }));
  const order = await db.order.findFirstOrThrow({ where: { tenantId, id: created.orderId as string } });
  assert.equal(order.totalPaisa, 51n);
  assert.equal(await db.ledgerEntry.count({ where: { tenantId } }), 0);
  await assert.rejects(propose(actor, "POST_SALE", { customerId: customer.id, orderId: order.id, totalPaisa: "51" }), code("VALIDATION_ERROR"));
  await approve(actor, await propose(actor, "CHANGE_ORDER_STATUS", { orderId: order.id, status: "FULFILLED" }));
  assert.equal(await db.sale.count({ where: { tenantId } }), 0);
  await approve(actor, await propose(actor, "POST_SALE", { customerId: customer.id, orderId: order.id, totalPaisa: "51" }));
  await assert.rejects(propose(actor, "POST_SALE", { customerId: customer.id, orderId: order.id, totalPaisa: "51" }), code("SALE_EXISTS"));
});

test("full reversals preserve originals, release allocations and net reports correctly", async () => {
  const { actor, customer, tenantId } = await setup();
  const receipt = await approve(actor, await propose(actor, "POST_SALE", { customerId: customer.id, totalPaisa: "65000", receivedPaisa: "65000" }));
  await assert.rejects(propose(actor, "REVERSE_SALE", { saleId: receipt.saleId, reason: "Synthetic correction" }), code("VALIDATION_ERROR"));
  await approve(actor, await propose(actor, "REVERSE_PAYMENT", { paymentId: receipt.paymentId, reason: "Synthetic payment correction" }));
  assert.equal((await ledger(db, actor, customer.id, new URLSearchParams())).balancePaisa, "65000");
  await approve(actor, await propose(actor, "REVERSE_SALE", { saleId: receipt.saleId, reason: "Synthetic sale correction" }));
  const summary = await dashboard(db, actor);
  assert.equal(summary.salesPaisa, "0"); assert.equal(summary.collectionsPaisa, "0"); assert.equal(summary.outstandingPaisa, "0");
  assert.equal(await db.ledgerEntry.count({ where: { tenantId } }), 4);
  await assert.rejects(db.sale.update({ where: { id: receipt.saleId as string }, data: { totalPaisa: 1n } }));
  const entry = await db.ledgerEntry.findFirstOrThrow({ where: { tenantId } });
  await assert.rejects(db.ledgerEntry.delete({ where: { id: entry.id } }));
});

test("failure after a sale insert rolls back every financial effect and permits safe retry", async () => {
  const { actor, customer, tenantId } = await setup();
  const draft = await propose(actor, "POST_SALE", { customerId: customer.id, totalPaisa: "12345", receivedPaisa: "12345" });
  // UUID is generated by the fixture, never supplied by an external caller.
  await db.$executeRawUnsafe(`CREATE FUNCTION test_s3_payment_fault() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."tenantId" = '${tenantId}'::uuid THEN RAISE EXCEPTION 'Synthetic payment insert failure'; END IF; RETURN NEW; END; $$`);
  await db.$executeRawUnsafe('CREATE TRIGGER test_s3_payment_fault BEFORE INSERT ON "Payment" FOR EACH ROW EXECUTE FUNCTION test_s3_payment_fault()');
  const request = mutation();
  try {
    await assert.rejects(approve(actor, draft, request));
    assert.equal(await db.sale.count({ where: { tenantId } }), 0); assert.equal(await db.ledgerEntry.count({ where: { tenantId } }), 0);
    assert.equal((await getProposal(db, actor, draft.id)).status, "READY");
    assert.equal(await db.approvalEvent.count({ where: { tenantId } }), 0);
  } finally {
    await db.$executeRawUnsafe('DROP TRIGGER IF EXISTS test_s3_payment_fault ON "Payment"');
    await db.$executeRawUnsafe('DROP FUNCTION IF EXISTS test_s3_payment_fault()');
  }
  await approve(actor, draft, request);
  assert.equal(await db.sale.count({ where: { tenantId } }), 1); assert.equal(await db.payment.count({ where: { tenantId } }), 1);
});

test("ledger/export are tenant-scoped and CSV escapes spreadsheet formulas", async () => {
  const { actor, tenantId } = await setup(), other = await setup();
  const customer = await createContact(db, actor, "customers", mutation(), { name: "=SUM(A1:A2)" });
  await approve(actor, await propose(actor, "POST_SALE", { customerId: customer.id, totalPaisa: "1" }));
  await assert.rejects(ledger(db, other.actor, customer.id, new URLSearchParams()), code("NOT_FOUND"));
  const exported = await exportLedger(db, actor, randomUUID(), new URLSearchParams());
  assert.ok(exported.csv.includes("'=SUM(A1:A2)"));
  assert.equal((await exportLedger(db, other.actor, randomUUID(), new URLSearchParams())).csv.includes("SUM(A1"), false);
  assert.equal(await db.auditEvent.count({ where: { tenantId, action: "LEDGER_EXPORTED" } }), 1);
});
