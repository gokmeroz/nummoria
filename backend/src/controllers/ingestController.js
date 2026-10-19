// backend/src/controllers/ingestController.js
// Node 22, "type":"module" — PDF ingest via ai/pdfText.js, no new folders.
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

import crypto from "node:crypto";
import mongoose from "mongoose";

// IMPORTANT:
// Keep Transaction import for /ingest/csv and /ingest/pdf routes
import { Transaction } from "../models/transaction.js";
import { Account } from "../models/account.js";
import { Category } from "../models/category.js";

// ✅ AI Advisor storage + metrics
import AiAdvisorFile from "../models/AiAdvisorFile.js";
import { computeMetrics } from "../ai/financialMetrics.js";

// ---- PDF text extraction (shared, line-preserving) + advisor cascade ----
import { extractPdfText } from "../ai/pdfText.js";
import { parseTransactionsFromText, parseStatementText } from "../ai/pdfParser.js";
import { parseCsvStatement } from "../ai/csvParser.js";
import { consumeQuota } from "../middlewares/aiQuota.js";
import { startTrace } from "../observability/trace.js";
import { majorToMinor, minorToMajor } from "../utils/money.js";
import { ensureIndexOnce } from "../utils/ensureIndex.js";

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

/* =============================== CSV Ingest =============================== */
// Parsed statement rows ({date: "YYYY-MM-DD", amount: signed major, ...}) ->
// internal docs (integer minor units + type). The one conversion both the
// ledger import and the advisor upload use.
function rowsToDocs(rows, currency) {
  return rows.map((r) => ({
    date: r.date,
    description: String(r.description || "").slice(0, 512),
    amountMinor: majorToMinor(Math.abs(r.amount), r.currency || currency),
    currency: r.currency || currency,
    type: r.amount >= 0 ? "income" : "expense",
    category: r.category,
  }));
}

async function ingestCsvBuffer(buffer, { currency }) {
  const { rows, skipped, skippedReasons, meta } = parseCsvStatement(buffer.toString("utf8"));
  return { docs: rowsToDocs(rows, currency), skipped, skippedReasons, meta, kind: "CSV" };
}

/* =============================== PDF Ingest =============================== */
async function extractPdfTextOrThrow(buffer) {
  const rawText = await extractPdfText(buffer);

  if (!rawText || rawText.trim().length < 20) {
    const err = new Error("PDF_NO_TEXT");
    err.code = "PDF_NO_TEXT";
    throw err;
  }
  return rawText;
}

// Ledger path (/ingest/pdf writes these into Transaction): deterministic
// tier only. Model-extracted rows must not reach the ledger until there is
// a human review step in between.
async function ingestPdfBuffer(buffer, { currency }) {
  const rawText = await extractPdfTextOrThrow(buffer);
  const { rows, meta } = parseStatementText(rawText);
  const skipped = Object.values(meta.skipped || {}).reduce((a, b) => a + b, 0);
  return { docs: rowsToDocs(rows, currency), skipped, skippedReasons: meta.skipped, meta, kind: "PDF" };
}

// Advisor path: the confidence-gated cascade (parser first, model only when
// the parser is unsure AND allowEscalation() grants budget). Results land in
// AiAdvisorFile, a scratch copy for analysis — never the ledger.
async function ingestPdfBufferWithCascade(
  buffer,
  req,
  { trace, allowEscalation },
) {
  const rawText = await extractPdfTextOrThrow(buffer);
  trace.setAttributes({ format: "pdf", textLength: rawText.length });

  let cascade = null;
  const rows = await parseTransactionsFromText(rawText, {
    // Off unless EXTRACTION_ESCALATION=on. Calibration on the synthetic set
    // shows no document where escalating would have improved recall (the
    // remaining errors are in the source text itself) — see
    // docs/ai-roadmap/EVALUATION.md before turning this on.
    useLLMFallback:
      process.env.EXTRACTION_ESCALATION === "on" &&
      Boolean(process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY),
    trace,
    allowEscalation,
    onCascade: (info) => {
      cascade = info;
      trace.setAttributes({
        cascadeDecision: info.decision,
        parserRows: info.parserRows,
        meanFinancialConfidence: info.meanFinancialConfidence,
      });
    },
  });

  // The cascade speaks signed MAJOR-unit floats (-7.33) with validated
  // ISO dates; convert to the internal integer-minor form (733 + type) at
  // this boundary, so money is never summed as floats downstream.
  const docs = rowsToDocs(rows, req.query.currency || "USD");
  return { docs, skipped: 0, kind: "PDF", cascade };
}

