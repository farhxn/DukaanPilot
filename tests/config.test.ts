import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { parseServerConfig } from "../src/server/config/schema.ts";

test("local shell runs without keys, database or provider calls", () => {
  const config = parseServerConfig({});
  assert.equal(config.aiEnabled, false);
  assert.equal(config.outboundEnabled, false);
  assert.equal(config.timezone, "Asia/Karachi");
  assert.equal(config.currency, "PKR");
});

test("business AI requires explicit live-data activation and an owner decision reference", () => {
  const env = { AUTH_ENABLED: "true", DATABASE_URL: "postgresql://synthetic:synthetic@127.0.0.1/test", FIREBASE_PROJECT_ID: "demo-test", NEXT_PUBLIC_FIREBASE_PROJECT_ID: "demo-test", NEXT_PUBLIC_FIREBASE_API_KEY: "public-fixture", NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "demo-test.firebaseapp.com", NEXT_PUBLIC_FIREBASE_APP_ID: "fixture", AI_ENABLED: "true", AI_LIVE_DATA_ENABLED: "true", AI_REVIEW_REFERENCE: "owner-decision-provider-review-pending", GEMINI_API_KEY: "synthetic-key", GEMINI_MODEL_ID: "fixture-model", AI_INPUT_PRICE_USD_PER_MILLION: "0.30", AI_OUTPUT_PRICE_USD_PER_MILLION: "2.50" };
  assert.equal(parseServerConfig(env).aiEnabled, true);
  assert.throws(() => parseServerConfig({ ...env, AI_LIVE_DATA_ENABLED: "false" }), /AI_REVIEW_REFERENCE/);
  assert.throws(() => parseServerConfig({ ...env, AI_REVIEW_REFERENCE: "" }), /AI_REVIEW_REFERENCE/);
  assert.throws(() => parseServerConfig({ ...env, AI_ENABLED: "false" }), /requires AI_ENABLED/);
});

test("the documented environment example is a valid disabled configuration", () => {
  const entries = readFileSync(".env.example", "utf8").split(/\r?\n/).filter(line => line && !line.startsWith("#")).map(line => {
    const i = line.indexOf("=");
    return [line.slice(0, i), line.slice(i + 1)];
  });
  assert.equal(parseServerConfig(Object.fromEntries(entries)).aiEnabled, false);
});

test("unknown flags fail closed instead of treating false-like strings as truthy", () => {
  for (const value of ["1", "yes", "FALSE", "", "undefined"]) {
    assert.throws(() => parseServerConfig({ AI_ENABLED: value }), /must be true or false/);
  }
});

test("provider flags require authentication and reviewed account prerequisites", () => {
  assert.throws(() => parseServerConfig({ AI_ENABLED: "true" }), /GEMINI_API_KEY/);
  assert.throws(() => parseServerConfig({ AI_ENABLED: "true", GEMINI_API_KEY: "synthetic-secret", GEMINI_MODEL_ID: "test", AI_INPUT_PRICE_USD_PER_MILLION: "0.1", AI_OUTPUT_PRICE_USD_PER_MILLION: "0.4" }), /authenticated workspaces/);
  for (const key of ["WHATSAPP_OUTBOUND_ENABLED", "WHATSAPP_PAID_TEMPLATES_ENABLED", "AI_LIVE_DATA_ENABLED"]) assert.throws(() => parseServerConfig({ [key]: "true" }));
});

test("financial locale and all configured retry/workflow bounds cannot expand silently", () => {
  for (const [key, value] of Object.entries({ BUSINESS_CURRENCY: "USD", BUSINESS_TIMEZONE: "UTC", AI_MAX_CALLS_PER_INSTRUCTION: "3", JOB_MAX_ATTEMPTS: "4", WORKFLOW_MAX_CHECKS: "4", WORKFLOW_MAX_OWNER_REMINDERS: "3", WORKFLOW_MAX_CUSTOMER_UPDATES: "2", WORKFLOW_MAX_LIFETIME_HOURS: "73", WORKFLOW_MIN_REMINDER_INTERVAL_HOURS: "11", QUIET_HOURS_START: "20:00", PROPOSAL_TTL_HOURS: "25", APP_ROLE: "unknown" })) assert.throws(() => parseServerConfig({ [key]: value }), Error, key);
});

test("invalid budgets are rejected and secret values are absent from errors/config", () => {
  for (const value of ["-1", "NaN", "Infinity", "", "100"]) assert.throws(() => parseServerConfig({ AI_GLOBAL_DAILY_BUDGET_USD: value }));
  assert.throws(() => parseServerConfig({ AI_GLOBAL_DAILY_BUDGET_USD: "0" }), /cannot exceed/);
  const config = parseServerConfig({ GEMINI_API_KEY: "synthetic-private-key" });
  assert.ok(!JSON.stringify(config).includes("synthetic-private-key"));
  assert.throws(() => parseServerConfig({ APP_URL: "https://synthetic-user:synthetic-secret@example.test" }), (error: unknown) => error instanceof Error && !error.message.includes("synthetic-secret"));
});

test("production environment requires explicit HTTPS app origins", () => {
  const production = { APP_ENV: "production", AUTH_ENABLED: "true", DATABASE_URL: "postgresql://synthetic:synthetic@example.test/db?sslmode=verify-full", FIREBASE_PROJECT_ID: "demo-test", NEXT_PUBLIC_FIREBASE_PROJECT_ID: "demo-test", NEXT_PUBLIC_FIREBASE_API_KEY: "public-fixture", NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "demo-test.firebaseapp.com", NEXT_PUBLIC_FIREBASE_APP_ID: "fixture" };
  assert.throws(() => parseServerConfig({ APP_ENV: "production" }), /AUTH_ENABLED/);
  assert.throws(() => parseServerConfig(production), /HTTPS/);
  assert.equal(parseServerConfig({ ...production, APP_URL: "https://app.example.test", NEXT_PUBLIC_APP_URL: "https://app.example.test" }).appUrl, "https://app.example.test");
  assert.throws(() => parseServerConfig({ ...production, DATABASE_URL: "postgresql://synthetic:synthetic@example.test/db", APP_URL: "https://app.example.test", NEXT_PUBLIC_APP_URL: "https://app.example.test" }), /verify-full/);
});

test("emulator tokens cannot be enabled in production or on a remote emulator host", () => {
  assert.throws(() => parseServerConfig({ APP_ENV: "production", AUTH_ENABLED: "true", FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099" }), /forbidden in production/);
  assert.throws(() => parseServerConfig({ NODE_ENV: "production", FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099" }), /forbidden in production/);
  assert.throws(() => parseServerConfig({ FIREBASE_AUTH_EMULATOR_HOST: "evil.example:9099" }), /loopback/);
  assert.throws(() => parseServerConfig({ AUTH_ENABLED: "true" }), /DATABASE_URL/);
});
