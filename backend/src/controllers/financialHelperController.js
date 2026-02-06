/* eslint-disable */

// ---------- IMPORTS ----------
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const pdf = require("pdf-parse"); // CJS import that works in ESM

import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import mongoose from "mongoose";
import { parse as parseCSV } from "csv-parse/sync";

import AiAdvisorFile from "../models/AiAdvisorFile.js";
import { User } from "../models/user.js";
import { computeMetrics } from "../ai/financialMetrics.js";
import { parseTransactionsFromText } from "../ai/pdfParser.js";
import { getPromptForSubscription } from "../ai/prompts/index.js";

// ----------------------------------------------------
// 2. AGENT CONFIGURATION & INITIALIZATION
// ----------------------------------------------------
const ACTIVE_AGENT = process.env.FINANCIAL_HELPER_AGENT || "openai";
const GEMINI_MODEL = "gemini-2.5-flash";
const OPENAI_MODEL = "gpt-4o-mini";

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

const gemini = process.env.GEMINI_API_KEY
  ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  : null;

const isDev = process.env.NODE_ENV !== "production";

async function callLLM(
  systemPrompt,
  context,
  tonePreference,
  message,
  modelType,
) {
  const input = [
    "SYSTEM:",
    systemPrompt,
    "",
    "USER:",
    JSON.stringify({ tonePreference, context, message }, null, 2),
  ].join("\n");

  if (modelType === "gemini" && gemini) {
    const model = gemini.getGenerativeModel({ model: GEMINI_MODEL });
    const response = await model.generateContent(input);
    const text =
      typeof response?.response?.text === "function"
        ? response.response.text()
        : typeof response?.text === "function"
          ? response.text()
          : "";
    return (text || "").trim() || "Sorry, I couldn’t generate a response.";
  }

  if (modelType === "openai" && openai) {
    try {
      const completion = await openai.responses.create({
        model: OPENAI_MODEL,
        temperature: 0.3,
        input,
      });
      return (
        completion.output_text?.trim() ||
        completion.content?.[0]?.text?.trim() ||
        "Sorry, I couldn’t generate a response."
      );
    } catch {
      const completion = await openai.chat.completions.create({
        model: OPENAI_MODEL,
        temperature: 0.3,
        messages: [{ role: "user", content: input }],
      });
      return (
        completion.choices?.[0]?.message?.content?.trim() ||
        "Sorry, I couldn't generate a response."
      );
    }
  }

  throw new Error(`Agent '${modelType}' not configured or API key missing.`);
}

/* ------------------------- OFFLINE Q&A HELPERS ------------------------- */
/* (unchanged — your existing helpers stay as-is) */

// Basic month-name map (EN + TR)
const MONTHS = {
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12,
  ocak: 1,
  subat: 2,
  şubat: 2,
  mart: 3,
  nisan: 4,
  mayis: 5,
  mayıs: 5,
  haziran: 6,
  temmuz: 7,
  agustos: 8,
  ağustos: 8,
  eylul: 9,
  eylül: 9,
  ekim: 10,
  kasim: 11,
  kasım: 11,
  aralik: 12,
  aralık: 12,
};

function toISO(d) {
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);
}

function startOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}
function endOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}
function addMonths(date, delta) {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1);
}

