import type { NextRequest } from "next/server";
import { api, jsonBody, mutationContext } from "@/server/http";
import { createProposal } from "@/server/domain/proposals";
import { listRecords } from "@/server/domain/reports";
export function GET(request: NextRequest) { return api(request, ({ db, identity }) => listRecords(db, identity, "proposals", request.nextUrl.searchParams)); }
export function POST(request: NextRequest) { return api(request, async ({ db, identity, requestId }) => createProposal(db, identity, mutationContext(request, requestId), await jsonBody(request)), 201); }
