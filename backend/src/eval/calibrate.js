#!/usr/bin/env node
// backend/src/eval/calibrate.js — does parser-self confidence mean anything?
//
// npm run eval:calibrate                          -> gate = confidence.financial (what ships:
//                                                    min(date, amount, description), multiline-capped)
// npm run eval:calibrate -- --gate overall         -> gate = confidence.overall (all four fields; the old gate)
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

import path from "path";
import { fileURLToPath } from "url";
import { parseStatementText, ESCALATION_CONFIDENCE_THRESHOLD } from "../ai/pdfParser.js";
import { FIELDS, matchRows, fieldsAgree } from "./scorecard.js";
import { loadExtractionDataset } from "./dataset.js";

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
  const k = argv.indexOf("--gate");
  const gate = k >= 0 ? argv[k + 1] : "financial";
  if (!["financial", "overall"].includes(gate)) throw new Error(`--gate: use financial or overall, got "${gate}"`);
  return { fields, agg, gate };
}

// The per-row value the gate averages. Default = the shipped behaviour
// (confidence.financial: min over date/amount/description + multiline cap).
function gateValue(tx, fields, gate) {
  if (fields) return Math.min(...fields.map((f) => tx.confidence.fields[f].value));
  return gate === "overall" ? tx.confidence.overall : tx.confidence.financial;
}

const pct = (x) => (Number.isFinite(x) ? `${(x * 100).toFixed(1)}%` : "   —");

async function main() {
  const { fields, agg, gate } = parseArgs(process.argv.slice(2));
  const cases = loadExtractionDataset(GOLDEN_EXTRACTION_DIR).fixtures.filter((c) => c.format === "pdf-text");

  // field -> confidence value -> { n, correct }
  const reliability = Object.fromEntries(FIELDS.map((f) => [f, new Map()]));
  const phantomConfidence = []; // extracted rows matching no real transaction
  const docs = [];

  for (const c of cases) {
    const extracted = parseStatementText(c.rawText).rows;
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
    for (const ex of falsePositives) phantomConfidence.push(gateValue(ex, fields, gate));

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
          ? Math.min(...extracted.map((t) => gateValue(t, fields, gate)))
          : extracted.reduce((s, t) => s + gateValue(t, fields, gate), 0) / extracted.length,
      rows: extracted.length,
      recall: c.groundTruth.length ? rowsRight / c.groundTruth.length : 1,
      phantoms: falsePositives.length,
    });
  }

  console.log(`Calibration over ${cases.length} golden pdf-text cases — row gate = ${fields ? `min(${fields.join(", ")})` : gate === "overall" ? "confidence.overall (old gate)" : "confidence.financial (shipped)"}; shipped threshold ${ESCALATION_CONFIDENCE_THRESHOLD}, doc gate = ${agg} over rows\n`);

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