function parseDateRangeFromQuery(q) {
  if (!q) return null;
  const s = q.toLowerCase();

  const between =
    /between\s+(\d{4}-\d{2}-\d{2})\s+(?:and|to)\s+(\d{4}-\d{2}-\d{2})/.exec(s);
  if (between)
    return {
      start: new Date(between[1]),
      end: new Date(between[2]),
      label: `between ${between[1]} and ${between[2]}`,
    };

  const yyyymm = /(\d{4})[-\/\.](\d{1,2})/.exec(s);
  if (yyyymm) {
    const y = +yyyymm[1],
      m = +yyyymm[2] - 1;
    return {
      start: new Date(y, m, 1),
      end: endOfMonth(new Date(y, m, 1)),
      label: `${y}-${String(m + 1).padStart(2, "0")}`,
    };
  }

  const monthYear = new RegExp(
    `(${Object.keys(MONTHS).join("|")})\\s*(\\d{4})`,
    "i",
  ).exec(s);
  if (monthYear) {
    const m = MONTHS[monthYear[1].toLowerCase()],
      y = +monthYear[2];
    return {
      start: new Date(y, m - 1, 1),
      end: endOfMonth(new Date(y, m - 1, 1)),
      label: `${y}-${String(m).padStart(2, "0")}`,
    };
  }

  if (/last\s+month|gecen\s+ay|geçen\s+ay/.test(s)) {
    const start = startOfMonth(addMonths(new Date(), -1));
    const end = endOfMonth(start);
    return { start, end, label: "last month" };
  }
  if (/this\s+month|bu\s+ay/.test(s)) {
    return {
      start: startOfMonth(new Date()),
      end: endOfMonth(new Date()),
      label: "this month",
    };
  }
  if (/last\s+30\s*days|son\s+30\s*g[uü]n/.test(s)) {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 30);
    return { start, end, label: "last 30 days" };
  }
  if (/last\s+7\s*days|son\s+7\s*g[uü]n/.test(s)) {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 7);
    return { start, end, label: "last 7 days" };
  }
  if (/yesterday|d[uü]n/.test(s)) {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return {
      start: new Date(d.getFullYear(), d.getMonth(), d.getDate()),
      end: new Date(
        d.getFullYear(),
        d.getMonth(),
        d.getDate(),
        23,
        59,
        59,
        999,
      ),
      label: "yesterday",
    };
  }

  return null;
}

const CATEGORY_ALIASES = [
  { key: "Groceries", re: /(grocery|market|migros|carrefour|a101|bim)/i },
  {
    key: "Dining",
    re: /(restaurant|cafe|bar|yemek|yemeksepeti|getir yemek|trendyol yemek|food)/i,
  },
  { key: "Transport", re: /(uber|taxi|taksi|metro|bus|otob[uü]s)/i },
  { key: "Rent", re: /(rent|kira)/i },
  { key: "Utilities", re: /(fatura|bill|internet|electric|water|gas)/i },
  {
    key: "Investments",
    re: /(invest|borsa|bist|fon|etf|btc|bitcoin|eth|avax|binance|hisse)/i,
  },
  { key: "Salary", re: /(salary|payroll|maa[sş]|[uü]cret)/i },
];

function detectCategoryFromQuery(q) {
  if (!q) return null;
  for (const { key, re } of CATEGORY_ALIASES) {
    if (re.test(q)) return key;
  }
  return null;
}

function filterTx(
  txs,
  { start = null, end = null, type = null, category = null } = {},
) {
  return txs.filter((t) => {
    const d = new Date(t.date);
    if (start && d < start) return false;
    if (end && d > end) return false;
    if (type && (t.type || "").toLowerCase() !== type) return false;
    if (category && (t.category || "Other") !== category) return false;
    return true;
  });
}

function sumAmounts(arr) {
  return arr.reduce((a, b) => a + Number(b.amount || 0), 0);
}

function groupByCategory(arr) {
  const m = {};
  for (const t of arr) {
    const k = t.category || "Other";
    m[k] = (m[k] || 0) + Number(t.amount || 0);
  }
  return Object.entries(m).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
}

function topN(arr, n) {
  return arr.slice(0, n);
}

// ---------- FILE/CSV HELPERS ----------
function normalizeAmount(s) {
  if (s == null) return NaN;
  const raw = String(s).replace(/[^0-9.,-]/g, "");
  const neg = raw.includes("-");
  let numStr = raw;
  if (raw.includes(".") && raw.includes(",")) {
    if (raw.lastIndexOf(",") > raw.lastIndexOf(".")) {
      numStr = raw.replace(/\./g, "").replace(",", ".");
    } else {
      numStr = raw.replace(/,/g, "");
    }
  } else if (raw.includes(",") && !raw.includes(".")) {
    numStr = raw.replace(",", ".");
  }
  const v = parseFloat(numStr);
  return neg ? -Math.abs(v) : v;
}

