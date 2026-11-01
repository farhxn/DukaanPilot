import assert from "node:assert/strict";
import { financialPreview } from "../src/server/whatsapp/financial-preview.ts";
import { test } from "node:test";
import { createHmac } from "node:crypto";
import { dispatchPolicy, isOptOut, quietUntil, rawBody, redactChannelCommand, statusProgress, verifySignature } from "../src/server/whatsapp/policy.ts";
import { parseWebhook } from "../src/server/whatsapp/ingress.ts";
import { metaAdapter } from "../src/server/whatsapp/outbox.ts";

test("signature binds exact raw bytes; streaming body bound rejects oversized input", async () => {
  const bytes = Buffer.from('{ "object": "whatsapp_business_account", "entry": [] }');
  const signature = "sha256=" + createHmac("sha256", "synthetic-app-secret").update(bytes).digest("hex");
  assert.equal(verifySignature(bytes, signature, "synthetic-app-secret"), true);
  assert.equal(verifySignature(Buffer.from(bytes.toString().replace(" ", "")), signature, "synthetic-app-secret"), false);
  assert.equal(verifySignature(bytes, "sha256=123", "synthetic-app-secret"), false);
  await assert.rejects(() => rawBody(new Request("https://example.test", { method: "POST", body: "x".repeat(100) }), 99), { code: "BODY_TOO_LARGE" });
});

test("window/consent/quiet-hour boundaries are exact and late delivery cannot regress", () => {
  const now = new Date("2030-01-01T16:00:00Z"); // 21:00 Pakistan
  const value = { now, expiresAt: new Date(now.getTime() + 86400000), active: true, optedOutAt: null, consentGrantedAt: now, lastInboundAt: now, proactive: false };
  assert.equal(dispatchPolicy(value).allowed, true);
  assert.equal(dispatchPolicy({ ...value, proactive: true }).allowed, false);
  assert.equal(quietUntil(now)?.toISOString(), "2030-01-02T04:00:00.000Z");
  assert.equal(quietUntil(new Date("2030-01-01T04:00:00Z")), null);
  assert.equal(dispatchPolicy({ ...value, lastInboundAt: new Date(now.getTime() - 86400000) }).allowed, false);
  assert.equal(dispatchPolicy({ ...value, optedOutAt: now }).allowed, false);
  assert.equal(dispatchPolicy({ ...value, consentGrantedAt: null }).allowed, false);
  assert.equal(statusProgress("READ", "DELIVERED"), "READ"); assert.equal(statusProgress("DELIVERED", "FAILED"), "DELIVERED");
  assert.equal(statusProgress("UNKNOWN", "DELIVERED"), "DELIVERED");
  for (const text of ["STOP", "please stop messages", "band karo", "بند کریں"]) assert.equal(isOptOut(text), true);
});

test("pairing/approval secrets are hashed before durable message storage", () => {
  const command = "PAIR 00000000-0000-4000-8000-000000000000 0123456789abcdef0123";
  const stored = redactChannelCommand(command)!;
  assert.ok(stored.startsWith("PAIR_HASH ")); assert.ok(!stored.includes("0123456789abcdef0123"));
  assert.equal(redactChannelCommand(stored), null);
  assert.ok(redactChannelCommand("APPROVE " + "a".repeat(48))!.startsWith("APPROVE_HASH "));
  assert.equal(redactChannelCommand("yes"), "yes");
});

test("batched messages and statuses parse separately; invalid IDs/timestamps cannot route", () => {
  const now = new Date(), timestamp = String(Math.floor(now.getTime() / 1000));
  const webhook = { object: "whatsapp_business_account", entry: [{ changes: [{ field: "messages", value: { metadata: { phone_number_id: "123456789" }, messages: [{ id: "wamid.a", from: "923001234567", timestamp, type: "text", text: { body: "one" } }, { id: "wamid.b", from: "923001234567", timestamp, type: "audio" }], statuses: [{ id: "wamid.c", timestamp, status: "read" }] } }] }] };
  const parsed = parseWebhook(webhook, now); assert.equal(parsed.messages.length, 2); assert.equal(parsed.statuses[0].status, "READ"); assert.equal(parsed.messages[1].body, null);
  webhook.entry[0].changes[0].value.messages[0].from = "tenant:admin";
  assert.throws(() => parseWebhook(webhook, now));
});

test("financial WhatsApp previews show item prices, references and allocations; long details cannot get a partial approval", () => {
  const command = "APPROVE " + "f".repeat(48), reference = "00000000-0000-4000-8000-000000000001";
  const p = { customerId: reference, customerName: "Ali", totalPaisa: "130000", items: [{ description: "Cake", quantity: "2", unitPricePaisa: "65000", lineTotalPaisa: "130000" }], allocations: [{ saleId: reference, amountPaisa: "65000", saleVersion: 1 }] };
  const preview = financialPreview("CREATE_ORDER", p, command);
  assert.match(preview, /unit Rs 650.00; line Rs 1,300.00/);
  assert.ok(preview.includes(`Customer reference: ${reference}`));
  assert.ok(preview.includes(`Allocate Rs 650.00 to sale ${reference}`));
  assert.ok(preview.includes(command));
  const long = financialPreview("CREATE_ORDER", { ...p, items: Array.from({ length: 30 }, () => ({ ...p.items[0], description: "Long untruncated item description ".repeat(6) })) }, command);
  assert.match(long, /review every detail/); assert.ok(!long.includes(command));
});

test("Meta retries only definite rate rejection; timeouts/5xx are UNKNOWN", async () => {
  const input = { phoneNumberId: "123456789", graphVersion: "v25.0", recipient: "923001234567", body: "Synthetic", reference: "synthetic" };
  const call = (response: Response) => metaAdapter("synthetic-token", async () => response)(input);
  assert.equal((await call(new Response(JSON.stringify({ error: { code: 130429 } }), { status: 429 }))).kind, "UNACCEPTED");
  assert.equal((await call(new Response(JSON.stringify({ error: { code: 1 } }), { status: 500 }))).kind, "UNKNOWN");
  assert.equal((await metaAdapter("test", async () => { throw new Error("timeout"); })(input)).kind, "UNKNOWN");
  assert.equal((await call(new Response(JSON.stringify({ messages: [{ id: "wamid.synthetic" }] })))).kind, "ACCEPTED");
  let cancelled = false;
  const stream = new ReadableStream({ pull(controller) { controller.enqueue(new Uint8Array(70000)); }, cancel() { cancelled = true; } });
  assert.deepEqual(await call(new Response(stream)), { kind: "UNKNOWN", code: "OVERSIZED_RESPONSE" });
  assert.equal(cancelled, true);
});
