// backend/src/eval/gate.js
//
// Turns an eval report into pass/fail. Printing a scorecard is not a check:
// CI passes only if every threshold in thresholds.json holds, the datasets
// are the ones the thresholds were recorded against, and the report itself
// is well-formed (a NaN F1 must fail loudly, not compare false and pass).

export class ReportError extends Error {
  constructor(problems) {
    super(`malformed eval report:\n  - ${problems.join("\n  - ")}`);
    this.name = "ReportError";
    this.problems = problems;
  }
}

const isRate = (x) => typeof x === "number" && Number.isFinite(x) && x >= 0 && x <= 1;
const isCount = (x) => Number.isInteger(x) && x >= 0;

function checkPRF(obj, where, problems) {
  if (!obj || typeof obj !== "object") {
    problems.push(`${where}: missing`);
    return;
  }
  for (const [field, s] of Object.entries(obj)) {
    for (const k of ["precision", "recall", "f1"]) if (!isRate(s?.[k])) problems.push(`${where}.${field}.${k} is not a rate in [0,1]: ${s?.[k]}`);
    for (const k of ["tp", "fp", "fn"]) if (!isCount(s?.[k])) problems.push(`${where}.${field}.${k} is not a count: ${s?.[k]}`);
  }
}

export function validateReport(report) {
  const problems = [];
  if (!report || typeof report !== "object") throw new ReportError(["report is not an object"]);
  if (!report.modes?.extraction) problems.push("modes.extraction missing");
  for (const track of ["golden", "regression", "pdfBinary"]) {
    const t = report.extraction?.[track];
    if (!t) {
      problems.push(`extraction.${track} missing`);
      continue;
    }
    if (!isCount(t.caseCount) || t.caseCount === 0) problems.push(`extraction.${track}.caseCount must be a positive count (an empty eval is not a pass)`);
    if (!isCount(t.rows?.groundTruth) || t.rows.groundTruth === 0) problems.push(`extraction.${track}.rows.groundTruth must be positive`);
    if (!isRate(t.rows?.financialExactRecall)) problems.push(`extraction.${track}.rows.financialExactRecall is not a rate`);
    checkPRF(t.aggregate, `extraction.${track}.aggregate`, problems);
    for (const [layout, fields] of Object.entries(t.layoutBreakdown || {})) checkPRF(fields, `extraction.${track}.layoutBreakdown.${layout}`, problems);
  }
  if (!isCount(report.advisor?.total) || report.advisor.total === 0) problems.push("advisor.total must be a positive count");
  if (!isCount(report.advisor?.passed)) problems.push("advisor.passed must be a count");
  if (problems.length) throw new ReportError(problems);
  return true;
}

const pct = (x) => `${(x * 100).toFixed(2)}%`;

/**
 * @returns {{ passed: boolean, failures: string[], checked: number }}
 */
export function checkThresholds(report, thresholds) {
  const failures = [];
  let checked = 0;
  const check = (ok, msg) => {
    checked++;
    if (!ok) failures.push(msg);
  };

  if (!thresholds || typeof thresholds !== "object" || !thresholds.version) {
    return { passed: false, failures: ["thresholds file is missing a version"], checked: 1 };
  }

  for (const [name, expected] of Object.entries(thresholds.datasets || {})) {
    const actual = report.datasets?.[name];
    check(
      actual && actual.fingerprint === expected.fingerprint && actual.cases === expected.cases && actual.rows === expected.rows,
      `dataset "${name}" changed (expected ${expected.cases} cases / ${expected.rows} rows / ${String(expected.fingerprint).slice(0, 12)}…, ` +
        `got ${actual?.cases} / ${actual?.rows} / ${String(actual?.fingerprint).slice(0, 12)}…). ` +
        "Fixtures are frozen: if a change is deliberate, re-record thresholds and explain it in EVALUATION.md.",
    );
  }

  for (const [track, t] of Object.entries(thresholds.extraction || {})) {
    const r = report.extraction?.[track];
    if (!r) {
      check(false, `extraction.${track}: no results in report`);
      continue;
    }
    for (const [field, min] of Object.entries(t.aggregateF1Min || {})) {
      const f1 = r.aggregate?.[field]?.f1;
      check(isRate(f1) && f1 >= min, `extraction.${track} aggregate ${field} F1 ${isRate(f1) ? pct(f1) : f1} < ${pct(min)}`);
    }
    for (const [layout, fields] of Object.entries(t.layoutF1Min || {})) {
      for (const [field, min] of Object.entries(fields)) {
        const f1 = r.layoutBreakdown?.[layout]?.[field]?.f1;
        check(isRate(f1) && f1 >= min, `extraction.${track} ${layout} ${field} F1 ${isRate(f1) ? pct(f1) : "missing"} < ${pct(min)}`);
      }
    }
    if (t.financialExactRecallMin != null) {
      const v = r.rows?.financialExactRecall;
      check(isRate(v) && v >= t.financialExactRecallMin, `extraction.${track} financial exact-row recall ${pct(v)} < ${pct(t.financialExactRecallMin)}`);
    }
    if (t.maxFalsePositiveRows != null) {
      const fp = r.rows ? r.rows.extracted - r.rows.matched : NaN;
      check(fp <= t.maxFalsePositiveRows, `extraction.${track} unmatched extracted rows ${fp} > ${t.maxFalsePositiveRows}`);
    }
  }

  if (thresholds.advisor?.minPassRate != null) {
    const rate = report.advisor.total ? report.advisor.passed / report.advisor.total : 0;
    check(rate >= thresholds.advisor.minPassRate, `advisor arithmetic pass rate ${pct(rate)} < ${pct(thresholds.advisor.minPassRate)}`);
  }

  return { passed: failures.length === 0, failures, checked };
}
