// backend/src/ai/csvParser.js
//
// CSV statement -> transactions. The single CSV parser behind both upload
// routes (/ingest/csv ledger import, /ai/financial-helper/ingest) and the
// offline eval. Before this module the eval scored a different parser
// (financialHelperController.csvToTxRows) than the routes ran, so its CSV
// numbers described code no user hit.
import { parse } from "csv-parse/sync";
import {
  detectDateOrder,
  fallbackDateOrder,
  inferPeriodFromDates,
  fitDateToPeriod,
  isAmbiguousDate,
  normalizeAmount,
  detectDecimalStyle,
  guessCategory,
  foldText,
} from "./statementNormalize.js";
import { repairDatesByNeighbors } from "./dateRepair.js";

// Header aliases, compared after foldText() + removing non-alphanumerics,
// so "İşlem Tarihi", "Islem Tarihi" and "islemTarihi" are one key.
const ALIASES = {
  date: ["date", "transactiondate", "postingdate", "posteddate", "bookingdate", "tarih", "islemtarihi"],
  description: [
    "description",
    "transactiondescription",
    "details",
    "memo",
    "payee",
    "narrative",
    "aciklama",
    "islemaciklama",
    "islemaciklamasi",
  ],
  amount: ["amount", "transactionamount", "tutar", "tutartl", "islemtutari"],
  credit: ["credit", "creditamount", "credits", "deposit", "deposits", "alacak", "yatan"],
  debit: ["debit", "debitamount", "debits", "withdrawal", "withdrawals", "borc", "cekilen"],
  currency: ["currency", "doviz", "parabirimi"],
};

const headerKey = (h) => foldText(h).replace(/[^a-z0-9]/g, "");

function findColumn(headers, field) {
  const keys = headers.map(headerKey);
  const idx = keys.findIndex((k) => ALIASES[field].includes(k));
  return idx >= 0 ? idx : null;
}

/** Count `ch` outside double quotes. */
function countOutsideQuotes(line, ch) {
  let n = 0;
  let inQ = false;
  for (const c of line) {
    if (c === '"') inQ = !inQ;
    else if (c === ch && !inQ) n++;
  }
  return n;
}

/**
 * The header is the first of the first 20 lines that names a date column and
 * an amount (or credit/debit) column for some delimiter — bank exports often
 * start with an account-info preamble.
 */
function locateHeader(lines) {
  for (let i = 0; i < Math.min(lines.length, 20); i++) {
    const line = lines[i];
    for (const delim of [",", ";", "\t", "|"]) {
      if (!countOutsideQuotes(line, delim)) continue;
      const headers = line.split(delim).map((h) => h.trim().replace(/^"|"$/g, ""));
      const date = findColumn(headers, "date");
      const amount = findColumn(headers, "amount");
      const credit = findColumn(headers, "credit");
      const debit = findColumn(headers, "debit");
      if (date != null && (amount != null || credit != null || debit != null)) {
        return { index: i, delim };
      }
    }
  }
  return null;
}

/**
 * @returns {{ rows: Array<{date, description, amount, category, type, currency, line}>,
 *   skipped: number, skippedReasons: Record<string, number>, meta: object }}
 *   amount is signed MAJOR units; `line` is the 1-based source line.
 */
export function parseCsvStatement(input) {
  const text = String(input || "").replace(/^﻿/, "");
  const lines = text.split(/\r?\n/);
  const skippedReasons = { invalidDate: 0, invalidAmount: 0, missingDate: 0 };
  const empty = (reason) => ({ rows: [], skipped: 0, skippedReasons, meta: { error: reason } });

  const header = locateHeader(lines);
  if (!header) return empty("no-recognized-header");

  let records;
  try {
    records = parse(lines.slice(header.index).join("\n"), {
      delimiter: header.delim,
      skip_empty_lines: true,
      relax_column_count: true,
      relax_quotes: true,
      trim: true,
      info: true,
    });
  } catch (e) {
    return empty(`csv-parse:${e?.code || "error"}`);
  }
  if (!records.length) return empty("empty");

  const headers = records[0].record;
  const col = {
    date: findColumn(headers, "date"),
    description: findColumn(headers, "description"),
    amount: findColumn(headers, "amount"),
    credit: findColumn(headers, "credit"),
    debit: findColumn(headers, "debit"),
    currency: findColumn(headers, "currency"),
  };
  const data = records.slice(1).map(({ record, info }) => ({
    cells: record,
    line: header.index + info.lines,
  }));
  const cell = (r, c) => (c == null ? "" : String(r.cells[c] ?? "").trim());

  // Document-level evidence first: one statement uses one date order and
  // one decimal mark, and a single row can't tell which.
  const rawDates = data.map((r) => cell(r, col.date)).filter(Boolean);
  const orderInfo = detectDateOrder(rawDates);
  const dateOrder = orderInfo.order || fallbackDateOrder(rawDates);
  const period = inferPeriodFromDates(rawDates);
  const decimalStyle = detectDecimalStyle(
    data.flatMap((r) => [cell(r, col.amount), cell(r, col.credit), cell(r, col.debit)]).filter(Boolean),
  );

  const rows = [];
  for (const r of data) {
    const dateRaw = cell(r, col.date);
    if (!dateRaw) {
      // Blank rows inside the table and trailing summary lines.
      if (r.cells.some((c) => String(c).trim())) skippedReasons.missingDate++;
      continue;
    }

    let amount = NaN;
    if (col.amount != null && cell(r, col.amount)) {
      amount = normalizeAmount(cell(r, col.amount), decimalStyle);
    } else if (col.credit != null || col.debit != null) {
      const c = cell(r, col.credit);
      const d = cell(r, col.debit);
      if (c || d) {
        const cv = c ? Math.abs(normalizeAmount(c, decimalStyle)) : 0;
        const dv = d ? Math.abs(normalizeAmount(d, decimalStyle)) : 0;
        amount = cv - dv;
      }
    }
    if (!Number.isFinite(amount)) {
      skippedReasons.invalidAmount++;
      continue;
    }

    const fitted = fitDateToPeriod(dateRaw, dateOrder, period);
    if (!fitted.date) {
      skippedReasons.invalidDate++;
      continue;
    }

    const description = cell(r, col.description);
    rows.push({
      date: fitted.date,
      description,
      amount,
      category: guessCategory(description),
      type: amount >= 0 ? "income" : "expense",
      currency: cell(r, col.currency).toUpperCase() || null,
      line: r.line,
      _dateRaw: dateRaw,
      _dateEvidence: !isAmbiguousDate(dateRaw)
        ? "unambiguous"
        : fitted.repaired
          ? "period"
          : orderInfo.order
            ? "document-order"
            : "assumed",
    });
  }

  const neighborRepairs = repairDatesByNeighbors(rows);
  const dateEvidence = {};
  for (const r of rows) {
    dateEvidence[r._dateEvidence] = (dateEvidence[r._dateEvidence] || 0) + 1;
    delete r._dateRaw;
    delete r._dateEvidence;
  }

  const skipped = Object.values(skippedReasons).reduce((a, b) => a + b, 0);
  return {
    rows,
    skipped,
    skippedReasons,
    meta: {
      delimiter: header.delim,
      headerLine: header.index + 1,
      columns: Object.fromEntries(Object.entries(col).map(([k, v]) => [k, v == null ? null : headers[v]])),
      dateOrder,
      dateOrderEvidence: orderInfo.order ? orderInfo.evidence : `fallback:${orderInfo.evidence}`,
      decimalStyle,
      period,
      neighborRepairs,
      dateEvidence,
    },
  };
}
