import { test } from "node:test";
import assert from "node:assert/strict";
import { computeMetrics } from "./financialMetrics.js";

const tx = (date, amount, category = "Other") => ({ date, amount, category });

test("empty or non-array input: empty metrics, no NaN", () => {
  for (const input of [[], undefined, null, "nope"]) {
    const m = computeMetrics(input);
    assert.equal(m.txCount, 0);
    assert.equal(m.savingsRate, null);
    assert.equal(m.dataFlags.sparse, true);
  }
});

test("malformed rows are dropped and counted, never summed", () => {
  const good = [tx("2025-01-05", 1000, "Salary"), tx("2025-01-10", -200, "Groceries")];
  const m = computeMetrics([...good, tx("2025-01-11", "12.50"), tx("not a date", -5), tx("2025-01-12", NaN), null]);
  assert.equal(m.invalidRows, 4);
  assert.deepEqual(m, { ...computeMetrics(good), invalidRows: 4 });
});

test("only invalid rows: empty metrics with the count", () => {
  const m = computeMetrics([tx("x", 1), tx("2025-01-01", "1")]);
  assert.equal(m.txCount, 0);
  assert.equal(m.invalidRows, 2);
});

test("savings rate and burn on a hand-computed month", () => {
  const m = computeMetrics([tx("2025-03-01", 4000, "Salary"), tx("2025-03-02", -1500, "Rent"), tx("2025-03-15", -500, "Groceries")]);
  // net 2000 / income 4000
  assert.equal(m.savingsRate, 50);
  assert.equal(m.monthlyBurn, 2000);
  assert.equal(m.categoryBreakdown.Rent, -1500);
});

test("Date objects are accepted like ISO strings", () => {
  const a = computeMetrics([tx("2025-03-01", 100), tx("2025-03-02", -50)]);
  const b = computeMetrics([tx(new Date("2025-03-01T00:00:00Z"), 100), tx(new Date("2025-03-02T00:00:00Z"), -50)]);
  assert.deepEqual(a, b);
});
