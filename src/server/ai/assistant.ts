import type { PrismaClient } from "../../generated/prisma/client.ts";
import type { VerifiedIdentity } from "../domain/identity.ts";
import { DomainError } from "../errors.ts";
import { object, text } from "../domain/validation.ts";
import { type Mutation } from "../domain/tenancy.ts";
import { createProposal } from "../domain/proposals.ts";
import { comparableName, financialText } from "../../lib/human-text.ts";
import { formatPkr } from "../../lib/money.ts";
import { dashboard, ledger } from "../domain/reports.ts";
import { groundedAmounts, validateExtraction, type Extraction } from "./contract.ts";
import { fitsContext, tokenCost, type AISettings, type ModelAdapter } from "./gemini.ts";
import { instructionDueDate } from "../../lib/instruction-date.ts";
import { matchCustomer, type CustomerMatch } from "./customer-match.ts";
import { reserveAI, settleAI, startAI } from "./metering.ts";

export type AssistantResult = { kind: "customer_required"; message: string; customerName: string; reason: "missing" | "ambiguous" | "archived"; matches: CustomerMatch[] } | { kind: "clarification"; message: string } | { kind: "proposal"; proposalId: string; message: string } | { kind: "summary"; message: string } | { kind: "unavailable"; message: string };
const clarification = (message: string): AssistantResult => ({ kind: "clarification", message });

async function resolveExtraction(db: PrismaClient, identity: VerifiedIdentity, extraction: Extraction, instruction: string, executionId: string, now: Date, selectedCustomer?: string): Promise<AssistantResult> {
  const needsDueDate = extraction.intent === "draft_order" || extraction.intent === "draft_sale" && extraction.statedTotalPaisa !== null && extraction.statedReceivedPaisa !== null && BigInt(extraction.statedTotalPaisa) > BigInt(extraction.statedReceivedPaisa);
  if (needsDueDate) {
    try {
      extraction = { ...extraction, dueAtCandidate: instructionDueDate(instruction, now) };
      const remaining = extraction.missingFields.filter(field => !/^(?:dueAt|dueAtCandidate|dueDate|due_date|date|time|timezone|dueTime)$/i.test(field));
      if (remaining.length === 0 && (extraction.missingFields.length > 0 || /(?:due date|date and time|timezone)/i.test(extraction.clarification ?? ""))) extraction = { ...extraction, missingFields: [], clarification: null };
      else extraction = { ...extraction, missingFields: remaining };
    } catch (error) { return clarification((error as Error).message); }
  }
  groundedAmounts(extraction, instruction);
  if (extraction.missingFields.length || extraction.intent === "unknown" || extraction.clarification) return clarification(extraction.clarification || "Please include the customer, exact amount, and action. You can also use manual entry.");
  if (extraction.intent === "query_summary" && extraction.customerCandidates.length === 0) return { kind: "summary", message: (await dashboard(db, identity)).summary };
  if (extraction.customerCandidates.length !== 1) return clarification("Which customer is this for? Choose an existing customer in the manual form.");
  const candidate = extraction.customerCandidates[0];
  const match = await matchCustomer(db, identity, candidate, selectedCustomer);
  if (!match.customer) return { kind: "customer_required", customerName: candidate, reason: match.reason!, matches: match.matches, message: match.reason === "archived" ? "This customer is archived. Restore them in Customers, then retry." : match.matches.length ? "Choose the correct customer below. No record has been posted." : "This customer is new to your workspace. Add them below, then prepare your draft." };
  const customerId = match.customer.id;
  if (extraction.intent === "query_summary") return { kind: "summary", message: `${match.customer.name}: outstanding ${formatPkr((await ledger(db, identity, customerId, new URLSearchParams())).balancePaisa)}.` };
  const methodSource = comparableName(instruction).replace(comparableName(candidate), "");
  const methods = [/(?:\bbank\b|\braast\b|بینک)/iu.test(methodSource) ? "BANK_TRANSFER" : null, /(?:\bcash\b|نقد)/iu.test(methodSource) ? "CASH" : null, /(?:jazzcash|easypaisa|جاز\s*کیش|ایزی\s*پیسہ)/iu.test(methodSource) ? "OTHER" : null].filter(Boolean);
  if (methods.length > 1 && extraction.intent !== "draft_order") return clarification("Several receipt methods were mentioned. Record each confirmed receipt separately, or review the method in the manual form.");
  const method = methods[0] ?? "CASH";
  let intent: string, payload: Record<string, unknown>;
  if (extraction.intent === "draft_order") {
    if (!extraction.dueAtCandidate || !extraction.items.length) return clarification("Please enter the order items with quantities and an explicit due date and time.");
    intent = "CREATE_ORDER";
    payload = { customerId, dueAt: extraction.dueAtCandidate, items: extraction.items.map(item => ({ description: item.description, quantity: item.quantity, ...(item.unitPricePaisa === null ? {} : { unitPricePaisa: item.unitPricePaisa }) })), ...(extraction.statedTotalPaisa ? { totalPaisa: extraction.statedTotalPaisa } : {}) };
  } else if (extraction.intent === "draft_sale") {
    if (!extraction.statedTotalPaisa || extraction.statedReceivedPaisa === null) return clarification("What was the sale total, and how much money did you receive now? State 0 if none.");
    intent = "POST_SALE"; payload = { customerId, totalPaisa: extraction.statedTotalPaisa, receivedPaisa: extraction.statedReceivedPaisa, method, ...(extraction.dueAtCandidate ? { dueAt: extraction.dueAtCandidate } : {}) };
  } else {
    if (!extraction.statedReceivedPaisa || extraction.statedReceivedPaisa === "0") return clarification("What exact payment amount have you received? Confirm the receipt in the payment form.");
    intent = "RECORD_PAYMENT"; payload = { customerId, amountPaisa: extraction.statedReceivedPaisa, method };
  }
  try {
    const proposal = await createProposal(db, identity, { key: `ai-${executionId}`, requestId: executionId }, { intent, payload });
    return { kind: "proposal", proposalId: proposal.id, message: "A draft is ready in Approvals. Review the customer, amounts, receipt method, and date before approving." };
  } catch (error) {
    if (error instanceof DomainError) return clarification(Object.values(error.fieldErrors ?? {}).join(" ") || error.message);
    if (error instanceof Error && /Amount|quantity|paisa|price|total/i.test(error.message)) return clarification("These details need a manual review. Open the order, sale, or payment form to check the customer, amount, balance, and due date.");
    throw error;
  }
}

