#!/usr/bin/env node
// Markdown summary of an eval report, for the CI job summary:
//   node src/eval/summary.js report.json >> "$GITHUB_STEP_SUMMARY"
import fs from "fs";

const report = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const pct = (x) => (typeof x === "number" ? `${(x * 100).toFixed(1)}%` : "—");
const FIELDS = ["date", "amount", "description", "category"];
const out = [];

out.push(`### Offline eval — ${report.gate?.skipped ? "gate skipped" : report.gate?.passed ? "✅ gate passed" : "❌ gate failed"}`);
out.push("");
out.push(`Extraction mode: **${report.modes.extractionModeDetail}** · PDF stage: ${report.modes.pdfBinaryTextExtraction} · OCR: ${report.modes.ocr} · advisor: ${report.modes.advisor}`);
out.push("");
out.push("| track | rows | " + FIELDS.map((f) => `${f} F1`).join(" | ") + " | exact rows |");
out.push("|---|---:|" + FIELDS.map(() => "---:").join("|") + "|---:|");
for (const [name, t] of Object.entries(report.extraction)) {
  out.push(`| ${name} | ${t.rows.groundTruth} | ${FIELDS.map((f) => pct(t.aggregate[f].f1)).join(" | ")} | ${pct(t.rows.financialExactRecall)} |`);
}
out.push("");
out.push(`Advisor arithmetic self-consistency: ${report.advisor.passed}/${report.advisor.total} (not a measure of answer quality)`);
const c = report.extraction.golden.cascade;
if (c) out.push(`Cascade: ${c.wouldEscalate}/${c.cases} pdf-text cases would escalate; decisions ${JSON.stringify(c.decisions)}; model calls ${c.modelCallsAttempted}`);
if (report.gate && !report.gate.skipped) {
  out.push("");
  out.push(`Gate: ${report.gate.checked - report.gate.failures.length}/${report.gate.checked} checks passed`);
  for (const f of report.gate.failures) out.push(`- ❌ ${f}`);
}
console.log(out.join("\n"));
