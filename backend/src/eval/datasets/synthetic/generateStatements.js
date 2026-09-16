#!/usr/bin/env node
// backend/src/eval/datasets/synthetic/generateStatements.js
//
// npm run gen:synthetic                 -> 100 labeled statements (CSV + PDF)
//   under datasets/synthetic/output/ (gitignored, regenerated each run)
// npm run gen:synthetic -- --golden     -> 50 labeled statements written as
//   committed JSON fixtures under datasets/golden/extraction/ (fixed seed,
//   text-only — see docs/ai-roadmap/SCHEMA.md for why no binary PDFs there)
//
// KNOWN CAVEAT: the PDF files this script writes in bulk mode are valid
// PDFs, but backend/src/controllers/financialHelperController.js's ingestPdf
// currently cannot read *any* PDF — see the P0 session notes. They're
// produced for when that's fixed, and to eyeball the generator's output.

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { jsPDF } from "jspdf";
import { mulberry32, pick } from "./rng.js";
import { generateProfile } from "./generateProfiles.js";
import { enrichWithDescriptions, renderCSV, renderPdfText, toGroundTruth } from "./render.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LAYOUTS_DIR = path.join(__dirname, "layouts");
const OUTPUT_DIR = path.join(__dirname, "output");
const GOLDEN_DIR = path.join(__dirname, "..", "golden", "extraction");

function loadLayouts() {
  return fs
    .readdirSync(LAYOUTS_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(fs.readFileSync(path.join(LAYOUTS_DIR, f), "utf8")));
}

function parseArgs(argv) {
  const args = { count: null, seed: null, golden: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--count") args.count = Number(argv[++i]);
    else if (argv[i] === "--seed") args.seed = Number(argv[++i]);
    else if (argv[i] === "--golden") args.golden = true;
  }
  return args;
}

function pdfBytesFromText(text) {
  const doc = new jsPDF();
  doc.setFont("courier");
  doc.setFontSize(10);
  let y = 10;
  for (const line of text.split("\n")) {
    if (y > 280) {
      doc.addPage();
      y = 10;
    }
    doc.text(line.slice(0, 100), 10, y);
    y += 6;
  }
  return Buffer.from(doc.output("arraybuffer"));
}

function generateOne(seed, layouts, rng) {
  const layout = pick(rng, layouts);
  const format = pick(rng, ["csv", "pdf"]);
  const profile = generateProfile(rng, { days: 90 });
  const enriched = enrichWithDescriptions(profile.transactions, layout, rng);
  const groundTruth = toGroundTruth(enriched);
  const rawText = format === "csv" ? renderCSV(enriched, layout, rng) : renderPdfText(enriched, layout, rng);
  return { seed, layout: layout.id, format, rawText, groundTruth };
}

function runBulk({ count, seed }) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const layouts = loadLayouts();
  const rng = mulberry32(seed);
  let written = 0;

  for (let i = 0; i < count; i++) {
    const id = `stmt-${String(i + 1).padStart(4, "0")}`;
    const { layout, format, rawText, groundTruth } = generateOne(seed + i, layouts, rng);

    if (format === "csv") {
      fs.writeFileSync(path.join(OUTPUT_DIR, `${id}.csv`), rawText, "utf8");
    } else {
      fs.writeFileSync(path.join(OUTPUT_DIR, `${id}.pdf`), pdfBytesFromText(rawText));
    }
    fs.writeFileSync(
      path.join(OUTPUT_DIR, `${id}.ground-truth.json`),
      JSON.stringify({ id, layout, format, groundTruth }, null, 2),
    );
    written++;
  }

  console.log(`Generated ${written} labeled statements -> ${path.relative(process.cwd(), OUTPUT_DIR)}/`);
  console.log(`Layouts used: ${layouts.map((l) => l.id).join(", ")}`);
}

function runGolden({ count, seed }) {
  fs.mkdirSync(GOLDEN_DIR, { recursive: true });
  const layouts = loadLayouts();
  const rng = mulberry32(seed);
  let written = 0;

  for (let i = 0; i < count; i++) {
    const id = `case-${String(i + 1).padStart(3, "0")}`;
    const { layout, format, rawText, groundTruth } = generateOne(seed + i, layouts, rng);
    const fixture = {
      id,
      layout,
      format: format === "pdf" ? "pdf-text" : "csv",
      rawText,
      groundTruth,
    };
    fs.writeFileSync(
      path.join(GOLDEN_DIR, `${id}.json`),
      JSON.stringify(fixture, null, 2),
    );
    written++;
  }

  console.log(`Wrote ${written} golden extraction fixtures -> ${path.relative(process.cwd(), GOLDEN_DIR)}/`);
  console.log(`Fixed seed ${seed} — rerunning with --golden reproduces byte-identical fixtures.`);
}

const args = parseArgs(process.argv.slice(2));
if (args.golden) {
  runGolden({ count: args.count ?? 50, seed: args.seed ?? 12345 });
} else {
  runBulk({ count: args.count ?? 100, seed: args.seed ?? 1 });
}