export async function processInstruction(db: PrismaClient, identity: VerifiedIdentity, mutation: Mutation, body: unknown, settings: AISettings, adapter: ModelAdapter, now = new Date()): Promise<AssistantResult> {
  const input = object(body, ["text", "customerId"]), instruction = text(input.text, "text", Math.min(settings.textCharacters ?? 2000, 2000), true, true);
  const selectedCustomer = input.customerId === undefined ? undefined : text(input.customerId, "customerId", 36);
  if (selectedCustomer) await matchCustomer(db, identity, "", selectedCustomer);
  if (/-\s*\d/.test(financialText(instruction))) return clarification("Negative amounts are not supported. Use a reversal to correct a posted record.");
  if (/\b(?:loans?|lend|lending|advances?|qarz|karz)\b|قرض|پیشگی/iu.test(instruction)) return clarification("Cash loans and advances are not supported. You can record a customer credit sale or a confirmed payment against an existing sale.");
  if (/\b(?:USD|EUR|GBP|AED|SAR|INR|dollars?|euros?)\b|[$€£]/iu.test(instruction)) return clarification("Only PKR is supported. Enter an explicit PKR amount in the manual form.");
  if (!fitsContext(instruction, settings)) return clarification("This message is too long for the assistant’s safe context limit. Shorten it or use manual entry.");
  const reservation = await reserveAI(db, identity, mutation, selectedCustomer ? JSON.stringify({ instruction, customerId: selectedCustomer }) : instruction, settings, now);
  const execution = reservation.execution;
  if (!reservation.fresh) {
    if (execution.status === "COMPLETED" || execution.status === "FAILED") return execution.result as AssistantResult;
    throw new DomainError("AI_IN_PROGRESS", 409, "This instruction is still being checked. Do not submit it again with a new key; manual entry remains available.");
  }
  if (!await startAI(db, execution.id, execution.tenantId)) throw new DomainError("AI_IN_PROGRESS", 409, "This instruction is already being processed.");
  let cost = 0n, calls = 0, inputTokens = 0, outputTokens = 0;
  let result: AssistantResult = { kind: "unavailable", message: "The assistant could not safely process this instruction. No financial record was posted. Use manual entry." };
  let extraction: Extraction | null = null;
  for (let attempt = 0; attempt < settings.calls; attempt++) {
    const claimed = await db.aIExecution.updateMany({ where: { id: execution.id, tenantId: execution.tenantId, status: "PROCESSING", calls: attempt }, data: { calls: { increment: 1 } } });
    if (!claimed.count) break;
    calls++;
    try {
      const reply = await adapter(instruction, attempt > 0, settings);
      if (!Number.isInteger(reply.inputTokens) || reply.inputTokens < 0 || reply.inputTokens > settings.inputTokens || !Number.isInteger(reply.outputTokens) || reply.outputTokens < 0 || reply.outputTokens > settings.outputTokens) throw new Error("Invalid usage.");
      extraction = validateExtraction(reply.extraction);
      cost += tokenCost(reply.inputTokens, reply.outputTokens, settings); inputTokens += reply.inputTokens; outputTokens += reply.outputTokens;
      break;
    } catch {
      // Unknown provider acceptance/usage is charged conservatively, including
      // schema failures. A retry consumes the second, already reserved call.
      cost += tokenCost(settings.inputTokens, settings.outputTokens, settings);
    }
  }
  if (extraction) {
    try { result = await resolveExtraction(db, identity, extraction, instruction, execution.id, now, selectedCustomer); }
    catch (error) { if (error instanceof DomainError) result = clarification(error.message); else throw error; }
  }
  await settleAI(db, execution.id, execution.tenantId, { usable: result.kind !== "unavailable", cost, calls, inputTokens, outputTokens, result });
  return result;
}
