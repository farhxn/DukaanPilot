import "server-only";
import { getServerConfig } from "./config";
import { currentIdentity } from "./auth/session";
import { getBusiness } from "./domain/business";
import { getDb } from "./db";

/** Explicit public projection only. No records or credentials reach the UI. */
export async function getWorkspaceStatus() {
  const config = getServerConfig();
  const identity = await currentIdentity();
  let businessName: string | null = null;
  let accessNotice: string | null = null;
  if (identity) {
    try { businessName = (await getBusiness(getDb(), identity))?.name ?? null; }
    catch { accessNotice = "Business access is unavailable. Contact your workspace administrator."; }
  }
  return {
    mode: "preview" as const,
    currency: config.currency,
    timezone: config.timezone,
    authEnabled: config.authEnabled,
    signedIn: !!identity,
    businessName,
    accountLabel: identity?.email ?? null,
    accessNotice,
    localTest: !!config.emulatorHost,
    whatsappEnabled: config.outboundEnabled,
    dateLabel: new Intl.DateTimeFormat("en-GB", {
      timeZone: config.timezone,
      weekday: "long",
      day: "numeric",
      month: "long",
    }).format(new Date()),
  };
}
