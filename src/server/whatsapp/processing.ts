import type { PrismaClient } from "../../generated/prisma/client.ts";
import { DomainError } from "../errors.ts";
import { withOwner } from "../domain/tenancy.ts";
import { approveProposal } from "../domain/proposals.ts";
import { getProposal } from "../domain/proposals.ts";
import type { FinancialPayload } from "../domain/financial-normalization.ts";
import { createContact } from "../domain/contacts.ts";
import { matchCustomer } from "../ai/customer-match.ts";
import { financialPreview } from "./financial-preview.ts";
import { dashboard } from "../domain/reports.ts";
import { processInstruction } from "../ai/assistant.ts";
import type { AISettings, ModelAdapter } from "../ai/gemini.ts";
import { consumePairingChallenge, createApprovalControl } from "./pairing.ts";
import { queueMessage } from "./updates.ts";
import type { ClaimedJob } from "../jobs.ts";
import { stopFollowUp } from "../workflows/engine.ts";

export async function processInbound(db: PrismaClient, job: ClaimedJob, ai?: { settings: AISettings; adapter: ModelAdapter }, now = new Date()) {
  const inbound = await db.inboundMessage.findFirst({ where: { tenantId: job.tenantId, id: job.entityId }, include: { conversation: true, tenant: true } });
  if (!inbound || inbound.state !== "PENDING") return;
  let outcome = "Owner review required. Customer messages cannot approve or confirm payments.", response: string | null = null;
  const body = inbound.body?.trim() ?? "";
  let responseExpiresAt = new Date(now.getTime() + 3600000);
  if (inbound.tenant.status !== "ACTIVE" || inbound.tenant.operationsPausedAt) outcome = "WORKSPACE_PAUSED";
  else if (body.startsWith("PAIR_HASH ")) {
    const paired = await consumePairingChallenge(db, job.tenantId, inbound.conversation.providerSenderId, inbound.conversationId, body, now);
    outcome = paired ? "OWNER_CHANNEL_PAIRED" : "PAIRING_REJECTED";
    response = paired ? "Your owner number is paired. Financial changes always need an exact approval control or dashboard approval." : null;
  } else {
    const ownerChannel = await db.ownerChannelIdentity.findFirst({ where: { tenantId: job.tenantId, providerSenderId: inbound.conversation.providerSenderId, revokedAt: null, owner: { status: "ACTIVE" } }, include: { owner: { include: { user: true } } } });
    if (ownerChannel) {
      const user = ownerChannel.owner.user, identity = { subject: user.authProviderSubject, uid: user.authProviderSubject.split(":").slice(2).join(":"), email: user.email, name: user.name };
      try {
        const approval = /^APPROVE_HASH ([a-f0-9]{64})$/.exec(body);
        const stop = /^STOP WORKFLOW ([0-9a-f-]{36})$/i.exec(body);
        const addCustomer = /^ADD CUSTOMER\s+(.{1,120})$/iu.exec(body);
        if (addCustomer) {
          const match = await matchCustomer(db, identity, addCustomer[1]);
          if (match.customer) response = "This customer already exists. Resend the original instruction to prepare a draft.";
          else if (match.reason === "archived") response = "This customer is archived. Restore them in the dashboard before recording a new action.";
          else if (match.matches.length) response = "Similar customers exist. Choose or create the correct customer in the dashboard, then resend the instruction.";
          else { await createContact(db, identity, "customers", { key: `inbound-contact-${inbound.id}`, requestId: inbound.id }, { name: addCustomer[1] }); response = "Customer added. Resend your original instruction to prepare a draft. No financial record has been posted."; }
          outcome = "OWNER_CUSTOMER_DIRECTORY";
        } else if (stop) {
          await stopFollowUp(db, identity, stop[1], { key: `inbound-stop-${inbound.id}`, requestId: inbound.id }, now);
          outcome = "OWNER_WORKFLOW_STOPPED"; response = "Follow-up stopped. Unsent workflow messages are cancelled.";
        } else if (approval) {
          const control = await db.channelApprovalControl.findFirst({ where: { tenantId: job.tenantId, identityId: ownerChannel.id, tokenHash: approval[1] } });
          if (!control) throw new DomainError("APPROVAL_NOT_FOUND", 403, "That approval is unavailable. Review it in the dashboard.");
          const saved = await approveProposal(db, identity, control.proposalId, { key: `channel-${control.id}`, requestId: inbound.id }, { version: control.version, payloadHash: control.payloadHash }, { identityId: ownerChannel.id, controlId: control.id, tokenHash: approval[1] });
          outcome = "OWNER_APPROVAL_EXECUTED"; response = `Approved and saved once. Reference ${Object.values(saved).find(value => typeof value === "string") ?? control.proposalId}. Check the dashboard for the record.`;
        } else if (/^(?:APPROVE|APPROVE_HASH|PAIR|PAIR_HASH)\b/iu.test(body)) {
          outcome = "MALFORMED_OWNER_CONTROL"; response = "Use the complete, current command shown with your draft or pairing request. A shortened or expired command cannot approve anything.";
        } else if (/^(?:summary|aaj ka hisaab|آج کا حساب)$/iu.test(body)) {
          outcome = "OWNER_SUMMARY"; response = (await dashboard(db, identity)).summary;
        } else if (/^(?:yes|haan|han|ji|ہاں|جی)$/iu.test(body)) {
          outcome = "UNBOUND_APPROVAL_REJECTED"; response = "A plain yes cannot approve a financial action. Review the exact preview in your dashboard or use its current approval control.";
        } else if (!body || !["text", "interactive", "button"].includes(inbound.type)) {
          outcome = "UNSUPPORTED_MEDIA"; response = "Please send text. Voice, images and documents are not supported yet.";
        } else if (ai) {
          // The authoritative owner/membership check is shared with web. Customer
          // origin never reaches the model or financial services.
          await withOwner(db, identity, async () => undefined);
          const selected = /^USE CUSTOMER ([0-9a-f-]{36})\s*\|\s*([\s\S]+)$/i.exec(body);
          const result = await processInstruction(db, identity, { key: `inbound-${inbound.id}`, requestId: inbound.id }, { text: selected ? selected[2] : body, ...(selected ? { customerId: selected[1] } : {}) }, ai.settings, ai.adapter, now);
          outcome = `OWNER_AI_${result.kind.toUpperCase()}`; response = result.message;
          if (result.kind === "proposal") {
            const proposal = await getProposal(db, identity, result.proposalId);
            const control = await createApprovalControl(db, identity, result.proposalId, { key: `inbound-control-${inbound.id}`, requestId: inbound.id });
            response = financialPreview(proposal.intent, proposal.payload as FinancialPayload, control.command, control.expiresAt);
            responseExpiresAt = new Date(control.expiresAt);
          } else if (result.kind === "customer_required") {
            response = result.reason === "missing" && !result.matches.length
              ? `Customer '${result.customerName}' is not in your workspace. To create them, reply ADD CUSTOMER ${result.customerName}, then resend this instruction. Nothing has been posted.`
              : `${result.message}\n${result.matches.map(customer => `${customer.name} ${customer.phoneE164 ?? ""}: ${customer.id}`).join("\n")}\nFor an active customer, reply USE CUSTOMER <id> | <original instruction>. Restore archived customers in the dashboard first. Nothing has been posted.`;
          }
        } else { outcome = "OWNER_MANUAL_FALLBACK"; response = "The assistant is disconnected. Use the dashboard to create and approve an order, sale, or confirmed receipt."; }
      } catch (error) {
        if (error instanceof DomainError) { outcome = error.code; response = Object.values(error.fieldErrors ?? {}).join(" ") || error.message; } else throw error;
      }
    } else if (!body || !["text", "interactive", "button"].includes(inbound.type)) { outcome = "UNSUPPORTED_MEDIA"; response = "Please send text. Your request will be reviewed by the business owner."; }
    else if (body.startsWith("APPROVE_HASH ")) outcome = "CUSTOMER_APPROVAL_REJECTED";
  }
  await db.$transaction(async tx => {
    const current = await tx.inboundMessage.findFirst({ where: { tenantId: job.tenantId, id: inbound.id } });
    if (!current || current.state !== "PENDING") return;
    // Replies go to the original sender and remain subject to consent/window at
    // dispatch. Failure to send does not undo an already committed approval.
    if (response) await queueMessage(tx, { tenantId: job.tenantId, conversationId: inbound.conversationId, recipient: inbound.conversation.providerSenderId, body: response.slice(0, 2000), key: `inbound-reply:${inbound.id}`, expiresAt: responseExpiresAt, now });
    await tx.inboundMessage.update({ where: { tenantId_id: { tenantId: job.tenantId, id: inbound.id } }, data: { state: "PROCESSED", outcome } });
  });
}
