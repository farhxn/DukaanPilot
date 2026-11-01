import type { PrismaClient } from "../../generated/prisma/client.ts";
import { DomainError } from "../errors.ts";
import type { VerifiedIdentity } from "./identity.ts";
import { audit, mutate, withOwner, type Mutation, type Tx } from "./tenancy.ts";
import { contactInput, listInput, uuid } from "./validation.ts";

export type ContactKind = "customers" | "suppliers";
type Filter = {
  id?: string | { lt: string }; version?: number; createdAt?: Date | { lt: Date };
  archivedAt?: null | { not: null }; name?: { contains: string; mode: "insensitive" };
  phoneE164?: { contains: string }; OR?: Filter[]; AND?: Filter[];
};
type ContactData = { name: string; phoneE164?: string | null; notes?: string | null };
type ContactPatch = Partial<ContactData> & { archivedAt?: Date | null; version: { increment: number } };

// Bind scope at repository construction. Callers cannot replace or omit it.
function repository(tx: Tx, kind: ContactKind, tenantId: string) {
  return {
    find: (filter: Filter) => kind === "customers" ? tx.customer.findFirst({ where: { ...filter, tenantId } }) : tx.supplier.findFirst({ where: { ...filter, tenantId } }),
    list: (filter: Filter, take: number) => kind === "customers" ? tx.customer.findMany({ where: { ...filter, tenantId, isWalkIn: false }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take }) : tx.supplier.findMany({ where: { ...filter, tenantId }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take }),
    create: (data: ContactData) => kind === "customers" ? tx.customer.create({ data: { ...data, tenantId } }) : tx.supplier.create({ data: { ...data, tenantId } }),
    update: (filter: Filter, data: ContactPatch) => kind === "customers" ? tx.customer.updateMany({ where: { ...filter, tenantId }, data }) : tx.supplier.updateMany({ where: { ...filter, tenantId }, data }),
  };
}

export function listContacts(db: PrismaClient, identity: VerifiedIdentity, kind: ContactKind, params: URLSearchParams) {
  const input = listInput(params);
  const compact = input.q.replace(/[\s()-]/g, "");
  const phoneQuery = /^0\d*$/.test(compact) ? "+92" + compact.slice(1) : compact;
  return withOwner(db, identity, async (tx, owner) => {
    const model = repository(tx, kind, owner.tenantId);
    let after: Filter | undefined;
    if (input.cursor) {
      const cursor = await model.find({ id: input.cursor });
      if (!cursor) throw new DomainError("NOT_FOUND", 404, "Record not found.");
      after = { OR: [{ createdAt: { lt: cursor.createdAt } }, { createdAt: cursor.createdAt, id: { lt: cursor.id } }] };
    }
    const items = await model.list({ archivedAt: input.archived ? { not: null } : null, AND: [
      ...(after ? [after] : []),
      ...(input.q ? [{ OR: [{ name: { contains: input.q, mode: "insensitive" as const } }, { phoneE164: { contains: phoneQuery } }] }] : []),
    ] }, input.limit + 1);
    const page = items.slice(0, input.limit);
    return { items: page, nextCursor: items.length > input.limit ? page.at(-1)!.id : null };
  });
}

export function getContact(db: PrismaClient, identity: VerifiedIdentity, kind: ContactKind, id: string) {
  uuid(id);
  return withOwner(db, identity, async (tx, owner) => {
    const item = await repository(tx, kind, owner.tenantId).find({ id });
    if (!item) throw new DomainError("NOT_FOUND", 404, "Record not found.");
    return item;
  });
}

export function createContact(db: PrismaClient, identity: VerifiedIdentity, kind: ContactKind, mutation: Mutation, body: unknown) {
  const input = contactInput(body);
  return mutate(db, identity, mutation, `POST/${kind}`, input, async (tx, owner) => {
    const item = await repository(tx, kind, owner.tenantId).create({ name: input.name!, phoneE164: input.phoneE164, notes: input.notes });
    await audit(tx, owner, mutation, "CONTACT_CREATED", kind, item.id, ["name", "phoneE164", "notes"]);
    return item;
  });
}

export function updateContact(db: PrismaClient, identity: VerifiedIdentity, kind: ContactKind, id: string, mutation: Mutation, body: unknown) {
  uuid(id);
  const input = contactInput(body, true);
  return mutate(db, identity, mutation, `PATCH/${kind}/${id}`, input, async (tx, owner) => {
    const model = repository(tx, kind, owner.tenantId);
    const existing = await model.find({ id });
    if (!existing) throw new DomainError("NOT_FOUND", 404, "Record not found.");
    if ("isWalkIn" in existing && existing.isWalkIn) throw new DomainError("MANAGED_CONTACT", 409, "The walk-in cash-sale contact is managed by your workspace.");
    const { version, archived, ...fields } = input;
    const changed = await model.update({ id, version }, { ...fields, ...(archived !== undefined ? { archivedAt: archived ? new Date() : null } : {}), version: { increment: 1 } });
    if (!changed.count) throw new DomainError("STALE_VERSION", 409, "This contact changed. Refresh the list before editing again.");
    await audit(tx, owner, mutation, "CONTACT_UPDATED", kind, id, Object.keys(input).filter(key => key !== "version"));
    return (await model.find({ id }))!;
  });
}
