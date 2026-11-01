import EmbeddedPostgres from "embedded-postgres";
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const local = resolve(".local");
mkdirSync(local, { recursive: true });
const stateFile = resolve(local, "database.json");
const state = existsSync(stateFile) ? JSON.parse(readFileSync(stateFile, "utf8")) : { user: "dukaanpilot_local", password: randomBytes(24).toString("hex"), port: 55432 };
if (!existsSync(stateFile)) writeFileSync(stateFile, JSON.stringify(state), { mode: 0o600 });
const pg = new EmbeddedPostgres({ databaseDir: resolve(local, "postgres"), user: state.user, password: state.password, port: state.port, authMethod: "scram-sha-256", persistent: true, createPostgresUser: false, initdbFlags: ["--locale=C", "--encoding=UTF8"], postgresFlags: ["-h", "127.0.0.1", "-c", "max_connections=30"], onLog: () => undefined, onError: message => { if (String(message).includes("FATAL")) console.error("Local PostgreSQL reported a startup error."); } });
if (!existsSync(resolve(local, "postgres/PG_VERSION"))) await pg.initialise();
await pg.start();
const client = pg.getPgClient();
await client.connect();
for (const name of ["dukaanpilot", "dukaanpilot_test"]) {
  if (!(await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [name])).rowCount) await client.query(`CREATE DATABASE "${name}"`);
}
await client.end();
const url = name => `postgresql://${state.user}:${state.password}@127.0.0.1:${state.port}/${name}`;
writeFileSync(resolve(local, "services.json"), JSON.stringify({ databaseUrl: url("dukaanpilot"), testDatabaseUrl: url("dukaanpilot_test") }), { mode: 0o600 });
const envPath = resolve(".env.local");
let env = existsSync(envPath) ? readFileSync(envPath, "utf8") : "";
const line = `DATABASE_URL=${url("dukaanpilot")}`;
// Never overwrite an intentionally configured external database.
if (!/^DATABASE_URL=.+$/m.test(env)) env = /^DATABASE_URL=.*$/m.test(env) ? env.replace(/^DATABASE_URL=.*$/m, line) : env + "\n" + line + "\n";
writeFileSync(envPath, env, { mode: 0o600 });
console.log("Local PostgreSQL ready on 127.0.0.1:55432 (development and isolated test databases). Keep this terminal open; Ctrl+C stops the server.");
async function stop() { await pg.stop(); process.exit(0); }
process.once("SIGINT", stop);
process.once("SIGTERM", stop);
