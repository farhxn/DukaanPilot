import type { NextRequest } from "next/server";
import { api, jsonBody, mutationContext } from "@/server/http";
import { processInstruction } from "@/server/ai/assistant";
import { aiSettings } from "@/server/ai/settings";
import { geminiAdapter } from "@/server/ai/gemini";
export const maxDuration = 60;
export function POST(request: NextRequest) { return api(request, async ({ db, identity, requestId }) => processInstruction(db, identity, mutationContext(request, requestId), await jsonBody(request), aiSettings(), geminiAdapter(process.env.GEMINI_API_KEY!))); }
