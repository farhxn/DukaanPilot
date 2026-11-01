import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../src/generated/prisma/client.ts";
import { createBusiness, getBusiness, updateBusiness } from "../../src/server/domain/business.ts";
import { createContact, getContact, listContacts, updateContact } from "../../src/server/domain/contacts.ts";
import { issueSession, resolveSession, revokeSession } from "../../src/server/auth/session-core.ts";
import type { VerifiedIdentity } from "../../src/server/domain/identity.ts";

const url = new URL(process.env.DATABASE_URL!);
if (url.hostname !== "127.0.0.1" || url.pathname !== "/dukaanpilot_test") throw new Error("Refusing to test outside the isolated local test database.");
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.toString(), max: 5 }) });
const identity = (): VerifiedIdentity => { const uid = randomUUID(); return { uid, subject: `firebase:demo-dukaanpilot:${uid}`, email: `synthetic-${uid}@example.test`, name: "Synthetic owner" }; };
const ownerA = identity(), ownerB = identity();
const mutation = (key = randomUUID()) => ({ key, requestId: randomUUID() });
const profile = { name: "Synthetic shop A", businessType: "Retail", city: "Karachi", language: "roman-urdu" };
let tenantA: string, tenantB: string;
const isCode = (code: string) => (error: unknown) => !!error && typeof error === "object" && "code" in error && error.code === code;

before(async () => {
  await db.$connect();
  tenantA = (await createBusiness(db, ownerA, mutation(), profile)).id;
  tenantB = (await createBusiness(db, ownerB, mutation(), { ...profile, name: "Synthetic shop B" })).id;
});
after(async () => { await db.$disconnect(); });

test("concurrent onboarding replay creates exactly one business and owner", async () => {
  const actor = identity(), request = mutation();
  const result = await Promise.all([1, 2, 3].map(() => createBusiness(db, actor, request, profile)));
  assert.equal(new Set(result.map(item => item.id)).size, 1);
  const saved = await getBusiness(db, actor);
  assert.equal(saved?.profile?.currency, "PKR");
  assert.equal(saved?.profile?.timezone, "Asia/Karachi");
  assert.equal(await db.tenantUser.count({ where: { tenantId: saved!.id } }), 1);
  await assert.rejects(createBusiness(db, actor, mutation(), profile), isCode("BUSINESS_EXISTS"));
  await assert.rejects(createBusiness(db, actor, request, { ...profile, city: "Lahore" }), isCode("IDEMPOTENCY_CONFLICT"));
});

test("customers support duplicate names, normalized phones, scoped search and idempotent creation", async () => {
  const request = mutation();
  const input = { name: "Ali Directory", phoneE164: "0300 1234567" };
  const first = await createContact(db, ownerA, "customers", request, input);
  const replay = await createContact(db, ownerA, "customers", request, input);
  assert.equal(first.id, replay.id);
  assert.equal(first.phoneE164, "+923001234567");
  await createContact(db, ownerA, "customers", mutation(), { name: "Ali Directory" });
  await createContact(db, ownerB, "customers", mutation(), input);
  assert.equal((await listContacts(db, ownerA, "customers", new URLSearchParams("q=ali directory"))).items.length, 2);
  await assert.rejects(createContact(db, ownerA, "customers", mutation(), input), isCode("P2002"));
  await assert.rejects(createContact(db, ownerA, "customers", request, { name: "Changed" }), isCode("IDEMPOTENCY_CONFLICT"));
  assert.equal(await db.auditEvent.count({ where: { tenantId: tenantA, targetId: first.id, action: "CONTACT_CREATED" } }), 1);
});

test("other owners cannot read, mutate, enumerate or use a foreign cursor", async () => {
  const privateContact = await createContact(db, ownerA, "customers", mutation(), { name: "Only owner A can see this" });
  await assert.rejects(getContact(db, ownerB, "customers", privateContact.id), isCode("NOT_FOUND"));
  await assert.rejects(updateContact(db, ownerB, "customers", privateContact.id, mutation(), { version: 1, name: "Stolen" }), isCode("NOT_FOUND"));
  await assert.rejects(listContacts(db, ownerB, "customers", new URLSearchParams({ cursor: privateContact.id })), isCode("NOT_FOUND"));
  const result = await listContacts(db, ownerB, "customers", new URLSearchParams("q=Only owner A"));
  assert.equal(result.items.length, 0);
  assert.throws(() => createContact(db, ownerB, "customers", mutation(), { name: "Forged", tenantId: tenantA }), isCode("VALIDATION_ERROR"));
  assert.equal((await getContact(db, ownerA, "customers", privateContact.id)).name, privateContact.name);
});

