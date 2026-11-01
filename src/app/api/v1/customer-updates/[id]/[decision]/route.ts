import type { NextRequest } from "next/server";
import { api, jsonBody, mutationContext } from "@/server/http";
import { decideCustomerUpdate } from "@/server/whatsapp/updates";
import { DomainError } from "@/server/errors";
export async function POST(request: NextRequest, context: { params: Promise<{ id: string; decision: string }> }) {
  const { id, decision } = await context.params;
  return api(request, async ({ db, identity, requestId }) => { if (!["approve", "reject"].includes(decision)) throw new DomainError("NOT_FOUND", 404, "Action not found."); return decideCustomerUpdate(db, identity, id, mutationContext(request, requestId), await jsonBody(request), decision === "approve"); });
}
