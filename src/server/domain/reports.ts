import { Prisma, type PrismaClient } from "../../generated/prisma/client.ts";
import { formatPkr } from "../../lib/money.ts";
import { DomainError } from "../errors.ts";
import type { VerifiedIdentity } from "./identity.ts";
import { audit, withOwner } from "./tenancy.ts";
import { customerBalance } from "./financial-normalization.ts";
import { invalid, text, uuid } from "./validation.ts";
import { jsonSafe } from "./proposals.ts";

export function businessDate(now = new Date()) { return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi", year: "numeric", month: "2-digit", day: "2-digit" }).format(now); }
export function dayRange(from = businessDate(), to = from) {
  for (const value of [from, to]) if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) invalid("date", "Choose valid calendar dates.");
  const start = new Date(from + "T00:00:00+05:00"), end = new Date(Date.parse(to + "T00:00:00+05:00") + 86400000);
  if (end <= start || end.getTime() - start.getTime() > 366 * 86400000) invalid("date", "Choose an ordered date range of no more than one year.");
  return { from, to, start, end };
}

export function dashboard(db: PrismaClient, identity: VerifiedIdentity, date?: string) {
  const range = dayRange(date);
  return withOwner(db, identity, async (tx, owner) => {
    const rows = await tx.$queryRaw<{ sales: string; collections: string; outstanding: string }[]>(Prisma.sql`
      SELECT COALESCE(SUM(CASE WHEN "effectiveAt" >= ${range.start} AND "effectiveAt" < ${range.end} THEN CASE WHEN kind = 'SALE' THEN "amountPaisa" WHEN kind = 'SALE_REVERSAL' THEN -"amountPaisa" ELSE 0 END ELSE 0 END),0)::text AS sales,
      COALESCE(SUM(CASE WHEN "effectiveAt" >= ${range.start} AND "effectiveAt" < ${range.end} THEN CASE WHEN kind = 'PAYMENT' THEN "amountPaisa" WHEN kind = 'PAYMENT_REVERSAL' THEN -"amountPaisa" ELSE 0 END ELSE 0 END),0)::text AS collections,
      COALESCE(SUM(CASE WHEN direction = 'DEBIT' THEN "amountPaisa" ELSE -"amountPaisa" END),0)::text AS outstanding
      FROM "LedgerEntry" WHERE "tenantId" = ${owner.tenantId}::uuid
    `);
    const pendingOrders = await tx.order.count({ where: { tenantId: owner.tenantId, status: "PENDING" } });
    const pendingApprovals = await tx.aIActionProposal.count({ where: { tenantId: owner.tenantId, status: "READY", expiresAt: { gt: new Date() } } });
    const recent = await tx.ledgerEntry.findMany({ where: { tenantId: owner.tenantId }, orderBy: [{ effectiveAt: "desc" }, { id: "desc" }], take: 5, include: { customer: { select: { name: true } } } });
    return { date: range.from, salesPaisa: rows[0].sales, collectionsPaisa: rows[0].collections, outstandingPaisa: rows[0].outstanding, pendingOrders, pendingApprovals, recent: recent.map(entry => ({ id: entry.id, customerName: entry.customer.name, kind: entry.kind, amountPaisa: entry.amountPaisa.toString(), effectiveAt: entry.effectiveAt.toISOString() })), summary: `Recorded sales ${formatPkr(rows[0].sales)}; owner-confirmed receipts ${formatPkr(rows[0].collections)}; total current outstanding ${formatPkr(rows[0].outstanding)}. ${pendingOrders} pending orders.` };
  });
}

export function financialCustomers(db: PrismaClient, identity: VerifiedIdentity, query = "") {
  const q = text(query, "q", 100, false);
  return withOwner(db, identity, (tx, owner) => tx.customer.findMany({ where: { tenantId: owner.tenantId, archivedAt: null, ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { phoneE164: { contains: q } }] } : {}) }, select: { id: true, name: true, phoneE164: true, isWalkIn: true }, orderBy: [{ isWalkIn: "desc" }, { name: "asc" }], take: 100 }));
}

