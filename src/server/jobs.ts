import { randomUUID } from "node:crypto";
import { Prisma, type PrismaClient, type Job } from "../generated/prisma/client.ts";
import { lock } from "./domain/tenancy.ts";
import { terminateWorkflow } from "./workflows/persistence.ts";
export type ClaimedJob = Job & { leaseToken: string };
async function closeFailedWorkflows(db: PrismaClient, now: Date) {
  const rows = await db.$queryRaw<{ tenantId: string; id: string }[]>(Prisma.sql`SELECT DISTINCT w."tenantId",w.id FROM "WorkflowInstance" w JOIN "Job" j ON j."tenantId"=w."tenantId" AND j."entityId"=w.id WHERE j.status='FAILED' AND j.type IN ('FOLLOW_UP','WORKFLOW_EXPIRE') AND w.state IN ('SCHEDULED','CHECKING','WAITING_OWNER') LIMIT 100`);
  for (const row of rows) await db.$transaction(async tx => { await lock(tx, `channel:${row.tenantId}`); const workflow = await tx.workflowInstance.findUnique({ where: { tenantId_id: row } }); if (workflow) await terminateWorkflow(tx, workflow, now >= workflow.expiresAt ? "EXPIRED" : "FAILED", now >= workflow.expiresAt ? "DEADLINE_REACHED" : "TECHNICAL_ATTEMPTS_EXHAUSTED", now); });
}
export async function claimJob(db: PrismaClient, now = new Date()) {
  await closeFailedWorkflows(db, now);
  const result = await db.$transaction(async tx => {
    const expired = await tx.job.findMany({ where: { status: "RUNNING", leaseUntil: { lte: now } }, take: 100 });
    for (const job of expired) await tx.job.updateMany({ where: { id: job.id, tenantId: job.tenantId, status: "RUNNING", leaseUntil: { lte: now } }, data: { status: job.attempts >= 3 ? "FAILED" : "PENDING", failureCode: "LEASE_EXPIRED", runAt: new Date(now.getTime() + (job.attempts === 1 ? 60000 : 300000)), leaseToken: null, leaseUntil: null } });
    const rows = await tx.$queryRaw<{ id: string; tenantId: string }[]>(Prisma.sql`SELECT id,"tenantId" FROM "Job" WHERE status='PENDING' AND "runAt"<=${now} AND attempts<3 ORDER BY "runAt",id FOR UPDATE SKIP LOCKED LIMIT 1`);
    if (!rows[0]) return null;
    const leaseToken = randomUUID();
    return await tx.job.update({ where: { tenantId_id: rows[0] }, data: { status: "RUNNING", attempts: { increment: 1 }, leaseToken, leaseUntil: new Date(now.getTime() + 120000) } }) as ClaimedJob;
  });
  await closeFailedWorkflows(db, now);
  return result;
}
export async function completeJob(db: PrismaClient, job: ClaimedJob) {
  await db.job.updateMany({ where: { id: job.id, tenantId: job.tenantId, status: "RUNNING", leaseToken: job.leaseToken }, data: { status: "COMPLETE", leaseUntil: null, leaseToken: null } });
}
export async function failJob(db: PrismaClient, job: ClaimedJob, code: string, now = new Date()) {
  await db.job.updateMany({ where: { id: job.id, tenantId: job.tenantId, status: "RUNNING", leaseToken: job.leaseToken }, data: { status: job.attempts < 3 ? "PENDING" : "FAILED", runAt: new Date(now.getTime() + (job.attempts === 1 ? 60000 : 300000)), failureCode: code, leaseUntil: null, leaseToken: null } });
  if (job.attempts >= 3) await closeFailedWorkflows(db, now);
}
