import { getDb } from "@/server/db";
import { getServerConfig } from "@/server/config";
export async function GET() {
  try {
    getServerConfig();
    const db = getDb();
    await db.$queryRaw`SELECT 1`;
    // Empty ID set reads no business records but verifies both generated-client
    // and database support for the financial schema used by approval writes.
    await db.sale.findMany({ where: { id: { in: [] } }, select: { id: true, dueAt: true }, take: 1 });
    return Response.json({ status: "ready" }, { headers: { "Cache-Control": "no-store" } });
  }
  catch { return Response.json({ status: "unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } }); }
}
