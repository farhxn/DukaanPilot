import type { NextRequest } from "next/server";
import { api } from "@/server/http";
import { listWorkflows } from "@/server/workflows/engine";
export function GET(request: NextRequest) { return api(request, ({ db, identity }) => listWorkflows(db, identity)); }
