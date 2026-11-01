import type { NextRequest } from "next/server";
import { api, jsonBody, mutationContext } from "@/server/http";
import { getBusiness, updateBusiness } from "@/server/domain/business";

export function GET(request: NextRequest) { return api(request, ({ db, identity }) => getBusiness(db, identity)); }
export function PATCH(request: NextRequest) { return api(request, async ({ db, identity, requestId }) => updateBusiness(db, identity, mutationContext(request, requestId), await jsonBody(request))); }
