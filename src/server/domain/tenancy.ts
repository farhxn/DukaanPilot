import { createHash } from "node:crypto";
import { Prisma, type PrismaClient } from "../../generated/prisma/client.ts";
import { DomainError } from "../errors.ts";
import type { VerifiedIdentity } from "./identity.ts";

export type Tx = Prisma.TransactionClient;
export type Owner = { userId: string; tenantId: string };
export type Mutation = { key: string; requestId: string };

export function digest(value: string) { return createHash("sha256").update(value).digest("hex"); }

function canonical(value: unknown): string {
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  return "{" + Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => JSON.stringify(key) + ":" + canonical(item)).join(",") + "}";
}

export function requestHash(value: unknown) { return digest(canonical(value)); }

export async function requireOwner(tx: Tx, identity: VerifiedIdentity, exclusive = false): Promise<Owner> {
  const user = await tx.user.findUnique({ where: { authProviderSubject: identity.subject } });
  if (!user) throw new DomainError("BUSINESS_REQUIRED", 403, "Create your business workspace first.");
  const rows = await tx.$queryRaw<{ tenantId: string; userId: string }[]>(Prisma.sql`
    SELECT m."tenantId", m."userId" FROM "TenantUser" m
    JOIN "Tenant" t ON t.id = m."tenantId"
    WHERE m."userId" = ${user.id}::uuid AND m.role = 'OWNER'
      AND m.status = 'ACTIVE' AND t.status = 'ACTIVE'
      AND (NOT ${exclusive} OR t."operationsPausedAt" IS NULL)
    FOR ${exclusive ? Prisma.raw("UPDATE") : Prisma.raw("SHARE")} OF m, t
  `);
  if (!rows[0]) throw new DomainError("WORKSPACE_UNAVAILABLE", 403, "This account cannot access an active business workspace.");
  return rows[0];
}

export function withOwner<T>(db: PrismaClient, identity: VerifiedIdentity, action: (tx: Tx, owner: Owner) => Promise<T>) {
  return db.$transaction(async tx => action(tx, await requireOwner(tx, identity)), { timeout: 15000 });
}

export async function audit(tx: Tx, owner: Owner, mutation: Mutation, action: string, targetType: string, targetId: string, fields: string[]) {
  await tx.auditEvent.create({ data: { tenantId: owner.tenantId, actorUserId: owner.userId, action, targetType, targetId, requestId: mutation.requestId, metadata: { fields } } });
}

export function checkMutation(mutation: Mutation) {
  if (!/^[a-zA-Z0-9_-]{8,100}$/.test(mutation.key)) throw new DomainError("IDEMPOTENCY_KEY_REQUIRED", 400, "Supply an Idempotency-Key of 8–100 letters, numbers, underscores or hyphens.");
}

export async function lock(tx: Tx, key: string) {
  await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`);
}

export function mutate<T>(db: PrismaClient, identity: VerifiedIdentity, mutation: Mutation, route: string, payload: unknown, action: (tx: Tx, owner: Owner) => Promise<T>) {
  checkMutation(mutation);
  return db.$transaction(async tx => {
    const owner = await requireOwner(tx, identity, true);
    const scope = `tenant:${owner.tenantId}:user:${owner.userId}`;
    await lock(tx, `${scope}:${route}:${mutation.key}`);
    const hash = requestHash(payload);
    const existing = await tx.idempotencyRecord.findUnique({ where: { scope_route_key: { scope, route, key: mutation.key } } });
    if (existing) {
      if (existing.requestHash !== hash) throw new DomainError("IDEMPOTENCY_CONFLICT", 409, "This request key was already used with different content.");
      return existing.result as T;
    }
    const result = await action(tx, owner);
    await tx.idempotencyRecord.create({ data: { scope, route, key: mutation.key, requestHash: hash, tenantId: owner.tenantId, actorUserId: owner.userId, result: JSON.parse(JSON.stringify(result)) } });
    return result;
  }, { timeout: 15000 });
}
