import { Queue } from "bullmq";
import { getRedisConnection } from "./redis.js";

export const REMINDER_QUEUE_NAME = "reminderQueue";

let queue = null;

// Lazy: see queues/redis.js for why nothing connects at import time.
export function getReminderQueue() {
  if (!queue) {
    queue = new Queue(REMINDER_QUEUE_NAME, { connection: getRedisConnection() });
    // The shared connection already warns once per outage (redis.js);
    // without a listener BullMQ prints every reconnect failure again.
    queue.on("error", () => {});
  }
  return queue;
}

export async function closeReminderQueue() {
  if (!queue) return;
  const q = queue;
  queue = null;
  // close() waits for a reachable Redis; don't let shutdown hang on it.
  await Promise.race([q.close(), new Promise((r) => setTimeout(r, 1000).unref())]);
}
