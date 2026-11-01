import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { Client } from "pg";
import { createBackup, restoreBackup, quote } from "./backup-lib.mjs";

const services = JSON.parse(await readFile(".local/services.json", "utf8"));
const sourceUrl = new URL(services.testDatabaseUrl);
if (sourceUrl.hostname !== "127.0.0.1" || sourceUrl.pathname !== "/dukaanpilot_test") throw new Error("Rehearsal uses the isolated loopback synthetic test database only.");
const targetName = "dukaanpilot_restore_" + Date.now(), targetUrl = new URL(sourceUrl); targetUrl.pathname = "/" + targetName;
const source = new Client({ connectionString: sourceUrl.toString() }); await source.connect();
const key = randomBytes(32).toString("base64");
const folder = ".local/restore-rehearsal"; await mkdir(folder, { recursive: true });
const file = `${folder}/synthetic-${Date.now()}.enc.json`, started = Date.now();
try {
  const backup = await createBackup(source, file, key, "synthetic-ephemeral-rehearsal-key");
  await source.query(`CREATE DATABASE ${quote(targetName)}`);
  const child = spawn(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy"], { env: { ...process.env, DATABASE_URL: targetUrl.toString(), DIRECT_DATABASE_URL: targetUrl.toString() }, stdio: "ignore", windowsHide: true });
  if (await new Promise(resolve => child.once("exit", resolve)) !== 0) throw new Error("Restore target migration failed.");
  const target = new Client({ connectionString: targetUrl.toString() }); await target.connect();
  try {
    const restored = await restoreBackup(target, file, key);
    const checks = {};
    for (const table of ["Tenant", "Sale", "Payment", "PaymentAllocation", "LedgerEntry", "AuditEvent", "ApprovalEvent", "ContactConsent", "WorkflowEvent"]) {
      const expression = table === "Tenant" ? `(to_jsonb(t)-'operationsPausedAt')::text` : 'row_to_json(t)::text';
      const query = `SELECT count(*)::text AS count,md5(COALESCE(string_agg(${expression},'' ORDER BY id),'EMPTY')) AS checksum FROM public.${quote(table)} t`;
      checks[table] = JSON.stringify((await source.query(query)).rows[0]) === JSON.stringify((await target.query(query)).rows[0]);
    }
    if (Object.values(checks).some(ok => !ok)) throw new Error("Restored authoritative history differs.");
    const unsafe = (await target.query(`SELECT (SELECT count(*) FROM "OutboxMessage" WHERE status IN ('PENDING','SENDING'))+(SELECT count(*) FROM "WhatsAppConnection" WHERE active)+(SELECT count(*) FROM "Job" WHERE status IN ('PENDING','RUNNING')) AS count`)).rows[0].count;
    if (Number(unsafe) !== 0) throw new Error("Restored dispatch was not fully frozen.");
    const report = { recordedAt: new Date().toISOString(), source: "isolated synthetic PostgreSQL", backup, restored, authoritativeChecks: checks, dispatchSafety: "PASS", totalDurationMs: Date.now() - started, rpoTargetHours: 24, rtoTargetHours: 8, limits: "Local logical snapshot exercise; managed backup scheduling, point-in-time recovery, key custody and external deletion/suppression journal remain deployment prerequisites." };
    await writeFile(`${folder}/evidence.json`, JSON.stringify(report, null, 2)); console.log(JSON.stringify(report));
  } finally { await target.end(); }
} finally { await source.end(); }
// Keep the isolated target for inspection. Never overwrite/drop an existing DB.
