// backend/src/utils/reminders.js
import { getReminderQueue } from "../queues/reminderQueue.js";

// Queue calls are bounded: the shared Redis connection retries forever
// (BullMQ requires maxRetriesPerRequest: null), so with Redis down an
// un-bounded call never settles and the HTTP request awaiting it hangs.
// A reminder is a side effect of a transaction write, never a reason to
// hold or fail it.
const QUEUE_OP_TIMEOUT_MS = 2000;

function withTimeout(promise, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`${label} timed out after ${QUEUE_OP_TIMEOUT_MS}ms (is Redis reachable?)`)),
      QUEUE_OP_TIMEOUT_MS,
    );
    timer.unref?.();
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

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
  await withTimeout(getReminderQueue().remove(jobId), "reminder remove").catch(() => {});

  const job = await withTimeout(
    getReminderQueue().add("transaction-reminder", payload, {
      jobId,
      delay,
      removeOnComplete: true,
      removeOnFail: 50,
    }),
    "reminder add",
  );

  return { scheduled: true, jobId: job.id, delay };
}

/**
 * Remove the reminder job for a transaction (by stable jobId).
 */
export async function removeTransactionReminderJob(transactionId) {
  if (!transactionId) return;
  const jobId = `tx_${String(transactionId)}`;
  await withTimeout(getReminderQueue().remove(jobId), "reminder remove").catch(() => {});
}
