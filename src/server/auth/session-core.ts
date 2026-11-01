import { randomBytes, createHash } from "node:crypto";
import type { PrismaClient } from "../../generated/prisma/client.ts";
import { DomainError } from "../errors.ts";
import type { VerifiedIdentity } from "../domain/identity.ts";
import { lock } from "../domain/tenancy.ts";

export const SESSION_COOKIE = "dukaanpilot_session";
const hash = (token: string) => createHash("sha256").update(token).digest("hex");

export async function issueSession(db: PrismaClient, identity: VerifiedIdentity, expiresAt: Date) {
  const expiry = new Date(Math.min(expiresAt.getTime(), Date.now() + 60 * 60 * 1000));
  if (!Number.isFinite(expiry.getTime()) || expiry.getTime() <= Date.now()) throw new DomainError("UNAUTHENTICATED", 401, "Your sign-in has expired.");
  const token = randomBytes(32).toString("base64url");
  await db.$transaction(async tx => {
    await lock(tx, "session:" + identity.subject);
    const user = await tx.user.upsert({ where: { authProviderSubject: identity.subject }, update: { email: identity.email, name: identity.name }, create: { authProviderSubject: identity.subject, email: identity.email, name: identity.name } });
    const recent = await tx.authSession.count({ where: { userId: user.id, createdAt: { gt: new Date(Date.now() - 60000) } } });
    if (recent >= 10) throw new DomainError("RATE_LIMITED", 429, "Too many sign-in attempts. Please wait a minute.");
    await tx.authSession.create({ data: { userId: user.id, tokenHash: hash(token), expiresAt: expiry, authenticatedAt: identity.authenticatedAt ?? new Date() } });
  });
  return { token, expiresAt: expiry };
}

export async function resolveSession(db: PrismaClient, token: string | undefined): Promise<VerifiedIdentity | null> {
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  const session = await db.authSession.findFirst({ where: { tokenHash: hash(token), revokedAt: null, expiresAt: { gt: new Date() } }, include: { user: true } });
  if (!session) return null;
  return { subject: session.user.authProviderSubject, uid: session.user.authProviderSubject.split(":").slice(2).join(":"), email: session.user.email, name: session.user.name, authenticatedAt: session.authenticatedAt };
}

export async function revokeSession(db: PrismaClient, token: string | undefined) {
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return;
  await db.authSession.updateMany({ where: { tokenHash: hash(token), revokedAt: null }, data: { revokedAt: new Date() } });
}
