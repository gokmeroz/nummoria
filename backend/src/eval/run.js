#!/usr/bin/env node
// backend/src/eval/run.js — offline quality gate.
//
//   npm run eval                       deterministic tracks + threshold gate
//   npm run eval -- --out report.json  also write the report to a fixed path
//   npm run eval -- --no-gate          print/report only, never fail on thresholds
//   npm run eval -- --compare old.json print per-field/per-layout deltas vs a report
//   npm run eval:live -- --max-llm-cases 5
//                                      opt-in, paid: let up to N pdf-text cases
//                                      escalate to the configured model
//
// Tracks (labelled by what they actually measure — see EVALUATION.md):
//   extraction.golden      deterministic text->transactions on the 50 synthetic
//                          golden fixtures (the baseline set; never edited)
//   extraction.regression  same, on hand-labelled cases for input variations the
//                          golden set lacks (written alongside the fixes — NOT a holdout)
//   extraction.pdfBinary   the golden pdf-text cases rendered to real text-layer
//                          PDFs, then PDF -> text (pdf-parse) -> transactions.
//                          Isolates the PDF text-extraction stage; generated
//                          PDFs, so it says nothing about scans/OCR
//   advisor.arithmetic     recomputes computeMetrics() against the advisor
//                          fixtures — arithmetic self-consistency, NOT answer quality
//
// Not measured here: OCR of scanned/image PDFs, real bank PDFs, and live
// advisor response quality.
//
// Exit codes: 0 all gates passed; 1 a quality threshold failed;
//             2 invalid dataset / report / thresholds, or an unexpected error.

// First import: loads backend/.env (provider keys for eval:live) before the
// parser module reads process.env. Under NODE_ENV=test it loads nothing.
import "../config/env.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { parseCsvStatement } from "../ai/csvParser.js";
import { parseTransactionsFromText, hasConfiguredExtractionModel } from "../ai/pdfParser.js";
import { computeMetrics } from "../ai/financialMetrics.js";
import { extractPdfText } from "../ai/pdfText.js";
import { pdfBytesFromText } from "./datasets/synthetic/pdfRender.js";
import { noopTrace } from "../observability/trace.js";
import { scoreExtraction, printExtractionScorecard, printAdvisorScorecard, printCascadeSummary } from "./scorecard.js";
import { loadExtractionDataset, loadAdvisorDataset, DatasetError } from "./dataset.js";
import { checkThresholds, validateReport, ReportError } from "./gate.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATASETS = path.join(__dirname, "datasets");
const GOLDEN_EXTRACTION_DIR = path.join(DATASETS, "golden", "extraction");
const REGRESSION_EXTRACTION_DIR = path.join(DATASETS, "regression", "extraction");
const GOLDEN_ADVISOR_DIR = path.join(DATASETS, "golden", "advisor");
const REPORTS_DIR = path.join(__dirname, "reports");
export const THRESHOLDS_PATH = path.join(__dirname, "thresholds.json");

export function parseArgs(argv) {
  const args = { out: null, gate: true, compare: null, withLLM: false, maxLLMCases: 0, thresholds: THRESHOLDS_PATH };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--out") args.out = argv[++i];
    else if (a === "--no-gate") args.gate = false;
    else if (a === "--compare") args.compare = argv[++i];
    else if (a === "--thresholds") args.thresholds = argv[++i];
    else if (a === "--with-llm") args.withLLM = true;
    else if (a === "--max-llm-cases") args.maxLLMCases = Number(argv[++i]);
    else throw new Error(`unknown argument: ${a}`);
  }
  if (process.env.EVAL_USE_LLM === "true") args.withLLM = true;
  if (args.withLLM && !(Number.isInteger(args.maxLLMCases) && args.maxLLMCases > 0)) {
    throw new Error("--with-llm needs a positive --max-llm-cases N (every escalation is a paid model call)");
  }
  return args;
}

/**
 * Model-assisted mode is only real when it is requested, a provider is
 * configured, AND paid calls are explicitly allowed. Otherwise the run is
 * deterministic and says why.
 */
