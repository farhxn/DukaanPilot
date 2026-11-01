import { readFileSync } from "node:fs";
import { spawn } from "node:child_process";

const services = JSON.parse(readFileSync(".local/services.json", "utf8"));
const url = new URL(services.testDatabaseUrl);
if (url.hostname !== "127.0.0.1" || url.pathname !== "/dukaanpilot_test") throw new Error("Integration tests require the isolated loopback dukaanpilot_test database.");
const env = { ...process.env, DATABASE_URL: services.testDatabaseUrl, DIRECT_DATABASE_URL: services.testDatabaseUrl };
async function run(args) {
  const child = spawn(process.execPath, args, { env, stdio: "inherit", windowsHide: true });
  const code = await new Promise(resolve => child.once("exit", resolve));
  if (code !== 0) process.exit(Number(code) || 1);
}
await run(["node_modules/prisma/build/index.js", "migrate", "deploy"]);
await run(["--conditions=react-server", "--experimental-strip-types", "--test", "--test-concurrency=1", "tests/integration/s2.test.ts", "tests/integration/s3.test.ts", "tests/integration/s4.test.ts", "tests/integration/s5.test.ts", "tests/integration/s6.test.ts", "tests/integration/s7.test.ts", "tests/integration/s8.test.ts"]);
