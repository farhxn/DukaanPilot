import { timingSafeEqual } from "node:crypto";
import { randomUUID } from "node:crypto";
import { getDb } from "@/server/db";
import { apiError } from "@/server/http";
import { ingestWebhook } from "@/server/whatsapp/ingress";
import { rawBody } from "@/server/whatsapp/policy";
export const runtime = "nodejs";
export function GET(request: Request) {
  const query = new URL(request.url).searchParams, expected = process.env.META_WEBHOOK_VERIFY_TOKEN;
  const supplied = query.get("hub.verify_token") ?? "", challenge = query.get("hub.challenge") ?? "";
  const valid = expected && Buffer.byteLength(supplied) === Buffer.byteLength(expected) && timingSafeEqual(Buffer.from(supplied), Buffer.from(expected));
  if (query.get("hub.mode") !== "subscribe" || !valid || !/^\d{1,100}$/.test(challenge)) return new Response("Verification rejected", { status: 403 });
  return new Response(challenge, { headers: { "Content-Type": "text/plain", "Cache-Control": "no-store" } });
}
export async function POST(request: Request) {
  const requestId = randomUUID();
  if (!process.env.META_APP_SECRET) return new Response("Webhook not configured", { status: 503 });
  try { await ingestWebhook(getDb(), await rawBody(request), request.headers.get("x-hub-signature-256"), process.env.META_APP_SECRET); return new Response("EVENT_RECEIVED", { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { return apiError(error, requestId); }
}
