import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs, resolveModelMode, runExtractionTrack, summarizeCascade, THRESHOLDS_PATH } from "./run.js";

const RUN = fileURLToPath(new URL("./run.js", import.meta.url));

test("model mode: requested but not authorized for paid calls stays deterministic and says why", () => {
  const m = resolveModelMode({ withLLM: true, maxLLMCases: 3 }, {}, true);
  assert.equal(m.enabled, false);
  assert.match(m.label, /not authorized/);
});

test("model mode: authorized but no provider stays deterministic and says why", () => {
  const m = resolveModelMode({ withLLM: true, maxLLMCases: 3 }, { EVAL_ALLOW_PAID_CALLS: "true" }, false);
  assert.equal(m.enabled, false);
  assert.match(m.label, /no provider/);
});

test("model mode: only requested + authorized + configured is model-assisted, with a budget", () => {
  const m = resolveModelMode({ withLLM: true, maxLLMCases: 3 }, { EVAL_ALLOW_PAID_CALLS: "true" }, true);
  assert.equal(m.enabled, true);
  assert.equal(m.budget, 3);
});

test("--with-llm requires an explicit case budget", () => {
  assert.throws(() => parseArgs(["--with-llm"]), /max-llm-cases/);
  assert.throws(() => parseArgs(["--bogus"]), /unknown argument/);
});

test("offline run: escalation candidates are counted, zero model calls are attempted", async () => {
  const fixtures = [
    {
      id: "hard",
      layout: "L",
      format: "pdf-text",
      rawText: "01/02/2025  SHOP  -5.00",
      groundTruth: [{ date: "2025-01-02", amount: -5, description: "SHOP", category: "Other" }],
    },
  ];
  const mode = resolveModelMode({ withLLM: false });
  const result = await runExtractionTrack(fixtures, mode);
  const summary = summarizeCascade(result, mode);
  assert.equal(summary.wouldEscalate, 1);
  assert.deepEqual(summary.decisions, { "skipped:llm-disabled": 1 });
  assert.equal(summary.modelCallsAttempted, 0);
});

function runEval(args) {
  return spawnSync(process.execPath, [RUN, ...args], { env: { ...process.env, NODE_ENV: "test" }, encoding: "utf8" });
}

test("end to end: the committed eval passes its committed thresholds and writes a valid report", () => {
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "nummoria-eval-")), "report.json");
  const r = runEval(["--out", out]);
  assert.equal(r.status, 0, r.stderr || r.stdout);
  const report = JSON.parse(fs.readFileSync(out, "utf8"));
  assert.equal(report.modes.extraction, "deterministic-text-to-transactions");
  assert.equal(report.modes.ocr, "not-tested");
  assert.equal(report.gate.passed, true);
  assert.equal(report.extraction.golden.cascade.modelCallsAttempted, 0);
});

test("end to end: a violated threshold exits 1 (a printed scorecard is not a pass)", () => {
  const strict = JSON.parse(fs.readFileSync(THRESHOLDS_PATH, "utf8"));
  strict.extraction.golden.aggregateF1Min.category = 0.999;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "nummoria-eval-"));
  fs.writeFileSync(path.join(dir, "t.json"), JSON.stringify(strict));
  const r = runEval(["--thresholds", path.join(dir, "t.json"), "--out", path.join(dir, "r.json")]);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /category F1/);
});

test("end to end: unreadable thresholds exit 2", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "nummoria-eval-"));
  fs.writeFileSync(path.join(dir, "t.json"), "{");
  const r = runEval(["--thresholds", path.join(dir, "t.json"), "--out", path.join(dir, "r.json")]);
  assert.equal(r.status, 2);
});
