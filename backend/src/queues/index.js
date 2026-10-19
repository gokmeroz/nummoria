// Close every queue this process opened, then the shared Redis connection.
// For graceful shutdown and for tests (an open ioredis socket keeps the
// process alive).
import { closeReminderQueue } from "./reminderQueue.js";
import { closePushQueue } from "./pushQueue.js";
import { closeRedisConnection } from "./redis.js";

export async function closeQueues() {
  await Promise.allSettled([closeReminderQueue(), closePushQueue()]);
  await closeRedisConnection();
}
