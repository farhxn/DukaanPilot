import type { NextRequest } from "next/server";
import { api, jsonBody, mutationContext } from "@/server/http";
import { approveProposal, rejectProposal } from "@/server/domain/proposals";
import { DomainError } from "@/server/errors";
export function POST(request: NextRequest, { params }: { params: Promise<{ id: string; decision: string }> }) {
  return api(request, async ({ db, identity, requestId }) => {
    const { id, decision } = await params;
    if (decision !== "approve" && decision !== "reject") throw new DomainError("NOT_FOUND", 404, "Action not found.");
    return (decision === "approve" ? approveProposal : rejectProposal)(db, identity, id, mutationContext(request, requestId), await jsonBody(request));
  });
}
