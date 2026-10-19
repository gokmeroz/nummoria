import { test } from "node:test";
import assert from "node:assert/strict";
import { matchRows, scoreExtraction } from "./scorecard.js";

const row = (date, amount, description, category = "Other") => ({ date, amount, description, category });
const score = (extracted, groundTruth) =>
  scoreExtraction([{ id: "c", layout: "L", format: "csv", extracted, groundTruth }]);

test("perfect extraction scores 1.0 on every field", () => {
  const gt = [row("2025-01-01", -5, "CAFE", "Dining"), row("2025-01-02", 10, "PAY", "Salary")];
  const r = score(gt.map((x) => ({ ...x })), gt);
  for (const f of ["date", "amount", "description", "category"]) assert.equal(r.aggregate[f].f1, 1);
  assert.equal(r.rows.financialExactRecall, 1);
});

test("a missing row is a false negative for every field", () => {
  const gt = [row("2025-01-01", -5, "CAFE"), row("2025-01-02", 10, "PAY")];
  const r = score([gt[0]], gt);
  assert.deepEqual([r.aggregate.amount.tp, r.aggregate.amount.fp, r.aggregate.amount.fn], [1, 0, 1]);
  assert.equal(r.aggregate.amount.precision, 1);
  assert.equal(r.aggregate.amount.recall, 0.5);
});

test("an extra row is a false positive for every field", () => {
  const gt = [row("2025-01-01", -5, "CAFE")];
  const r = score([gt[0], row("2025-02-09", -99, "PHANTOM")], gt);
  assert.deepEqual([r.aggregate.date.tp, r.aggregate.date.fp, r.aggregate.date.fn], [1, 1, 0]);
});

test("a wrong field in a matched row is FP+FN for that field only", () => {
  const gt = [row("2025-01-01", -5, "CAFE")];
  const r = score([row("2025-01-01", -50, "CAFE")], gt);
  assert.equal(r.aggregate.date.f1, 1);
  assert.equal(r.aggregate.description.f1, 1);
  assert.deepEqual([r.aggregate.amount.tp, r.aggregate.amount.fp, r.aggregate.amount.fn], [0, 1, 1]);
  assert.equal(r.rows.financialExact, 0);
});

test("empty extraction: zero scores, every ground-truth row a false negative", () => {
  const r = score([], [row("2025-01-01", -5, "CAFE")]);
  assert.equal(r.aggregate.date.f1, 0);
  assert.equal(r.aggregate.date.fn, 1);
  assert.equal(r.perCase[0].meanConfidence, null);
});

test("duplicate legitimate transactions match one-to-one: one copy of two is a miss", () => {
  const coffee = row("2025-01-03", -4.5, "LOCAL CAFE");
  const r = score([{ ...coffee }], [coffee, { ...coffee }]);
  assert.equal(r.aggregate.amount.tp, 1);
  assert.equal(r.aggregate.amount.fn, 1);
});

test("repeated date+amount with different merchants pair by description", () => {
  const gt = [row("2025-01-03", -10, "BOOKSHOP"), row("2025-01-03", -10, "CINEMA")];
  const { pairs } = matchRows([row("2025-01-03", -10, "CINEMA"), row("2025-01-03", -10, "BOOKSHOP")], gt);
  assert.deepEqual(
    pairs.map((p) => [p.ex.description, p.gt.description]),
    [
      ["BOOKSHOP", "BOOKSHOP"],
      ["CINEMA", "CINEMA"],
    ],
  );
});

test("matching is order-independent (the old greedy matcher was not)", () => {
  // The old greedy matcher, in this order, gave the BETA row the ALPHA
  // ground truth (date+amount) and left ALPHA with BETA: 0 description TPs.
  // Reversed, it found 2. Best-first gives 2 in both orders: ALPHA<->ALPHA
  // (all fields), BETA<->BETA (amount+description; the date is wrong).
  const gt = [row("2025-01-01", -10, "ALPHA"), row("2025-01-02", -10, "BETA")];
  const ex = [row("2025-01-01", -10, "BETA"), row("2025-01-01", -10, "ALPHA")];
  const a = score(ex, gt);
  const b = score([...ex].reverse(), gt);
  assert.deepEqual(a.aggregate, b.aggregate);
  assert.equal(a.aggregate.description.tp, 2);
  assert.equal(a.aggregate.date.tp, 1);
});

test("one agreeing signal is not a match (no free date credit for an unrelated row)", () => {
  const gt = [row("2025-01-01", -10, "ALPHA")];
  const { pairs } = matchRows([row("2025-01-01", -999, "ZULU")], gt);
  assert.equal(pairs.length, 0);
});

test("rows without confidence are 'not measured', not zero confidence", () => {
  const gt = [row("2025-01-01", -5, "CAFE")];
  const r = score([{ ...gt[0] }], gt);
  assert.equal(r.perCase[0].meanConfidence, null);
});

test("aggregation is micro-averaged across cases", () => {
  const r = scoreExtraction([
    { id: "a", layout: "L", format: "csv", extracted: [row("2025-01-01", 1, "A")], groundTruth: [row("2025-01-01", 1, "A")] },
    {
      id: "b",
      layout: "L",
      format: "csv",
      extracted: [],
      groundTruth: [row("2025-01-01", 1, "B"), row("2025-01-02", 1, "C"), row("2025-01-03", 1, "D")],
    },
  ]);
  // 1 TP, 3 FN -> recall 0.25 (a per-case macro mean would say 0.5)
  assert.equal(r.aggregate.amount.recall, 0.25);
});
