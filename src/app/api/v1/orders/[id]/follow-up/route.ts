import type { NextRequest } from "next/server";
import { api, jsonBody, mutationContext } from "@/server/http";
import { getServerConfig } from "@/server/config";
import { enableFollowUp } from "@/server/workflows/engine";
import { DomainError } from "@/server/errors";
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return api(request, async ({ db, identity, requestId }) => {
    const config = getServerConfig();
    if (!config.followUpEnabled) throw new DomainError("FOLLOW_UP_UNAVAILABLE", 503, "Automatic follow-ups are unavailable. You can review and update orders manually.");
    return enableFollowUp(db, identity, id, mutationContext(request, requestId), await jsonBody(request), new Date(), config.limits);
  }, 201);
}
