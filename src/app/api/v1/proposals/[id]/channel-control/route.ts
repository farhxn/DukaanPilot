import type { NextRequest } from "next/server";
import { api, mutationContext } from "@/server/http";
import { createApprovalControl } from "@/server/whatsapp/pairing";
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) { const { id } = await context.params; return api(request, ({ db, identity, requestId }) => createApprovalControl(db, identity, id, mutationContext(request, requestId)), 201); }
