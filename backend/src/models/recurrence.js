// backend/src/services/recurrence.js
import { Transaction } from "../models/transaction.js";

/**
 * Expand due templates into concrete instances up to 'horizon' date (default: today).
 * Intended to be called from a cron/queue worker.
 */
export async function materializeDueTransactions({
  userId,
  horizon = new Date(),
}) {
  const now = horizon;

  // 1) Find due templates
  const templates = await Transaction.find({
    userId,
    isDeleted: { $ne: true },
    "recurrence.isTemplate": true,
    "recurrence.frequency": { $ne: "none" },
    "recurrence.nextRunAt": { $lte: now },
  }).lean();

  const created = [];

  for (const t of templates) {
    const r = t.recurrence;
    if (!r?.nextRunAt) continue;

    // respect end bounds
    if (r.endDate && r.nextRunAt > new Date(r.endDate)) {
      // nothing more to generate, consider clearing nextRunAt if you want
      continue;
    }

    const scheduledFor = new Date(
      Date.UTC(
        r.nextRunAt.getUTCFullYear(),
        r.nextRunAt.getUTCMonth(),
        r.nextRunAt.getUTCDate()
      )
    );

    // 2) Create an instance if not exists
    try {
      const instance = await Transaction.create({
        userId: t.userId,
        accountId: t.accountId,
        categoryId: t.categoryId,
        type: t.type,
        amountMinor: t.amountMinor,
        currency: t.currency,

        // Instance "date" is the scheduled day (can be adjusted to business rules)
        date: scheduledFor,

        description: t.description,
        notes: t.notes,
        tags: t.tags,
        assetSymbol: t.assetSymbol,
        units: t.units,
        isDeleted: false,

        recurrence: {
          isTemplate: false,
          parentId: t._id,
          frequency: r.frequency,
          interval: r.interval,
          startDate: r.startDate,
          endDate: r.endDate,
          maxOccurrences: r.maxOccurrences,
          byMonthDay: r.byMonthDay,
          byWeekday: r.byWeekday,
          scheduledFor,
          autopost: r.autopost,
        },
      });

      created.push(instance);

      // 3) Advance the template's nextRunAt / lastRunAt
      const nextDate = Transaction.computeNextDate(r, r.nextRunAt);
      const $set = { "recurrence.lastRunAt": r.nextRunAt };
      if (r.endDate && nextDate && nextDate > new Date(r.endDate)) {
        $set["recurrence.nextRunAt"] = undefined;
      } else {
        $set["recurrence.nextRunAt"] = nextDate;
      }

      await Transaction.updateOne({ _id: t._id }, { $set });
    } catch (err) {
      // Duplicate (unique index) -> already generated; just advance template
      if (err?.code === 11000) {
        const nextDate = Transaction.computeNextDate(r, r.nextRunAt);
        const $set = { "recurrence.lastRunAt": r.nextRunAt };
        if (r.endDate && nextDate && nextDate > new Date(r.endDate)) {
          $set["recurrence.nextRunAt"] = undefined;
        } else {
          $set["recurrence.nextRunAt"] = nextDate;
        }
        await Transaction.updateOne({ _id: t._id }, { $set });
        continue;
      }
      throw err;
    }
  }

  return created;
}
