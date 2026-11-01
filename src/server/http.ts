import "server-only";
import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { Prisma } from "../generated/prisma/client";
import { currentIdentity } from "./auth/session";
import { getServerConfig } from "./config";
import { getDb } from "./db";
import { DomainError } from "./errors";
import type { Mutation } from "./domain/tenancy";
import { rateLimit } from "./whatsapp/ingress";

export function assertOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (origin !== getServerConfig().appUrl || request.headers.get("x-dukaanpilot-request") !== "1") throw new DomainError("CSRF_REJECTED", 403, "This request did not come from your workspace. Refresh and try again.");
  const site = request.headers.get("sec-fetch-site");
  if (site && !["same-origin", "none"].includes(site)) throw new DomainError("CSRF_REJECTED", 403, "Cross-site requests are not permitted.");
}

export async function jsonBody(request: Request) {
  if (!/^application\/json(?:;|$)/i.test(request.headers.get("content-type") ?? "")) throw new DomainError("JSON_REQUIRED", 400, "Send a JSON request.");
  // Bound streaming reads as well as advertised length; never buffer an
  // attacker-controlled body in full before applying the size limit.
  const reader = request.body?.getReader();
  if (!reader) throw new DomainError("INVALID_JSON", 400, "Send a JSON request body.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > 16384) { await reader.cancel(); throw new DomainError("BODY_TOO_LARGE", 413, "This request is too large."); }
      chunks.push(chunk.value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
  } catch (error) {
    if (error instanceof DomainError) throw error;
    throw new DomainError("INVALID_JSON", 400, "The request could not be read as JSON.");
  }
}

export function mutationContext(request: Request, requestId: string): Mutation {
  return { key: request.headers.get("idempotency-key") ?? "", requestId };
}

export function response(data: unknown, requestId: string, status = 200) {
  return NextResponse.json({ data, requestId }, { status, headers: { "Cache-Control": "private, no-store" } });
}

export async function api(request: NextRequest, operation: (context: { identity: NonNullable<Awaited<ReturnType<typeof currentIdentity>>>; db: ReturnType<typeof getDb>; requestId: string }) => Promise<unknown>, status = 200) {
  const requestId = randomUUID();
  try {
    if (!["GET", "HEAD"].includes(request.method)) assertOrigin(request);
    if (!getServerConfig().authEnabled) throw new DomainError("AUTH_NOT_CONFIGURED", 503, "Sign-in is not configured yet.");
    const identity = await currentIdentity();
    if (!identity) throw new DomainError("UNAUTHENTICATED", 401, "Please sign in to your workspace.");
    if (!await getDb().$transaction(tx => rateLimit(tx, `web:${identity.subject}:${request.method === "GET" ? "read" : "write"}`, request.method === "GET" ? 300 : 120, 60000, new Date()))) throw new DomainError("RATE_LIMITED", 429, "Too many requests. Please wait a minute.");
    return response(await operation({ identity, db: getDb(), requestId }), requestId, status);
  } catch (error) { return apiError(error, requestId); }
}

export function apiError(error: unknown, requestId: string) {
  let safe: DomainError;
  if (error instanceof DomainError) safe = error;
  else if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") safe = new DomainError("DUPLICATE_CONTACT", 409, "That phone number is already used in this directory, including archived contacts.");
  else if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") safe = new DomainError("INVALID_REFERENCE", 422, "This record cannot reference the selected workspace.");
  else {
    safe = new DomainError("SERVICE_UNAVAILABLE", 503, "Your workspace is temporarily unavailable. Please try again.");
    const details = error as { name?: unknown; code?: unknown } | null;
    const allowed = ["Error", "TypeError", "PrismaClientValidationError", "PrismaClientKnownRequestError", "PrismaClientUnknownRequestError", "PrismaClientInitializationError", "PrismaClientRustPanicError"];
    console.error(JSON.stringify({ event: "workspace_request_failed", requestId, type: typeof details?.name === "string" && allowed.includes(details.name) ? details.name : "Unknown", ...(typeof details?.code === "string" && /^P\d{4}$/.test(details.code) ? { code: details.code } : {}) }));
  }
  return NextResponse.json({ error: { code: safe.code, message: safe.message, ...(safe.fieldErrors ? { fieldErrors: safe.fieldErrors } : {}) }, requestId }, { status: safe.status, headers: { "Cache-Control": "private, no-store" } });
}
