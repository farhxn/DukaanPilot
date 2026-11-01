import "server-only";
import { getServerConfig } from "../config";
import { decimalMicros, type AISettings } from "./gemini";
import { DomainError } from "../errors";

export function aiSettings(): AISettings {
  const config = getServerConfig();
  if (!config.aiEnabled) throw new DomainError("AI_DISABLED", 503, "The assistant is disconnected. Manual entry and summaries are available.");
  return { model: process.env.GEMINI_MODEL_ID!, inputPrice: process.env.AI_INPUT_PRICE_USD_PER_MILLION!, outputPrice: process.env.AI_OUTPUT_PRICE_USD_PER_MILLION!, inputTokens: config.limits.inputTokens, outputTokens: config.limits.outputTokens, calls: config.limits.calls, timeoutMs: config.limits.timeoutMs, textCharacters: config.limits.textCharacters,
    globalDaily: decimalMicros(String(config.budgets.globalDaily)) * 1000n, globalMonthly: decimalMicros(String(config.budgets.globalMonthly)) * 1000n, tenantDaily: decimalMicros(String(config.budgets.tenantDaily)) * 1000n, tenantMonthly: decimalMicros(String(config.budgets.tenantMonthly)) * 1000n };
}
