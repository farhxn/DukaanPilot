export type Environment = Readonly<Record<string, string | undefined>>;

export class ConfigurationError extends Error {
  constructor(key: string, reason: string) {
    super(`Invalid configuration: ${key} ${reason}`);
    this.name = "ConfigurationError";
  }
}

/** Server-only alternative to ADC on hosts without a Google workload identity. */
export function firebaseServiceAccount(env: Environment) {
  if (!env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim()) return undefined;
  try {
    const value = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON);
    if (!value || value.type !== "service_account" || value.project_id !== env.FIREBASE_PROJECT_ID ||
      typeof value.client_email !== "string" || !value.client_email.endsWith(".iam.gserviceaccount.com") ||
      typeof value.private_key !== "string" || !value.private_key.startsWith("-----BEGIN PRIVATE KEY-----\n") ||
      !value.private_key.trimEnd().endsWith("-----END PRIVATE KEY-----")) throw new Error();
    return { projectId: value.project_id as string, clientEmail: value.client_email as string, privateKey: value.private_key as string };
  } catch {
    throw new ConfigurationError("FIREBASE_SERVICE_ACCOUNT_JSON", "must be valid service-account JSON for FIREBASE_PROJECT_ID; credential details are withheld.");
  }
}

function flag(env: Environment, key: string): boolean {
  const value = env[key];
  if (value === undefined || value === "false") return false;
  if (value === "true") return true;
  throw new ConfigurationError(key, "must be true or false.");
}

function boundedNumber(env: Environment, key: string, fallback: number, minimum: number, maximum: number, integer = true) {
  const raw = env[key];
  const value = raw === undefined ? fallback : Number(raw);
  if (raw === "" || !Number.isFinite(value) || value < minimum || value > maximum || (integer && !Number.isInteger(value))) {
    throw new ConfigurationError(key, `must be ${integer ? "an integer" : "a number"} between ${minimum} and ${maximum}.`);
  }
  return value;
}

function url(env: Environment, key: string, production: boolean) {
  const raw = env[key] ?? "http://localhost:3000";
  try {
    const parsed = new URL(raw);
    if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password || (production && parsed.protocol !== "https:")) throw new Error();
    return parsed.origin;
  } catch {
    throw new ConfigurationError(key, `must be ${production ? "an HTTPS" : "an HTTP(S)"} URL without credentials.`);
  }
}

