import "server-only";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getServerConfig } from "../config";
import { DomainError } from "../errors";
import type { VerifiedIdentity } from "../domain/identity";
import { sessionStillValid } from "./revocation";
import { firebaseServiceAccount } from "../config/schema";

export function firebaseAdminAuth() {
  const projectId = process.env.FIREBASE_PROJECT_ID!;
  const account = firebaseServiceAccount(process.env);
  const app = getApps().find(app => app.name === "dukaanpilot-auth") ?? initializeApp({ projectId, ...(account ? { credential: cert(account) } : {}) }, "dukaanpilot-auth");
  return getAuth(app);
}
export async function verifySessionRevocation(identity: VerifiedIdentity) {
  try {
    const user = await firebaseAdminAuth().getUser(identity.uid);
    return sessionStillValid(user, identity.authenticatedAt);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "auth/user-not-found") return false;
    throw new DomainError("AUTH_SERVICE_UNAVAILABLE", 503, "Sign-in verification is temporarily unavailable. Please try again.");
  }
}

export async function verifyFirebaseIdentity(token: string): Promise<VerifiedIdentity & { expiresAt: Date }> {
  const config = getServerConfig();
  if (!config.authEnabled) throw new DomainError("AUTH_NOT_CONFIGURED", 503, "Sign-in is not configured yet.");
  const projectId = process.env.FIREBASE_PROJECT_ID!;
  try {
    // Public Firebase certificates verify signature/audience/issuer/expiry.
    // Production checks disable/revocation using ADC or a server credential.
    const claims = await firebaseAdminAuth().verifyIdToken(token, config.appEnv === "production");
    const now = Math.floor(Date.now() / 1000);
    if (!claims.email || !claims.uid || !Number.isFinite(claims.auth_time) || now - claims.auth_time > 300 || claims.auth_time > now + 30) throw new Error();
    if (!config.emulatorHost && (claims.firebase.sign_in_provider !== "google.com" || !claims.email_verified)) throw new Error();
    return { subject: `firebase:${projectId}:${claims.uid}`, uid: claims.uid, email: claims.email, name: typeof claims.name === "string" ? claims.name.slice(0, 120) : null, authenticatedAt: new Date(claims.auth_time * 1000), expiresAt: new Date(Math.min(claims.exp * 1000, Date.now() + 60 * 60 * 1000)) };
  } catch {
    throw new DomainError("UNAUTHENTICATED", 401, "Sign-in expired or could not be verified. Please sign in again.");
  }
}

export function getPublicAuthSettings() {
  const config = getServerConfig();
  return {
    enabled: config.authEnabled,
    emulatorUrl: config.authEnabled && config.emulatorHost ? `http://${config.emulatorHost}` : null,
    firebase: {
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "",
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "",
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "",
    },
  };
}
