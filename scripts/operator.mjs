import nextEnv from "@next/env";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.ts";
import { parseServerConfig } from "../src/server/config/schema.ts";
import { maintainRetention, operationsMetrics, pauseTenant, provisionChannel, resumeTenant, setPilotPlan } from "../src/server/operations/controls.ts";
nextEnv.loadEnvConfig(process.cwd()); const config = parseServerConfig(process.env);
if (!process.env.DATABASE_URL) throw new Error("Operator command requires business storage.");
const [action, tenantId, ...args] = process.argv.slice(2), db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL, max: 2 }) });
try {
  const operator = { actorRef: process.env.OPERATOR_ID ?? "", reviewReference: process.env.OPERATOR_REVIEW_REFERENCE ?? "" };
  if (action !== "metrics" && (!operator.actorRef || !operator.reviewReference)) throw new Error("Operator identity and review reference are required.");
  let result;
  if (action === "metrics") result = await operationsMetrics(db);
  else if (action === "maintain") result = await maintainRetention(db, operator, new Date(), config.limits.messageRetentionDays);
  else if (action === "pause") result = await pauseTenant(db, tenantId, operator);
  else if (action === "resume") result = await resumeTenant(db, tenantId, operator);
  else if (action === "plan") result = await setPilotPlan(db, tenantId, args[0], new Date(args[1]), operator);
  else if (action === "channel") result = await provisionChannel(db, tenantId, args[0] ?? "", args[1] ?? "", operator);
  else throw new Error("Use metrics, maintain, pause <tenant>, plan <tenant> <plan> <expiry>, or channel <tenant> <phone-id> <version>.");
  console.log(JSON.stringify(result));
} catch { console.error("Operator command failed. Check configuration, reviewed arguments and database availability; no secret diagnostics are printed."); process.exitCode = 1; }
finally { await db.$disconnect(); }
