import type { ProposalIntent } from "../../generated/prisma/client.ts";
import type { FinancialPayload } from "./financial-normalization.ts";
import type { Owner, Tx } from "./tenancy.ts";
import { stopForOrder } from "../workflows/persistence.ts";

export async function postPayment(tx: Tx, owner: Owner, proposalId: string, payload: FinancialPayload) {
  const payment = await tx.payment.create({ data: { tenantId: owner.tenantId, customerId: payload.customerId!, proposalId, amountPaisa: BigInt(payload.amountPaisa!), method: payload.method! } });
  for (const allocation of payload.allocations!) {
    await tx.paymentAllocation.create({ data: { tenantId: owner.tenantId, customerId: payload.customerId!, paymentId: payment.id, saleId: allocation.saleId, amountPaisa: BigInt(allocation.amountPaisa) } });
    await tx.sale.updateMany({ where: { tenantId: owner.tenantId, id: allocation.saleId, status: "POSTED" }, data: { version: { increment: 1 } } });
  }
  await tx.ledgerEntry.create({ data: { tenantId: owner.tenantId, customerId: payload.customerId!, paymentId: payment.id, direction: "CREDIT", kind: "PAYMENT", amountPaisa: payment.amountPaisa } });
  return payment.id;
}

export async function executeFinancial(tx: Tx, owner: Owner, proposalId: string, intent: ProposalIntent, p: FinancialPayload): Promise<Record<string, string | boolean>> {
  const tenantId = owner.tenantId;
  if (intent === "CREATE_ORDER") {
    const order = await tx.order.create({ data: { tenantId, customerId: p.customerId!, proposalId, totalPaisa: BigInt(p.totalPaisa!), dueAt: new Date(p.dueAt!), notes: p.notes, pricingMode: p.pricingMode!, items: { create: p.items!.map(item => ({ description: item.description, quantity: item.quantity, unitPricePaisa: item.unitPricePaisa === null ? null : BigInt(item.unitPricePaisa), lineTotalPaisa: item.lineTotalPaisa === null ? null : BigInt(item.lineTotalPaisa) })) } } });
    return { orderId: order.id };
  }
  if (intent === "UPDATE_ORDER") {
    const previous = await tx.order.findFirstOrThrow({ where: { tenantId, id: p.orderId! } });
    await tx.orderItem.deleteMany({ where: { tenantId, orderId: p.orderId! } });
    await tx.order.update({ where: { tenantId_id: { tenantId, id: p.orderId! } }, data: { totalPaisa: BigInt(p.totalPaisa!), dueAt: new Date(p.dueAt!), notes: p.notes, pricingMode: p.pricingMode!, version: { increment: 1 }, items: { create: p.items!.map(item => ({ description: item.description, quantity: item.quantity, unitPricePaisa: item.unitPricePaisa === null ? null : BigInt(item.unitPricePaisa), lineTotalPaisa: item.lineTotalPaisa === null ? null : BigInt(item.lineTotalPaisa) })) } } });
    const dueDateChanged = previous.dueAt.toISOString() !== p.dueAt;
    if (dueDateChanged) await stopForOrder(tx, tenantId, p.orderId!, "NEEDS_HUMAN", "DUE_DATE_CHANGED");
    return { orderId: p.orderId!, dueDateChanged };
  }
  if (intent === "CHANGE_ORDER_STATUS") {
    await tx.order.update({ where: { tenantId_id: { tenantId, id: p.orderId! } }, data: { status: p.status!, version: { increment: 1 }, ...(p.status === "FULFILLED" ? { fulfilledAt: new Date() } : { cancelledAt: new Date() }) } });
    await stopForOrder(tx, tenantId, p.orderId!, p.status === "FULFILLED" ? "RESOLVED" : "CANCELLED", p.status === "FULFILLED" ? "ORDER_FULFILLED" : "ORDER_CANCELLED");
    return { orderId: p.orderId!, status: p.status! };
  }
  if (intent === "POST_SALE") {
    const businessDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
    const sale = await tx.sale.create({ data: { tenantId, customerId: p.customerId!, proposalId, totalPaisa: BigInt(p.totalPaisa!), businessDate, dueAt: p.dueAt ? new Date(p.dueAt) : null, orderId: p.orderId } });
    await tx.ledgerEntry.create({ data: { tenantId, customerId: p.customerId!, saleId: sale.id, direction: "DEBIT", kind: "SALE", amountPaisa: sale.totalPaisa } });
    const result: Record<string, string> = { saleId: sale.id };
    if (BigInt(p.receivedPaisa!) > 0n) result.paymentId = await postPayment(tx, owner, proposalId, { customerId: p.customerId, amountPaisa: p.receivedPaisa, method: p.method, allocations: [{ saleId: sale.id, amountPaisa: p.receivedPaisa!, saleVersion: sale.version }] });
    return result;
  }
  if (intent === "RECORD_PAYMENT") return { paymentId: await postPayment(tx, owner, proposalId, p) };
  if (intent === "REVERSE_PAYMENT") {
    const original = await tx.ledgerEntry.findFirstOrThrow({ where: { tenantId, paymentId: p.paymentId, kind: "PAYMENT" } });
    const allocations = await tx.paymentAllocation.findMany({ where: { tenantId, paymentId: p.paymentId, reversedAt: null } });
    const reversal = await tx.reversal.create({ data: { tenantId, ownerUserId: owner.userId, proposalId, paymentId: p.paymentId, reason: p.reason! } });
    await tx.paymentAllocation.updateMany({ where: { tenantId, paymentId: p.paymentId, reversedAt: null }, data: { reversedAt: new Date() } });
    for (const allocation of allocations) await tx.sale.updateMany({ where: { tenantId, id: allocation.saleId }, data: { version: { increment: 1 } } });
    await tx.payment.update({ where: { tenantId_id: { tenantId, id: p.paymentId! } }, data: { status: "REVERSED", version: { increment: 1 } } });
    await tx.ledgerEntry.create({ data: { tenantId, customerId: p.customerId!, paymentId: p.paymentId, direction: "DEBIT", kind: "PAYMENT_REVERSAL", amountPaisa: BigInt(p.amountPaisa!), reversalOfId: original.id } });
    return { reversalId: reversal.id, paymentId: p.paymentId! };
  }
  if (intent === "REVERSE_SALE") {
    const original = await tx.ledgerEntry.findFirstOrThrow({ where: { tenantId, saleId: p.saleId, kind: "SALE" } });
    const reversal = await tx.reversal.create({ data: { tenantId, ownerUserId: owner.userId, proposalId, saleId: p.saleId, reason: p.reason! } });
    await tx.sale.update({ where: { tenantId_id: { tenantId, id: p.saleId! } }, data: { status: "REVERSED", version: { increment: 1 } } });
    await tx.ledgerEntry.create({ data: { tenantId, customerId: p.customerId!, saleId: p.saleId, direction: "CREDIT", kind: "SALE_REVERSAL", amountPaisa: BigInt(p.amountPaisa!), reversalOfId: original.id } });
    return { reversalId: reversal.id, saleId: p.saleId! };
  }
  throw new Error("Unsupported financial execution intent.");
}
