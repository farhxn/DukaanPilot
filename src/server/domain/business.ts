import type { PrismaClient } from "../../generated/prisma/client.ts";
import { DomainError } from "../errors.ts";
import type { VerifiedIdentity } from "./identity.ts";
import { audit, checkMutation, digest, lock, mutate, requestHash, withOwner, type Mutation } from "./tenancy.ts";
import { businessInput } from "./validation.ts";

export async function createBusiness(db: PrismaClient, identity: VerifiedIdentity, mutation: Mutation, body: unknown) {
  checkMutation(mutation);
  const input = businessInput(body);
  return db.$transaction(async tx => {
    const scope = "onboard:" + digest(identity.subject);
    await lock(tx, scope);
    const hash = requestHash(input);
    const existing = await tx.idempotencyRecord.findUnique({ where: { scope_route_key: { scope, route: "POST/businesses", key: mutation.key } } });
    if (existing) {
      const owner = await tx.tenantUser.findFirst({ where: { user: { authProviderSubject: identity.subject }, tenantId: existing.tenantId, status: "ACTIVE", tenant: { status: "ACTIVE" } } });
      if (!owner) throw new DomainError("WORKSPACE_UNAVAILABLE", 403, "Your workspace is not available.");
      if (existing.requestHash !== hash) throw new DomainError("IDEMPOTENCY_CONFLICT", 409, "This request key was already used with different content.");
      return existing.result;
    }
    const user = await tx.user.upsert({ where: { authProviderSubject: identity.subject }, update: {}, create: { authProviderSubject: identity.subject, email: identity.email, name: identity.name } });
    if (await tx.tenantUser.findUnique({ where: { userId: user.id } })) throw new DomainError("BUSINESS_EXISTS", 409, "This account already has a business workspace.");
    const tenant = await tx.tenant.create({ data: { name: input.name!, profile: { create: { businessType: input.businessType!, city: input.city!, language: input.language! } }, members: { create: { userId: user.id } }, customers: { create: { name: "Walk-in", isWalkIn: true } } }, include: { profile: true } });
    const owner = { tenantId: tenant.id, userId: user.id };
    await audit(tx, owner, mutation, "BUSINESS_CREATED", "Tenant", tenant.id, ["name", "businessType", "city", "language"]);
    const result = JSON.parse(JSON.stringify({ id: tenant.id, name: tenant.name, profile: tenant.profile }));
    await tx.idempotencyRecord.create({ data: { scope, route: "POST/businesses", key: mutation.key, requestHash: hash, tenantId: tenant.id, actorUserId: user.id, result } });
    return result;
  }, { timeout: 15000 });
}

export async function getBusiness(db: PrismaClient, identity: VerifiedIdentity) {
  const user = await db.user.findUnique({ where: { authProviderSubject: identity.subject }, select: { id: true } });
  if (!user) return null;
  if (!await db.tenantUser.findUnique({ where: { userId: user.id }, select: { id: true } })) return null;
  return withOwner(db, identity, async (tx, owner) => tx.tenant.findFirst({ where: { id: owner.tenantId }, select: { id: true, name: true, profile: true } }));
}

export function updateBusiness(db: PrismaClient, identity: VerifiedIdentity, mutation: Mutation, body: unknown) {
  const input = businessInput(body, true);
  return mutate(db, identity, mutation, "PATCH/business", input, async (tx, owner) => {
    const { version, name, ...profile } = input;
    const updated = await tx.businessProfile.updateMany({ where: { tenantId: owner.tenantId, version }, data: { ...profile, version: { increment: 1 } } });
    if (!updated.count) throw new DomainError("STALE_VERSION", 409, "Your profile changed. Refresh it before saving again.");
    if (name) await tx.tenant.update({ where: { id: owner.tenantId }, data: { name } });
    await audit(tx, owner, mutation, "BUSINESS_UPDATED", "Tenant", owner.tenantId, Object.keys(input).filter(key => key !== "version"));
    return tx.tenant.findFirst({ where: { id: owner.tenantId }, select: { id: true, name: true, profile: true } });
  });
}
