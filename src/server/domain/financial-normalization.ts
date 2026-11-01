import { Prisma, type ProposalIntent } from "../../generated/prisma/client.ts";
import { parsePaisa, quantityMills, quantityString, lineTotal, MAX_PAISA } from "../../lib/money.ts";
import { DomainError } from "../errors.ts";
import { invalid, object, text, uuid } from "./validation.ts";
import type { Owner, Tx } from "./tenancy.ts";
import { instructionDueDate, nextMonthFirst } from "../../lib/instruction-date.ts";

export type Line = { description: string; quantity: string; unitPricePaisa: string | null; lineTotalPaisa: string | null };
export type Allocation = { saleId: string; amountPaisa: string; saleVersion: number };
export type FinancialPayload = {
  customerId?: string; customerName?: string; expectedBalancePaisa?: string; resultingBalancePaisa?: string;
  orderId?: string; orderVersion?: number; items?: Line[]; pricingMode?: string; totalPaisa?: string;
  receivedPaisa?: string; amountPaisa?: string; method?: "CASH" | "BANK_TRANSFER" | "OTHER";
  dueAt?: string | null; notes?: string | null; status?: "FULFILLED" | "CANCELLED";
  allocations?: Allocation[]; saleId?: string; paymentId?: string; sourceVersion?: number; reason?: string;
};

const sourceKeys: Record<Exclude<ProposalIntent, "SEND_CUSTOMER_UPDATE">, string[]> = {
  CREATE_ORDER: ["customerId", "items", "totalPaisa", "dueAt", "notes"],
  UPDATE_ORDER: ["orderId", "items", "totalPaisa", "dueAt", "notes"],
  CHANGE_ORDER_STATUS: ["orderId", "status"],
  POST_SALE: ["customerId", "orderId", "totalPaisa", "receivedPaisa", "method", "dueAt"],
  RECORD_PAYMENT: ["customerId", "amountPaisa", "method", "allocations"],
  REVERSE_SALE: ["saleId", "reason"], REVERSE_PAYMENT: ["paymentId", "reason"],
};
export function sourcePayload(intent: ProposalIntent, payload: FinancialPayload): Record<string, unknown> {
  if (intent === "SEND_CUSTOMER_UPDATE") throw new DomainError("UNSUPPORTED_ACTION", 422, "Customer messaging is not enabled yet.");
  const raw: Record<string, unknown> = {};
  for (const key of sourceKeys[intent]) if (key in payload) raw[key] = payload[key as keyof FinancialPayload];
  if (payload.items) raw.items = payload.items.map(({ description, quantity, unitPricePaisa }) => ({ description, quantity, ...(unitPricePaisa !== null ? { unitPricePaisa } : {}) }));
  if (payload.allocations) raw.allocations = payload.allocations.map(({ saleId, amountPaisa }) => ({ saleId, amountPaisa }));
  return raw;
}

function money(value: unknown, field: string, zero = false): bigint {
  try { return parsePaisa(value, zero); } catch (error) { return invalid(field, (error as Error).message); }
}
function id(value: unknown, field: string) { return uuid(text(value, field, 36), field); }
function method(value: unknown): "CASH" | "BANK_TRANSFER" | "OTHER" {
  if (value === undefined) return "CASH";
  if (value !== "CASH" && value !== "BANK_TRANSFER" && value !== "OTHER") invalid("method", "Choose cash, bank transfer or other.");
  return value;
}

export async function customerBalance(tx: Tx, tenantId: string, customerId: string) {
  const rows = await tx.$queryRaw<{ balance: string }[]>(Prisma.sql`SELECT COALESCE(SUM(CASE WHEN direction = 'DEBIT' THEN "amountPaisa" ELSE -"amountPaisa" END),0)::text AS balance FROM "LedgerEntry" WHERE "tenantId" = ${tenantId}::uuid AND "customerId" = ${customerId}::uuid`);
  return BigInt(rows[0].balance);
}

async function customer(tx: Tx, owner: Owner, value: unknown) {
  const customerId = id(value, "customerId");
  const record = await tx.customer.findFirst({ where: { tenantId: owner.tenantId, id: customerId, archivedAt: null } });
  if (!record) throw new DomainError("NOT_FOUND", 404, "Customer not found or archived.");
  const balance = await customerBalance(tx, owner.tenantId, customerId);
  return { record, balance, fields: { customerId, customerName: record.name, expectedBalancePaisa: balance.toString() } };
}

async function order(tx: Tx, owner: Owner, value: unknown) {
  const record = await tx.order.findFirst({ where: { tenantId: owner.tenantId, id: id(value, "orderId") } });
  if (!record) throw new DomainError("NOT_FOUND", 404, "Order not found.");
  return record;
}

