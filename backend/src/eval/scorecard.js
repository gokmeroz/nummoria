// backend/src/eval/scorecard.js
//
// Field-level precision/recall/F1 for extraction, plus pretty-printing.
//
// Matching strategy (documented because it's a real methodology choice, not
// an incidental detail): extracted rows are greedily matched to the closest
// unused ground-truth row by a combined score (exact date, exact amount,
// description token overlap). This is a simplification of a proper
// assignment problem — good enough to catch real regressions, not exact
// for pathological cases (e.g. two identical transactions on the same day).
// An extracted row that can't be matched with at least some evidence counts
// as a false positive for every field; a ground-truth row nothing matched
// counts as a false negative for every field.

const FIELDS = ["date", "amount", "description", "category"];

function tokenOverlap(a, b) {
  const ta = new Set(String(a || "").toLowerCase().split(/\s+/).filter(Boolean));
  const tb = new Set(String(b || "").toLowerCase().split(/\s+/).filter(Boolean));
  if (!ta.size || !tb.size) return 0;
  let shared = 0;
  for (const t of ta) if (tb.has(t)) shared++;
  return shared / Math.max(ta.size, tb.size);
}

function matchRows(extracted, groundTruth) {
  const usedGT = new Set();
  const pairs = [];
  const falsePositives = [];

  for (const ex of extracted) {
    let bestIdx = -1;
    let bestScore = -Infinity;
    groundTruth.forEach((gt, idx) => {
      if (usedGT.has(idx)) return;
      let score = 0;
      if (gt.date === ex.date) score += 2;
      if (Math.abs(Number(gt.amount) - Number(ex.amount)) < 0.005) score += 2;
      score += tokenOverlap(gt.description, ex.description);
      if (score > bestScore) {
        bestScore = score;
        bestIdx = idx;
      }
    });
    if (bestIdx >= 0 && bestScore >= 1) {
      usedGT.add(bestIdx);
      pairs.push({ ex, gt: groundTruth[bestIdx] });
    } else {
      falsePositives.push(ex);
    }
  }

  const falseNegatives = groundTruth.filter((_, idx) => !usedGT.has(idx));
  return { pairs, falsePositives, falseNegatives };
}

function fieldsAgree(field, exVal, gtVal) {
  if (field === "amount") return Math.abs(Number(exVal) - Number(gtVal)) < 0.005;
  if (field === "date") return exVal === gtVal;
  return String(exVal || "").trim().toLowerCase() === String(gtVal || "").trim().toLowerCase();
}

/**
 * @param {Array<{extracted: Array, groundTruth: Array, layout: string, id: string}>} cases
 */
export function scoreExtraction(cases) {
  const totals = {};
  for (const f of FIELDS) totals[f] = { tp: 0, fp: 0, fn: 0 };
  const perLayout = {};
  const perCase = [];

  for (const c of cases) {
    const { pairs, falsePositives, falseNegatives } = matchRows(c.extracted, c.groundTruth);
    if (!perLayout[c.layout]) {
      perLayout[c.layout] = {};
      for (const f of FIELDS) perLayout[c.layout][f] = { tp: 0, fp: 0, fn: 0 };
    }

    for (const f of FIELDS) {
      for (const { ex, gt } of pairs) {
        if (fieldsAgree(f, ex[f], gt[f])) {
          totals[f].tp++;
          perLayout[c.layout][f].tp++;
        } else {
          totals[f].fp++;
          totals[f].fn++;
          perLayout[c.layout][f].fp++;
          perLayout[c.layout][f].fn++;
        }
      }
      totals[f].fp += falsePositives.length;
      totals[f].fn += falseNegatives.length;
      perLayout[c.layout][f].fp += falsePositives.length;
      perLayout[c.layout][f].fn += falseNegatives.length;
    }

    perCase.push({
      id: c.id,
      layout: c.layout,
      format: c.format,
      escalated: Boolean(c.escalated),
      matched: pairs.length,
      falsePositives: falsePositives.length,
      falseNegatives: falseNegatives.length,
      meanConfidence: c.extracted.length
        ? c.extracted.reduce((s, t) => s + (t.confidence?.overall ?? 0), 0) / c.extracted.length
        : null,
    });
  }

  const prf1 = ({ tp, fp, fn }) => {
    const precision = tp + fp ? tp / (tp + fp) : 0;
    const recall = tp + fn ? tp / (tp + fn) : 0;
    const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
    return { precision, recall, f1, tp, fp, fn };
  };

  const aggregate = {};
  for (const f of FIELDS) aggregate[f] = prf1(totals[f]);

  const layoutBreakdown = {};
  for (const [layout, fields] of Object.entries(perLayout)) {
    layoutBreakdown[layout] = {};
    for (const f of FIELDS) layoutBreakdown[layout][f] = prf1(fields[f]);
  }

  return { aggregate, layoutBreakdown, perCase };
}

function pct(x) {
  return `${(x * 100).toFixed(1)}%`;
}

export function printExtractionScorecard(result) {
  console.log("\n=== Extraction — field-level P / R / F1 (aggregate) ===");
  console.log(
    FIELDS.map((f) => f.padEnd(12)).join("") + "  precision  recall    f1",
  );
  for (const f of FIELDS) {
    const s = result.aggregate[f];
    console.log(
      `${f.padEnd(12)}                 ${pct(s.precision).padStart(7)}   ${pct(s.recall).padStart(7)}  ${pct(s.f1).padStart(7)}`,
    );
  }

  console.log("\n=== Per-layout F1 ===");
  for (const [layout, fields] of Object.entries(result.layoutBreakdown)) {
    console.log(`  ${layout}`);
    for (const f of FIELDS) {
      console.log(`    ${f.padEnd(12)} f1=${pct(fields[f].f1)}`);
    }
  }

  const escalations = result.perCase.filter((c) => c.escalated).length;
  const withConfidence = result.perCase.filter((c) => c.meanConfidence != null);
  const meanConfidence =
    withConfidence.length
      ? withConfidence.reduce((s, c) => s + c.meanConfidence, 0) / withConfidence.length
      : null;
  console.log(
    `\nCascade: ${escalations}/${result.perCase.length} cases escalated to the model tier` +
      (meanConfidence != null ? `; mean parser-self/agreement confidence ${meanConfidence.toFixed(2)}` : ""),
  );
}

export function printAdvisorScorecard(results) {
  const pass = results.filter((r) => r.pass).length;
  console.log(`\n=== Advisor golden-set self-consistency: ${pass}/${results.length} ===`);
  for (const r of results) {
    const mark = r.pass ? "OK  " : "FAIL";
    console.log(
      `  [${mark}] ${r.id} (${r.profileId}, ${r.expectedMetric}): expected ${r.expectedValue}, recomputed ${r.actualValue}`,
    );
  }
}
