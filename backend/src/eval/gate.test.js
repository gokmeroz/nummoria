import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { checkThresholds, validateReport, ReportError } from "./gate.js";
import { loadExtractionDataset, datasetFingerprint, DatasetError } from "./dataset.js";

const prf = (f1) => ({ precision: f1, recall: f1, f1, tp: 1, fp: 0, fn: 0 });
const fields = (f1) => ({ date: prf(f1), amount: prf(f1), description: prf(f1), category: prf(f1) });
const track = (f1) => ({
  caseCount: 2,
  rows: { groundTruth: 10, extracted: 10, matched: 10, financialExact: 10, financialExactRecall: f1 },
  aggregate: fields(f1),
  layoutBreakdown: { L: fields(f1) },
});
const report = (f1 = 0.96) => ({
  modes: { extraction: "deterministic-text-to-transactions" },
  datasets: { golden: { cases: 2, rows: 10, fingerprint: "abc" } },
  extraction: { golden: track(f1), regression: track(1), pdfBinary: track(f1) },
  advisor: { passed: 3, total: 3 },
});
const thresholds = {
  version: 1,
  datasets: { golden: { cases: 2, rows: 10, fingerprint: "abc" } },
  extraction: { golden: { aggregateF1Min: { amount: 0.95 }, layoutF1Min: { L: { date: 0.95 } }, financialExactRecallMin: 0.95 } },
  advisor: { minPassRate: 1 },
};

test("passes when every threshold holds", () => {
  const r = checkThresholds(report(0.96), thresholds);
  assert.equal(r.passed, true);
  assert.equal(r.checked, 5);
});

test("a drop below any threshold fails, naming the metric", () => {
  const r = checkThresholds(report(0.9), thresholds);
  assert.equal(r.passed, false);
  assert.ok(r.failures.some((f) => f.includes("aggregate amount F1")));
  assert.ok(r.failures.some((f) => f.includes("L date F1")));
});

test("a changed dataset fails the gate even if scores went up", () => {
  const rep = report(0.99);
  rep.datasets.golden.fingerprint = "edited";
  const r = checkThresholds(rep, thresholds);
  assert.equal(r.passed, false);
  assert.match(r.failures[0], /dataset "golden" changed/);
});

test("advisor arithmetic failures fail the gate", () => {
  const rep = report();
  rep.advisor.passed = 2;
  assert.equal(checkThresholds(rep, thresholds).passed, false);
});

test("a missing layout fails rather than being skipped", () => {
  const rep = report();
  delete rep.extraction.golden.layoutBreakdown.L;
  assert.equal(checkThresholds(rep, thresholds).passed, false);
});

test("thresholds without a version are rejected", () => {
  assert.equal(checkThresholds(report(), {}).passed, false);
});

test("malformed reports throw: NaN scores, empty evals", () => {
  const nan = report();
  nan.extraction.golden.aggregate.amount.f1 = NaN;
  assert.throws(() => validateReport(nan), ReportError);
  const empty = report();
  empty.extraction.golden.caseCount = 0;
  assert.throws(() => validateReport(empty), /empty eval is not a pass/);
  assert.doesNotThrow(() => validateReport(report()));
});

function tmpDir(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "nummoria-eval-"));
  for (const [name, content] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), content);
  return dir;
}
const fixture = (over = {}) =>
  JSON.stringify({
    id: "case-1",
    layout: "L",
    format: "csv",
    rawText: "Date,Description,Amount\n01/15/2025,X,-1.00",
    groundTruth: [{ date: "2025-01-15", amount: -1, description: "X", category: "Other" }],
    ...over,
  });

test("dataset: invalid fixtures are an error, not silently skipped", () => {
  const bad = tmpDir({
    "a.json": fixture({ groundTruth: [{ date: "2025-02-30", amount: -1, description: "X", category: "Other" }] }),
    "b.json": fixture({ id: "case-2", format: "pdf" }),
    "c.json": "{not json",
  });
  assert.throws(() => loadExtractionDataset(bad), DatasetError);
  assert.throws(
    () => loadExtractionDataset(tmpDir({ "a.json": fixture({ groundTruth: [{ date: "2025-02-30", amount: "1" }] }) })),
    (e) =>
      e instanceof DatasetError &&
      e.problems.some((p) => p.includes("not a valid YYYY-MM-DD")) &&
      e.problems.some((p) => p.includes("amount must be a finite number")),
  );
});

test("dataset: duplicate ids and an empty directory are errors", () => {
  assert.throws(() => loadExtractionDataset(tmpDir({ "a.json": fixture(), "b.json": fixture() })), /duplicate id/);
  assert.throws(() => loadExtractionDataset(tmpDir({}), { minCases: 1 }), /at least 1/);
});

test("dataset: fingerprint ignores formatting but changes with any label", () => {
  const a = JSON.parse(fixture());
  const b = JSON.parse(fixture());
  assert.equal(datasetFingerprint([a]), datasetFingerprint([b]));
  b.groundTruth[0].amount = -1.01;
  assert.notEqual(datasetFingerprint([a]), datasetFingerprint([b]));
});
