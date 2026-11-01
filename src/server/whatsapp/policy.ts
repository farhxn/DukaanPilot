import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { DomainError } from "../errors.ts";

export function verifySignature(bytes: Uint8Array, signature: string | null, secret: string) {
  if (!secret || !signature || !/^sha256=[a-f0-9]{64}$/.test(signature)) return false;
  const expected = createHmac("sha256", secret).update(bytes).digest();
  return timingSafeEqual(expected, Buffer.from(signature.slice(7), "hex"));
}
export async function rawBody(request: Request, maximum = 1048576) {
  const reader = request.body?.getReader(); if (!reader) throw new DomainError("INVALID_WEBHOOK", 400, "Missing webhook body.");
  let size = 0; const chunks: Uint8Array[] = [];
  while (true) { const part = await reader.read(); if (part.done) break; size += part.value.byteLength; if (size > maximum) { await reader.cancel(); throw new DomainError("BODY_TOO_LARGE", 413, "Webhook body is too large."); } chunks.push(part.value); }
  return Buffer.concat(chunks);
}
export function senderId(value: unknown): string {
  if (typeof value !== "string" || !/^[1-9]\d{5,19}$/.test(value)) throw new DomainError("INVALID_WEBHOOK", 400, "Invalid sender identifier.");
  return value;
}
export function providerId(value: unknown): string {
  if (typeof value !== "string" || !/^[!-~]{1,200}$/.test(value)) throw new DomainError("INVALID_WEBHOOK", 400, "Invalid provider identifier.");
  return value;
}
export function isOptOut(text: string) { if (/^STOP WORKFLOW [0-9a-f-]{36}$/i.test(text.trim())) return false; return /\b(?:stop|unsubscribe|opt\s*out|band\s*karo|band\s*kar\s*do)\b|بند\s*(?:کرو|کریں)|پیغامات\s*نہیں/iu.test(text); }
export function redactChannelCommand(body: string | null) {
  if (!body) return body;
  const hash = (value: string) => createHash("sha256").update(value.toLowerCase()).digest("hex");
  const pair = /^PAIR ([0-9a-f-]{36}) ([0-9a-f]{20})$/i.exec(body.trim());
  if (pair) return `PAIR_HASH ${pair[1].toLowerCase()} ${hash(pair[2])}`;
  const approval = /^APPROVE ([0-9a-f]{48})$/i.exec(body.trim());
  if (approval) return `APPROVE_HASH ${hash(approval[1])}`;
  // Never accept a caller-supplied digest in place of the secret command.
  if (/^(?:PAIR_HASH|APPROVE_HASH)\b/i.test(body.trim())) return null;
  return body;
}
export function quietUntil(now: Date): Date | null {
  const pakistan = new Date(now.getTime() + 5 * 3600000), hour = pakistan.getUTCHours();
  if (hour >= 9 && hour < 21) return null;
  const next = new Date(pakistan); if (hour >= 21) next.setUTCDate(next.getUTCDate() + 1);
  next.setUTCHours(9, 0, 0, 0); return new Date(next.getTime() - 5 * 3600000);
}
export function dispatchPolicy(value: { now: Date; expiresAt: Date; active: boolean; optedOutAt: Date | null; consentGrantedAt: Date | null; lastInboundAt: Date; proactive: boolean }) {
  if (!value.active) return { allowed: false, reason: "CHANNEL_PAUSED" } as const;
  if (value.expiresAt <= value.now) return { allowed: false, reason: "EXPIRED" } as const;
  if (value.optedOutAt || !value.consentGrantedAt) return { allowed: false, reason: "NO_CONSENT" } as const;
  if (value.proactive) { const until = quietUntil(value.now); if (until) return { allowed: false, reason: "QUIET_HOURS", deferUntil: until } as const; }
  if (value.now.getTime() - value.lastInboundAt.getTime() >= 86400000) return { allowed: false, reason: "TEMPLATE_REQUIRED" } as const;
  return { allowed: true } as const;
}
export function statusProgress(current: string, incoming: string) {
  const rank: Record<string, number> = { PENDING: 0, SENDING: 1, UNKNOWN: 1, FAILED: 1, CANCELLED: 1, ACCEPTED: 2, DELIVERED: 3, READ: 4 };
  if (incoming === "FAILED") return ["ACCEPTED", "SENDING", "UNKNOWN"].includes(current) ? "FAILED" : current;
  return (rank[incoming] ?? -1) > (rank[current] ?? -1) ? incoming : current;
}
