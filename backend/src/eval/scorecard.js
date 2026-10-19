// backend/src/eval/scorecard.js
//
// Field-level precision/recall/F1 for extraction, plus pretty-printing.
//
// Matching (a real methodology choice, documented in
// docs/ai-roadmap/EVALUATION.md):
//
//   1. An extracted row and a ground-truth row are a CANDIDATE pair only when
//      at least two of three identifying signals agree: exact date, exact
//      amount (to the cent), description token overlap >= 0.5. One signal is
//      not enough — "same day, different everything" is a different
//      transaction, and pairing it would hand out a free date true-positive.
//   2. Candidates are assigned best-first over the whole case (score =
//      2·date + 2·amount + overlap; ties go to the closest row positions),
//      each row used at most once. The previous scorer matched greedily in
//      extracted-row order, so its result depended on output order and could
//      pair a row with a worse partner than one available.
//   3. A matched pair scores TP per field that agrees, and FP+FN per field
//      that doesn't. An unmatched extracted row is an FP for every field; an
//      unmatched ground-truth row is an FN for every field.
//
// Aggregation is micro-averaged: TP/FP/FN are summed over every row of every
// case before computing P/R/F1, so long statements weigh more than short ones.
//
// Repeated legitimate transactions (same date, amount and merchant) are
// matched one-to-one, so extracting one copy of two is one FN, not a pass.

export const FIELDS = ["date", "amount", "description", "category"];
export const FINANCIAL_FIELDS = ["date", "amount", "description"];

function tokens(s) {
  return new Set(
    String(s || "")
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean),
  );
}

export function tokenOverlap(a, b) {
  const ta = tokens(a);
  const tb = tokens(b);
  if (!ta.size || !tb.size) return 0;
  let shared = 0;
  for (const t of ta) if (tb.has(t)) shared++;
  return shared / Math.max(ta.size, tb.size);
}

export function fieldsAgree(field, exVal, gtVal) {
  if (field === "amount") {
    const a = Number(exVal);
    const b = Number(gtVal);
    return Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) < 0.005;
  }
  if (field === "date") return typeof exVal === "string" && exVal === gtVal;
  return (
    String(exVal ?? "")
      .trim()
      .toLowerCase() ===
    String(gtVal ?? "")
      .trim()
      .toLowerCase()
  );
}

export function matchRows(extracted, groundTruth) {
  const candidates = [];
  extracted.forEach((ex, i) => {
    groundTruth.forEach((gt, j) => {
      const dateEq = fieldsAgree("date", ex.date, gt.date);
      const amountEq = fieldsAgree("amount", ex.amount, gt.amount);
      const overlap = tokenOverlap(ex.description, gt.description);
      const signals = Number(dateEq) + Number(amountEq) + Number(overlap >= 0.5);
      if (signals < 2) return;
      candidates.push({ i, j, score: 2 * Number(dateEq) + 2 * Number(amountEq) + overlap });
    });
  });
  candidates.sort((a, b) => b.score - a.score || Math.abs(a.i - a.j) - Math.abs(b.i - b.j) || a.i - b.i || a.j - b.j);

  const usedEx = new Set();
  const usedGT = new Set();
  const pairs = [];
  for (const c of candidates) {
    if (usedEx.has(c.i) || usedGT.has(c.j)) continue;
    usedEx.add(c.i);
    usedGT.add(c.j);
    pairs.push({ ex: extracted[c.i], gt: groundTruth[c.j], exIndex: c.i, gtIndex: c.j });
  }
  pairs.sort((a, b) => a.gtIndex - b.gtIndex);

  return {
    pairs,
    falsePositives: extracted.filter((_, i) => !usedEx.has(i)),
    falseNegatives: groundTruth.filter((_, j) => !usedGT.has(j)),
  };
}

const emptyCounts = () => Object.fromEntries(FIELDS.map((f) => [f, { tp: 0, fp: 0, fn: 0 }]));

export function prf1({ tp, fp, fn }) {
  const precision = tp + fp ? tp / (tp + fp) : 0;
  const recall = tp + fn ? tp / (tp + fn) : 0;
  const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
  return { precision, recall, f1, tp, fp, fn };
}

const MAX_EXAMPLES_PER_CASE = 10;

/**
 * @param {Array<{id, layout, format, extracted: Array, groundTruth: Array, cascade?: object}>} cases
 */
