import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { assertOrigin, apiError, jsonBody, response } from "@/server/http";
import { verifyFirebaseIdentity } from "@/server/auth/firebase";
import { issueSession, revokeSession, SESSION_COOKIE } from "@/server/auth/session-core";
import { getDb } from "@/server/db";
import { getServerConfig } from "@/server/config";
import { object, text } from "@/server/domain/validation";
import { rateLimit } from "@/server/whatsapp/ingress";
import { DomainError } from "@/server/errors";

export async function POST(request: NextRequest) {
  const requestId = randomUUID();
  try {
    assertOrigin(request);
    if (!await getDb().$transaction(tx => rateLimit(tx, "auth-exchange-global", 120, 60000, new Date()))) throw new DomainError("RATE_LIMITED", 429, "Too many sign-in attempts. Please wait a minute.");
    const input = object(await jsonBody(request), ["idToken"]);
    const identity = await verifyFirebaseIdentity(text(input.idToken, "idToken", 12000));
    const db = getDb();
    const session = await issueSession(db, identity, identity.expiresAt);
    await revokeSession(db, request.cookies.get(SESSION_COOKIE)?.value);
    const result = response({ signedIn: true }, requestId);
    result.cookies.set(SESSION_COOKIE, session.token, { httpOnly: true, secure: getServerConfig().appEnv === "production" || process.env.NODE_ENV === "production", sameSite: "lax", path: "/", expires: session.expiresAt });
    return result;
  } catch (error) { return apiError(error, requestId); }
}

export async function DELETE(request: NextRequest) {
  const requestId = randomUUID();
  try {
    assertOrigin(request);
    if (getServerConfig().authEnabled) await revokeSession(getDb(), request.cookies.get(SESSION_COOKIE)?.value);
    const result: NextResponse = response({ signedIn: false }, requestId);
    result.cookies.set(SESSION_COOKIE, "", { httpOnly: true, secure: getServerConfig().appEnv === "production" || process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 });
    return result;
  } catch (error) { return apiError(error, requestId); }
}
