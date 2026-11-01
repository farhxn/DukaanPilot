import type { NextRequest } from "next/server";
import { api, jsonBody, mutationContext } from "@/server/http";
import { editProposal, getProposal } from "@/server/domain/proposals";
export function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) { return api(request, async ({ db, identity }) => getProposal(db, identity, (await params).id)); }
export function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) { return api(request, async ({ db, identity, requestId }) => editProposal(db, identity, (await params).id, mutationContext(request, requestId), await jsonBody(request))); }
