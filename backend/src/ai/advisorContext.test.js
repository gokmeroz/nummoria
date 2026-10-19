import { test } from "node:test";
import assert from "node:assert/strict";
import { ledgerToAdvisorTransactions } from "./advisorContext.js";

const NOW = new Date("2025-06-15T12:00:00Z");
const t = (over) => ({ type: "expense", amountMinor: 1000, currency: "USD", date: new Date("2025-06-01T00:00:00Z"), ...over });

test("income is positive; expense and investment are outflows", () => {
  const { parsedTransactions } = ledgerToAdvisorTransactions(
    [t({ type: "income", amountMinor: 500000 }), t({ type: "expense" }), t({ type: "investment", amountMinor: 20000 })],
    { now: NOW },
  );
  assert.deepEqual(
    parsedTransactions.map((x) => x.amount),
    [5000, -10, -200],
  );
});

test("transfers and future-dated (planned) rows are excluded and counted", () => {
  const r = ledgerToAdvisorTransactions([t({}), t({ type: "transfer" }), t({ date: new Date("2025-07-01T00:00:00Z") })], { now: NOW });
  assert.equal(r.parsedTransactions.length, 1);
  assert.deepEqual(r.excluded, { future: 1, transfer: 1, otherCurrency: 0, invalid: 0 });
});

test("a row dated later today is posted, not future", () => {
  const r = ledgerToAdvisorTransactions([t({ date: new Date("2025-06-15T00:00:00Z") })], { now: NOW });
  assert.equal(r.parsedTransactions.length, 1);
});

test("currencies are never summed together: the majority currency is used, others reported", () => {
  const r = ledgerToAdvisorTransactions([t({}), t({}), t({ currency: "TRY", amountMinor: 999999 })], { now: NOW });
  assert.equal(r.currency, "USD");
  assert.equal(r.parsedTransactions.length, 2);
  assert.equal(r.excluded.otherCurrency, 1);
});

test("minor units follow the currency (JPY has none, KWD has three)", () => {
  assert.equal(ledgerToAdvisorTransactions([t({ currency: "JPY", amountMinor: 1200 })], { now: NOW }).parsedTransactions[0].amount, -1200);
  assert.equal(ledgerToAdvisorTransactions([t({ currency: "KWD", amountMinor: 1500 })], { now: NOW }).parsedTransactions[0].amount, -1.5);
});

test("malformed rows are excluded, not coerced", () => {
  const r = ledgerToAdvisorTransactions([t({ amountMinor: "abc" }), t({ date: "nope" }), t({ type: "weird" }), null], { now: NOW });
  assert.equal(r.parsedTransactions.length, 0);
  assert.equal(r.excluded.invalid, 4);
});

test("populated category name is used; otherwise the type", () => {
  const r = ledgerToAdvisorTransactions([t({ categoryId: { name: "Groceries" } }), t({})], { now: NOW });
  assert.deepEqual(
    r.parsedTransactions.map((x) => x.category),
    ["Groceries", "expense"],
  );
});