export function resolveModelMode({ withLLM, maxLLMCases }, env = process.env, hasProvider = hasConfiguredExtractionModel()) {
  if (!withLLM) return { enabled: false, label: "deterministic (offline; model tier disabled)", reason: "not requested" };
  if (env.EVAL_ALLOW_PAID_CALLS !== "true") {
    return { enabled: false, label: "deterministic (model tier requested but not authorized)", reason: "set EVAL_ALLOW_PAID_CALLS=true to allow paid calls" };
  }
  if (!hasProvider) {
    return { enabled: false, label: "deterministic (model tier requested; no provider configured)", reason: "no GEMINI_API_KEY / OPENAI_API_KEY" };
  }
  return { enabled: true, label: `model-assisted (live, at most ${maxLLMCases} escalations)`, reason: null, budget: maxLLMCases };
}

export async function runExtractionTrack(fixtures, modelMode) {
  let budget = modelMode.enabled ? modelMode.budget : 0;
  const cases = [];
  for (const fx of fixtures) {
    let extracted;
    let cascade = null;
    if (fx.format === "csv") {
      // The CSV path has no model tier: there is nothing to escalate to.
      extracted = parseCsvStatement(fx.rawText).rows;
    } else {
      extracted = await parseTransactionsFromText(fx.rawText, {
        useLLMFallback: modelMode.enabled,
        trace: noopTrace,
        allowEscalation: async () => (budget > 0 ? (budget--, true) : false),
        onCascade: (info) => {
          cascade = {
            wouldEscalate: info.wouldEscalate,
            reasons: info.reasons,
            decision: info.decision,
            attempts: info.attempts.length,
            meanFinancialConfidence: info.meanFinancialConfidence,
          };
        },
      });
    }
    cases.push({ id: fx.id, layout: fx.layout, format: fx.format, extracted, groundTruth: fx.groundTruth, cascade });
  }
  return scoreExtraction(cases);
}

/** Render each pdf-text fixture to a PDF, extract its text, then parse. */
export async function toPdfBinaryFixtures(fixtures) {
  const out = [];
  for (const fx of fixtures.filter((f) => f.format === "pdf-text")) {
    const rawText = await extractPdfText(pdfBytesFromText(fx.rawText));
    out.push({ ...fx, format: "pdf-binary", rawText });
  }
  return out;
}

export function summarizeCascade(result, modelMode) {
  const pdfCases = result.perCase.filter((c) => c.cascade);
  const decisions = {};
  for (const c of pdfCases) decisions[c.cascade.decision] = (decisions[c.cascade.decision] || 0) + 1;
  return {
    mode: modelMode.label,
    reason: modelMode.reason,
    cases: pdfCases.length,
    wouldEscalate: pdfCases.filter((c) => c.cascade.wouldEscalate).length,
    decisions,
    modelCallsAttempted: pdfCases.reduce((s, c) => s + c.cascade.attempts, 0),
  };
}

function resolveMetric(metrics, p) {
  if (p.startsWith("categoryBreakdown.")) return metrics.categoryBreakdown[p.split(".")[1]];
  return metrics[p];
}

export function runAdvisorTrack(cases, profilesDir) {
  const profileCache = new Map();
  return cases.map((c) => {
    if (!profileCache.has(c.profileId)) {
      const file = path.join(profilesDir, `${c.profileId}.json`);
      if (!fs.existsSync(file)) throw new DatasetError(`advisor case ${c.id}: profile ${c.profileId} not found`);
      profileCache.set(c.profileId, JSON.parse(fs.readFileSync(file, "utf8")));
    }
    const metrics = computeMetrics(profileCache.get(c.profileId).transactions);
    const raw = resolveMetric(metrics, c.expectedMetric);
    const actualValue = typeof raw === "number" && Number.isFinite(raw) ? Number(raw.toFixed(2)) : null;
    const pass = actualValue != null && Math.abs(actualValue - c.expectedValue) <= c.tolerance;
    return { ...c, actualValue, pass };
  });
}

function printComparison(report, baseline) {
  console.log(`\n=== Delta vs ${baseline.generatedAt || "baseline"} (F1, percentage points) ===`);
  for (const track of ["golden", "regression", "pdfBinary"]) {
    const now = report.extraction?.[track];
    const then = baseline.extraction?.[track];
    if (!now || !then) continue;
    console.log(`  ${track}`);
    const rows = [["aggregate", now.aggregate, then.aggregate], ...Object.keys(now.layoutBreakdown).map((l) => [l, now.layoutBreakdown[l], then.layoutBreakdown?.[l]])];
    for (const [name, a, b] of rows) {
      if (!b) continue;
      const cells = Object.keys(a).map((f) => `${f}=${((a[f].f1 - b[f].f1) * 100 >= 0 ? "+" : "") + ((a[f].f1 - b[f].f1) * 100).toFixed(1)}`);
      console.log(`    ${name.padEnd(34)} ${cells.join("  ")}`);
    }
  }
}