/* =============================== Unified Ingest for AI Advisor =============================== */
/**
 * IMPORTANT:
 * This handler is for /ai/financial-helper/ingest.
 * It must NOT write into Transaction collection.
 * It saves into AiAdvisorFile and returns a fileId for session linking.
 */
export async function ingestFile(req, res) {
  const trace = startTrace({ req, operation: "ingest.document" });
  if (trace.id) res.setHeader("X-Trace-Id", trace.id);
  // Many early returns below; finalize once when the response is flushed.
  res.on("finish", () => {
    const status =
      res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "partial" : "ok";
    trace.finalize(status);
  });

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

    // Model spend is budgeted per escalation, not per upload: most documents
    // never reach the model, so they cost nothing and shouldn't use quota.
    // "not_attempted" = the parser was confident, or no model is configured.
    let escalation = "not_attempted";
    const allowEscalation = async () => {
      try {
        const q = await consumeQuota("aix", userId, req.user?.subscription);
        escalation = q.allowed ? "granted" : "over_budget";
      } catch {
        // Fail closed: a broken counter must not mean unlimited model spend.
        // The user still gets the deterministic result.
        escalation = "quota_error";
      }
      trace.setAttributes({ escalation });
      return escalation === "granted";
    };

    // Parse into docs (internal normalized form)
    const parsed =
      kind === "CSV"
        ? await ingestCsvBuffer(buffer, { currency: req.query.currency || "USD" })
        : await ingestPdfBufferWithCascade(buffer, req, {
            trace,
            allowEscalation,
          });

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
        date: d.date,
        description: d.description || "",
        // Best-effort dictionary label from the shared parser (CSV and PDF).
        category: d.category || "Other",
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
      // Additive field (clients ignore unknown keys): lets the UI say "this
      // was a hard statement; results may be incomplete" when over_budget.
      escalation,
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

/* =============================== Ledger import: /ingest/csv, /ingest/pdf =============================== */
// These write real ledger rows, so every rule a manual create enforces
// applies here too: the caller is authenticated (route), the account and
// optional category belong to the caller, rows use the account's currency.
//
// Idempotency: each row carries importId + importRowKey, guarded by a unique
// partial index. Re-uploading a file — or retrying after a partial failure —
// inserts only rows that are not already there. Rows that are genuinely
// identical inside one file get distinct keys (#0, #1, ...), so they persist.
//
// Imports do not change Account.balance (unchanged behaviour): whether a
// historical statement should move the current balance is a product decision
// (it double-counts if the balance was entered as of today).

const { ObjectId } = mongoose.Types;

function ensureImportIndex() {
  // Correctness under concurrent double-submits depends on this index, and
  // autoIndex is off in production — see utils/ensureIndex.js.
  return ensureIndexOnce(
    Transaction,
    { userId: 1, importId: 1, importRowKey: 1 },
    { unique: true, partialFilterExpression: { importId: { $type: "string" } } },
  );
}

export function importRowKeys(docs) {
  const seen = new Map();
  return docs.map((d) => {
    const base = [d.date, d.amountMinor, d.type, String(d.description || "").trim().toLowerCase()].join("|");
    const n = seen.get(base) || 0;
    seen.set(base, n + 1);
    return `${base}#${n}`;
  });
}

function isDuplicateKeyError(e) {
  return e?.code === 11000 || (Array.isArray(e?.writeErrors) && e.writeErrors.length > 0 && e.writeErrors.every((w) => (w.code ?? w.err?.code) === 11000));
}

async function importToLedger(req, res, kind) {
  if (!req.file?.buffer?.length) {
    return safeJsonError(res, 400, { code: "NO_FILE", error: "No file provided" });
  }
  const userId = req.userId;
  const { accountId, categoryId } = req.query;
  if (!accountId) {
    return safeJsonError(res, 400, {
      code: "ACCOUNT_REQUIRED",
      error: "Choose the account to import into (select an account in the filter first), then import again.",
    });
  }
  if (!ObjectId.isValid(accountId) || (categoryId && !ObjectId.isValid(categoryId))) {
    return safeJsonError(res, 400, { code: "INVALID_ID", error: "Invalid accountId or categoryId" });
  }

  // Ownership: a foreign id looks exactly like a missing one (404 either
  // way), so the response does not reveal whether another user's account
  // exists.
  const account = await Account.findOne({ _id: accountId, userId, isDeleted: { $ne: true } })
    .select("_id currency")
    .lean();
  if (!account) return safeJsonError(res, 404, { code: "ACCOUNT_NOT_FOUND", error: "Account not found" });

  let category = null;
  if (categoryId) {
    category = await Category.findOne({ _id: categoryId, userId, isDeleted: { $ne: true } })
      .select("_id kind")
      .lean();
    if (!category) return safeJsonError(res, 404, { code: "CATEGORY_NOT_FOUND", error: "Category not found" });
  }

  const currency = String(account.currency || "USD").toUpperCase();
  const parsed = kind === "CSV" ? await ingestCsvBuffer(req.file.buffer, { currency }) : await ingestPdfBuffer(req.file.buffer, { currency });

  // A row that names another currency can't be booked into this account
  // (no FX here, same rule as POST /transactions).
  const currencyMismatch = parsed.docs.filter((d) => d.currency !== currency).length;
  const docs = parsed.docs.filter((d) => d.currency === currency);
  if (!docs.length) {
    return safeJsonError(res, 400, {
      code: "NO_TRANSACTIONS",
      error: `No transactions could be parsed from this ${kind}.`,
      skipped: parsed.skipped + currencyMismatch,
    });
  }

  const importId = crypto
    .createHash("sha256")
    .update(`${userId}:${account._id}:`)
    .update(req.file.buffer)
    .digest("hex");
  const keys = importRowKeys(docs);

  const rows = docs.map((d, i) => ({
    userId,
    accountId: account._id,
    categoryId: category && category.kind === d.type ? category._id : null,
    type: d.type,
    amountMinor: d.amountMinor,
    currency,
    date: new Date(`${d.date}T00:00:00.000Z`),
    description: d.description || null,
    isDeleted: false,
    importId,
    importRowKey: keys[i],
  }));

  await ensureImportIndex();
  // Sequential retries are filtered here (works even without the index);
  // the unique index catches concurrent duplicates that slip past this read.
  const existing = new Set(
    (await Transaction.find({ userId, importId }).select("importRowKey").lean()).map((t) => t.importRowKey),
  );
  const fresh = rows.filter((r) => !existing.has(r.importRowKey));

  let inserted = 0;
  let duplicates = rows.length - fresh.length;
  if (fresh.length) {
    try {
      inserted = (await Transaction.insertMany(fresh, { ordered: false })).length;
    } catch (e) {
      if (!isDuplicateKeyError(e)) throw e;
      // ordered:false keeps going past duplicates; count what landed.
      inserted = e.insertedDocs?.length ?? e.result?.insertedCount ?? fresh.length - e.writeErrors.length;
      duplicates += fresh.length - inserted;
    }
  }

  return res.json({
    inserted,
    duplicates,
    skipped: parsed.skipped + currencyMismatch,
    skippedReasons: { ...(parsed.skippedReasons || {}), currencyMismatch },
    importId,
    message:
      inserted === 0 && duplicates > 0
        ? "This file was already imported into this account; nothing new was added."
        : `Imported ${inserted} transaction${inserted === 1 ? "" : "s"}.`,
  });
}

export async function ingestCsv(req, res) {
  try {
    return await importToLedger(req, res, "CSV");
  } catch (e) {
    console.error("ingestCsv error:", e?.message || e);
    return res.status(500).json({ error: "CSV import failed" });
  }
}

export async function ingestPdf(req, res) {
  try {
    return await importToLedger(req, res, "PDF");
  } catch (e) {
    if (e?.code === "PDF_NO_TEXT" || e?.message === "PDF_NO_TEXT") {
      return safeJsonError(res, 400, {
        code: "PDF_NO_TEXT",
        error:
          "This PDF appears to be scanned/image-only or has no extractable text. Please upload a text-based PDF or a CSV export.",
      });
    }
    console.error("ingestPdf error:", e?.message || e);
    return res.status(500).json({ error: "PDF import failed" });
  }
}
