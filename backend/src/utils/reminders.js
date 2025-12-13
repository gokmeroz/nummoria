// backend/src/utils/reminders.js
import { reminderQueue } from "../queues/reminderQueue.js";

/**
 * Upsert a reminder job for a transaction.
 * - jobId is stable per transaction: `tx_<transactionId>`
 * - delay is computed from remindAt
 */
export async function upsertTransactionReminderJob({
  transactionId,
  remindAt,
  payload,
}) {
  if (!transactionId) throw new Error("transactionId is required");
  if (!remindAt) throw new Error("remindAt is required");

  const remindAtDate = new Date(remindAt);
  if (Number.isNaN(remindAtDate.getTime())) throw new Error("Invalid remindAt");

  const delay = remindAtDate.getTime() - Date.now();

  // If already due/past, do not schedule (and clear any previous job)
  if (delay <= 0) {
    await removeTransactionReminderJob(transactionId);
    return { scheduled: false, reason: "delay<=0" };
  }

  const jobId = `tx_${String(transactionId)}`;

  // Remove previous job (if exists) then add again (true upsert)
  await reminderQueue.remove(jobId).catch(() => {});

  const job = await reminderQueue.add("transaction-reminder", payload, {
    jobId,
    delay,
    removeOnComplete: true,
    removeOnFail: 50,
  });

  return { scheduled: true, jobId: job.id, delay };
}

/**
 * Remove the reminder job for a transaction (by stable jobId).
 */
export async function removeTransactionReminderJob(transactionId) {
  if (!transactionId) return;
  const jobId = `tx_${String(transactionId)}`;
  await reminderQueue.remove(jobId).catch(() => {});
}
