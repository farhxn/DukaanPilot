import "server-only";
import { DomainError } from "../errors.ts";
import { extractionSchema, SYSTEM_PROMPT, validateExtraction, type Extraction } from "./contract.ts";

export type AISettings = {
  model: string; inputPrice: string; outputPrice: string;
  inputTokens: number; outputTokens: number; calls: number; timeoutMs: number;
  textCharacters?: number;
  globalDaily: bigint; globalMonthly: bigint; tenantDaily: bigint; tenantMonthly: bigint;
};
export type ModelReply = { extraction: Extraction; inputTokens: number; outputTokens: number };
export type ModelAdapter = (instruction: string, repair: boolean, settings: AISettings) => Promise<ModelReply>;

// Prices are USD per million tokens. Keep all accounting in integer nano-USD.
export function decimalMicros(value: string) {
  if (!/^\d{1,6}(?:\.\d{1,6})?$/.test(value)) throw new Error("Use a nonnegative decimal with at most six places.");
  const [whole, fraction = ""] = value.split(".");
  return BigInt(whole) * 1_000_000n + BigInt(fraction.padEnd(6, "0"));
}
export function tokenCost(input: number, output: number, settings: Pick<AISettings, "inputPrice" | "outputPrice">) {
  return (BigInt(input) * decimalMicros(settings.inputPrice) + BigInt(output) * decimalMicros(settings.outputPrice) + 999n) / 1000n;
}
export function worstCost(settings: AISettings) { return tokenCost(settings.inputTokens, settings.outputTokens, settings) * BigInt(settings.calls); }

export function makePrompt(instruction: string, repair: boolean) {
  return { systemInstruction: { parts: [{ text: SYSTEM_PROMPT + (repair ? " Previous attempt failed validation. Return only valid extraction JSON; do not guess missing fields." : "") }] }, contents: [{ role: "user", parts: [{ text: JSON.stringify({ untrustedOwnerInstruction: instruction }) }] }] };
}
export function fitsContext(instruction: string, settings: AISettings) {
  // A deliberately conservative UTF-8 byte ceiling includes system/schema and
  // repair overhead. Requests exceeding it use manual clarification, no calls.
  return Buffer.byteLength(JSON.stringify({ ...makePrompt(instruction, true), schema: extractionSchema }), "utf8") + 256 <= settings.inputTokens;
}

export function geminiAdapter(apiKey: string, transport: typeof fetch = fetch): ModelAdapter {
  return async (instruction, repair, settings) => {
    if (!/^[a-zA-Z0-9_.-]{1,100}$/.test(settings.model)) throw new DomainError("MODEL_NOT_CONFIGURED", 503, "The assistant model needs operator review.");
    const response = await transport(`https://generativelanguage.googleapis.com/v1beta/models/${settings.model}:generateContent`, {
      method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({ ...makePrompt(instruction, repair), generationConfig: { temperature: 0, maxOutputTokens: settings.outputTokens, responseMimeType: "application/json", responseJsonSchema: extractionSchema } }),
      signal: AbortSignal.timeout(settings.timeoutMs), redirect: "error",
    });
    // Never include raw provider error bodies/prompts/keys in logs or responses.
    if (!response.ok) throw new DomainError("AI_PROVIDER_UNAVAILABLE", 503, "The assistant is unavailable. You can still enter records manually.");
    const reader = response.body?.getReader();
    if (!reader) throw new Error("Missing model response.");
    const chunks: Uint8Array[] = []; let size = 0;
    while (true) { const chunk = await reader.read(); if (chunk.done) break; size += chunk.value.length; if (size > 65536) { await reader.cancel(); throw new Error("Oversized model response."); } chunks.push(chunk.value); }
    const data = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    const candidate = data.candidates?.[0];
    if (candidate?.finishReason !== "STOP") throw new Error("Incomplete or blocked model response.");
    const inputTokens = data.usageMetadata?.promptTokenCount, outputTokens = data.usageMetadata?.totalTokenCount - inputTokens;
    if (!Number.isInteger(inputTokens) || inputTokens < 0 || !Number.isInteger(outputTokens) || outputTokens < 0 || inputTokens > settings.inputTokens || outputTokens > settings.outputTokens) throw new Error("Unexpected model usage; retain reserved cost.");
    const parts = candidate.content?.parts;
    if (!Array.isArray(parts) || parts.some((part: Record<string, unknown>) => typeof part.text !== "string")) throw new Error("Unsupported model response.");
    return { extraction: validateExtraction(JSON.parse(parts.map((part: { text: string }) => part.text).join(""))), inputTokens, outputTokens };
  };
}
