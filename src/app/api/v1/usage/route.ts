import type { NextRequest } from "next/server";
import { api } from "@/server/http";
import { usage } from "@/server/ai/metering";
export function GET(request: NextRequest) { return api(request, ({ db, identity }) => usage(db, identity)); }