function normalizeDate(s) {
  const p = String(s).replace(/-/g, "/").replace(/\./g, "/").split("/");
  let d, m, y;

  if (p[2]?.length === 4) {
    const a = +p[0],
      b = +p[1];
    if (a > 12) {
      d = a;
      m = b;
    } else if (b > 12) {
      d = b;
      m = a;
    } else {
      m = a;
      d = b;
    }
    y = p[2];
  } else {
    const a = +p[0],
      b = +p[1];
    y = String(2000 + +(p[2] || "0"));
    if (a > 12) {
      d = a;
      m = b;
    } else {
      m = a;
      d = b;
    }
  }

  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function csvToTxRows(buf) {
  const text = buf.toString("utf8");

  // Important: csv-parse/sync does NOT accept an array of delimiters.
  // We'll implement a small delimiter fallback.
  const delimiters = [",", ";", "\t", "|"];
  let rows = [];

  for (const delim of delimiters) {
    try {
      rows = parseCSV(text, {
        columns: true,
        skip_empty_lines: true,
        delimiter: delim,
        relax_column_count: true,
        relax_quotes: true,
        trim: true,
      });
      // If it parsed into objects with multiple keys, accept it.
      if (Array.isArray(rows) && rows.length) break;
    } catch {
      // try next delimiter
    }
  }

  if (!Array.isArray(rows) || rows.length === 0) return [];

  const out = [];

  for (const r of rows) {
    const date =
      r.Date ||
      r.Tarih ||
      r["Transaction Date"] ||
      r["İşlem Tarihi"] ||
      r["islemTarihi"];
    const desc =
      r.Description ||
      r.Açıklama ||
      r["Transaction Description"] ||
      r["Aciklama"] ||
      r["Islem Aciklama"];
    const credit = r.Credit || r.Alacak || r["Yatan"] || r["Credit Amount"];
    const debit = r.Debit || r.Borç || r["Çekilen"] || r["Debit Amount"];
    const amountRaw =
      r.Amount || r.Tutar || r["İşlem Tutarı"] || r["Islem Tutari"];

    let amount = NaN;
    if (amountRaw != null) amount = normalizeAmount(amountRaw);
    else if (credit != null || debit != null) {
      const c = normalizeAmount(credit ?? "0");
      const d = normalizeAmount(debit ?? "0");
      amount = (isNaN(c) ? 0 : c) - (isNaN(d) ? 0 : d);
    }

    if (!date || isNaN(amount)) continue;

    const iso = normalizeDate(date);

    out.push({
      date: iso,
      description: (desc || "").toString().trim(),
      category: "Other",
      amount,
      type: amount >= 0 ? "income" : "expense",
    });
  }

  return out;
}

/* ---------------------- OFFLINE, INTENT-AWARE ANSWERS ---------------------- */
/* (unchanged — your existing buildRuleBasedReply stays as-is) */
function buildRuleBasedReply(ctx, tone, userMsg) {
  const txs = ctx.parsedTransactions || [];
  const m = ctx.computedMetrics || {};
  const txCount = txs.length;
  const bullet = "•";
  const head = tone === "buddy" ? "Alright bro, here's the read:" : "Summary:";
  const disclaimer =
    tone === "buddy"
      ? "This is educational, not licensed financial advice."
      : "Note: Educational guidance, not licensed financial advice.";

  if (!txCount) {
    return `${
      tone === "buddy" ? "Heads up:" : "Note:"
    } I don't see any transactions yet. Upload a CSV (preferred) or a text-based PDF so I can run the numbers.\n\n${disclaimer}`;
  }

  const q = (userMsg || "").trim();
  if (q) {
    const range = parseDateRangeFromQuery(q);
    const category = detectCategoryFromQuery(q);

    const askSpend =
      /(how much|ne kadar).*(spend|harca|gider)|total.*(spend|gider)|harcamam|giderim/i.test(
        q,
      );
    const askIncome =
      /(how much|ne kadar).*(income|gelir)|total.*(income|gelir)|maa[sş]/i.test(
        q,
      );
    const askInvest =
      /(how much|ne kadar).*(invest|yatır)|invest(ed|ment)|yat[ıi]r[ıi]m/i.test(
        q,
      );
    const askTopCats =
      /(top|en [cç]ok).*(categories|kategoriler)|category breakdown|dağılım/i.test(
        q,
      );
    const askLargest =
      /(largest|biggest|en b[uü]y[uü]k).*(expense|gider)/i.test(q);
    const askBurn =
      /(burn rate|monthly burn|ayl[ıi]k gider|ayl[ıi]k harcama)/i.test(q);
    const askTrend = /(trend|ay baz[ıi]nda|month over month|m[oa]m)/i.test(q);

    const start = range?.start || null;
    const end = range?.end || null;
    const label = range?.label || "selected period";

    if (askSpend) {
      const base = filterTx(txs, { start, end, type: "expense", category });
      const total = Math.abs(sumAmounts(base.filter((t) => t.amount < 0)));
      const cnt = base.length;
      const avg = cnt ? total / cnt : 0;
      const catLine = category ? `${category} ` : "";
      if (cnt) {
        const lines = [
          `${head}`,
          `${bullet} ${catLine}spend in ${label}: ${total.toFixed(
            2,
          )} (${cnt} tx, avg ${avg.toFixed(2)}).`,
        ];
        const byCat = groupByCategory(base).map(
          ([k, v]) => `${k}: ${Math.abs(v).toFixed(2)}`,
        );
        if (!category && byCat.length)
          lines.push(`\nBreakdown: ${topN(byCat, 5).join(" • ")}`);
        lines.push(`\n${disclaimer}`);
        return lines.join("\n");
      } else {
        return `${head}\n${bullet} I don't see ${
          category ? category + " " : ""
        }expenses in ${label}. Try a wider range or upload a statement that includes expenses.\n\n${disclaimer}`;
      }
    }

    if (askIncome) {
      const base = filterTx(txs, { start, end, type: "income" });
      const total = sumAmounts(base.filter((t) => t.amount > 0));
      const cnt = base.length;
      const avg = cnt ? total / cnt : 0;
      if (cnt) {
        return `${head}\n${bullet} Income in ${label}: ${total.toFixed(
          2,
        )} (${cnt} tx, avg ${avg.toFixed(2)}).\n\n${disclaimer}`;
      } else {
        return `${head}\n${bullet} I don't see income in ${label}. If this seems wrong, upload a period covering payroll.\n\n${disclaimer}`;
      }
    }

    if (askInvest) {
      const base = filterTx(txs, { start, end, category: "Investments" });
      const total = Math.abs(sumAmounts(base.filter((t) => t.amount !== 0)));
      const cnt = base.length;
      if (cnt) {
        return `${head}\n${bullet} Investments in ${label}: ${total.toFixed(
          2,
        )} (${cnt} tx).\n\n${disclaimer}`;
      } else {
        return `${head}\n${bullet} No investment transactions found in ${label}. Try a wider window or confirm category labels.\n\n${disclaimer}`;
      }
    }

    if (askTopCats) {
      const base = filterTx(txs, { start, end });
      if (!base.length) {
        return `${head}\n${bullet} No transactions in ${label}. Try a wider range.\n\n${disclaimer}`;
      }
      const byCat = groupByCategory(base).map(
        ([k, v]) => `${k}: ${v.toFixed(2)}`,
      );
      return `${head}\n${bullet} Top categories in ${label}: ${topN(
        byCat,
        5,
      ).join(" • ")}\n\n${disclaimer}`;
    }

    if (askLargest) {
      const base = filterTx(txs, { start, end, type: "expense" }).filter(
        (t) => t.amount < 0,
      );
      base.sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
      const top = topN(base, 5);
      if (!top.length) {
        return `${head}\n${bullet} I don't see expenses in ${label}.\n\n${disclaimer}`;
      }
      const list = top
        .map(
          (t) =>
            `- ${toISO(new Date(t.date))} ${t.description || "—"} (${Math.abs(
              t.amount,
            ).toFixed(2)})`,
        )
        .join("\n");
      return `${head}\nLargest expenses in ${label}:\n${list}\n\n${disclaimer}`;
    }

    if (askBurn) {
      let startM,
        endM,
        lbl = label;
      if (start && end) {
        startM = new Date(start.getFullYear(), start.getMonth(), 1);
        endM = endOfMonth(startM);
      } else {
        startM = startOfMonth(addMonths(new Date(), -1));
        endM = endOfMonth(startM);
        lbl = "last month";
      }
      const exp = filterTx(txs, {
        start: startM,
        end: endM,
        type: "expense",
      }).filter((t) => t.amount < 0);
      const burn = Math.abs(sumAmounts(exp));
      const cnt = exp.length;
      return `${head}\n${bullet} Monthly burn (${lbl}): ${burn.toFixed(2)} ${
        cnt ? `(${cnt} tx)` : ``
      }\n\n${disclaimer}`;
    }

    if (askTrend) {
      const now = startOfMonth(new Date());
      const m3 = [addMonths(now, -3), addMonths(now, -2), addMonths(now, -1)];
      const lines = m3
        .map((d) => {
          const startM = d,
            endM = endOfMonth(d);
          const income = sumAmounts(
            filterTx(txs, { start: startM, end: endM, type: "income" }).filter(
              (t) => t.amount > 0,
            ),
          );
          const expense = Math.abs(
            sumAmounts(
              filterTx(txs, {
                start: startM,
                end: endM,
                type: "expense",
              }).filter((t) => t.amount < 0),
            ),
          );
          const net = income - expense;
          return `- ${startM.getFullYear()}-${String(
            startM.getMonth() + 1,
          ).padStart(2, "0")}: income ${income.toFixed(
            2,
          )} • out ${expense.toFixed(2)} • net ${net.toFixed(2)}`;
        })
        .join("\n");
      return `${head}\nLast 3 months trend:\n${lines}\n\n${disclaimer}`;
    }
  }

  const sr = m.savingsRate ?? null;
  const burn = m.monthlyBurn ?? null;
  const stab = m.incomeStability ?? null;
  const alloc = m.investmentAllocation ?? null;
  const risk = m.riskScore ?? null;

  const topCatsArr = Object.entries(m.categoryBreakdown || {})
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
    .slice(0, 3)
    .map(([k, v]) => `${k} (${Number(v).toFixed(2)})`);
  const topCats = topCatsArr.length ? topCatsArr.join(", ") : "none";

  const recs = [];
  if (typeof sr === "number") {
    if (sr < 15)
      recs.push(
        `Push savings rate toward 20%+. Start with +5% auto-transfer on payday.`,
      );
    else if (sr < 30)
      recs.push(`Solid savings rate (${sr}%). Nudge +1% each quarter.`);
    else
      recs.push(
        `Strong savings rate (${sr}%). Maintain ≥20% and review quarterly.`,
      );
  }
  if (typeof burn === "number" && burn > 0) {
    recs.push(
      `Monthly burn ≈ ${burn.toFixed(
        2,
      )}. Set weekly caps for Dining/Groceries/Transport and enable alerts.`,
    );
  }
  if (typeof alloc === "number") {
    if (alloc < 10)
      recs.push(
        `Low investment allocation (${alloc}%). After 3–6 mo EF, DCA into diversified ETFs.`,
      );
    else if (alloc > 60)
      recs.push(
        `High allocation (${alloc}%). Ensure 3–6 months liquidity and rebalance.`,
      );
    else
      recs.push(
        `Investment allocation (${alloc}%). Rebalance quarterly to your target mix.`,
      );
  }
  if (typeof stab === "number" && stab < 70) {
    recs.push(
      `Income stability ${stab}%. Build/maintain a 3–6 month emergency fund first.`,
    );
  }
  if (typeof risk === "number") {
    recs.push(
      risk < 55
        ? `Risk score ${risk}/100 (riskier). Trim concentrated bets and rebalance.`
        : `Risk score ${risk}/100 (okay). Rebalance quarterly.`,
    );
  }
  if (!recs.length)
    recs.push(
      `Upload more months (CSV preferred) so I can give sharper, number-backed actions.`,
    );

  const snap = [
    typeof sr === "number" ? `Savings rate: ${sr}%` : null,
    typeof burn === "number" ? `Monthly burn: ${burn.toFixed(2)}` : null,
    typeof stab === "number" ? `Income stability: ${stab}%` : null,
    typeof alloc === "number" ? `Investment allocation: ${alloc}%` : null,
    typeof risk === "number" ? `Risk score: ${risk}/100` : null,
    topCatsArr.length ? `Top categories: ${topCats}` : null,
    `Transactions: ${txCount}`,
  ]
    .filter(Boolean)
    .join(" • ");

  return `${head}
${recs.map((r) => `${bullet} ${r}`).join("\n")}

${snap}

${disclaimer}`;
}

/* =============================== INGEST (FILE MANAGEMENT) =============================== */
/**
 * NOTE: This function name is kept as `ingestPdf` for compatibility with your current route:
 *   router.post("/ingest", upload.single("file"), ctrl.ingestPdf);
 *
 * It now supports BOTH CSV and PDF, returns consistent payloads, and gives clear errors.
 */
export async function ingestPdf(req, res) {
  try {
    // 1) Most common real-world cause of req.file missing:
    //    client sent application/json instead of multipart/form-data
    const ct = String(req.headers["content-type"] || "").toLowerCase();
    if (!ct.includes("multipart/form-data")) {
      return res.status(415).json({
        ok: false,
        code: "BAD_CONTENT_TYPE",
        message:
          "Upload requires multipart/form-data. Your request did not include a multipart boundary. If you use Axios, do NOT set Content-Type manually; let the browser set it for FormData.",
      });
    }

    if (!req.file || !req.file.buffer) {
      return res.status(400).json({
        ok: false,
        code: "NO_FILE",
        message:
          "No file received. Make sure the form field name is 'file' (upload.single('file')).",
      });
    }

    const original = String(req.file.originalname || "");
    const name = original.toLowerCase();
    const mimetype = String(req.file.mimetype || "").toLowerCase();

    const isCsv =
      mimetype.includes("csv") ||
      name.endsWith(".csv") ||
      mimetype === "application/vnd.ms-excel"; // some browsers report CSV like this
    const isPdf = mimetype === "application/pdf" || name.endsWith(".pdf");

    if (!isCsv && !isPdf) {
      return res.status(415).json({
        ok: false,
        code: "UNSUPPORTED_TYPE",
        message: "Only PDF or CSV files are allowed.",
        meta: { mimetype, originalname: original },
      });
    }

    let parsedTransactions = [];
    let note = isCsv ? "csv" : "pdf";

    if (isCsv) {
      parsedTransactions = csvToTxRows(req.file.buffer);

      if (!parsedTransactions.length) {
        return res.status(422).json({
          ok: false,
          code: "NO_TRANSACTIONS",
          message:
            "We couldn't read any transactions from this CSV. Ensure it has headers like Date/Description/Amount (or Credit/Debit).",
          note,
        });
      }
    } else {
      // PDF: extract text
      const data = await pdf(req.file.buffer);
      const contentText = (data.text || "").replace(/\u0000/g, "");

      if (!contentText.trim()) {
        return res.status(400).json({
          ok: false,
          code: "PDF_NO_TEXT",
          message:
            "PDF has no extractable text (likely scanned). Export a text-based PDF or CSV.",
        });
      }

      // LLM fallback allowed if either key exists
      parsedTransactions = await parseTransactionsFromText(contentText, {
        useLLMFallback: Boolean(
          process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY,
        ),
      });

      if (!parsedTransactions.length) {
        return res.status(422).json({
          ok: false,
          code: "NO_TRANSACTIONS",
          message:
            "We couldn't read any transactions from this PDF. Try your bank’s CSV export or another statement format.",
          note,
        });
      }
    }

    const computedMetrics = computeMetrics(parsedTransactions);

    // Save if Mongo is connected; otherwise return in-memory result
    let fileId = null;
    try {
      if (mongoose.connection.readyState === 1) {
        const doc = await AiAdvisorFile.create({
          userId: req.user?._id || req.userId || req.body.userId || null,
          fileName: req.file.originalname,
          contentText: undefined, // do not store full text to avoid bloat
          parsedTransactions,
          computedMetrics,
        });
        fileId = doc._id;
      } else if (isDev) {
        console.warn(
          "Mongo not connected (readyState:",
          mongoose.connection.readyState,
          ")",
        );
      }
    } catch (e) {
      if (isDev) console.warn("Mongo save skipped:", e.message);
    }

    const totals = {
      txCount: parsedTransactions.length,
      income: parsedTransactions
        .filter((t) => Number(t.amount) > 0)
        .reduce((a, b) => a + Number(b.amount || 0), 0),
      expense: parsedTransactions
        .filter((t) => Number(t.amount) < 0)
        .reduce((a, b) => a + Number(b.amount || 0), 0),
    };

    return res.json({
      ok: true,
      fileId,
      totals,
      computedMetrics,
      note,
    });
  } catch (err) {
    console.error("ingestPdf error:", err);
    return res.status(500).json({
      ok: false,
      code: "INGEST_FAILED",
      message: "Failed to ingest file",
      details: isDev ? String(err.message || err) : undefined,
    });
  }
}
// ---------------- AI ADVISOR (quota-limited) ----------------
export async function aiAdvisor(req, res) {
  try {
    const userId = req.user?._id || req.user?.id || null;
    const { message, tonePreference, fileId } = req.body;

    if (!message || !String(message).trim()) {
      return res.status(400).json({ error: "Missing message" });
    }

    // Plan prompt selection (your system uses User.subscription = Plus/Premium)
    let subscription = "Plus";
    if (userId) {
      const user = await User.findById(userId).select("subscription");
      if (user?.subscription === "Premium" || user?.subscription === "Plus") {
        subscription = user.subscription;
      } else {
        // if user exists but has no subscription set, treat as free
        subscription = "Free";
      }
    } else {
      subscription = "Free";
    }

    const systemPrompt = getPromptForSubscription(subscription);

    // Optional context (same behavior as chat)
    let fileDoc = null;
    if (fileId) fileDoc = await AiAdvisorFile.findById(fileId);
    else if (userId)
      fileDoc = await AiAdvisorFile.findOne({ userId }).sort({ createdAt: -1 });

    const context = fileDoc
      ? {
          parsedTransactions: fileDoc.parsedTransactions || [],
          computedMetrics: fileDoc.computedMetrics || {},
        }
      : {
          parsedTransactions: [],
          computedMetrics: {},
        };

    // If no API keys, fallback to rule-based (won't be amazing but works)
    if (!openai && !gemini) {
      const reply = buildRuleBasedReply(
        context,
        tonePreference || "formal",
        message,
      );
      return res.json({
        reply,
        quota: req.aiQuota || null,
      });
    }

    const agentToUse = ACTIVE_AGENT;

    try {
      const reply = await callLLM(
        systemPrompt,
        context,
        tonePreference,
        message,
        agentToUse,
      );

      return res.json({
        reply,
        quota: req.aiQuota || null, // include remaining/reset info for UI
      });
    } catch (e) {
      // fallback if LLM fails
      const reply = buildRuleBasedReply(
        context,
        tonePreference || "formal",
        message,
      );

      return res.json({
        reply: isDev
          ? reply +
            `\n\n(Dev note: AI call to ${agentToUse} failed; served rule-based reply.)`
          : reply,
        quota: req.aiQuota || null,
      });
    }
  } catch (err) {
    console.error("aiAdvisor error:", err);
    return res.status(500).json({ error: "AI advisor failed" });
  }
}

/* =============================== CHAT (UNCHANGED LOGIC) =============================== */
export async function chat(req, res) {
  try {
    const userId = req.user?._id || req.userId || req.body.userId || null;
    const { message, tonePreference, fileId } = req.body;
    if (!message && !tonePreference) {
      return res.status(400).json({ error: "Missing message" });
    }

    let subscription = "Plus";
    if (userId) {
      const user = await User.findById(userId).select("subscription");
      if (user?.subscription === "Premium" || user?.subscription === "Plus") {
        subscription = user.subscription;
      }
    }

    const systemPrompt = getPromptForSubscription(subscription);

    let fileDoc = null;
    if (fileId) fileDoc = await AiAdvisorFile.findById(fileId);
    else if (userId)
      fileDoc = await AiAdvisorFile.findOne({ userId }).sort({ createdAt: -1 });
    else fileDoc = await AiAdvisorFile.findOne({}).sort({ createdAt: -1 });

    if (!fileDoc) {
      const tone =
        (tonePreference || "formal") === "buddy" ? "buddy" : "formal";
      const msg =
        tone === "buddy"
          ? "Bro, henüz hareket göremiyorum. Bir CSV ya da metin tabanlı PDF yükle; istersen demo verilerle deneme yapabilirim—'run with demo data' yaz yeter 👍"
          : "Henüz analiz edebileceğim veri yok. Lütfen bir CSV ya da metin tabanlı PDF yükleyin. İsterseniz 'run with demo data' yazarak örnek verilerle deneme yapabilirim.";
      return res.json({ reply: msg });
    }

    const context = {
      parsedTransactions: fileDoc.parsedTransactions || [],
      computedMetrics: fileDoc.computedMetrics || {},
    };

    if (!openai && !gemini) {
      const reply = buildRuleBasedReply(
        context,
        tonePreference || "formal",
        message,
      );
      return res.json({ reply });
    }

    const agentToUse = ACTIVE_AGENT;

    try {
      const reply = await callLLM(
        systemPrompt,
        context,
        tonePreference,
        message,
        agentToUse,
      );
      return res.json({ reply });
    } catch (e) {
      if (isDev)
        console.warn(
          `${agentToUse} failed, using fallback:`,
          e?.status || e?.code,
          e?.message,
        );
      const reply = buildRuleBasedReply(
        context,
        tonePreference || "formal",
        message,
      );
      if (isDev) {
        return res.json({
          reply:
            reply +
            `\n\n(Dev note: AI call to ${agentToUse} failed; served rule-based reply. Check API Key / network.)`,
        });
      }
      return res.json({ reply });
    }
  } catch (err) {
    console.error("chat error:", err);
    return res.status(500).json({ error: "Chat failed" });
  }
}

export default { ingestPdf, chat };
