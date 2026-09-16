// backend/src/eval/datasets/synthetic/generateProfiles.js
//
// Produces an abstract, layout-independent transaction history: dates,
// signed amounts, categories. Merchant-name text (which depends on
// language/layout) is filled in later by render.js — kept separate so the
// same underlying financial history can be rendered through any bank layout.

import { randInt, randFloat, chance } from "./rng.js";

const DAY_MS = 86400000;

function toISODate(d) {
  return d.toISOString().slice(0, 10);
}

function addDays(base, days) {
  return new Date(base.getTime() + days * DAY_MS);
}

const DISCRETIONARY = [
  { category: "Groceries", freqPerMonth: 8, amountRange: [15, 120] },
  { category: "Dining", freqPerMonth: 9, amountRange: [8, 60] },
  { category: "Transport", freqPerMonth: 10, amountRange: [5, 70] },
  { category: "Investments", freqPerMonth: 2, amountRange: [50, 500] },
];

/**
 * @param {() => number} rng  seeded PRNG (see rng.js)
 * @param {{days?: number, startDate?: string}} opts
 * @returns {{ startDate: string, endDate: string, transactions: Array<{date:string, amount:number, category:string, type:string}> }}
 */
export function generateProfile(rng, opts = {}) {
  const days = opts.days ?? 90;
  const start = new Date(`${opts.startDate ?? "2025-01-01"}T00:00:00.000Z`);
  const end = addDays(start, days);

  const monthlySalary = randFloat(rng, 3000, 7000, 2);
  const salaryDay = randInt(rng, 1, 5);
  const rentAmount = randFloat(rng, 800, 2200, 2);
  const rentDay = randInt(rng, 1, 3);
  const hasInternet = chance(rng, 0.8);
  const hasStreaming = chance(rng, 0.7);

  const transactions = [];

  // Walk month-by-month within [start, end) for the fixed-schedule items.
  let cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  while (cursor < end) {
    const y = cursor.getUTCFullYear();
    const m = cursor.getUTCMonth();

    const salaryDate = new Date(Date.UTC(y, m, salaryDay));
    if (salaryDate >= start && salaryDate < end) {
      transactions.push({
        date: toISODate(salaryDate),
        amount: monthlySalary,
        category: "Salary",
        type: "income",
      });
    }

    const rentDate = new Date(Date.UTC(y, m, rentDay));
    if (rentDate >= start && rentDate < end) {
      transactions.push({
        date: toISODate(rentDate),
        amount: -rentAmount,
        category: "Rent",
        type: "expense",
      });
    }

    if (hasInternet) {
      const d = new Date(Date.UTC(y, m, randInt(rng, 5, 10)));
      if (d >= start && d < end) {
        transactions.push({
          date: toISODate(d),
          amount: -randFloat(rng, 35, 70, 2),
          category: "Utilities",
          type: "expense",
        });
      }
    }
    if (hasStreaming) {
      const d = new Date(Date.UTC(y, m, randInt(rng, 1, 28)));
      if (d >= start && d < end) {
        transactions.push({
          date: toISODate(d),
          amount: -randFloat(rng, 8, 20, 2),
          category: "Utilities",
          type: "expense",
        });
      }
    }

    cursor = new Date(Date.UTC(y, m + 1, 1));
  }

  // Discretionary spend: scattered occurrences across the whole window.
  for (const spec of DISCRETIONARY) {
    const occurrences = Math.max(1, Math.round((spec.freqPerMonth * days) / 30));
    for (let i = 0; i < occurrences; i++) {
      const d = addDays(start, randInt(rng, 0, days - 1));
      transactions.push({
        date: toISODate(d),
        amount: -randFloat(rng, spec.amountRange[0], spec.amountRange[1], 2),
        category: spec.category,
        type: "expense",
      });
    }
  }

  transactions.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  return { startDate: toISODate(start), endDate: toISODate(end), transactions };
}
