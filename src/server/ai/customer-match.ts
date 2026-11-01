import { Prisma, type PrismaClient } from "../../generated/prisma/client.ts";
import type { VerifiedIdentity } from "../domain/identity.ts";
import { withOwner } from "../domain/tenancy.ts";
import { normalizePhone, uuid } from "../domain/validation.ts";
import { comparableName, latinDigits } from "../../lib/human-text.ts";
import { DomainError } from "../errors.ts";

export type CustomerMatch = { id: string; name: string; phoneE164: string | null };
export async function matchCustomer(db: PrismaClient, identity: VerifiedIdentity, candidate: string, selected?: string) {
  return withOwner(db, identity, async (tx, owner) => {
    if (selected) {
      uuid(selected, "customerId");
      const customer = await tx.customer.findFirst({ where: { tenantId: owner.tenantId, id: selected, archivedAt: null, isWalkIn: false }, select: { id: true, name: true, phoneE164: true } });
      if (!customer) throw new DomainError("NOT_FOUND", 404, "Select an active customer in this workspace.");
      return { customer, matches: [], reason: null };
    }
    let phone: string | null = null;
    if (/^[+\d\s()-]+$/.test(latinDigits(candidate))) {
      try { phone = normalizePhone(latinDigits(candidate)); } catch { /* Invalid phones are never guessed. */ }
    }
    const exact = await tx.$queryRaw<(CustomerMatch & { archivedAt: Date | null })[]>(Prisma.sql`
      SELECT id,name,"phoneE164","archivedAt" FROM "Customer"
      WHERE "tenantId"=${owner.tenantId}::uuid AND "isWalkIn"=false
      AND (lower(regexp_replace(btrim(name),'[[:space:]]+',' ','g'))=${comparableName(candidate)} OR (${phone}::text IS NOT NULL AND "phoneE164"=${phone}))
      ORDER BY "archivedAt" NULLS FIRST,id LIMIT 6
    `);
    const active = exact.filter(customer => !customer.archivedAt);
    if (active.length === 1) return { customer: active[0], matches: [], reason: null };
    if (active.length > 1) return { customer: null, matches: active, reason: "ambiguous" as const };
    if (exact.length) return { customer: null, matches: exact, reason: "archived" as const };
    const suggestions = await tx.customer.findMany({ where: { tenantId: owner.tenantId, archivedAt: null, isWalkIn: false, name: { contains: candidate.trim(), mode: "insensitive" } }, select: { id: true, name: true, phoneE164: true }, orderBy: { id: "asc" }, take: 5 });
    return { customer: null, matches: suggestions, reason: "missing" as const };
  });
}
