import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { gzipSync, gunzipSync } from "node:zlib";
import { join } from "node:path";
export const quote = value => '"' + value.replaceAll('"', '""') + '"';
export async function migrationFingerprint() {
  const folders = (await readdir("prisma/migrations", { withFileTypes: true })).filter(e => e.isDirectory()).map(e => e.name).sort();
  const hash = createHash("sha256"); for (const folder of folders) hash.update(folder).update(await readFile(join("prisma/migrations", folder, "migration.sql")));
  return { hash: hash.digest("hex"), count: folders.length };
}
function encryptionKey(encoded) { const bytes = Buffer.from(encoded ?? "", "base64"); if (bytes.length !== 32) throw new Error("Provide a 32-byte base64 backup encryption key through the secret environment."); return bytes; }
export async function createBackup(client, filename, key, keyId) {
  if (!keyId || keyId.length > 100) throw new Error("A backup key ID is required.");
  const fingerprint = await migrationFingerprint(), startedAt = new Date();
  await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
  let snapshot;
  try {
    const migrations = await client.query('SELECT count(*)::int AS count FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL');
    if (migrations.rows[0].count !== fingerprint.count) throw new Error("Apply the exact application migrations before backing up.");
    const tables = (await client.query("SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename <> '_prisma_migrations' ORDER BY tablename")).rows.map(r => r.tablename);
    const foreignKeys = (await client.query("SELECT c.conrelid::regclass::text AS child,c.confrelid::regclass::text AS parent, ARRAY(SELECT a.attname::text FROM unnest(c.conkey) WITH ORDINALITY u(n,o) JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=u.n ORDER BY u.o) AS columns FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE c.contype='f' AND n.nspname='public'")).rows.map(row => ({ child: row.child.replaceAll('"', ''), parent: row.parent.replaceAll('"', ''), columns: row.columns }));
    const rows = {};
    for (const table of tables) {
      const result = await client.query(`SELECT row_to_json(t)::text AS json FROM public.${quote(table)} t LIMIT 100001`);
      if (result.rows.length > 100000) throw new Error("Backup table exceeds the pilot logical-backup limit. Use managed/native PostgreSQL backup tooling.");
      rows[table] = result.rows.map(row => row.json); // preserve exact SQL numeric text
    }
    snapshot = { version: 1, createdAt: startedAt.toISOString(), migrationFingerprint: fingerprint.hash, foreignKeys, rows };
    await client.query("COMMIT");
  } catch (error) { await client.query("ROLLBACK"); throw error; }
  const compressed = gzipSync(Buffer.from(JSON.stringify(snapshot))), iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(key), iv);
  cipher.setAAD(Buffer.from(`dukaanpilot-backup-v1:${keyId}`));
  const encrypted = Buffer.concat([cipher.update(compressed), cipher.final()]);
  await writeFile(filename, JSON.stringify({ version: 1, keyId, iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64"), encrypted: encrypted.toString("base64") }), { mode: 0o600, flag: "wx" });
  return { createdAt: snapshot.createdAt, tables: Object.keys(snapshot.rows).length, rows: Object.values(snapshot.rows).reduce((sum, rows) => sum + rows.length, 0), bytes: encrypted.length, durationMs: Date.now() - startedAt.getTime() };
}
function orderedRows(table, rows, foreignKeys) {
  const selfKeys = foreignKeys.filter(key => key.child === table && key.parent === table).flatMap(key => key.columns.filter(col => col !== "tenantId"));
  if (!selfKeys.length) return rows;
  const records = rows.map(raw => ({ raw, data: JSON.parse(raw) })), remaining = new Map(records.map(record => [record.data.id, record])), sorted = [];
  while (remaining.size) {
    let moved = 0;
    for (const [id, record] of remaining) if (selfKeys.every(key => !record.data[key] || !remaining.has(record.data[key]))) { sorted.push(record.raw); remaining.delete(id); moved++; }
    if (!moved) throw new Error("Self-reference cycle requires a reviewed native restore.");
  }
  return sorted;
}
export async function restoreBackup(client, filename, key) {
  const envelope = JSON.parse(await readFile(filename, "utf8"));
  if (envelope.version !== 1) throw new Error("Unsupported backup format.");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(key), Buffer.from(envelope.iv, "base64"));
  decipher.setAAD(Buffer.from(`dukaanpilot-backup-v1:${envelope.keyId}`)); decipher.setAuthTag(Buffer.from(envelope.tag, "base64"));
  const compressed = Buffer.concat([decipher.update(Buffer.from(envelope.encrypted, "base64")), decipher.final()]);
  const snapshot = JSON.parse(gunzipSync(compressed, { maxOutputLength: 268435456 }).toString("utf8"));
  if (snapshot.migrationFingerprint !== (await migrationFingerprint()).hash) throw new Error("Backup and application migrations do not match.");
  const catalog = new Set((await client.query("SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename <> '_prisma_migrations'")).rows.map(row => row.tablename));
  if (Object.keys(snapshot.rows).length !== catalog.size || Object.keys(snapshot.rows).some(table => !catalog.has(table))) throw new Error("Restore schema does not match backup.");
  for (const table of catalog) if ((await client.query(`SELECT EXISTS(SELECT 1 FROM public.${quote(table)}) AS present`)).rows[0].present) throw new Error("Restore target must be empty. Existing business data is never overwritten.");
  const remaining = new Set(catalog), order = [];
  while (remaining.size) {
    let moved = 0;
    for (const table of remaining) if (snapshot.foreignKeys.filter(key => key.child === table && key.parent !== table).every(key => !remaining.has(key.parent))) { order.push(table); remaining.delete(table); moved++; }
    if (!moved) throw new Error("Schema cycle requires a reviewed native restore.");
  }
  await client.query("BEGIN");
  try {
    for (const table of order) {
      const rows = orderedRows(table, snapshot.rows[table], snapshot.foreignKeys);
      for (let offset = 0; offset < rows.length; offset += 250) await client.query(`INSERT INTO public.${quote(table)} SELECT * FROM json_populate_recordset(NULL::public.${quote(table)},$1::json)`, ["[" + rows.slice(offset, offset + 250).join(",") + "]"]);
    }
    // Recovery always freezes outbound and invalidates authority. The external
    // deletion/suppression journal must be reapplied before any re-enablement.
    await client.query('UPDATE "WhatsAppConnection" SET active=false');
    await client.query('UPDATE "Tenant" SET "operationsPausedAt"=COALESCE("operationsPausedAt",now())');
    await client.query('UPDATE "Conversation" SET "optedOutAt"=COALESCE("optedOutAt",now())');
    await client.query(`UPDATE "OutboxMessage" SET status=CASE WHEN status='SENDING' THEN 'UNKNOWN'::"OutboxStatus" ELSE 'CANCELLED'::"OutboxStatus" END,"failureCode"='RESTORE_REVIEW_REQUIRED' WHERE status IN ('PENDING','SENDING')`);
    await client.query(`UPDATE "Job" SET status='CANCELLED',"leaseToken"=NULL,"leaseUntil"=NULL,"failureCode"='RESTORE_REVIEW_REQUIRED' WHERE status IN ('PENDING','RUNNING')`);
    await client.query(`UPDATE "WorkflowInstance" SET state='NEEDS_HUMAN',"terminalReason"='RESTORE_REVIEW_REQUIRED',"nextRunAt"=NULL WHERE state IN ('SCHEDULED','CHECKING','WAITING_OWNER')`);
    await client.query('UPDATE "AuthSession" SET "revokedAt"=COALESCE("revokedAt",now())');
    await client.query('UPDATE "OwnerChannelIdentity" SET "revokedAt"=COALESCE("revokedAt",now())');
    await client.query('UPDATE "PairingChallenge" SET "revokedAt"=COALESCE("revokedAt",now())');
    await client.query('UPDATE "ChannelApprovalControl" SET "consumedAt"=COALESCE("consumedAt",now())');
    await client.query(`UPDATE "CustomerUpdateProposal" SET status='EXPIRED' WHERE status='READY'`);
    await client.query(`INSERT INTO "OperatorEvent" (id,"actorRef",action,"reviewReference",metadata,"createdAt") VALUES (gen_random_uuid(),'recovery-tool','RECOVERY_FROZEN',$1,$2::jsonb,now())`, [`backup-key:${envelope.keyId}`, JSON.stringify({ backupCreatedAt: snapshot.createdAt, externalJournalReviewRequired: true, freshConsentRequired: true })]);
    await client.query("COMMIT");
  } catch (error) { await client.query("ROLLBACK"); throw error; }
  return { backupCreatedAt: snapshot.createdAt, tables: order.length, rows: Object.values(snapshot.rows).reduce((sum, rows) => sum + rows.length, 0), dispatchFrozen: true };
}
