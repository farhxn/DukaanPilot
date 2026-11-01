import type { NextRequest } from "next/server";
import { api, mutationContext } from "@/server/http";
import { channelStatus, revokeOwnerChannel } from "@/server/whatsapp/pairing";
export function GET(request: NextRequest) { return api(request, ({ db, identity }) => channelStatus(db, identity)); }
export function DELETE(request: NextRequest) { return api(request, ({ db, identity, requestId }) => revokeOwnerChannel(db, identity, mutationContext(request, requestId))); }
