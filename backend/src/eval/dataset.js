// backend/src/eval/dataset.js
//
// Loading + validation for eval fixtures. A fixture that doesn't match the
// frozen annotation format (docs/ai-roadmap/SCHEMA.md) is an error, not a
// skipped case: silently dropping malformed cases is how a score goes up
// without the system getting better.
import crypto from "crypto";
import fs from "fs";
import path from "path";

export class DatasetError extends Error {
  constructor(message, problems = []) {
    super(problems.length ? `${message}:\n  - ${problems.join("\n  - ")}` : message);
    this.name = "DatasetError";
    this.problems = problems;
  }
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

function validIsoDate(s) {
  const m = typeof s === "string" && s.match(ISO_DATE);
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
}

/** Returns a list of problems (empty = valid). */
export function validateExtractionFixture(fx, file) {
  const p = [];
  const where = (msg) => p.push(`${file}: ${msg}`);
  if (!fx || typeof fx !== "object" || Array.isArray(fx)) {
    where("not a JSON object");
    return p;
  }
  if (typeof fx.id !== "string" || !fx.id) where("id must be a non-empty string");
  if (typeof fx.layout !== "string" || !fx.layout) where("layout must be a non-empty string");
  if (!["csv", "pdf-text"].includes(fx.format)) where(`format must be "csv" or "pdf-text", got ${JSON.stringify(fx.format)}`);
  if (typeof fx.rawText !== "string" || !fx.rawText.trim()) where("rawText must be a non-empty string");
  if (!Array.isArray(fx.groundTruth)) {
    where("groundTruth must be an array");
    return p;
  }
  fx.groundTruth.forEach((g, i) => {
    if (!validIsoDate(g?.date)) where(`groundTruth[${i}].date ${JSON.stringify(g?.date)} is not a valid YYYY-MM-DD date`);
    if (typeof g?.amount !== "number" || !Number.isFinite(g.amount)) where(`groundTruth[${i}].amount must be a finite number`);
    if (typeof g?.description !== "string") where(`groundTruth[${i}].description must be a string`);
    if (typeof g?.category !== "string" || !g.category) where(`groundTruth[${i}].category must be a non-empty string`);
  });
  return p;
}

export function validateAdvisorCase(c, file) {
  const p = [];
  const where = (msg) => p.push(`${file}: ${msg}`);
  if (typeof c?.id !== "string") where("id must be a string");
  if (typeof c?.profileId !== "string") where("profileId must be a string");
  if (typeof c?.expectedMetric !== "string") where("expectedMetric must be a string");
  if (typeof c?.expectedValue !== "number" || !Number.isFinite(c.expectedValue)) where("expectedValue must be a finite number");
  if (typeof c?.tolerance !== "number" || !(c.tolerance >= 0)) where("tolerance must be a number >= 0");
  return p;
}

function readJsonFiles(dir) {
  if (!fs.existsSync(dir)) throw new DatasetError(`dataset directory not found: ${dir}`);
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort(); // readdir order is filesystem-dependent; results must not be
  const out = [];
  const problems = [];
  for (const f of files) {
    try {
      out.push({ file: f, data: JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")) });
    } catch (e) {
      problems.push(`${f}: invalid JSON (${e.message})`);
    }
  }
  if (problems.length) throw new DatasetError(`unreadable fixtures in ${dir}`, problems);
  return out;
}

/**
 * Fingerprint of the dataset's content (ids + text + labels, in id order),
 * independent of file formatting. The thresholds file pins it, so editing
 * an expected answer fails the gate until the baseline is deliberately
 * re-recorded.
 */
export function datasetFingerprint(fixtures) {
  const canonical = [...fixtures]
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .map((f) => [f.id, f.layout, f.format, f.rawText, f.groundTruth.map((g) => [g.date, g.amount, g.description, g.category])]);
  return crypto.createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}

/** Load + validate an extraction fixture directory. Throws DatasetError. */
export function loadExtractionDataset(dir, { minCases = 1 } = {}) {
  const files = readJsonFiles(dir);
  const problems = [];
  const ids = new Set();
  for (const { file, data } of files) {
    problems.push(...validateExtractionFixture(data, file));
    if (data?.id) {
      if (ids.has(data.id)) problems.push(`${file}: duplicate id ${data.id}`);
      ids.add(data.id);
    }
  }
  if (problems.length) throw new DatasetError(`invalid extraction fixtures in ${dir}`, problems);
  const fixtures = files.map((f) => f.data);
  if (fixtures.length < minCases) {
    throw new DatasetError(`expected at least ${minCases} extraction fixtures in ${dir}, found ${fixtures.length}`);
  }
  return {
    fixtures,
    summary: {
      cases: fixtures.length,
      rows: fixtures.reduce((s, f) => s + f.groundTruth.length, 0),
      byFormat: countBy(fixtures, (f) => f.format),
      byLayout: countBy(fixtures, (f) => f.layout),
      fingerprint: datasetFingerprint(fixtures),
    },
  };
}

export function loadAdvisorDataset(dir, { minCases = 1 } = {}) {
  const files = readJsonFiles(dir);
  const problems = [];
  for (const { file, data } of files) problems.push(...validateAdvisorCase(data, file));
  if (problems.length) throw new DatasetError(`invalid advisor cases in ${dir}`, problems);
  const cases = files.map((f) => f.data);
  if (cases.length < minCases) throw new DatasetError(`expected at least ${minCases} advisor cases in ${dir}, found ${cases.length}`);
  return cases;
}

function countBy(xs, key) {
  const out = {};
  for (const x of xs) out[key(x)] = (out[key(x)] || 0) + 1;
  return out;
}
