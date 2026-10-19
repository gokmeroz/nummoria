import { Queue } from "bullmq";
import { getRedisConnection } from "./redis.js";

export const PUSH_QUEUE_NAME = "pushQueue";

let queue = null;

// Lazy: see queues/redis.js for why nothing connects at import time.
export function getPushQueue() {
  if (!queue) {
    queue = new Queue(PUSH_QUEUE_NAME, { connection: getRedisConnection() });
    // The shared connection already warns once per outage (redis.js);
    // without a listener BullMQ prints every reconnect failure again.
    queue.on("error", () => {});
  }
  return queue;
}

export async function closePushQueue() {
  if (!queue) return;
  const q = queue;
  queue = null;
  // close() waits for a reachable Redis; don't let shutdown hang on it.
  await Promise.race([q.close(), new Promise((r) => setTimeout(r, 1000).unref())]);
}
