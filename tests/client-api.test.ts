import assert from "node:assert/strict";
import { test } from "node:test";
import { apiRequest, ClientError } from "../src/components/api-client.ts";

test("stalled network becomes a recoverable error; no automatic retry or replacement request key", async () => {
  const original = globalThis.fetch; let calls = 0;
  globalThis.fetch = async (_url, options) => {
    calls++; assert.equal((options!.headers as Record<string, string>)["Idempotency-Key"], "same-safe-key");
    return new Promise((_resolve, reject) => {
      const keepAlive = setTimeout(() => reject(new Error("test did not abort")), 200);
      options!.signal!.addEventListener("abort", () => { clearTimeout(keepAlive); reject(options!.signal!.reason); });
    });
  };
  try {
    await assert.rejects(() => apiRequest("/test", { method: "POST", body: {}, key: "same-safe-key", timeoutMs: 10 }), error => error instanceof ClientError && error.status === 0 && /retry without changing/i.test(error.message));
    assert.equal(calls, 1);
  } finally { globalThis.fetch = original; }
});

test("malformed successful response and lost connection never masquerade as a saved financial action", async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response("not json");
    await assert.rejects(() => apiRequest("/test"), error => error instanceof ClientError && error.status === 0);
    globalThis.fetch = async () => { throw new Error("offline"); };
    await assert.rejects(() => apiRequest("/test"), error => error instanceof ClientError && /couldn’t confirm/.test(error.message));
  } finally { globalThis.fetch = original; }
});
