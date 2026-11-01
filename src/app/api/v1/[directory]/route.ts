import type { NextRequest } from "next/server";
import { api, jsonBody, mutationContext } from "@/server/http";
import { createContact, listContacts } from "@/server/domain/contacts";
import { DomainError } from "@/server/errors";
import { listRecords } from "@/server/domain/reports";

export function GET(request: NextRequest, { params }: { params: Promise<{ directory: string }> }) {
  return api(request, async ({ db, identity }) => {
    const { directory } = await params;
    if (directory === "orders" || directory === "sales" || directory === "payments") return listRecords(db, identity, directory, request.nextUrl.searchParams);
    if (directory !== "customers" && directory !== "suppliers") throw new DomainError("NOT_FOUND", 404, "Page not found.");
    return listContacts(db, identity, directory, request.nextUrl.searchParams);
  });
}
export function POST(request: NextRequest, { params }: { params: Promise<{ directory: string }> }) {
  return api(request, async ({ db, identity, requestId }) => {
    const { directory } = await params;
    if (directory !== "customers" && directory !== "suppliers") throw new DomainError("NOT_FOUND", 404, "Page not found.");
    return createContact(db, identity, directory, mutationContext(request, requestId), await jsonBody(request));
  }, 201);
}
