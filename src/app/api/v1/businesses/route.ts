import type { NextRequest } from "next/server";
import { api, jsonBody, mutationContext } from "@/server/http";
import { createBusiness } from "@/server/domain/business";

export function POST(request: NextRequest) {
  return api(request, async ({ db, identity, requestId }) => createBusiness(db, identity, mutationContext(request, requestId), await jsonBody(request)), 201);
}
