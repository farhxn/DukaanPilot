import type { PrismaClient } from "../../generated/prisma/client.ts";
import type { VerifiedIdentity } from "../domain/identity.ts";
import { audit, mutate, withOwner, type Mutation } from "../domain/tenancy.ts";
import { object, text } from "../domain/validation.ts";
import { DomainError } from "../errors.ts";
import { jsonSafe } from "../domain/proposals.ts";
export function requestPrivacyReview(db: PrismaClient, identity: VerifiedIdentity, mutation: Mutation, body: unknown) {
  const input = object(body, ["kind"]), kind = text(input.kind, "kind", 20);
  if (!["EXPORT", "DELETE"].includes(kind)) throw new DomainError("INVALID_REQUEST", 422, "Choose export or deletion review.");
  return mutate(db, identity, mutation, "POST/privacy-requests", input, async (tx, owner) => {
    const existing = await tx.privacyRequest.findFirst({ where: { tenantId: owner.tenantId, ownerUserId: owner.userId, kind, status: "REQUESTED" } });
    if (existing) return jsonSafe(existing);
    const request = await tx.privacyRequest.create({ data: { tenantId: owner.tenantId, ownerUserId: owner.userId, kind } });
    await audit(tx, owner, mutation, "PRIVACY_REVIEW_REQUESTED", "PrivacyRequest", request.id, ["kind"]);
    return jsonSafe(request);
  });
}
export function exportWorkspace(db: PrismaClient, identity: VerifiedIdentity) {
  return withOwner(db, identity, async (tx, owner) => {
    const tenantId = owner.tenantId;
    const result = { exportedAt: new Date().toISOString(), business: await tx.tenant.findUnique({ where: { id: tenantId }, select: { id: true, name: true, createdAt: true, profile: true } }), customers: await tx.customer.findMany({ where: { tenantId }, take: 10001 }), suppliers: await tx.supplier.findMany({ where: { tenantId }, take: 10001 }), orders: await tx.order.findMany({ where: { tenantId }, include: { items: true }, take: 10001 }), sales: await tx.sale.findMany({ where: { tenantId }, take: 10001 }), payments: await tx.payment.findMany({ where: { tenantId }, include: { allocations: true }, take: 10001 }), ledger: await tx.ledgerEntry.findMany({ where: { tenantId }, take: 10001 }), reversals: await tx.reversal.findMany({ where: { tenantId }, take: 10001 }), workflows: await tx.workflowInstance.findMany({ where: { tenantId }, include: { events: true }, take: 10001 }), consent: await tx.contactConsent.findMany({ where: { tenantId }, take: 10001 }), audit: await tx.auditEvent.findMany({ where: { tenantId }, take: 10001 }), approvals: await tx.approvalEvent.findMany({ where: { tenantId }, take: 10001 }) };
    if (Object.values(result).some(value => Array.isArray(value) && value.length > 10000)) throw new DomainError("EXPORT_SUPPORT_REQUIRED", 422, "This workspace needs a larger export. Request an export review through support.");
    await audit(tx, owner, { key: "workspace-export", requestId: crypto.randomUUID() }, "WORKSPACE_EXPORTED", "Tenant", tenantId, ["exportedAt"]);
    return jsonSafe(result);
  });
}
