import type { NextRequest } from "next/server";
import { api } from "@/server/http";
import { financialCustomers } from "@/server/domain/reports";
export function GET(request: NextRequest) { return api(request, ({ db, identity }) => financialCustomers(db, identity, request.nextUrl.searchParams.get("q") ?? "")); }
