import env from "@next/env";
env.loadEnvConfig(process.cwd());
const required = ["META_ACCESS_TOKEN", "META_APP_SECRET", "META_WEBHOOK_VERIFY_TOKEN", "META_GRAPH_API_VERSION", "META_REVIEW_REFERENCE"];
const present = Object.fromEntries(required.map(key => [key, Boolean(process.env[key]?.trim())]));
let origin;
try { origin = new URL(process.env.APP_URL ?? "http://127.0.0.1:3000"); } catch { origin = null; }
const publicHTTPS = !!origin && origin.protocol === "https:" && !["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname) && !origin.username && !origin.password;
const ready = Object.values(present).every(Boolean) && publicHTTPS;
console.log(JSON.stringify({
  configurationPresent: present,
  publicHTTPS,
  webhookPath: "/api/v1/webhooks/whatsapp",
  outboundEnabled: process.env.WHATSAPP_OUTBOUND_ENABLED === "true",
  appRollingAttemptLimitPerNumber: 900, rollingDays: 33,
  configuredForReview: ready,
  liveVerified: false,
  next: ready ? "Verify Meta webhook subscription, dedicated number routing, owner pairing, worker and permitted recipients before enabling sends." : "Follow docs/WHATSAPP_SETUP.md for Meta's free test-number setup. Do not paste tokens into chat.",
}, null, 2));
// Presence is not provider/IAM/billing verification. Never contacts Meta or sends.
if (!ready) process.exitCode = 2;