function orderDetails(raw: Record<string, unknown>) {
  if (!Array.isArray(raw.items) || !raw.items.length || raw.items.length > 30) invalid("items", "Add between 1 and 30 item descriptions.");
  const items: Line[] = raw.items.map((line, index) => {
    const item = object(line, ["description", "quantity", "unitPricePaisa"]);
    const description = text(item.description, `items.${index}.description`, 200);
    let mills: bigint;
    try { mills = quantityMills(item.quantity); } catch (error) { return invalid(`items.${index}.quantity`, (error as Error).message); }
    const price = item.unitPricePaisa === undefined || item.unitPricePaisa === null ? null : money(item.unitPricePaisa, `items.${index}.unitPricePaisa`, true);
    const total = price === null ? null : lineTotal(price, mills);
    if (total !== null && total > MAX_PAISA) invalid("items", "A line total exceeds the supported amount.");
    return { description, quantity: quantityString(mills), unitPricePaisa: price?.toString() ?? null, lineTotalPaisa: total?.toString() ?? null };
  });
  const priced = items.every(item => item.unitPricePaisa !== null);
  let total = priced ? items.reduce((sum, item) => sum + BigInt(item.lineTotalPaisa!), 0n) : money(raw.totalPaisa, "totalPaisa");
  if (priced && raw.totalPaisa !== undefined && money(raw.totalPaisa, "totalPaisa") !== total) invalid("totalPaisa", "The stated total does not match the calculated item total.");
  total = money(total.toString(), "totalPaisa");
  const dueString = text(raw.dueAt, "dueAt", 40);
  const due = new Date(dueString);
  if (!/(?:Z|[+-]\d{2}:\d{2})$/i.test(dueString) || !Number.isFinite(due.getTime()) || due.getTime() < Date.now() - 30 * 86400000 || due.getTime() > Date.now() + 366 * 86400000) invalid("dueAt", "Use an explicit timezone and a due date within the supported range (30 days past to one year ahead).");
  try { instructionDueDate(dueString); } catch { invalid("dueAt", "Use a real calendar date and valid time."); }
  return { items, pricingMode: priced ? "PRICED" : "DESCRIPTIVE", totalPaisa: total.toString(), dueAt: due.toISOString(), notes: raw.notes === undefined || raw.notes === null ? null : text(raw.notes, "notes", 2000, false, true) || null };
}

