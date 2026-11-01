import assert from "node:assert/strict";
import { test } from "node:test";
import { settings, sale } from "./fixtures/ai.ts";
import { extractionSchema, groundedAmounts, validateExtraction } from "../src/server/ai/contract.ts";
import { fitsContext, geminiAdapter, tokenCost, worstCost } from "../src/server/ai/gemini.ts";

test("AI cost calculation is exact and reserves both calls including ceiling", () => {
  assert.equal(tokenCost(1000, 200, settings), 180000n);
  assert.equal(worstCost(settings), 1280000n);
  assert.equal(tokenCost(1, 0, { inputPrice: "0.000001", outputPrice: "0.1" }), 1n);
  assert.throws(() => tokenCost(1, 0, { inputPrice: "1e2", outputPrice: "0.1" }));
  assert.ok(fitsContext("Ali sale 650 received 0", settings));
  assert.equal(fitsContext("ا".repeat(2000), settings), false);
});

test("real-user commas and phones ground; date/time/phone digits never justify invented financial amounts", () => {
  assert.doesNotThrow(() => groundedAmounts({ ...sale, statedTotalPaisa: "125000" }, "Ali sale 1,250, received 0"));
  assert.doesNotThrow(() => groundedAmounts({ ...sale, customerCandidates: ["+923001234567"] }, "0300-1234567 sale 650 received 0"));
  assert.throws(() => groundedAmounts({ ...sale, statedTotalPaisa: "202600" }, "Ali sale 650 received 0 due 1 December 2026"));
  assert.throws(() => groundedAmounts({ ...sale, statedTotalPaisa: "30000" }, "Ali 0300-1234567 sale 650 received 0"));
  assert.throws(() => groundedAmounts({ ...sale, statedTotalPaisa: "150000" }, "Ali sale 1,50 received 0"));
  assert.throws(() => groundedAmounts({ ...sale, statedTotalPaisa: "65000" }, "Ali sale 650.001 received 0"));
  assert.throws(() => groundedAmounts(sale, "Malik sale 650 received 0"));
  assert.throws(() => groundedAmounts({ ...sale, customerCandidates: ["December"] }, "Ali sale 650 received 0 due 1 December 2026"));
});

test("unknown tools, IDs, enum, money, dates and invented amounts cannot enter a proposal", () => {
  assert.equal(validateExtraction(sale).statedTotalPaisa, "65000");
  for (const change of [{ tool: "post_payment" }, { tenantId: "fake" }, { intent: "approve" }, { statedTotalPaisa: -1 }, { statedTotalPaisa: "1.2" }, { dueAtCandidate: "tomorrow" }, { items: [{ description: "Cake", quantity: "-2", unitPricePaisa: "100" }] }]) assert.throws(() => validateExtraction({ ...sale, ...change }));
  assert.throws(() => groundedAmounts(sale, "Ali sale 700 received 0"));
  assert.throws(() => groundedAmounts(sale, "someone sale 650 received 0"));
  assert.doesNotThrow(() => groundedAmounts(sale, "Ali ko sale ۶۵۰, abhi ۰ received"));
  assert.doesNotThrow(() => groundedAmounts(sale, "Ali ko 650 udhar mai add karo"));
  assert.throws(() => groundedAmounts(sale, "Ali sale 650"));
});

test("Gemini REST adapter uses fixed origin, schema, no tools and bounded output", async () => {
  let calls = 0;
  const adapter = geminiAdapter("synthetic-test-key", async (url, options) => {
    calls++; assert.equal(url, "https://generativelanguage.googleapis.com/v1beta/models/fixture-model:generateContent");
    assert.equal((options!.headers as Record<string, string>)["x-goog-api-key"], "synthetic-test-key");
    const body = JSON.parse(options!.body as string);
    assert.equal(body.tools, undefined); assert.deepEqual(body.generationConfig.responseJsonSchema, extractionSchema); assert.equal(body.generationConfig.maxOutputTokens, 600);
    return new Response(JSON.stringify({ candidates: [{ finishReason: "STOP", content: { parts: [{ text: JSON.stringify(sale) }] } }], usageMetadata: { promptTokenCount: 100, totalTokenCount: 150 } }));
  });
  assert.equal((await adapter("Ali sale 650 received 0", false, settings)).extraction.intent, "draft_sale"); assert.equal(calls, 1);
  await assert.rejects(() => geminiAdapter("test", async () => new Response("private provider diagnostic", { status: 429 }))("x", false, settings), error => error instanceof Error && !error.message.includes("private provider diagnostic"));
});

