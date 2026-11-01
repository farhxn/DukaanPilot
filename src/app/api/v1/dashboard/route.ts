import type { NextRequest } from "next/server";
import { api } from "@/server/http";
import { dashboard } from "@/server/domain/reports";
export function GET(request: NextRequest) { return api(request, ({ db, identity }) => dashboard(db, identity, request.nextUrl.searchParams.get("date") ?? undefined)); }
