// backend/src/queues/redis.js
//
// One place that knows how to reach Redis. Connections are created on first
// use, not at import: the API imports the queue modules transitively (via
// transaction reminders and the notifications route), and an import-time
// IORedis client retries forever when Redis is down — the API process (and
// any test importing a controller) would never exit cleanly.
//
// REDIS_URL wins (it's what Upstash/Railway hand out); REDIS_HOST/REDIS_PORT
// remain for existing local setups.
import IORedis from "ioredis";

export function createRedisConnection() {
  const opts = {
    // REQUIRED by BullMQ workers
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  };
  const conn = process.env.REDIS_URL
    ? new IORedis(process.env.REDIS_URL, opts)
    : new IORedis({
        host: process.env.REDIS_HOST || "127.0.0.1",
        port: Number(process.env.REDIS_PORT) || 6379,
        ...opts,
      });
  // Without a listener ioredis prints an "Unhandled error event" on every
  // reconnect attempt. Warn once per outage instead.
  let warned = false;
  conn.on("error", (err) => {
    if (warned) return;
    warned = true;
    console.warn(`[redis] unavailable (${err?.code || err?.message}); queue operations will time out until it is back`);
  });
  conn.on("ready", () => {
    warned = false;
  });
  return conn;
}

let shared = null;

export function getRedisConnection() {
  if (!shared) shared = createRedisConnection();
  return shared;
}

export async function closeRedisConnection() {
  if (!shared) return;
  const conn = shared;
  shared = null;
  conn.disconnect();
}
