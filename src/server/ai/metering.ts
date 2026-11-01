import { type PrismaClient, type Prisma } from "../../generated/prisma/client.ts";
import { DomainError } from "../errors.ts";
import type { VerifiedIdentity } from "../domain/identity.ts";
import { checkMutation, lock, requireOwner, requestHash, withOwner, type Mutation } from "../domain/tenancy.ts";
import { jsonSafe } from "../domain/proposals.ts";
import { businessDate } from "../domain/reports.ts";
import { PROMPT_VERSION } from "./contract.ts";
import { worstCost, type AISettings } from "./gemini.ts";

export const PLANS = { FREE: { monthly: 50, daily: 10, workflows: 3, pricePkr: 0 }, SMART: { monthly: 500, daily: 50, workflows: 20, pricePkr: 999 }, PRO: { monthly: 1500, daily: 150, workflows: 50, pricePkr: 2499 }, BUSINESS: { monthly: 4000, daily: 300, workflows: 100, pricePkr: 4999 } };
export async function entitlement(tx: Prisma.TransactionClient, tenantId: string, now: Date) {
  const subscription = await tx.subscription.findUnique({ where: { tenantId } });
  const plan = subscription && (!subscription.expiresAt || subscription.expiresAt > now) ? subscription.plan : "FREE";
  return { plan, ...PLANS[plan], expiresAt: subscription?.expiresAt ?? null };
}

export function reserveAI(db: PrismaClient, identity: VerifiedIdentity, mutation: Mutation, input: string, settings: AISettings, now = new Date()) {
  checkMutation(mutation);
  const day = businessDate(now), month = now.toISOString().slice(0, 7), hash = requestHash({ input, model: settings.model, prompt: PROMPT_VERSION });
  return db.$transaction(async tx => {
    const owner = await requireOwner(tx, identity, true);
    await lock(tx, "ai-global-budget");
    const existing = await tx.aIExecution.findUnique({ where: { tenantId_key: { tenantId: owner.tenantId, key: mutation.key } } });
    if (existing) {
      if (existing.inputHash !== hash) throw new DomainError("IDEMPOTENCY_CONFLICT", 409, "That instruction key belongs to different text.");
      return { execution: existing, fresh: false };
    }
    const plan = await entitlement(tx, owner.tenantId, now);
    const cost = worstCost(settings);
    if (cost <= 0n) throw new DomainError("AI_PRICE_REQUIRED", 503, "AI price configuration needs operator review.");
    const checks = [
      { filter: { day }, cap: settings.globalDaily, actions: null },
      { filter: { month }, cap: settings.globalMonthly, actions: null },
      { filter: { tenantId: owner.tenantId, day }, cap: settings.tenantDaily, actions: plan.daily },
      { filter: { tenantId: owner.tenantId, month }, cap: settings.tenantMonthly, actions: plan.monthly },
    ];
    for (const check of checks) {
      const totals = await tx.aIExecution.aggregate({ where: check.filter, _sum: { chargedNanoUsd: true, actionUnits: true } });
      const inFlight = await tx.aIExecution.count({ where: { ...check.filter, status: { in: ["RESERVED", "PROCESSING"] } } });
      if ((totals._sum.chargedNanoUsd ?? 0n) + cost > check.cap || (check.actions !== null && (totals._sum.actionUnits ?? 0) + inFlight >= check.actions)) throw new DomainError("AI_QUOTA_REACHED", 429, "The assistant has reached a usage cap. Manual entry and your records remain available.");
    }
    const execution = await tx.aIExecution.create({ data: { tenantId: owner.tenantId, ownerUserId: owner.userId, key: mutation.key, inputHash: hash, day, month, model: settings.model, promptVersion: PROMPT_VERSION, reservedNanoUsd: cost, chargedNanoUsd: cost } });
    return { execution, fresh: true };
  }, { timeout: 15000 });
}

export async function startAI(db: PrismaClient, id: string, tenantId: string) {
  return (await db.aIExecution.updateMany({ where: { id, tenantId, status: "RESERVED" }, data: { status: "PROCESSING" } })).count === 1;
}
export async function settleAI(db: PrismaClient, id: string, tenantId: string, data: { usable: boolean; cost: bigint; calls: number; inputTokens: number; outputTokens: number; result: unknown }) {
  // A crash retains worst-case cost and the action reservation. Never release an
  // uncertain execution automatically; operator reconciliation uses execution ID.
  await db.$transaction(async tx => {
    await lock(tx, "ai-global-budget");
    const execution = await tx.aIExecution.findFirstOrThrow({ where: { id, tenantId } });
    if (execution.status !== "PROCESSING") return;
    await tx.aIExecution.update({ where: { tenantId_id: { tenantId, id } }, data: { status: data.usable ? "COMPLETED" : "FAILED", actionUnits: data.usable ? 1 : 0, chargedNanoUsd: data.cost, calls: data.calls, inputTokens: data.inputTokens, outputTokens: data.outputTokens, result: jsonSafe(data.result) } });
  });
}

export function usage(db: PrismaClient, identity: VerifiedIdentity, now = new Date()) {
  return withOwner(db, identity, async (tx, owner) => {
    const plan = await entitlement(tx, owner.tenantId, now), day = businessDate(now), month = now.toISOString().slice(0, 7);
    const monthTotal = await tx.aIExecution.aggregate({ where: { tenantId: owner.tenantId, month }, _sum: { actionUnits: true, chargedNanoUsd: true } });
    const dayTotal = await tx.aIExecution.aggregate({ where: { tenantId: owner.tenantId, day }, _sum: { actionUnits: true } });
    const reserved = await tx.aIExecution.count({ where: { tenantId: owner.tenantId, month, status: { in: ["RESERVED", "PROCESSING"] } } });
    return jsonSafe({ ...plan, day, month, monthlyUsed: monthTotal._sum.actionUnits ?? 0, dailyUsed: dayTotal._sum.actionUnits ?? 0, reserved, internalCostNanoUsd: monthTotal._sum.chargedNanoUsd ?? 0n, warning: (monthTotal._sum.actionUnits ?? 0) + reserved >= plan.monthly * 0.8, pricesAreProposed: true });
  });
}
