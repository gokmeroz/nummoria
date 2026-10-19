// backend/src/services/recurringService.js
//
// Materializes occurrences of recurring transactions (templates created via
// POST /transactions with `frequency`, which sets `nextProcessedDate`).
//
// NOT SCHEDULED ANYWHERE YET. startRecurringExpenseCron() exists, but
// nothing calls it: enabling it starts writing ledger rows for every user
// with a recurring template, and one product question is open first —
// should a generated occurrence move Account.balance like a manual entry
// does? (It doesn't here, matching the previous implementation.)
//
// Guarantees (tested in recurringService.test.js):
//   - each occurrence is booked once: children are keyed by
//     (recurrenceParentId, recurrenceDate) under a unique index, and the
//     template only advances after its occurrence exists — a crash between
//     the two steps is repaired by the next run, not duplicated by it
//   - concurrent runs: the duplicate insert fails on the index, and the
//     template advance is compare-and-set on nextProcessedDate
//   - missed runs catch up with correctly dated occurrences (bounded)
//   - children carry the template's userId (the old job omitted it, which
//     the schema rejects) and never recur themselves
import cron from "node-cron";
import { Transaction } from "../models/transaction.js";
import { ensureIndexOnce } from "../utils/ensureIndex.js";

const FREQUENCIES = ["daily", "weekly", "monthly", "yearly"];
// A template that hasn't run for years must not write thousands of rows in
// one go; the rest is picked up on later runs.
const MAX_OCCURRENCES_PER_TEMPLATE_PER_RUN = 62;

function startOfUTC(date) {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export function nextOccurrence(date, frequency) {
  const d = new Date(date);
  if (frequency === "daily") d.setUTCDate(d.getUTCDate() + 1);
  else if (frequency === "weekly") d.setUTCDate(d.getUTCDate() + 7);
  else if (frequency === "monthly") d.setUTCMonth(d.getUTCMonth() + 1);
  else if (frequency === "yearly") d.setUTCFullYear(d.getUTCFullYear() + 1);
  else throw new Error(`unknown frequency: ${frequency}`);
  return d;
}

/**
 * @returns {Promise<{ templates: number, created: number, alreadyBooked: number }>}
 */
export async function processDueRecurringTransactions({ now = new Date() } = {}) {
  // The once-per-occurrence guarantee IS this index (autoIndex is off in
  // production, so don't assume it was built at startup).
  await ensureIndexOnce(
    Transaction,
    { recurrenceParentId: 1, recurrenceDate: 1 },
    { unique: true, partialFilterExpression: { recurrenceParentId: { $exists: true } } },
  );
  const today = startOfUTC(now);
  const templates = await Transaction.find({
    frequency: { $in: FREQUENCIES },
    nextProcessedDate: { $lte: today },
    isDeleted: { $ne: true },
    recurrenceParentId: { $exists: false },
  }).lean();

  let created = 0;
  let alreadyBooked = 0;

  for (const tpl of templates) {
    let occurrence = tpl.nextProcessedDate;
    for (let n = 0; n < MAX_OCCURRENCES_PER_TEMPLATE_PER_RUN && occurrence <= today; n++) {
      if (tpl.endDate && occurrence > tpl.endDate) break;

      try {
        await Transaction.create({
          userId: tpl.userId,
          accountId: tpl.accountId,
          categoryId: tpl.categoryId ?? null,
          type: tpl.type,
          amountMinor: tpl.amountMinor,
          currency: tpl.currency,
          date: occurrence,
          description: tpl.description || "Recurring transaction",
          tags: tpl.tags || [],
          isDeleted: false,
          recurrenceParentId: tpl._id,
          recurrenceDate: occurrence,
        });
        created++;
      } catch (e) {
        if (e?.code !== 11000) throw e;
        alreadyBooked++; // a previous (crashed) or concurrent run booked it
      }

      const next = nextOccurrence(occurrence, tpl.frequency);
      const advanced = await Transaction.updateOne(
        { _id: tpl._id, nextProcessedDate: occurrence },
        { $set: { nextProcessedDate: next } },
      );
      if (advanced.modifiedCount === 0) break; // another run moved it on
      occurrence = next;
    }
  }

  return { templates: templates.length, created, alreadyBooked };
}

// Runs every day at 00:05 server time. Not called anywhere — see header.
export const startRecurringExpenseCron = () =>
  cron.schedule("5 0 * * *", async () => {
    try {
      const r = await processDueRecurringTransactions();
      console.log(`[CRON] recurring: ${r.created} created, ${r.alreadyBooked} already booked, ${r.templates} templates`);
    } catch (error) {
      console.error("[CRON] Failed to process recurring transactions:", error?.message || error);
    }
  });
