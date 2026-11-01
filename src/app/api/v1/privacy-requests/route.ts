import type { NextRequest } from "next/server";
import { api, jsonBody, mutationContext } from "@/server/http";
import { requestPrivacyReview } from "@/server/operations/privacy";
export function POST(request: NextRequest) { return api(request, async ({ db, identity, requestId }) => requestPrivacyReview(db, identity, mutationContext(request, requestId), await jsonBody(request)), 201); }
