import type { NextRequest } from "next/server";
import { api, mutationContext } from "@/server/http";
import { stopFollowUp } from "@/server/workflows/engine";
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) { const { id } = await context.params; return api(request, ({ db, identity, requestId }) => stopFollowUp(db, identity, id, mutationContext(request, requestId))); }
