import type { NextRequest } from "next/server";
import { api, jsonBody, mutationContext } from "@/server/http";
import { recordConsent } from "@/server/whatsapp/updates";
export function POST(request: NextRequest) { return api(request, async ({ db, identity, requestId }) => recordConsent(db, identity, mutationContext(request, requestId), await jsonBody(request))); }
