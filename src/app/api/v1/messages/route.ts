import type { NextRequest } from "next/server";
import { api } from "@/server/http";
import { listChannelMessages } from "@/server/whatsapp/updates";
export function GET(request: NextRequest) { return api(request, ({ db, identity }) => listChannelMessages(db, identity)); }