/** Pure validation. Does not read process.env, log inputs, or contact providers. */
export function parseServerConfig(env: Environment) {
  const appEnv = env.APP_ENV ?? "development";
  if (!["development", "test", "production"].includes(appEnv)) throw new ConfigurationError("APP_ENV", "has an unsupported mode.");
  const production = appEnv === "production";
  firebaseServiceAccount(env);
  const authEnabled = flag(env, "AUTH_ENABLED");
  if (production && !authEnabled) throw new ConfigurationError("AUTH_ENABLED", "must be true in production.");
  const emulatorHost = env.FIREBASE_AUTH_EMULATOR_HOST?.trim() || null;
  if (emulatorHost && (production || env.NODE_ENV === "production")) throw new ConfigurationError("FIREBASE_AUTH_EMULATOR_HOST", "is forbidden in production, including production-built servers.");
  if (emulatorHost && !/^127\.0\.0\.1:\d{2,5}$/.test(emulatorHost)) throw new ConfigurationError("FIREBASE_AUTH_EMULATOR_HOST", "must be a loopback host and port without a URL scheme.");
  if (authEnabled) {
    for (const key of ["DATABASE_URL", "FIREBASE_PROJECT_ID", "NEXT_PUBLIC_FIREBASE_PROJECT_ID", "NEXT_PUBLIC_FIREBASE_API_KEY", "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN", "NEXT_PUBLIC_FIREBASE_APP_ID"]) if (!env[key]?.trim()) throw new ConfigurationError(key, "is required when authentication is enabled.");
    if (env.FIREBASE_PROJECT_ID !== env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) throw new ConfigurationError("FIREBASE_PROJECT_ID", "must match the public web project ID.");
    try { if (!["postgres:", "postgresql:"].includes(new URL(env.DATABASE_URL!).protocol)) throw new Error(); } catch { throw new ConfigurationError("DATABASE_URL", "must be a PostgreSQL connection URL."); }
    if (production && new URL(env.DATABASE_URL!).searchParams.get("sslmode") !== "verify-full") throw new ConfigurationError("DATABASE_URL", "must use sslmode=verify-full in production.");
  }
  if (env.BUSINESS_CURRENCY && env.BUSINESS_CURRENCY !== "PKR") throw new ConfigurationError("BUSINESS_CURRENCY", "must be PKR.");
  if (env.BUSINESS_TIMEZONE && env.BUSINESS_TIMEZONE !== "Asia/Karachi") throw new ConfigurationError("BUSINESS_TIMEZONE", "must be Asia/Karachi.");

  const aiEnabled = flag(env, "AI_ENABLED");
  const liveData = flag(env, "AI_LIVE_DATA_ENABLED");
  const outboundEnabled = flag(env, "WHATSAPP_OUTBOUND_ENABLED");
  const paidTemplates = flag(env, "WHATSAPP_PAID_TEMPLATES_ENABLED");
  if (aiEnabled) {
    for (const key of ["GEMINI_API_KEY", "GEMINI_MODEL_ID", "AI_INPUT_PRICE_USD_PER_MILLION", "AI_OUTPUT_PRICE_USD_PER_MILLION"]) {
      if (!env[key]?.trim()) throw new ConfigurationError(key, "is required when AI is enabled.");
    }
    if (!authEnabled) throw new ConfigurationError("AI_ENABLED", "requires authenticated workspaces.");
    if (!liveData || !env.AI_REVIEW_REFERENCE?.trim()) throw new ConfigurationError("AI_REVIEW_REFERENCE", "must reference the owner's activation decision and pending or completed provider review before AI is enabled.");
    if (!/^[a-zA-Z0-9_.-]{1,100}$/.test(env.GEMINI_MODEL_ID!)) throw new ConfigurationError("GEMINI_MODEL_ID", "must be an explicit reviewed model ID.");
    for (const key of ["AI_INPUT_PRICE_USD_PER_MILLION", "AI_OUTPUT_PRICE_USD_PER_MILLION"]) if (!/^\d{1,6}(?:\.\d{1,6})?$/.test(env[key]!) || Number(env[key]) <= 0) throw new ConfigurationError(key, "must be a positive reviewed decimal rate with at most six decimal places.");
  }
  if (liveData && !aiEnabled) throw new ConfigurationError("AI_LIVE_DATA_ENABLED", "requires AI_ENABLED and the recorded review.");
  if (outboundEnabled) {
    if (!authEnabled) throw new ConfigurationError("WHATSAPP_OUTBOUND_ENABLED", "requires authenticated workspaces.");
    for (const key of ["META_ACCESS_TOKEN", "META_APP_SECRET", "META_WEBHOOK_VERIFY_TOKEN", "META_GRAPH_API_VERSION", "META_REVIEW_REFERENCE"]) if (!env[key]?.trim()) throw new ConfigurationError(key, "is required for reviewed WhatsApp dispatch.");
    if (!/^v\d{2}\.0$/.test(env.META_GRAPH_API_VERSION!)) throw new ConfigurationError("META_GRAPH_API_VERSION", "must be an explicitly reviewed Graph API version.");
  }
  if (paidTemplates) throw new ConfigurationError("WHATSAPP_PAID_TEMPLATES_ENABLED", "is unavailable while the pilot paid-template allocation is zero; use dashboard fallback outside the service window.");
  if (env.APP_ROLE && !["web", "worker"].includes(env.APP_ROLE)) throw new ConfigurationError("APP_ROLE", "must be web or worker.");
  if (env.QUIET_HOURS_START && env.QUIET_HOURS_START !== "21:00") throw new ConfigurationError("QUIET_HOURS_START", "must be 21:00.");
  if (env.QUIET_HOURS_END && env.QUIET_HOURS_END !== "09:00") throw new ConfigurationError("QUIET_HOURS_END", "must be 09:00.");

  const limits = {
    inputTokens: boundedNumber(env, "AI_MAX_INPUT_TOKENS", 4000, 1, 4000),
    outputTokens: boundedNumber(env, "AI_MAX_OUTPUT_TOKENS", 600, 1, 600),
    calls: boundedNumber(env, "AI_MAX_CALLS_PER_INSTRUCTION", 2, 1, 2),
    timeoutMs: boundedNumber(env, "AI_TIMEOUT_MS", 15000, 1, 15000),
    textCharacters: boundedNumber(env, "AI_MAX_TEXT_CHARACTERS", 2000, 1, 2000),
    jobAttempts: boundedNumber(env, "JOB_MAX_ATTEMPTS", 3, 1, 3),
    checks: boundedNumber(env, "WORKFLOW_MAX_CHECKS", 3, 1, 3),
    reminders: boundedNumber(env, "WORKFLOW_MAX_OWNER_REMINDERS", 2, 0, 2),
    updates: boundedNumber(env, "WORKFLOW_MAX_CUSTOMER_UPDATES", 1, 0, 1),
    lifetimeHours: boundedNumber(env, "WORKFLOW_MAX_LIFETIME_HOURS", 72, 1, 72),
    reminderIntervalHours: boundedNumber(env, "WORKFLOW_MIN_REMINDER_INTERVAL_HOURS", 12, 12, 72),
    proposalTtlHours: boundedNumber(env, "PROPOSAL_TTL_HOURS", 24, 1, 24),
    workerPollMs: boundedNumber(env, "WORKER_POLL_INTERVAL_MS", 5000, 1000, 60000),
    messageRetentionDays: boundedNumber(env, "MESSAGE_BODY_RETENTION_DAYS", 30, 1, 30),
  };
  const budgets = {
    globalDaily: boundedNumber(env, "AI_GLOBAL_DAILY_BUDGET_USD", 1, 0, 1, false),
    globalMonthly: boundedNumber(env, "AI_GLOBAL_MONTHLY_BUDGET_USD", 25, 0, 25, false),
    tenantDaily: boundedNumber(env, "AI_TENANT_DAILY_BUDGET_USD", 0.1, 0, 0.1, false),
    tenantMonthly: boundedNumber(env, "AI_TENANT_MONTHLY_BUDGET_USD", 2, 0, 2, false),
  };
  if (production && url(env, "APP_URL", true) !== url(env, "NEXT_PUBLIC_APP_URL", true)) throw new ConfigurationError("NEXT_PUBLIC_APP_URL", "must match the production application origin.");
  if (budgets.tenantDaily > budgets.globalDaily || budgets.tenantMonthly > budgets.globalMonthly) throw new ConfigurationError("AI_TENANT_BUDGET", "cannot exceed the corresponding global budget.");
  return {
    appEnv,
    authEnabled,
    emulatorHost,
    appUrl: url(env, "APP_URL", production),
    publicAppUrl: url(env, "NEXT_PUBLIC_APP_URL", production),
    currency: "PKR" as const,
    timezone: "Asia/Karachi" as const,
    aiEnabled,
    outboundEnabled,
    followUpEnabled: env.FOLLOW_UP_ENABLED === undefined ? true : flag(env, "FOLLOW_UP_ENABLED"),
    limits,
    budgets,
  };
}
