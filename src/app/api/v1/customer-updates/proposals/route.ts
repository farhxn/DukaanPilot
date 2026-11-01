import type { NextRequest } from "next/server";
import { api, jsonBody, mutationContext } from "@/server/http";
import { createCustomerUpdate } from "@/server/whatsapp/updates";
export function POST(request: NextRequest) { return api(request, async ({ db, identity, requestId }) => createCustomerUpdate(db, identity, mutationContext(request, requestId), await jsonBody(request)), 201); }
