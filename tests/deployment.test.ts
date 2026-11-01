import assert from "node:assert/strict";
import { test } from "node:test";
import { generateKeyPairSync } from "node:crypto";
import { cert } from "firebase-admin/app";
import { firebaseServiceAccount, parseServerConfig } from "../src/server/config/schema.ts";
import { validateFreeDeployment } from "../src/server/config/free-deployment.ts";

const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048, privateKeyEncoding: { type: "pkcs8", format: "pem" }, publicKeyEncoding: { type: "spki", format: "pem" } });
const account = JSON.stringify({ type: "service_account", project_id: "synthetic-project", client_email: "test@synthetic-project.iam.gserviceaccount.com", private_key: privateKey });
const env = { APP_ENV: "production", CONTEXT: "production", AUTH_ENABLED: "true", DATABASE_URL: "postgresql://test:test@ep-synthetic-pooler.example.test/db?sslmode=verify-full", APP_URL: "https://synthetic.netlify.app", NEXT_PUBLIC_APP_URL: "https://synthetic.netlify.app", FIREBASE_PROJECT_ID: "synthetic-project", NEXT_PUBLIC_FIREBASE_PROJECT_ID: "synthetic-project", NEXT_PUBLIC_FIREBASE_API_KEY: "public-fixture", NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "synthetic-project.firebaseapp.com", NEXT_PUBLIC_FIREBASE_APP_ID: "fixture", FIREBASE_SERVICE_ACCOUNT_JSON: account, WHATSAPP_OUTBOUND_ENABLED: "false", WHATSAPP_PAID_TEMPLATES_ENABLED: "false", FOLLOW_UP_ENABLED: "false" };

test("free deployment validates offline without exposing service credentials", () => {
  const result = validateFreeDeployment(env);
  assert.equal(result.status, "configuration-valid");
  assert.equal(result.followUpEnabled, false);
  assert.ok(!JSON.stringify(result).includes("PRIVATE KEY"));
  // SDK accepts the supplied credential without making any network request.
  assert.ok(cert(firebaseServiceAccount(env)!));
  assert.equal(firebaseServiceAccount({}), undefined);
});

test("malformed or mismatched service credentials fail without revealing values", () => {
  for (const value of ["synthetic-private-secret", "null", "{}", account.replace("synthetic-project", "foreign-project")]) {
    assert.throws(() => firebaseServiceAccount({ ...env, FIREBASE_SERVICE_ACCOUNT_JSON: value }), (error: unknown) => error instanceof Error && error.message.includes("FIREBASE_SERVICE_ACCOUNT_JSON") && !error.message.includes(value));
  }
});

test("free profile rejects local mode, missing credentials and production-data previews", () => {
  assert.throws(() => validateFreeDeployment({ ...env, APP_ENV: "development" }), /APP_ENV/);
  assert.throws(() => validateFreeDeployment({ ...env, FIREBASE_SERVICE_ACCOUNT_JSON: "" }), /FIREBASE_SERVICE_ACCOUNT_JSON/);
  for (const context of ["deploy-preview", "branch-deploy"]) assert.throws(() => validateFreeDeployment({ ...env, CONTEXT: context }), /CONTEXT/);
  assert.throws(() => validateFreeDeployment({ ...env, FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099" }), /forbidden/);
  assert.throws(() => validateFreeDeployment({ ...env, NEXT_DIST_DIR: ".next-s2-tests" }), /NEXT_DIST_DIR/);
});

test("free profile requires explicit disabled worker and paid-channel flags", () => {
  assert.throws(() => validateFreeDeployment({ ...env, FOLLOW_UP_ENABLED: "true" }), /FOLLOW_UP_ENABLED/);
  assert.throws(() => validateFreeDeployment({ ...env, FOLLOW_UP_ENABLED: undefined }), /FOLLOW_UP_ENABLED/);
  assert.throws(() => validateFreeDeployment({ ...env, WHATSAPP_OUTBOUND_ENABLED: undefined }), /WHATSAPP_OUTBOUND_ENABLED/);
  assert.throws(() => validateFreeDeployment({ ...env, WHATSAPP_PAID_TEMPLATES_ENABLED: "true" }), /WHATSAPP_PAID_TEMPLATES_ENABLED/);
  assert.equal(parseServerConfig({}).followUpEnabled, true);
  assert.equal(parseServerConfig({ FOLLOW_UP_ENABLED: "false" }).followUpEnabled, false);
  assert.throws(() => parseServerConfig({ FOLLOW_UP_ENABLED: "no" }), /FOLLOW_UP_ENABLED/);
});