test("concurrent edits cannot overwrite a newer version; archive and restore preserve the record", async () => {
  const contact = await createContact(db, ownerA, "suppliers", mutation(), { name: "Supplier", phoneE164: "03011234567", notes: "Synthetic" });
  const results = await Promise.allSettled(["First edit", "Second edit"].map(name => updateContact(db, ownerA, "suppliers", contact.id, mutation(), { version: contact.version, name })));
  assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
  assert.equal(results.filter(result => result.status === "rejected" && isCode("STALE_VERSION")(result.reason)).length, 1);
  const latest = await getContact(db, ownerA, "suppliers", contact.id);
  const archived = await updateContact(db, ownerA, "suppliers", contact.id, mutation(), { version: latest.version, archived: true });
  assert.ok(archived.archivedAt);
  assert.equal((await listContacts(db, ownerA, "suppliers", new URLSearchParams())).items.some(item => item.id === contact.id), false);
  assert.ok((await listContacts(db, ownerA, "suppliers", new URLSearchParams("archived=true"))).items.some(item => item.id === contact.id));
  await assert.rejects(createContact(db, ownerA, "suppliers", mutation(), { name: "Replacement", phoneE164: "03011234567" }), isCode("P2002"));
  const restored = await updateContact(db, ownerA, "suppliers", contact.id, mutation(), { version: archived.version, archived: false });
  assert.equal(restored.archivedAt, null);
});

test("pagination is bounded and business updates use optimistic versions", async () => {
  const page = await listContacts(db, ownerA, "customers", new URLSearchParams("limit=1"));
  assert.equal(page.items.length, 1);
  assert.ok(page.nextCursor);
  const next = await listContacts(db, ownerA, "customers", new URLSearchParams({ limit: "1", cursor: page.nextCursor! }));
  assert.notEqual(page.items[0].id, next.items[0].id);
  const business = await getBusiness(db, ownerA);
  await updateBusiness(db, ownerA, mutation(), { version: business!.profile!.version, city: "Lahore" });
  await assert.rejects(updateBusiness(db, ownerA, mutation(), { version: business!.profile!.version, city: "Karachi" }), isCode("STALE_VERSION"));
  const latest = await getBusiness(db, ownerA);
  const parallel = await Promise.allSettled(["One", "Two"].map(name => updateBusiness(db, ownerA, mutation(), { version: latest!.profile!.version, name, city: "Karachi" })));
  assert.equal(parallel.filter(result => result.status === "fulfilled").length, 1);
  assert.equal(parallel.filter(result => result.status === "rejected" && isCode("STALE_VERSION")(result.reason)).length, 1);
});

test("suspended tenants and revoked memberships lose access immediately", async () => {
  await db.tenant.update({ where: { id: tenantB }, data: { status: "SUSPENDED" } });
  try { await assert.rejects(listContacts(db, ownerB, "customers", new URLSearchParams()), isCode("WORKSPACE_UNAVAILABLE")); }
  finally { await db.tenant.update({ where: { id: tenantB }, data: { status: "ACTIVE" } }); }
  await db.tenantUser.update({ where: { tenantId: tenantB }, data: { status: "REVOKED" } });
  try { await assert.rejects(createContact(db, ownerB, "customers", mutation(), { name: "Denied" }), isCode("WORKSPACE_UNAVAILABLE")); }
  finally { await db.tenantUser.update({ where: { tenantId: tenantB }, data: { status: "ACTIVE" } }); }
});

test("PostgreSQL rejects cross-tenant references, invalid locale and mutable audit history", async () => {
  const memberB = await db.tenantUser.findUniqueOrThrow({ where: { tenantId: tenantB } });
  await assert.rejects(db.pairingChallenge.create({ data: { tenantId: tenantA, userId: memberB.userId, codeHash: "a".repeat(64), expiresAt: new Date(Date.now() + 600000) } }), isCode("P2003"));
  await assert.rejects(db.ownerChannelIdentity.create({ data: { tenantId: tenantA, userId: memberB.userId, providerSenderId: "923009999999" } }), isCode("P2003"));
  await assert.rejects(db.$executeRaw`UPDATE "BusinessProfile" SET currency = 'USD' WHERE "tenantId" = ${tenantA}::uuid`);
  const event = await db.auditEvent.findFirstOrThrow({ where: { tenantId: tenantA } });
  await assert.rejects(db.auditEvent.update({ where: { id: event.id }, data: { metadata: { tampered: true } } }));
  await assert.rejects(db.auditEvent.delete({ where: { id: event.id } }));
  assert.ok(await db.auditEvent.findUnique({ where: { id: event.id } }));
});

test("opaque sessions are hashed, bounded, revocable and reject forged or expired cookies", async () => {
  const actor = identity();
  const expiry = new Date(Date.now() + 20 * 60000);
  const session = await issueSession(db, actor, expiry);
  assert.ok(session.expiresAt <= expiry);
  const resolved = await resolveSession(db, session.token);
  assert.equal(resolved?.subject, actor.subject);
  const record = await db.authSession.findFirstOrThrow({ where: { user: { authProviderSubject: actor.subject } } });
  assert.notEqual(record.tokenHash, session.token);
  assert.equal(await resolveSession(db, "forged-cookie"), null);
  await revokeSession(db, session.token);
  assert.equal(await resolveSession(db, session.token), null);
  const expired = await issueSession(db, actor, expiry);
  await db.authSession.updateMany({ where: { userId: record.userId }, data: { expiresAt: new Date(Date.now() - 1000) } });
  assert.equal(await resolveSession(db, expired.token), null);
});
