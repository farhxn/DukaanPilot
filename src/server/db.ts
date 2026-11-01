import "server-only";
import { createHash } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import { DomainError } from "./errors";

const globalDb = globalThis as unknown as { dukaanDb?: PrismaClient; dukaanDbSchema?: string };

export function getDb() {
  if (!process.env.DATABASE_URL) throw new DomainError("DATABASE_NOT_CONFIGURED", 503, "Business storage is not configured yet.");
  // Bump this schema generation after regenerating models; restart dev afterward.
  // Constructor identity differs between route bundles in development.
  const signature = createHash("sha256").update("sale-due-schema-v3:" + process.env.DATABASE_URL).digest("hex");
  if (!globalDb.dukaanDb || globalDb.dukaanDbSchema !== signature) {
    globalDb.dukaanDb = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL, max: 2, connectionTimeoutMillis: 10000, idleTimeoutMillis: 10000 }) });
    globalDb.dukaanDbSchema = signature;
  }
  return globalDb.dukaanDb;
}
