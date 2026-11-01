import type { NextRequest } from "next/server";
import { api } from "@/server/http";
import { ledger } from "@/server/domain/reports";
export function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) { return api(request, async ({ db, identity }) => ledger(db, identity, (await params).id, request.nextUrl.searchParams)); }
