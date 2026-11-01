import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { currentIdentity } from "@/server/auth/session";
import { getDb } from "@/server/db";
import { apiError } from "@/server/http";
import { DomainError } from "@/server/errors";
import { exportLedger } from "@/server/domain/reports";
export async function GET(request: NextRequest) {
  const requestId = randomUUID();
  try {
    const identity = await currentIdentity();
    if (!identity) throw new DomainError("UNAUTHENTICATED", 401, "Please sign in to export your ledger.");
    const result = await exportLedger(getDb(), identity, requestId, request.nextUrl.searchParams);
    return new NextResponse(result.csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${result.filename}"`, "Cache-Control": "private, no-store" } });
  } catch (error) { return apiError(error, requestId); }
}
