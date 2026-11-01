import nextEnv from "@next/env";
import { Client } from "pg";
import { restoreBackup } from "./backup-lib.mjs";
nextEnv.loadEnvConfig(process.cwd());
const target = new URL(process.env.RESTORE_DATABASE_URL ?? "postgresql://unused@127.0.0.1:1/unconfigured");
if (!process.env.RESTORE_REVIEW_REFERENCE || target.toString() === process.env.DATABASE_URL || !/^\/(?:dukaanpilot_restore_|dukaanpilot_recovery_)[a-zA-Z0-9_]+$/.test(target.pathname)) throw new Error("Use a separately provisioned, empty dukaanpilot_restore_/dukaanpilot_recovery_ target and an explicit restore review reference.");
if (!['127.0.0.1', 'localhost'].includes(target.hostname) && target.searchParams.get('sslmode') !== 'verify-full') throw new Error("Remote restore requires certificate-verified TLS.");
const client = new Client({ connectionString: target.toString() });
try { await client.connect(); console.log(JSON.stringify(await restoreBackup(client, process.argv[2], process.env.BACKUP_ENCRYPTION_KEY_BASE64))); }
catch { console.error("Restore failed. Keep the isolated target frozen; verify key, schema fingerprint, empty target and reviewed recovery procedure."); process.exitCode = 1; }
finally { await client.end(); }