export async function normalizeFinancial(tx: Tx, owner: Owner, intent: ProposalIntent, value: unknown): Promise<FinancialPayload> {
  if (intent === "SEND_CUSTOMER_UPDATE" || !Object.hasOwn(sourceKeys, intent)) throw new DomainError("UNSUPPORTED_ACTION", 422, "That action is not supported here.");
  const raw = object(value, sourceKeys[intent]);
  if (intent === "CREATE_ORDER" || intent === "UPDATE_ORDER") {
    const existing = intent === "UPDATE_ORDER" ? await order(tx, owner, raw.orderId) : null;
    if (existing && existing.status !== "PENDING") throw new DomainError("ORDER_CLOSED", 409, "Only pending orders can be edited.");
    const c = await customer(tx, owner, existing?.customerId ?? raw.customerId);
    if (c.record.isWalkIn) invalid("customerId", "Choose a named customer for an order.");
    return { ...c.fields, ...orderDetails(raw), ...(existing ? { orderId: existing.id, orderVersion: existing.version } : {}) };
  }
  if (intent === "CHANGE_ORDER_STATUS") {
    const existing = await order(tx, owner, raw.orderId);
    if (existing.status !== "PENDING") throw new DomainError("ORDER_CLOSED", 409, "This order is already fulfilled or cancelled.");
    if (raw.status !== "FULFILLED" && raw.status !== "CANCELLED") invalid("status", "Choose fulfilled or cancelled.");
    return { ...(await customer(tx, owner, existing.customerId)).fields, orderId: existing.id, orderVersion: existing.version, status: raw.status };
  }
  if (intent === "POST_SALE") {
    const c = await customer(tx, owner, raw.customerId);
    const linked = raw.orderId ? await order(tx, owner, raw.orderId) : null;
    if (linked && (linked.status !== "FULFILLED" || linked.customerId !== c.record.id)) invalid("orderId", "Choose a fulfilled order for this customer.");
    if (linked && await tx.sale.findFirst({ where: { tenantId: owner.tenantId, orderId: linked.id } })) throw new DomainError("SALE_EXISTS", 409, "This order already has a sale, including reversed history.");
    const total = money(raw.totalPaisa, "totalPaisa"), received = money(raw.receivedPaisa ?? "0", "receivedPaisa", true);
    if (linked && total !== linked.totalPaisa) invalid("totalPaisa", "Sale total must match the approved order.");
    if (received > total || (c.record.isWalkIn && received !== total)) invalid("receivedPaisa", "Receipts cannot exceed the total; walk-in sales must be fully paid.");
    const dueAt = received < total ? (raw.dueAt === undefined || raw.dueAt === null || raw.dueAt === "" ? nextMonthFirst() : text(raw.dueAt, "dueAt", 40)) : null;
    if (dueAt && (!/(?:Z|[+-]\d{2}:\d{2})$/i.test(dueAt) || !Number.isFinite(Date.parse(dueAt)))) invalid("dueAt", "Use a valid repayment date and time in Pakistan time.");
    if (dueAt) { try { instructionDueDate(dueAt); } catch { invalid("dueAt", "Use a real repayment calendar date and valid time."); } }
    return { ...c.fields, dueAt: dueAt ? new Date(dueAt).toISOString() : null, totalPaisa: total.toString(), receivedPaisa: received.toString(), method: method(raw.method), resultingBalancePaisa: (c.balance + total - received).toString(), ...(linked ? { orderId: linked.id, orderVersion: linked.version } : {}) };
  }
  if (intent === "RECORD_PAYMENT") {
    const c = await customer(tx, owner, raw.customerId);
    const amount = money(raw.amountPaisa, "amountPaisa");
    if (c.record.isWalkIn || amount > c.balance) invalid("amountPaisa", "Payment exceeds this customer's outstanding balance. Advances and overpayments are not supported.");
    let selectedSales: string[] | null = null;
    if (raw.allocations !== undefined) {
      if (!Array.isArray(raw.allocations) || !raw.allocations.length || raw.allocations.length > 100) invalid("allocations", "Allocate this receipt to 1–100 open sales.");
      selectedSales = raw.allocations.map(value => id(object(value, ["saleId", "amountPaisa"]).saleId, "saleId"));
    }
    const open = await tx.$queryRaw<{ id: string; version: number; due: bigint }[]>(Prisma.sql`
      SELECT s.id,s.version,(s."totalPaisa"-COALESCE(SUM(a."amountPaisa"),0))::bigint AS due FROM "Sale" s
      LEFT JOIN "PaymentAllocation" a ON a."tenantId"=s."tenantId" AND a."saleId"=s.id AND a."reversedAt" IS NULL
      WHERE s."tenantId"=${owner.tenantId}::uuid AND s."customerId"=${c.record.id}::uuid AND s.status='POSTED'
      ${selectedSales ? Prisma.sql`AND s.id IN (${Prisma.join(selectedSales.map(value => Prisma.sql`${value}::uuid`))})` : Prisma.empty}
      GROUP BY s.id,s.version,s."totalPaisa",s."postedAt" HAVING s."totalPaisa">COALESCE(SUM(a."amountPaisa"),0)
      ORDER BY s."postedAt",s.id LIMIT 100
    `);
    const allocations: Allocation[] = [];
    if (raw.allocations !== undefined) {
      if (!Array.isArray(raw.allocations) || !raw.allocations.length || raw.allocations.length > 100) invalid("allocations", "Allocate this receipt to 1–100 open sales.");
      const seen = new Set<string>();
      for (const item of raw.allocations) {
        const allocation = object(item, ["saleId", "amountPaisa"]), saleId = id(allocation.saleId, "saleId");
        const sale = open.find(sale => sale.id === saleId);
        const allocated = money(allocation.amountPaisa, "allocations.amountPaisa");
        if (!sale || seen.has(saleId) || allocated > sale.due) invalid("allocations", "An allocation is duplicated, unavailable, or above the sale balance.");
        seen.add(saleId); allocations.push({ saleId, amountPaisa: allocated.toString(), saleVersion: sale.version });
      }
    } else {
      let remaining = amount;
      for (const sale of open) { if (remaining === 0n) break; const allocated = remaining < sale.due ? remaining : sale.due; allocations.push({ saleId: sale.id, amountPaisa: allocated.toString(), saleVersion: sale.version }); remaining -= allocated; }
    }
    if (allocations.reduce((sum, item) => sum + BigInt(item.amountPaisa), 0n) !== amount) invalid("allocations", "Allocations must exactly equal the payment and cover no more than 100 sales. Record smaller receipts when needed.");
    return { ...c.fields, amountPaisa: amount.toString(), method: method(raw.method), allocations, resultingBalancePaisa: (c.balance - amount).toString() };
  }
  const saleMode = intent === "REVERSE_SALE";
  const recordId = id(saleMode ? raw.saleId : raw.paymentId, saleMode ? "saleId" : "paymentId");
  const source = saleMode ? await tx.sale.findFirst({ where: { tenantId: owner.tenantId, id: recordId } }) : await tx.payment.findFirst({ where: { tenantId: owner.tenantId, id: recordId } });
  if (!source) throw new DomainError("NOT_FOUND", 404, "Financial record not found.");
  if (source.status !== "POSTED") throw new DomainError("ALREADY_REVERSED", 409, "This record has already been reversed.");
  const c = await customer(tx, owner, source.customerId);
  if (saleMode && await tx.paymentAllocation.count({ where: { tenantId: owner.tenantId, saleId: recordId, reversedAt: null } })) invalid("saleId", "Reverse this sale's payments before reversing the sale.");
  const amount = "totalPaisa" in source ? source.totalPaisa : source.amountPaisa;
  if (saleMode && c.balance < amount) invalid("saleId", "Reversal would create a negative receivable.");
  return { ...c.fields, ...(saleMode ? { saleId: recordId } : { paymentId: recordId }), amountPaisa: amount.toString(), sourceVersion: source.version, reason: text(raw.reason, "reason", 500), resultingBalancePaisa: (saleMode ? c.balance - amount : c.balance + amount).toString() };
}