export type RecordKind = "orders" | "sales" | "payments" | "proposals";
export function listRecords(db: PrismaClient, identity: VerifiedIdentity, kind: RecordKind, params: URLSearchParams) {
  if ([...params.keys()].some(key => !["limit", "cursor", "status", "customerId"].includes(key))) invalid("query", "Unsupported filter.");
  const limit = Number(params.get("limit") ?? 25), cursor = params.get("cursor"), customerId = params.get("customerId"), status = params.get("status");
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) invalid("limit", "Use a limit from 1 to 100.");
  if (cursor) uuid(cursor, "cursor"); if (customerId) uuid(customerId, "customerId");
  const statuses = kind === "orders" ? ["PENDING", "FULFILLED", "CANCELLED"] : kind === "proposals" ? ["READY", "EXECUTED", "REJECTED", "EXPIRED", "DRAFT", "NEEDS_CLARIFICATION", "FAILED"] : ["POSTED", "REVERSED"];
  if (status && !statuses.includes(status)) invalid("status", "Unsupported status.");
  if (kind === "proposals" && customerId) invalid("customerId", "Filter financial records by customer instead.");
  return withOwner(db, identity, async (tx, owner) => {
    const tenantId = owner.tenantId;
    if (cursor) {
      const where = { tenantId, id: cursor };
      const exists = kind === "orders" ? await tx.order.findFirst({ where }) : kind === "sales" ? await tx.sale.findFirst({ where }) : kind === "payments" ? await tx.payment.findFirst({ where }) : await tx.aIActionProposal.findFirst({ where });
      if (!exists) throw new DomainError("NOT_FOUND", 404, "Page cursor not found.");
    }
    const paging = { take: limit + 1, ...(cursor ? { cursor: { tenantId_id: { tenantId, id: cursor } }, skip: 1 } : {}) };
    let items;
    if (kind === "orders") items = await tx.order.findMany({ where: { tenantId, ...(customerId ? { customerId } : {}), ...(status ? { status: status as "PENDING" | "FULFILLED" | "CANCELLED" } : {}) }, include: { customer: { select: { id: true, name: true, phoneE164: true } }, items: true, sale: { select: { id: true, status: true } } }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], ...paging });
    else if (kind === "sales") items = await tx.sale.findMany({ where: { tenantId, ...(customerId ? { customerId } : {}), ...(status ? { status: status as "POSTED" | "REVERSED" } : {}) }, include: { customer: { select: { id: true, name: true } }, allocations: { where: { reversedAt: null } } }, orderBy: [{ postedAt: "desc" }, { id: "desc" }], ...paging });
    else if (kind === "payments") items = await tx.payment.findMany({ where: { tenantId, ...(customerId ? { customerId } : {}), ...(status ? { status: status as "POSTED" | "REVERSED" } : {}) }, include: { customer: { select: { id: true, name: true } }, allocations: true }, orderBy: [{ receivedAt: "desc" }, { id: "desc" }], ...paging });
    else items = await tx.aIActionProposal.findMany({ where: { tenantId, ...(status ? { status: status as "READY" | "EXECUTED" | "REJECTED" | "EXPIRED" | "DRAFT" | "NEEDS_CLARIFICATION" | "FAILED" } : {}) }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], ...paging });
    return jsonSafe({ items: items.slice(0, limit), nextCursor: items.length > limit ? items[limit - 1].id : null });
  });
}

export function ledger(db: PrismaClient, identity: VerifiedIdentity, customerId: string, params: URLSearchParams) {
  uuid(customerId);
  if ([...params.keys()].some(key => !["limit", "cursor"].includes(key))) invalid("query", "Unsupported filter.");
  const limit = Number(params.get("limit") ?? 50), cursor = params.get("cursor");
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) invalid("limit", "Use a limit from 1 to 100.");
  if (cursor) uuid(cursor, "cursor");
  return withOwner(db, identity, async (tx, owner) => {
    const tenantId = owner.tenantId;
    const customer = await tx.customer.findFirst({ where: { tenantId, id: customerId }, select: { id: true, name: true, archivedAt: true } });
    if (!customer) throw new DomainError("NOT_FOUND", 404, "Customer not found.");
    if (cursor && !await tx.ledgerEntry.findFirst({ where: { tenantId, customerId, id: cursor } })) throw new DomainError("NOT_FOUND", 404, "Page cursor not found.");
    const items = await tx.ledgerEntry.findMany({ where: { tenantId, customerId }, orderBy: [{ effectiveAt: "desc" }, { id: "desc" }], take: limit + 1, ...(cursor ? { cursor: { tenantId_id: { tenantId, id: cursor } }, skip: 1 } : {}) });
    return jsonSafe({ customer, balancePaisa: (await customerBalance(tx, tenantId, customerId)).toString(), items: items.slice(0, limit), nextCursor: items.length > limit ? items[limit - 1].id : null });
  });
}

function csvCell(value: string) { const safe = /^[=+\-@\t\r]/.test(value) ? "'" + value : value; return '"' + safe.replaceAll('"', '""') + '"'; }
export function exportLedger(db: PrismaClient, identity: VerifiedIdentity, requestId: string, params: URLSearchParams) {
  if ([...params.keys()].some(key => !["from", "to"].includes(key))) invalid("query", "Unsupported export filter.");
  const range = dayRange(params.get("from") ?? undefined, params.get("to") ?? undefined);
  return withOwner(db, identity, async (tx, owner) => {
    const rows = await tx.ledgerEntry.findMany({ where: { tenantId: owner.tenantId, effectiveAt: { gte: range.start, lt: range.end } }, include: { customer: { select: { name: true } } }, orderBy: [{ effectiveAt: "asc" }, { id: "asc" }], take: 10001 });
    if (rows.length > 10000) invalid("date", "This export exceeds 10,000 rows. Choose a smaller date range.");
    await audit(tx, owner, { key: "ledger-export", requestId }, "LEDGER_EXPORTED", "Tenant", owner.tenantId, ["from", "to"]);
    const header = ["Entry ID", "Customer", "Kind", "Direction", "Amount paisa", "Effective UTC", "Reverses entry"];
    const lines = rows.map(row => [row.id, row.customer.name, row.kind, row.direction, row.amountPaisa.toString(), row.effectiveAt.toISOString(), row.reversalOfId ?? ""]);
    return { csv: "\uFEFF" + [header, ...lines].map(line => line.map(csvCell).join(",")).join("\r\n"), filename: `dukaanpilot-ledger-${range.from}-${range.to}.csv` };
  });
}
