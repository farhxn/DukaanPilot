import { readFileSync } from "node:fs";
import { spawn } from "node:child_process";

const services = JSON.parse(readFileSync(".local/services.json", "utf8"));
// Explicit isolated browser-fixture mode. It never uses a real model key; the
// recovery UI tests intercept extraction while exercising real owner/domain APIs.
const recovery = process.env.E2E_AI_RECOVERY === "true";
const env = { ...process.env, APP_ENV: "test", AI_ENABLED: recovery ? "true" : "false", AI_LIVE_DATA_ENABLED: recovery ? "true" : "false", GEMINI_API_KEY: "fake-browser-fixture-only", GEMINI_MODEL_ID: "fixture-model", AI_REVIEW_REFERENCE: "isolated-browser-fixture", AI_INPUT_PRICE_USD_PER_MILLION: "0.10", AI_OUTPUT_PRICE_USD_PER_MILLION: "0.40", APP_URL: "http://127.0.0.1:3100", NEXT_PUBLIC_APP_URL: "http://127.0.0.1:3100", NEXT_DIST_DIR: ".next-s2-tests", AUTH_ENABLED: "true", DATABASE_URL: services.testDatabaseUrl, FIREBASE_PROJECT_ID: "demo-dukaanpilot", NEXT_PUBLIC_FIREBASE_PROJECT_ID: "demo-dukaanpilot", NEXT_PUBLIC_FIREBASE_API_KEY: "demo-public-key", NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "demo-dukaanpilot.firebaseapp.com", NEXT_PUBLIC_FIREBASE_APP_ID: "demo-app", FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099", NEXT_TELEMETRY_DISABLED: "1" };
const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", ...(recovery ? ["--webpack"] : []), "--hostname", "127.0.0.1", "--port", "3100"], { env, stdio: "inherit", windowsHide: true });
child.once("exit", code => process.exit(code ?? 1));
