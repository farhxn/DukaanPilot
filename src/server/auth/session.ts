import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { getServerConfig } from "../config";
import { getDb } from "../db";
import { resolveSession, SESSION_COOKIE } from "./session-core";
import { verifySessionRevocation } from "./firebase";

export const currentIdentity = cache(async () => {
  if (!getServerConfig().authEnabled) return null;
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const identity = await resolveSession(getDb(), token);
  if (identity && getServerConfig().appEnv === "production" && !await verifySessionRevocation(identity)) return null;
  return identity;
});
