import { createConnection } from "node:net";
import { access } from "node:fs/promises";
const services = process.argv[2] === "services", deadline = Date.now() + 60000;
async function probe() {
  if (!services) return (await fetch("http://127.0.0.1:3100/login", { signal: AbortSignal.timeout(2000) })).ok;
  await access(".local/services.json");
  await new Promise((resolve, reject) => { const socket = createConnection({ host: "127.0.0.1", port: 55432 }); socket.setTimeout(1000); socket.once("connect", () => { socket.destroy(); resolve(); }); socket.once("error", reject); socket.once("timeout", () => { socket.destroy(); reject(new Error("Startup pending")); }); });
  await fetch("http://127.0.0.1:9099", { signal: AbortSignal.timeout(2000) });
  return true;
}
let ready = false;
while (Date.now() < deadline) { try { if (await probe()) { ready = true; break; } } catch {} await new Promise(resolve => setTimeout(resolve, 500)); }
if (!ready) { console.error("Local test services did not become ready within 60 seconds."); process.exitCode = 1; }
