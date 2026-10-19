// Local benchmark entry point; never imported by normal application startup.
import fs from "node:fs";
import { monitorEventLoopDelay, performance } from "node:perf_hooks";
import mongoose from "mongoose";

if (process.env.NODE_ENV !== "test" || process.env.NUMMORIA_LOAD_TEST !== "local-only") {
  throw new Error("Load entry point requires the isolated local runner");
}
const uri = new URL(process.env.MONGO_URI.replace(/^mongodb:/, "http:"));
if (uri.hostname !== "127.0.0.1" || !/^\/nummoria_load_[a-z0-9_]+$/.test(uri.pathname)) {
  throw new Error("Refusing non-local/non-load database");
}
const { connectDB } = await import("../config/db.js");
await connectDB();
const { default: app } = await import("../app.js");
const client = mongoose.connection.getClient();
let waits = [], waiting = 0, checkedOut = 0, peakWaiting = 0, peakCheckedOut = 0, checkoutFailures = 0;
client.on("connectionCheckOutStarted", () => { waiting++; peakWaiting = Math.max(peakWaiting, waiting); });
client.on("connectionCheckedOut", (e) => {
  waiting = Math.max(0, waiting - 1); checkedOut++;
  peakCheckedOut = Math.max(peakCheckedOut, checkedOut);
  if (Number.isFinite(e.durationMS)) waits.push(e.durationMS);
});
client.on("connectionCheckedIn", () => { checkedOut = Math.max(0, checkedOut - 1); });
client.on("connectionCheckOutFailed", () => { waiting = Math.max(0, waiting - 1); checkoutFailures++; });
const loop = monitorEventLoopDelay({ resolution: 20 }); loop.enable();
let cpu = process.cpuUsage(), at = performance.now();
const stream = fs.createWriteStream(process.env.PERF_RESOURCE_PATH, { flags: "wx" });
const sample = () => {
  const now = performance.now(), usage = process.cpuUsage(cpu), elapsed = now - at;
  cpu = process.cpuUsage(); at = now;
  waits.sort((a, b) => a - b);
  const percentile = (p) => waits.length ? waits[Math.min(waits.length - 1, Math.floor((waits.length - 1) * p))] : null;
  stream.write(JSON.stringify({
    time: new Date().toISOString(), pid: process.pid,
    cpuPercentOfOneCore: (usage.user + usage.system) / (elapsed * 10),
    rssBytes: process.memoryUsage().rss,
    eventLoopP95Ms: loop.percentile(95) / 1e6,
    eventLoopMaxMs: loop.max / 1e6,
    pool: { samples: waits.length, p95CheckoutMs: percentile(0.95), maxCheckoutMs: waits.at(-1) ?? null,
      waiting, checkedOut, peakWaiting, peakCheckedOut, checkoutFailures },
  }) + "\n");
  waits = []; loop.reset();
};
const interval = setInterval(sample, 1000);
const server = app.listen(0, "127.0.0.1", () => process.send?.({ ready: true, port: server.address().port }));
async function close() {
  clearInterval(interval); sample(); loop.disable();
  server.closeAllConnections();
  await new Promise((r) => server.close(r));
  const { closeQueues } = await import("../queues/index.js");
  const { closeQuotaRedis } = await import("../middlewares/aiQuota.js");
  await Promise.allSettled([closeQueues(), closeQuotaRedis(), mongoose.disconnect()]);
  stream.end(() => process.exit(0));
}
process.once("SIGTERM", close);
process.once("SIGINT", close);
