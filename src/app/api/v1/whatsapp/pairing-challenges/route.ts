import type { NextRequest } from "next/server";
import { api, jsonBody, mutationContext } from "@/server/http";
import { createPairingChallenge } from "@/server/whatsapp/pairing";
export function POST(request: NextRequest) { return api(request, async ({ db, identity, requestId }) => createPairingChallenge(db, identity, mutationContext(request, requestId), await jsonBody(request)), 201); }
