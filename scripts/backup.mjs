import nextEnv from "@next/env";
import { Client } from "pg";
import { createBackup } from "./backup-lib.mjs";
import { parseServerConfig } from "../src/server/config/schema.ts";
nextEnv.loadEnvConfig(process.cwd()); parseServerConfig(process.env);
const target = process.argv[2];
if (!target || !target.endsWith(".enc.json")) throw new Error("Provide a new encrypted backup path ending in .enc.json; existing files are never overwritten.");
const client = new Client({ connectionString: process.env.DATABASE_URL });
try { await client.connect(); console.log(JSON.stringify(await createBackup(client, target, process.env.BACKUP_ENCRYPTION_KEY_BASE64, process.env.BACKUP_KEY_ID))); }
catch { console.error("Encrypted backup failed. Check storage, key custody, applied migrations and database availability."); process.exitCode = 1; }
finally { await client.end(); }
