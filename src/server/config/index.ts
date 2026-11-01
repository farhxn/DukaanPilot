import "server-only";
import { parseServerConfig } from "./schema";

export function getServerConfig() {
  return parseServerConfig(process.env);
}
