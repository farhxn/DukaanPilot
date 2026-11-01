import type { NextRequest } from "next/server";
import { api, jsonBody, mutationContext } from "@/server/http";
import { getContact, updateContact } from "@/server/domain/contacts";
import { DomainError } from "@/server/errors";

export function GET(request: NextRequest, { params }: { params: Promise<{ directory: string; id: string }> }) {
  return api(request, async ({ db, identity }) => {
    const { directory, id } = await params;
    if (directory !== "customers" && directory !== "suppliers") throw new DomainError("NOT_FOUND", 404, "Record not found.");
    return getContact(db, identity, directory, id);
  });
}
export function PATCH(request: NextRequest, { params }: { params: Promise<{ directory: string; id: string }> }) {
  return api(request, async ({ db, identity, requestId }) => {
    const { directory, id } = await params;
    if (directory !== "customers" && directory !== "suppliers") throw new DomainError("NOT_FOUND", 404, "Record not found.");
    return updateContact(db, identity, directory, id, mutationContext(request, requestId), await jsonBody(request));
  });
}
