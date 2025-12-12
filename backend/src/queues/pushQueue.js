import { Queue } from "bullmq";
import IORedis from "ioredis";

const connection = new IORedis(process.env.REDIS_URL, {
  maxRetriesPerRequest: null, // ✅ REQUIRED by BullMQ
});

export const pushQueue = new Queue("pushQueue", {
  connection,
});

export { connection };
