#!/usr/bin/env node
// backend/src/eval/run.js — P0 exit criterion: `npm run eval` runs
// end-to-end and prints a scorecard.
//
// Two tracks:
//  - extraction: runs the real csvToTxRows / parseTransactionsFromText
//    against golden/extraction/*.json and scores field-level P/R/F1.
//  - advisor: re-runs computeMetrics() against each golden profile and
//    checks it still matches the fixture's expectedValue — a self-
//    consistency check on the golden set itself, not a live LLM eval (that's
//    P2/P4 scope; see docs/ai-roadmap/SCHEMA.md).
//
// By default the extraction track never calls a model — it only exercises
// the deterministic parser tier, so `npm run eval` needs no API keys and
// spends no tokens. Pass --with-llm (or EVAL_USE_LLM=true) to also let
// low-confidence cases escalate to the real model tier.

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { csvToTxRows } from "../controllers/financialHelperController.js";
import { parseTransactionsFromText } from "../ai/pdfParser.js";
import { computeMetrics } from "../ai/financialMetrics.js";
import { noopTrace } from "../observability/trace.js";
import { scoreExtraction, printExtractionScorecard, printAdvisorScorecard } from "./scorecard.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GOLDEN_EXTRACTION_DIR = path.join(__dirname, "datasets", "golden", "extraction");
const GOLDEN_ADVISOR_DIR = path.join(__dirname, "datasets", "golden", "advisor");
const REPORTS_DIR = path.join(__dirname, "reports");

const useLLM = process.argv.includes("--with-llm") || process.env.EVAL_USE_LLM === "true";

function loadJSONDir(dir) {
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")));
}

async function runExtractionTrack() {
  const fixtures = loadJSONDir(GOLDEN_EXTRACTION_DIR);
  const cases = [];

  for (const fixture of fixtures) {
    let extracted;
    let escalated = false;

    if (fixture.format === "csv") {
      extracted = csvToTxRows(Buffer.from(fixture.rawText, "utf8"));
      // csvToTxRows has no confidence/cascade concept (deterministic-only
      // parser) — leave escalated=false, confidence undefined for these.
    } else {
      const before = fixture.rawText;
      extracted = await parseTransactionsFromText(before, {
        useLLMFallback: useLLM,
        trace: noopTrace,
      });
      // A case "escalated" if any returned tx carries agreement/model-only
      // confidence rather than parser-self.
      escalated = extracted.some((t) => t.confidence?.fields?.date?.source !== "parser-self");
    }

    cases.push({
      id: fixture.id,
      layout: fixture.layout,
      format: fixture.format,
      escalated,
      extracted,
      groundTruth: fixture.groundTruth,
    });
  }

  return scoreExtraction(cases);
}

function resolveMetric(metrics, path) {
  if (path.startsWith("categoryBreakdown.")) {
    const key = path.split(".")[1];
    return metrics.categoryBreakdown[key];
  }
  return metrics[path];
}

function runAdvisorTrack() {
  const cases = loadJSONDir(GOLDEN_ADVISOR_DIR).filter((c) => c.expectedMetric);
  const profilesDir = path.join(GOLDEN_ADVISOR_DIR, "profiles");
  const profileCache = new Map();

  return cases.map((c) => {
    if (!profileCache.has(c.profileId)) {
      profileCache.set(
        c.profileId,
        JSON.parse(fs.readFileSync(path.join(profilesDir, `${c.profileId}.json`), "utf8")),
      );
    }
    const profile = profileCache.get(c.profileId);
    const metrics = computeMetrics(profile.transactions);
    const actualValue = Number((resolveMetric(metrics, c.expectedMetric) ?? NaN).toFixed(2));
    const pass = Math.abs(actualValue - c.expectedValue) <= c.tolerance;
    return { ...c, actualValue, pass };
  });
}

async function main() {
  console.log(`Nummoria AI eval — extraction track uses ${useLLM ? "deterministic + model cascade" : "deterministic tier only (pass --with-llm to also test escalation)"}\n`);

  const extractionResult = await runExtractionTrack();
  printExtractionScorecard(extractionResult);

  const advisorResults = runAdvisorTrack();
  printAdvisorScorecard(advisorResults);

  fs.mkdirSync(REPORTS_DIR, { recursive: true });
  const reportPath = path.join(REPORTS_DIR, `${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  fs.writeFileSync(
    reportPath,
    JSON.stringify({ generatedAt: new Date().toISOString(), useLLM, extraction: extractionResult, advisor: advisorResults }, null, 2),
  );
  console.log(`\nReport written to ${path.relative(process.cwd(), reportPath)}`);
}

main().catch((err) => {
  console.error("eval run failed:", err);
  process.exit(1);
});
