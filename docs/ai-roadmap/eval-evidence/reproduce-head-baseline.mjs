// docs/ai-roadmap/eval-evidence/reproduce-head-baseline.mjs
//
// Re-measures commit 24b854d2 with its PRODUCTION parsers (the CSV path the
// upload routes used, not the csvToTxRows the old eval scored):
//
//   git archive 24b854d2 backend | tar -x -C /tmp/head && cd /tmp/head/backend && npm install
//   sed -i.bak "s/^async function ingestCsvBuffer(/export async function ingestCsvBuffer(/" src/controllers/ingestController.js
//   NODE_ENV=test node <this file> out.json [scorer.js]
//
// scorer.js defaults to the HEAD scorer; pass the current
// backend/src/eval/scorecard.js for the like-for-like comparison.
// FIXTURE_DIR=<dir> scores another fixture set (e.g. the regression set).
import fs from "fs";
import path from "path";
const root = process.cwd();
const { ingestCsvBuffer } = await import(root + "/src/controllers/ingestController.js");
const { parseTransactionsFromText } = await import(root + "/src/ai/pdfParser.js");
const { scoreExtraction } = await import(process.argv[3] || (root + "/src/eval/scorecard.js"));
const dir = process.env.FIXTURE_DIR || (root + "/src/eval/datasets/golden/extraction");
const cases = [];
for (const f of fs.readdirSync(dir).filter((f) => f.endsWith(".json")).sort()) {
  const fx = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
  let extracted;
  if (fx.format === "csv") {
    const { docs } = await ingestCsvBuffer(Buffer.from(fx.rawText, "utf8"), { query: {} });
    // same conversion ingestFile applies before computeMetrics
    extracted = docs.map((d) => ({
      date: new Date(d.date).toISOString().slice(0, 10),
      description: d.description || "",
      category: d.category || "Other",
      amount: (d.type === "income" ? 1 : -1) * (d.amountMinor / 100),
    }));
  } else {
    extracted = await parseTransactionsFromText(fx.rawText, { useLLMFallback: false });
  }
  cases.push({ id: fx.id, layout: fx.layout, format: fx.format, extracted, groundTruth: fx.groundTruth });
}
const r = scoreExtraction(cases);
console.log("rows", JSON.stringify(r.rows || {}));
fs.writeFileSync(process.argv[2], JSON.stringify(r, null, 2));
const pct = (x) => (x * 100).toFixed(1);
for (const [k, v] of Object.entries(r.aggregate)) console.log("agg", k, pct(v.f1));
for (const [l, fs_] of Object.entries(r.layoutBreakdown)) console.log(l, Object.entries(fs_).map(([k, v]) => k + "=" + pct(v.f1)).join(" "));
