import type { FinancialPayload } from "../domain/financial-normalization.ts";
import { formatPkr } from "../../lib/money.ts";

export function financialPreview(intent: string, p: FinancialPayload, command: string | null, expiresAt?: string) {
  const titles: Record<string, string> = { CREATE_ORDER: "New order", UPDATE_ORDER: "Edit order", CHANGE_ORDER_STATUS: "Order status", POST_SALE: "Sale", RECORD_PAYMENT: "Confirmed payment", REVERSE_SALE: "Reverse sale", REVERSE_PAYMENT: "Reverse payment" };
  const lines = [`Draft: ${titles[intent] ?? "Review in dashboard"}`, `Customer: ${p.customerName ?? "Review in dashboard"}`];
  if (p.customerId) lines.push(`Customer reference: ${p.customerId}`);
  if (p.orderId) lines.push(`Order reference: ${p.orderId}`);
  if (p.saleId) lines.push(`Sale reference: ${p.saleId}`);
  if (p.paymentId) lines.push(`Payment reference: ${p.paymentId}`);
  if (p.totalPaisa) lines.push(`Total: ${formatPkr(p.totalPaisa)}`);
  if (p.receivedPaisa !== undefined) lines.push(`Received now: ${formatPkr(p.receivedPaisa)}`);
  if (p.amountPaisa) lines.push(`Confirmed receipt: ${formatPkr(p.amountPaisa)}`);
  if (p.resultingBalancePaisa !== undefined) lines.push(`Outstanding after approval: ${formatPkr(p.resultingBalancePaisa)}`);
  if (p.expectedBalancePaisa !== undefined) lines.push(`Current outstanding: ${formatPkr(p.expectedBalancePaisa)}`);
  if (p.method) lines.push(`Receipt method: ${p.method}`);
  if (p.dueAt) lines.push(`Due (Pakistan): ${new Intl.DateTimeFormat("en-PK", { timeZone: "Asia/Karachi", dateStyle: "medium", timeStyle: "short" }).format(new Date(p.dueAt))}`);
  if (p.items) lines.push(...p.items.map(item => `${item.quantity} × ${item.description}${item.unitPricePaisa !== null ? `; unit ${formatPkr(item.unitPricePaisa)}` : "; unit price not specified"}${item.lineTotalPaisa !== null ? `; line ${formatPkr(item.lineTotalPaisa)}` : ""}`));
  if (p.allocations) lines.push(...p.allocations.map(item => `Allocate ${formatPkr(item.amountPaisa)} to sale ${item.saleId}`));
  if (p.notes) lines.push(`Notes: ${p.notes}`);
  if (p.status) lines.push(`Status: ${p.status}`);
  if (p.reason) lines.push(`Reason: ${p.reason}`);
  if (intent.includes("ORDER")) lines.push("Order only: no sale or payment is posted by this action.");
  const details = lines.join("\n");
  // Never truncate the financial preview to fit an approval command. Large
  // orders must be reviewed in the dashboard, with no misleading partial view.
  if (!command || details.length > 1300) return "A draft is ready. Open Approvals in the dashboard to review every detail and approve it. Nothing has been posted.";
  const expiry = expiresAt ? new Intl.DateTimeFormat("en-PK", { timeZone: "Asia/Karachi", dateStyle: "medium", timeStyle: "short" }).format(new Date(expiresAt)) : "the expiry shown in the dashboard";
  return `${details}\n\nNothing posted. If every detail is correct, reply with this exact command before ${expiry} (Pakistan):\n${command}\nUse the dashboard to edit/reject. A plain yes does not approve.`;
}
