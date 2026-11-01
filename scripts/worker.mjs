import nextEnv from "@next/env";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.ts";
import { parseServerConfig } from "../src/server/config/schema.ts";
import { claimJob, completeJob, failJob } from "../src/server/jobs.ts";
import { processInbound } from "../src/server/whatsapp/processing.ts";
import { dispatchOne, metaAdapter } from "../src/server/whatsapp/outbox.ts";
import { decimalMicros, geminiAdapter } from "../src/server/ai/gemini.ts";
import { processWorkflow } from "../src/server/workflows/engine.ts";

nextEnv.loadEnvConfig(process.cwd());
const config = parseServerConfig({ ...process.env, APP_ROLE: "worker" });
if (!process.env.DATABASE_URL) throw new Error("Worker requires business storage.");
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL, max: 5, connectionTimeoutMillis: 5000 }) });
const ai = config.aiEnabled ? { adapter: geminiAdapter(process.env.GEMINI_API_KEY), settings: { model: process.env.GEMINI_MODEL_ID, inputPrice: process.env.AI_INPUT_PRICE_USD_PER_MILLION, outputPrice: process.env.AI_OUTPUT_PRICE_USD_PER_MILLION, inputTokens: config.limits.inputTokens, outputTokens: config.limits.outputTokens, calls: config.limits.calls, timeoutMs: config.limits.timeoutMs, textCharacters: config.limits.textCharacters, ...Object.fromEntries(Object.entries(config.budgets).map(([key, value]) => [key, decimalMicros(String(value)) * 1000n])) } } : undefined;
const adapter = metaAdapter(process.env.META_ACCESS_TOKEN ?? "");
let running = true;
process.once("SIGINT", () => { running = false; });
process.once("SIGTERM", () => { running = false; });
async function tick() {
  const job = await claimJob(db);
  if (job) {
    try {
      if (job.type === "INBOUND") await processInbound(db, job, ai);
      else if (["FOLLOW_UP", "WORKFLOW_EXPIRE"].includes(job.type)) await processWorkflow(db, job, config.outboundEnabled);
      else throw new Error("Unsupported durable job type.");
      await completeJob(db, job);
    } catch { await failJob(db, job, "JOB_EXECUTION_FAILED"); console.error("worker_job_failed", { jobId: job.id, attempt: job.attempts }); }
  }
  await dispatchOne(db, async input => input.graphVersion === process.env.META_GRAPH_API_VERSION ? adapter(input) : { kind: "FAILED", code: "GRAPH_VERSION_REVIEW_REQUIRED" }, config.outboundEnabled);
  return !!job;
}
try {
  do {
    try { await tick(); } catch { console.error("worker_tick_failed"); if (process.argv.includes("--once")) process.exitCode = 1; }
    if (process.argv.includes("--once")) break;
    if (running) await new Promise(resolve => setTimeout(resolve, config.limits.workerPollMs));
  } while (running);
} finally { await db.$disconnect(); }