export function scoreExtraction(cases) {
  const totals = emptyCounts();
  const perLayout = {};
  const perFormat = {};
  const perCase = [];
  const rowTotals = { groundTruth: 0, extracted: 0, matched: 0, financialExact: 0 };

  for (const c of cases) {
    const { pairs, falsePositives, falseNegatives } = matchRows(c.extracted, c.groundTruth);
    for (const bucket of [
      [perLayout, c.layout],
      [perFormat, c.format],
    ]) {
      if (!bucket[0][bucket[1]]) bucket[0][bucket[1]] = emptyCounts();
    }
    const targets = [totals, perLayout[c.layout], perFormat[c.format]];
    const mismatchCounts = Object.fromEntries(FIELDS.map((f) => [f, 0]));
    const examples = [];
    let financialExact = 0;

    for (const { ex, gt, gtIndex } of pairs) {
      let allFinancial = true;
      for (const f of FIELDS) {
        const ok = fieldsAgree(f, ex[f], gt[f]);
        for (const t of targets) {
          if (ok) t[f].tp++;
          else {
            t[f].fp++;
            t[f].fn++;
          }
        }
        if (!ok) {
          mismatchCounts[f]++;
          if (FINANCIAL_FIELDS.includes(f)) allFinancial = false;
          if (examples.length < MAX_EXAMPLES_PER_CASE && f !== "category") {
            examples.push({ field: f, gtIndex, extracted: ex[f] ?? null, expected: gt[f] });
          }
        }
      }
      if (allFinancial) financialExact++;
    }
    for (const f of FIELDS) {
      for (const t of targets) {
        t[f].fp += falsePositives.length;
        t[f].fn += falseNegatives.length;
      }
    }

    const withConfidence = c.extracted.filter((t) => typeof t.confidence?.overall === "number");
    rowTotals.groundTruth += c.groundTruth.length;
    rowTotals.extracted += c.extracted.length;
    rowTotals.matched += pairs.length;
    rowTotals.financialExact += financialExact;

    perCase.push({
      id: c.id,
      layout: c.layout,
      format: c.format,
      groundTruthRows: c.groundTruth.length,
      extractedRows: c.extracted.length,
      matched: pairs.length,
      falsePositives: falsePositives.length,
      falseNegatives: falseNegatives.length,
      financialExactRows: financialExact,
      fieldMismatches: mismatchCounts,
      // Only rows that carry a confidence (the PDF-text tier) count; CSV rows
      // have none, which is "not measured", not "zero confidence".
      meanConfidence: withConfidence.length
        ? withConfidence.reduce((s, t) => s + t.confidence.overall, 0) / withConfidence.length
        : null,
      cascade: c.cascade ?? null,
      examples: [
        ...examples,
        ...falsePositives.slice(0, 3).map((ex) => ({ field: "row", kind: "false-positive", extracted: ex })),
        ...falseNegatives.slice(0, 3).map((gt) => ({ field: "row", kind: "false-negative", expected: gt })),
      ],
    });
  }

  const toPRF = (counts) => Object.fromEntries(FIELDS.map((f) => [f, prf1(counts[f])]));
  const mapValues = (obj, fn) => Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, fn(v)]));

  return {
    caseCount: cases.length,
    rows: {
      ...rowTotals,
      // Share of ground-truth rows recovered with date, amount and
      // description all exactly right — the "would this row be correct in
      // the ledger" number, independent of category.
      financialExactRecall: rowTotals.groundTruth ? rowTotals.financialExact / rowTotals.groundTruth : 0,
    },
    aggregate: toPRF(totals),
    layoutBreakdown: mapValues(perLayout, toPRF),
    formatBreakdown: mapValues(perFormat, toPRF),
    perCase,
  };
}

function pct(x) {
  return `${(x * 100).toFixed(1)}%`;
}

function printTable(title, breakdown) {
  const w = Math.max(18, ...Object.keys(breakdown).map((k) => k.length + 2));
  console.log(`\n=== ${title} ===`);
  console.log(`  ${"".padEnd(w)}${FIELDS.map((f) => f.padStart(13)).join("")}`);
  for (const [k, fields] of Object.entries(breakdown)) {
    console.log(`  ${k.padEnd(w)}${FIELDS.map((f) => pct(fields[f].f1).padStart(13)).join("")}`);
  }
}

export function printExtractionScorecard(result) {
  console.log("\n=== Extraction — field-level P / R / F1 (micro-averaged over all rows) ===");
  console.log(`${"field".padEnd(14)}${"precision".padStart(10)}${"recall".padStart(10)}${"f1".padStart(9)}     tp     fp     fn`);
  for (const f of FIELDS) {
    const s = result.aggregate[f];
    console.log(
      `${f.padEnd(14)}${pct(s.precision).padStart(10)}${pct(s.recall).padStart(10)}${pct(s.f1).padStart(9)}  ${String(s.tp).padStart(5)}  ${String(s.fp).padStart(5)}  ${String(s.fn).padStart(5)}`,
    );
  }
  const r = result.rows;
  console.log(
    `\nRows: ${r.groundTruth} ground truth, ${r.extracted} extracted, ${r.matched} matched; ` +
      `${r.financialExact} (${pct(r.financialExactRecall)}) recovered with date+amount+description all exact`,
  );
  printTable("F1 by layout", result.layoutBreakdown);
  printTable("F1 by format", result.formatBreakdown);
}

export function printCascadeSummary(summary) {
  console.log("\n=== Model cascade (pdf-text cases) ===");
  console.log(`  mode: ${summary.mode}`);
  console.log(`  would escalate per the gate: ${summary.wouldEscalate}/${summary.cases}`);
  for (const [decision, n] of Object.entries(summary.decisions)) console.log(`  ${decision.padEnd(28)} ${n}`);
  console.log(`  model calls attempted: ${summary.modelCallsAttempted}`);
}

export function printAdvisorScorecard(results) {
  const pass = results.filter((r) => r.pass).length;
  console.log(
    `\n=== Advisor — deterministic arithmetic self-consistency (NOT response quality): ${pass}/${results.length} ===`,
  );
  for (const r of results) {
    const mark = r.pass ? "OK  " : "FAIL";
    console.log(
      `  [${mark}] ${r.id} (${r.profileId}, ${r.expectedMetric}): expected ${r.expectedValue}, recomputed ${r.actualValue}`,
    );
  }
}
