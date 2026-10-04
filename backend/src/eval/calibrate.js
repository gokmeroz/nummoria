#!/usr/bin/env node
// backend/src/eval/calibrate.js — does parser-self confidence mean anything?
//
// npm run eval:calibrate                          -> gate = confidence.overall (what ships)
// npm run eval:calibrate -- --fields date,amount  -> gate = min over just these fields
// npm run eval:calibrate -- --agg min              -> doc gate = worst row, not mean row
//
// Evidence for choosing the escalation gate, not a decision. Two tables:
//
// 1. Reliability per field: for every confidence value the parser emits,
//    how often that field is actually correct against ground truth. A
//    calibrated score has accuracy ≈ the score itself; a big positive gap
//    means the score is needlessly pessimistic (it will escalate rows that
//    were fine), a negative gap means it is overconfident (it will keep
//    rows that were wrong).
//
// 2. Threshold sweep per document: if we escalated every document whose
//    mean gate value is below t, what fraction would escalate, and how good
//    were the escalated vs. kept documents? A useful gate escalates the bad
//    documents and keeps the good ones — the recall columns should separate.
//
// Deterministic tier only (no model calls), over the golden pdf-text cases.

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { parseTransactionsFromText } from "../ai/pdfParser.js";
import { FIELDS, matchRows, fieldsAgree } from "./scorecard.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GOLDEN_EXTRACTION_DIR = path.join(__dirname, "datasets", "golden", "extraction");

function parseArgs(argv) {
  const i = argv.indexOf("--fields");
  const fields = i >= 0 ? argv[i + 1].split(",").map((s) => s.trim()) : null;
  for (const f of fields || []) {
    if (!FIELDS.includes(f)) throw new Error(`--fields: unknown field "${f}" (use ${FIELDS.join(",")})`);
  }
  const j = argv.indexOf("--agg");
  const agg = j >= 0 ? argv[j + 1] : "avg";
  if (!["avg", "min"].includes(agg)) throw new Error(`--agg: use avg or min, got "${agg}"`);
  return { fields, agg };
}

// The per-row value the gate averages. null fields = the shipped behaviour
// (confidence.overall, which is min over all four fields + multiline cap).
function gateValue(tx, fields) {
  if (!fields) return tx.confidence.overall;
  return Math.min(...fields.map((f) => tx.confidence.fields[f].value));
}

const pct = (x) => (Number.isFinite(x) ? `${(x * 100).toFixed(1)}%` : "   —");

async function main() {
  const { fields, agg } = parseArgs(process.argv.slice(2));
  const cases = fs
    .readdirSync(GOLDEN_EXTRACTION_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(fs.readFileSync(path.join(GOLDEN_EXTRACTION_DIR, f), "utf8")))
    .filter((c) => c.format === "pdf-text");

  // field -> confidence value -> { n, correct }
  const reliability = Object.fromEntries(FIELDS.map((f) => [f, new Map()]));
  const phantomConfidence = []; // extracted rows matching no real transaction
  const docs = [];

  for (const c of cases) {
    const extracted = await parseTransactionsFromText(c.rawText, { useLLMFallback: false });
    const { pairs, falsePositives } = matchRows(extracted, c.groundTruth);

    for (const { ex, gt } of pairs) {
      for (const f of FIELDS) {
        const v = ex.confidence.fields[f].value;
        const bucket = reliability[f].get(v) || { n: 0, correct: 0 };
        bucket.n++;
        if (fieldsAgree(f, ex[f], gt[f])) bucket.correct++;
        reliability[f].set(v, bucket);
      }
    }
    for (const ex of falsePositives) phantomConfidence.push(gateValue(ex, fields));

    // Document quality = share of real transactions recovered with the two
    // fields money depends on (date, amount) both right.
    const rowsRight = pairs.filter(
      ({ ex, gt }) => fieldsAgree("date", ex.date, gt.date) && fieldsAgree("amount", ex.amount, gt.amount),
    ).length;
    docs.push({
      id: c.id,
      layout: c.layout,
      gate: !extracted.length
        ? 0
        : agg === "min"
          ? Math.min(...extracted.map((t) => gateValue(t, fields)))
          : extracted.reduce((s, t) => s + gateValue(t, fields), 0) / extracted.length,
      rows: extracted.length,
      recall: c.groundTruth.length ? rowsRight / c.groundTruth.length : 1,
      phantoms: falsePositives.length,
    });
  }

  console.log(`Calibration over ${cases.length} golden pdf-text cases — row gate = ${fields ? `min(${fields.join(", ")})` : "confidence.overall (shipped)"}, doc gate = ${agg} over rows\n`);

  console.log("=== 1. Reliability: does a field's confidence predict that field being correct? ===");
  console.log("field         conf     rows   actually correct   gap (correct − conf)");
  for (const f of FIELDS) {
    for (const [v, { n, correct }] of [...reliability[f]].sort((a, b) => a[0] - b[0])) {
      const acc = correct / n;
      const gap = acc - v;
      console.log(
        `${f.padEnd(12)} ${v.toFixed(2).padStart(5)}  ${String(n).padStart(6)}   ${pct(acc).padStart(15)}   ${(gap >= 0 ? "+" : "") + (gap * 100).toFixed(1)} pts`,
      );
    }
  }
  if (phantomConfidence.length) {
    const avg = phantomConfidence.reduce((s, v) => s + v, 0) / phantomConfidence.length;
    console.log(`\nPhantom rows (extracted, but no real transaction): ${phantomConfidence.length}, mean gate value ${avg.toFixed(2)}`);
  }

  console.log("\n=== 2. Threshold sweep: escalate a document when its doc gate < t ===");
  console.log("   t    escalated   recall(escalated)   recall(kept)   worst kept doc");
  for (let t = 0.3; t <= 0.901; t += 0.05) {
    const esc = docs.filter((d) => d.gate < t);
    const kept = docs.filter((d) => d.gate >= t);
    const mean = (xs) => (xs.length ? xs.reduce((s, d) => s + d.recall, 0) / xs.length : NaN);
    const worst = kept.length ? kept.reduce((a, b) => (b.recall < a.recall ? b : a)) : null;
    console.log(
      `${t.toFixed(2).padStart(5)}   ${`${esc.length}/${docs.length}`.padStart(9)}   ${pct(mean(esc)).padStart(17)}   ${pct(mean(kept)).padStart(12)}   ${worst ? `${worst.id} ${pct(worst.recall)}` : "—"}`,
    );
  }

  console.log("\n=== Per document (sorted by gate value) ===");
  for (const d of [...docs].sort((a, b) => a.gate - b.gate)) {
    console.log(`  ${d.id}  ${d.layout.padEnd(16)} gate ${d.gate.toFixed(2)}   recall ${pct(d.recall).padStart(6)}   rows ${d.rows}   phantoms ${d.phantoms}`);
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
