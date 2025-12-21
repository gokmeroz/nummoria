// backend/src/controllers/ingestController.js
// Node 22, "type":"module" — PDF ingest via pdfjs-dist, no new folders.
//
// ✅ FIX SUMMARY
// - NEW: Correctly extract authenticated userId from requireAuth middleware (req.user.id / req.userId)
// - NEW: Return 401 only when user truly missing (not because we read wrong field)

import { createRequire } from "node:module";
import path from "node:path";

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

// IMPORTANT:
// Keep Transaction import for /ingest/csv and /ingest/pdf routes
import { Transaction } from "../models/transaction.js";

// ✅ AI Advisor storage + metrics
import AiAdvisorFile from "../models/AiAdvisorFile.js";
import { computeMetrics } from "../ai/financialMetrics.js";

// ---- PDF text extraction via pdfjs-dist (ESM) ----
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

/**
 * Extract text from PDF buffer using pdfjs-dist (works in Node)
 */
async function extractPdfText(pdfBuffer) {
  // ✅ pdfjs-dist refuses Buffer; make a real Uint8Array copy
  const data = Buffer.isBuffer(pdfBuffer)
    ? new Uint8Array(pdfBuffer) // copies buffer into Uint8Array
    : pdfBuffer instanceof Uint8Array
    ? pdfBuffer
    : new Uint8Array(pdfBuffer);

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

/* ------------------------------ Upload middleware ------------------------------ */
/**
 * IMPORTANT:
 * Frontend uses: fd.append("file", f)
 * So field name MUST be "file" in upload.single("file") on the route.
 */
export const upload = Multer({
  storage: Multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  fileFilter: (req, file, cb) => {
    const name = (file?.originalname || "").toLowerCase();
    const ext = path.extname(name);
    const mime = (file?.mimetype || "").toLowerCase();

    const isPdf =
      ext === ".pdf" ||
      mime === "application/pdf" ||
      mime === "application/x-pdf";
    const isCsv =
      ext === ".csv" ||
      mime === "text/csv" ||
      mime === "application/vnd.ms-excel" ||
      mime === "text/plain";

    if (!isPdf && !isCsv) {
      return cb(
        new Error(`UNSUPPORTED_TYPE:${mime || "unknown"}:${ext || "noext"}`)
      );
    }
    cb(null, true);
  },
});

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
function minorToMajor(minor, currency = "USD") {
  const d = decimalsForCurrency(currency);
  return Number(minor) / Math.pow(10, d);
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

function safeJsonError(res, status, payload) {
  return res.status(status).json(payload);
}

function detectFileKind(file) {
  const name = String(file?.originalname || "").toLowerCase();
  const ext = path.extname(name);
  const mime = String(file?.mimetype || "").toLowerCase();

  const isPdf =
    ext === ".pdf" ||
    mime === "application/pdf" ||
    mime === "application/x-pdf";
  const isCsv =
    ext === ".csv" ||
    mime === "text/csv" ||
    mime === "application/vnd.ms-excel" ||
    mime === "text/plain";

  return isPdf ? "PDF" : isCsv ? "CSV" : "UNKNOWN";
}

function stripBom(s) {
  if (!s) return s;
  return s.charCodeAt(0) === 0xfeff ? s.slice(1) : s;
}

function detectDelimiter(sample) {
  const s = String(sample || "");
  const commas = (s.match(/,/g) || []).length;
  const semis = (s.match(/;/g) || []).length;
  return semis > commas ? ";" : ",";
}

function parseAmountToNumber(raw) {
  if (raw === null || raw === undefined) return NaN;

  let s = String(raw).trim();
  if (!s) return NaN;

  const neg = /^\(.*\)$/.test(s) ? -1 : 1;
  s = s.replace(/[()]/g, "").trim();

  s = s.replace(/\s/g, "");

  const hasDot = s.includes(".");
  const hasComma = s.includes(",");

  if (hasDot && hasComma) {
    if (s.lastIndexOf(",") > s.lastIndexOf(".")) {
      s = s.replace(/\./g, "").replace(",", ".");
    } else {
      s = s.replace(/,/g, "");
    }
  } else if (hasComma && !hasDot) {
    s = s.replace(",", ".");
  }

  const n = Number(s);
  return neg * n;
}

/* =============================== CSV Ingest =============================== */
async function ingestCsvBuffer(buffer, req) {
  const raw = stripBom(buffer.toString("utf8"));
  const delimiter = detectDelimiter(raw.slice(0, 4096));

  const records = parse(raw, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
    relax_quotes: true,
    bom: true,
    delimiter,
  });

  const defaultCurrency = req.query.currency || "USD";
  const defaultAccountId = req.query.accountId || null;
  const defaultCategoryId = req.query.categoryId || null;

  const docs = [];
  let skipped = 0;

  for (const row of records) {
    const dateRaw = row.Date ?? row.date ?? row.DATE ?? row.Tarih ?? row.tarih;
    const descRaw =
      row.Description ??
      row.description ??
      row.DESCRIPTION ??
      row.Aciklama ??
      row.ACIKLAMA ??
      row["Açıklama"] ??
      "";
    const amtRaw =
      row.Amount ??
      row.amount ??
      row.AMOUNT ??
      row.Tutar ??
      row.tutar ??
      row["Tutar (TL)"] ??
      row["Tutar"];

    const date = normalizeDate(dateRaw);
    const desc = String(descRaw || "").slice(0, 512);
    const amountMajor = parseAmountToNumber(amtRaw);

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

  return { docs, skipped, kind: "CSV" };
}

/* =============================== PDF Ingest =============================== */
async function ingestPdfBuffer(buffer, req) {
  const rawText = await extractPdfText(buffer);

  if (!rawText || rawText.trim().length < 20) {
    const err = new Error("PDF_NO_TEXT");
    err.code = "PDF_NO_TEXT";
    throw err;
  }

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
    /^(\d{4}-\d{2}-\d{2}|\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4})\s+(.+?)\s+([()\-+]?[\d.,\s]+)\s*$/;

  for (const line of lines) {
    const m = line.match(rx);
    if (!m) {
      skipped++;
      continue;
    }

    const date = normalizeDate(m[1]);
    const desc = String(m[2] || "").slice(0, 512);
    const amountMajor = parseAmountToNumber(m[3]);

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

  return { docs, skipped, kind: "PDF" };
}

/* =============================== Unified Ingest for AI Advisor =============================== */
/**
 * IMPORTANT:
 * This handler is for /ai/financial-helper/ingest.
 * It must NOT write into Transaction collection.
 * It saves into AiAdvisorFile and returns a fileId for session linking.
 */
export async function ingestFile(req, res) {
  try {
    if (!req.file) {
      return safeJsonError(res, 400, {
        ok: false,
        code: "NO_FILE",
        message: "No file provided",
      });
    }

    // NEW: Correct userId lookup to match requireAuth middleware
    // requireAuth sets:
    //   req.user = { id: <userId>, ... }
    //   req.userId = <userId>
    // Your previous code checked req.user._id (undefined), causing false 401s.
    const userId =
      req.user?._id || // (optional compatibility if you ever set _id)
      req.user?.id || // NEW: primary field set by requireAuth
      req.userId || // existing field set by requireAuth
      req.user?.userId || // NEW: extra compatibility (if payload uses userId)
      null;

    // ✅ Require authenticated user for AI file storage (prevents null userId)
    if (!userId) {
      return safeJsonError(res, 401, {
        ok: false,
        code: "UNAUTHORIZED",
        message: "Login required to upload files for AI Advisor.",
      });
    }

    const kind = detectFileKind(req.file);
    if (kind === "UNKNOWN") {
      return safeJsonError(res, 415, {
        ok: false,
        code: "UNSUPPORTED_TYPE",
        message: `Unsupported file type (${req.file.mimetype || "unknown"})`,
      });
    }

    const buffer = req.file.buffer;
    if (!buffer || !buffer.length) {
      return safeJsonError(res, 400, {
        ok: false,
        code: "EMPTY_FILE",
        message: "Uploaded file is empty",
      });
    }

    // Parse into docs (internal normalized form)
    const parsed =
      kind === "CSV"
        ? await ingestCsvBuffer(buffer, req)
        : await ingestPdfBuffer(buffer, req);

    const { docs, skipped } = parsed;

    if (!docs || docs.length === 0) {
      return safeJsonError(res, 422, {
        ok: false,
        code: "NO_TRANSACTIONS",
        message:
          "No transactions could be parsed from this file. Export a CSV from your bank (recommended) or try a different statement format.",
      });
    }

    // Convert docs -> advisor tx rows (signed amount in MAJOR units)
    const parsedTransactions = docs.map((d) => {
      const signedMajor =
        (d.type === "income" ? 1 : -1) *
        minorToMajor(d.amountMinor, d.currency);

      return {
        date: new Date(d.date).toISOString().slice(0, 10),
        description: d.description || "",
        category: "Other",
        amount: signedMajor,
        type: d.type,
      };
    });

    const computedMetrics = computeMetrics(parsedTransactions);

    // Save session file
    const fileDoc = await AiAdvisorFile.create({
      userId,
      fileName: req.file.originalname,
      parsedTransactions,
      computedMetrics,
    });

    return res.json({
      ok: true,
      fileId: fileDoc._id,
      totals: { txCount: parsedTransactions.length },
      computedMetrics,
      skipped,
      kind,
      filename: req.file.originalname,
    });
  } catch (e) {
    if (
      typeof e?.message === "string" &&
      e.message.startsWith("UNSUPPORTED_TYPE:")
    ) {
      return safeJsonError(res, 415, {
        ok: false,
        code: "UNSUPPORTED_TYPE",
        message: "Unsupported file type. Upload a PDF or CSV.",
        detail: e.message,
      });
    }

    if (e?.code === "PDF_NO_TEXT" || e?.message === "PDF_NO_TEXT") {
      return safeJsonError(res, 400, {
        ok: false,
        code: "PDF_NO_TEXT",
        message:
          "This PDF appears to be scanned/image-only or has no extractable text. Please upload a text-based PDF or a CSV export.",
      });
    }

    console.error("ingestFile error:", e);
    return res.status(500).json({
      ok: false,
      code: "INGEST_FAILED",
      message: "Failed to ingest file",
      detail: e?.message || String(e),
    });
  }
}

/* =============================== Existing /ingest endpoints (keep as-is) =============================== */
export async function ingestCsv(req, res) {
  try {
    if (!req.file) return res.status(400).json({ error: "No file provided" });
    const { docs, skipped } = await ingestCsvBuffer(req.file.buffer, req);

    if (!docs.length) {
      return safeJsonError(res, 400, {
        code: "NO_TRANSACTIONS",
        message: "No transactions could be parsed from this CSV.",
      });
    }

    // NOTE: These endpoints still write to Transaction collection
    const inserted = (await Transaction.insertMany(docs)).length;
    res.json({ inserted, skipped });
  } catch (e) {
    console.error("ingestCsv error:", e);
    res.status(500).json({ error: e.message || "CSV ingest failed" });
  }
}

export async function ingestPdf(req, res) {
  try {
    if (!req.file) return res.status(400).json({ error: "No file provided" });
    const { docs, skipped } = await ingestPdfBuffer(req.file.buffer, req);

    if (!docs.length) {
      return safeJsonError(res, 400, {
        code: "NO_TRANSACTIONS",
        message: "No transactions could be parsed from this PDF.",
      });
    }

    // NOTE: These endpoints still write to Transaction collection
    const inserted = (await Transaction.insertMany(docs)).length;
    res.json({ inserted, skipped });
  } catch (e) {
    if (e?.code === "PDF_NO_TEXT" || e?.message === "PDF_NO_TEXT") {
      return safeJsonError(res, 400, {
        code: "PDF_NO_TEXT",
        message:
          "This PDF appears to be scanned/image-only or has no extractable text. Please upload a text-based PDF or a CSV export.",
      });
    }
    console.error("ingestPdf error:", e);
    res.status(500).json({ error: e.message || "PDF ingest failed" });
  }
}
