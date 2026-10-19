// backend/src/workers/reminderWorker.js
import { Worker } from "bullmq";
import { getRedisConnection } from "../queues/redis.js";
import Notification from "../models/Notification.js";
import { Transaction } from "../models/transaction.js";
import { getPushQueue } from "../queues/pushQueue.js";
import { REMINDER_QUEUE_NAME } from "../queues/reminderQueue.js";

new Worker(
  REMINDER_QUEUE_NAME,
  async (job) => {
    const { userId, transactionId } = job.data;

    const tx = await Transaction.findById(transactionId).lean();
    if (!tx) return;

    // If reminder was disabled after scheduling, skip
    if (!tx.reminder?.enabled || !tx.reminder?.remindAt) return;

    const isIncome = tx.type === "income";

    const notif = await Notification.create({
      userId,
      type: "transaction.reminder",
      title: isIncome ? "Upcoming income" : "Upcoming expense",
      body: `${tx.description || "Transaction"} is coming up`,
      data: {
        route: "Transactions",
        params: { transactionId: String(tx._id) },
      },
      status: "queued",
    });

    await getPushQueue().add(
      "sendPush",
      { notificationId: String(notif._id) },
      { removeOnComplete: true, removeOnFail: 50 }
    );
  },
  { connection: getRedisConnection() }
);

console.log("[reminder-worker] worker online");
