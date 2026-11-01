import type { AISettings } from "../../src/server/ai/gemini.ts";
import type { Extraction } from "../../src/server/ai/contract.ts";
export const settings: AISettings = { model: "fixture-model", inputPrice: "0.1", outputPrice: "0.4", inputTokens: 4000, outputTokens: 600, calls: 2, timeoutMs: 15000, globalDaily: 1_000_000_000n, globalMonthly: 25_000_000_000n, tenantDaily: 100_000_000n, tenantMonthly: 2_000_000_000n };
export const sale: Extraction = { schemaVersion: 1, intent: "draft_sale", language: "english", customerCandidates: ["Ali"], items: [], statedTotalPaisa: "65000", statedReceivedPaisa: "0", dueAtCandidate: null, missingFields: [], clarification: null };


