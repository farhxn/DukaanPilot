import { ConfigurationError, firebaseServiceAccount, parseServerConfig, type Environment } from "./schema.ts";

/** Offline checks only: cannot attest to provider billing or live connectivity. */
export function validateFreeDeployment(env: Environment) {
  const config = parseServerConfig(env);
  if (config.appEnv !== "production") throw new ConfigurationError("APP_ENV", "must be production for deployment.");
  if (env.CONTEXT && env.CONTEXT !== "production") throw new ConfigurationError("CONTEXT", "preview/branch deployments must not use production data.");
  if (!firebaseServiceAccount(env)) throw new ConfigurationError("FIREBASE_SERVICE_ACCOUNT_JSON", "is required for this Netlify profile.");
  if (env.WHATSAPP_OUTBOUND_ENABLED !== "false" || env.WHATSAPP_PAID_TEMPLATES_ENABLED !== "false") throw new ConfigurationError("WHATSAPP_OUTBOUND_ENABLED", "and paid templates must explicitly remain false for free web deployment.");
  if (env.FOLLOW_UP_ENABLED !== "false") throw new ConfigurationError("FOLLOW_UP_ENABLED", "must be false because this profile has no durable worker.");
  if (env.NEXT_DIST_DIR) throw new ConfigurationError("NEXT_DIST_DIR", "must be absent for the production output directory.");
  return { status: "configuration-valid", profile: "netlify-free-web", aiEnabled: config.aiEnabled, followUpEnabled: false, whatsappEnabled: false };
}
