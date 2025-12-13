import { Queue } from "bullmq";
import { connection } from "./redis.js";

export const REMINDER_QUEUE_NAME = "reminderQueue";

export const reminderQueue = new Queue(REMINDER_QUEUE_NAME, { connection });