export async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const modelMode = resolveModelMode(args);

  const golden = loadExtractionDataset(GOLDEN_EXTRACTION_DIR, { minCases: 1 });
  const regression = loadExtractionDataset(REGRESSION_EXTRACTION_DIR, { minCases: 1 });
  const advisorCases = loadAdvisorDataset(GOLDEN_ADVISOR_DIR, { minCases: 1 });

  console.log("Nummoria offline eval");
  console.log(`  extraction mode: ${modelMode.label}${modelMode.reason ? ` — ${modelMode.reason}` : ""}`);
  console.log(`  golden:     ${golden.summary.cases} cases, ${golden.summary.rows} rows, ${JSON.stringify(golden.summary.byFormat)} (synthetic)`);
  console.log(`  regression: ${regression.summary.cases} cases, ${regression.summary.rows} rows (hand-labelled; not a holdout)`);
  console.log("  not measured: PDF binary->text, OCR, live advisor answers");

  const goldenResult = await runExtractionTrack(golden.fixtures, modelMode);
  console.log("\n######## extraction.golden ########");
  printExtractionScorecard(goldenResult);
  const goldenCascade = summarizeCascade(goldenResult, modelMode);
  printCascadeSummary(goldenCascade);

  const pdfBinaryResult = await runExtractionTrack(await toPdfBinaryFixtures(golden.fixtures), { enabled: false });
  console.log("\n######## extraction.pdfBinary (golden pdf-text cases as generated text-layer PDFs) ########");
  printExtractionScorecard(pdfBinaryResult);

  const regressionResult = await runExtractionTrack(regression.fixtures, modelMode);
  console.log("\n######## extraction.regression ########");
  printExtractionScorecard(regressionResult);

  const advisorResults = runAdvisorTrack(advisorCases, path.join(GOLDEN_ADVISOR_DIR, "profiles"));
  printAdvisorScorecard(advisorResults);

  const report = {
    schemaVersion: 2,
    generatedAt: new Date().toISOString(),
    modes: {
      extraction: modelMode.enabled ? "model-assisted" : "deterministic-text-to-transactions",
      extractionModeDetail: modelMode.label,
      pdfBinaryTextExtraction: "synthetic-text-layer-pdfs (jsPDF-generated; pdf-parse)",
      ocr: "not-tested",
      advisor: "deterministic-arithmetic-self-consistency",
      advisorResponseQuality: "not-tested",
    },
    datasets: { golden: golden.summary, regression: regression.summary, advisor: { cases: advisorCases.length } },
    extraction: {
      golden: { ...goldenResult, cascade: goldenCascade },
      regression: { ...regressionResult, cascade: summarizeCascade(regressionResult, modelMode) },
      pdfBinary: pdfBinaryResult,
    },
    advisor: {
      kind: "deterministic-arithmetic-self-consistency",
      passed: advisorResults.filter((r) => r.pass).length,
      total: advisorResults.length,
      cases: advisorResults,
    },
  };
  validateReport(report);

  if (args.compare) printComparison(report, JSON.parse(fs.readFileSync(args.compare, "utf8")));

  let gate = { passed: true, failures: [], checked: 0, skipped: true };
  if (args.gate) {
    const thresholds = JSON.parse(fs.readFileSync(args.thresholds, "utf8"));
    gate = { ...checkThresholds(report, thresholds), skipped: false };
  }
  report.gate = gate;

  const outPath = args.out || path.join(REPORTS_DIR, `${report.generatedAt.replace(/[:.]/g, "-")}.json`);
  fs.mkdirSync(path.dirname(path.resolve(outPath)), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(`\nReport written to ${path.relative(process.cwd(), path.resolve(outPath))}`);

  if (gate.skipped) {
    console.log("Quality gate: SKIPPED (--no-gate)");
    return 0;
  }
  if (!gate.passed) {
    console.error(`\nQuality gate: FAILED (${gate.failures.length} of ${gate.checked} checks)`);
    for (const f of gate.failures) console.error(`  ✗ ${f}`);
    return 1;
  }
  console.log(`\nQuality gate: PASSED (${gate.checked} checks)`);
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main()
    .then((code) => process.exit(code))
    .catch((err) => {
      const known = err instanceof DatasetError || err instanceof ReportError;
      console.error(known ? `eval aborted: ${err.message}` : "eval run failed:", known ? "" : err);
      process.exit(2);
    });
}
