// backend/src/controllers/ingestController.js
// Node 22, "type":"module" — PDF ingest via pdfjs-dist, no new folders.

import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

// Multer (CJS)
let Multer;
try {
  const m = require("multer");
  Multer = m?.default ?? m;
} catch {
  const m = await import("multer");
  Multer = m?.default ?? m;
}

// ESM libs
import { parse } from "csv-parse/sync";
import { Transaction } from "../models/transaction.js";

// ---- PDF text extraction via pdfjs-dist (ESM) ----
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

/**
 * Extract text from PDF buffer using pdfjs-dist (works in Node)
 */
async function extractPdfText(pdfBuffer) {
  // ✅ Ensure Uint8Array (not Buffer)
  const data =
    pdfBuffer instanceof Uint8Array
      ? pdfBuffer
      : new Uint8Array(
          pdfBuffer.buffer,
          pdfBuffer.byteOffset,
          pdfBuffer.byteLength
        );

  const loadingTask = getDocument({
    data,
    disableWorker: true,
    isEvalSupported: false,
    useSystemFonts: true,
    disableFontFace: true,
  });

  const pdf = await loadingTask.promise;
  let text = "";

  try {
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const line = content.items.map((it) => it.str ?? "").join(" ");
      text += line + "\n";
    }
  } finally {
    await pdf.destroy();
  }

  return text;
}

export const upload = Multer({ storage: Multer.memoryStorage() });

/* ------------------------------ Helpers ------------------------------ */
function decimalsForCurrency(code = "USD") {
  const zero = new Set(["JPY", "KRW", "CLP", "VND"]);
  const three = new Set(["BHD", "IQD", "JOD", "KWD", "OMR", "TND"]);
  if (zero.has(code)) return 0;
  if (three.has(code)) return 3;
  return 2;
}
function majorToMinor(major, currency = "USD") {
  const d = decimalsForCurrency(currency);
  return Math.round(Number(major) * Math.pow(10, d));
}
function normalizeDate(d) {
  if (!d) return null;
  const s = String(d).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return new Date(s);
  const m = s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})$/);
  if (m) {
    let [, a, b, c] = m;
    if (c.length === 2) c = String(2000 + Number(c));
    const mmdd = new Date(`${c}-${a.padStart(2, "0")}-${b.padStart(2, "0")}`);
    const ddmm = new Date(`${c}-${b.padStart(2, "0")}-${a.padStart(2, "0")}`);
    return isNaN(mmdd) ? (isNaN(ddmm) ? null : ddmm) : mmdd;
  }
  const dt = new Date(s);
  return isNaN(dt) ? null : dt;
}

/* =============================== CSV Ingest =============================== */
export async function ingestCsv(req, res) {
  try {
    if (!req.file) return res.status(400).json({ error: "No file provided" });

    const csv = req.file.buffer.toString("utf8");
    const records = parse(csv, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });

    const defaultCurrency = req.query.currency || "USD";
    const defaultAccountId = req.query.accountId || null;
    const defaultCategoryId = req.query.categoryId || null;

    const docs = [];
    let skipped = 0;

    for (const row of records) {
      const dateRaw = row.Date ?? row.date ?? row.DATE;
      const descRaw =
        row.Description ?? row.description ?? row.DESCRIPTION ?? "";
      const amtRaw = row.Amount ?? row.amount ?? row.AMOUNT;

      const date = normalizeDate(dateRaw);
      const desc = String(descRaw || "").slice(0, 512);
      const amountMajor = Number(String(amtRaw || "").replace(",", "."));

      if (!date || !isFinite(amountMajor)) {
        skipped++;
        continue;
      }

      const type = amountMajor >= 0 ? "income" : "expense";
      const currency = row.Currency || row.currency || defaultCurrency;
      const amountMinor = majorToMinor(Math.abs(amountMajor), currency);

      docs.push({
        date,
        description: desc,
        amountMinor,
        currency,
        type,
        accountId: row.accountId || defaultAccountId,
        categoryId: row.categoryId || defaultCategoryId,
      });
    }

    const inserted = docs.length
      ? (await Transaction.insertMany(docs)).length
      : 0;
    res.json({ inserted, skipped });
  } catch (e) {
    console.error("ingestCsv error:", e);
    res.status(500).json({ error: e.message || "CSV ingest failed" });
  }
}

/* =============================== PDF Ingest =============================== */
export async function ingestPdf(req, res) {
  try {
    if (!req.file) return res.status(400).json({ error: "No file provided" });

    const rawText = await extractPdfText(req.file.buffer);
    const lines = rawText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    const defaultCurrency = req.query.currency || "USD";
    const defaultAccountId = req.query.accountId || null;
    const defaultCategoryId = req.query.categoryId || null;

    const docs = [];
    let skipped = 0;
    const rx =
      /^(\d{4}-\d{2}-\d{2}|\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4})\s+(.+?)\s+([()\-+]?[\d.,]+)\s*$/;

    for (const line of lines) {
      const m = line.match(rx);
      if (!m) {
        skipped++;
        continue;
      }

      const date = normalizeDate(m[1]);
      const desc = m[2].slice(0, 512);

      let raw = m[3].trim();
      const neg = /^\(.*\)$/.test(raw) ? -1 : 1;
      raw = raw.replace(/[()]/g, "");

      if (raw.includes(".") && raw.includes(",")) {
        raw = raw.replace(/\./g, "").replace(",", ".");
      } else if (raw.includes(",")) {
        raw = raw.replace(",", ".");
      }
      const amountMajor = neg * Number(raw);

      if (!date || !isFinite(amountMajor)) {
        skipped++;
        continue;
      }

      const type = amountMajor >= 0 ? "income" : "expense";
      const currency = defaultCurrency;
      const amountMinor = majorToMinor(Math.abs(amountMajor), currency);

      docs.push({
        date,
        description: desc,
        amountMinor,
        currency,
        type,
        accountId: defaultAccountId,
        categoryId: defaultCategoryId,
      });
    }

    const inserted = docs.length
      ? (await Transaction.insertMany(docs)).length
      : 0;
    res.json({ inserted, skipped });
  } catch (e) {
    console.error("ingestPdf error:", e);
    res.status(500).json({ error: e.message || "PDF ingest failed" });
  }
}
