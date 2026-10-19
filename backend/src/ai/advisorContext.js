// backend/src/ai/advisorContext.js
//
// Which ledger rows the advisor's arithmetic (computeMetrics) runs over, and
// with what sign. Pure, so the scope rules are unit-tested rather than
// implied by a Mongo query.
//
// Scope rules:
//   - posted rows only: a future-dated (planned) row has not happened and
//     does not affect the balance either (transactionCreateCore)
//   - income is +, expense AND investment are − (money leaving the account,
//     same as the balance rule); the old mapping treated investments as
//     income, inflating income and the savings rate
//   - transfers are excluded: this endpoint has no sign for them
//   - one currency: summing USD and TRY minor units is meaningless, so the
//     metrics use the currency with the most rows and report what was left out
import { minorToMajor } from "../utils/money.js";

const SIGN = { income: 1, expense: -1, investment: -1 };

function endOfTodayUTC(now) {
  const d = new Date(now);
  d.setUTCHours(23, 59, 59, 999);
  return d;
}

/**
 * @param {Array} dbTxs lean Transaction docs (categoryId may be populated)
 * @returns {{ parsedTransactions: Array, currency: string|null,
 *   excluded: { future: number, transfer: number, otherCurrency: number, invalid: number } }}
 */
export function ledgerToAdvisorTransactions(dbTxs, { now = new Date() } = {}) {
  const excluded = { future: 0, transfer: 0, otherCurrency: 0, invalid: 0 };
  const cutoff = endOfTodayUTC(now);

  const eligible = [];
  for (const t of dbTxs || []) {
    const date = t?.date instanceof Date ? t.date : new Date(t?.date);
    if (Number.isNaN(date.getTime()) || !Number.isFinite(Number(t?.amountMinor)) || !t?.currency) {
      excluded.invalid++;
      continue;
    }
    if (t.type === "transfer") {
      excluded.transfer++;
      continue;
    }
    if (!(t.type in SIGN)) {
      excluded.invalid++;
      continue;
    }
    if (date > cutoff) {
      excluded.future++;
      continue;
    }
    eligible.push({ t, date });
  }

  const byCurrency = new Map();
  for (const { t } of eligible) {
    const c = String(t.currency).toUpperCase();
    byCurrency.set(c, (byCurrency.get(c) || 0) + 1);
  }
  const currency =
    [...byCurrency.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0]?.[0] ?? null;

  const parsedTransactions = [];
  for (const { t, date } of eligible) {
    const c = String(t.currency).toUpperCase();
    if (c !== currency) {
      excluded.otherCurrency++;
      continue;
    }
    parsedTransactions.push({
      date: date.toISOString().slice(0, 10),
      amount: SIGN[t.type] * Math.abs(minorToMajor(t.amountMinor, c)),
      description: t.description || "",
      type: t.type,
      category: t.categoryId?.name || t.type,
      currency: c,
    });
  }

  return { parsedTransactions, currency, excluded };
}
