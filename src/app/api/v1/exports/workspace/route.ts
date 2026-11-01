import type { NextRequest } from "next/server";
import { api } from "@/server/http";
import { exportWorkspace } from "@/server/operations/privacy";
export async function GET(request: NextRequest) { const result = await api(request, ({ db, identity }) => exportWorkspace(db, identity)); if (result.ok) result.headers.set("Content-Disposition", 'attachment; filename="dukaanpilot-business-data.json"'); return result; }
