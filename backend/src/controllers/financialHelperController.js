/* eslint-disable */

// ---------- IMPORTS ----------
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const pdf = require("pdf-parse"); // CJS import that works in ESM

import OpenAI from "openai";
// 1. ADD GEMINI SDK IMPORT
import { GoogleGenAI } from "@google/genai";
import mongoose from "mongoose";
import { parse as parseCSV } from "csv-parse/sync";

import AiAdvisorFile from "../models/AiAdvisorFile.js";
import { computeMetrics } from "../ai/financialMetrics.js";
import { parseTransactionsFromText } from "../ai/pdfParser.js";

// If you don't have a prompts file, we keep a minimal system prompt inline
const systemPrompt = `You are Nummora Financial Helper.
- Educational only; not licensed financial advice.
- Keep the user's tonePreference (formal|buddy).
- Use provided parsedTransactions and computedMetrics as ground truth.
- Output: 1–2 sentence summary, 3–5 bullets, then a metric snapshot.`;

// ----------------------------------------------------
// 2. AGENT CONFIGURATION & INITIALIZATION
// ----------------------------------------------------

// Determine the active agent from environment variable (default to openai)
const ACTIVE_AGENT = process.env.FINANCIAL_HELPER_AGENT || "openai";
const GEMINI_MODEL = "gemini-2.5-flash"; // Recommended model for chat
const OPENAI_MODEL = "gpt-4o-mini"; // Your existing OpenAI model

// ---------- OPENAI (old agent) ----------
const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

// ---------- GEMINI (new agent) ----------
const gemini = process.env.GEMINI_API_KEY
  ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  : null;

const isDev = process.env.NODE_ENV !== "production";

/**
 * 3. Central function to call the configured LLM.
 */
async function callLLM(context, tonePreference, message, modelType) {
  // This structured input is passed to the LLM to provide all context
  const input = [
    "SYSTEM:",
    systemPrompt,
    "",
    "USER:",
    JSON.stringify({ tonePreference, context, message }, null, 2),
  ].join("\n");

  if (modelType === "gemini" && gemini) {
    // --- GEMINI AGENT LOGIC ---
    const response = await gemini.models.generateContent({
      model: GEMINI_MODEL,
      contents: input,
      config: {
        temperature: 0.3,
      },
    });
    return response.text.trim();
  } else if (modelType === "openai" && openai) {
    // --- OPENAI AGENT LOGIC ---
    // Retaining your original call structure, though using the modern chat completions API is generally preferred.
    try {
      // Attempting to use the non-standard 'responses.create' if it's part of an older or custom SDK fork
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
      // Fallback to standard chat completions
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
  } else {
    throw new Error(`Agent '${modelType}' not configured or API key missing.`);
  }
}

/* ------------------------- OFFLINE Q&A HELPERS ------------------------- */

// Basic month-name map (EN + TR)
const MONTHS = {
  // ... (MONTHS array contents remain the same) ...
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
  // ... (toISO function contents remain the same) ...
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);
}

function startOfMonth(date = new Date()) {
  // ... (startOfMonth function contents remain the same) ...
  return new Date(date.getFullYear(), date.getMonth(), 1);
}
function endOfMonth(date = new Date()) {
  // ... (endOfMonth function contents remain the same) ...
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}
function addMonths(date, delta) {
  // ... (addMonths function contents remain the same) ...
  return new Date(date.getFullYear(), date.getMonth() + delta, 1);
}

function parseDateRangeFromQuery(q) {
  // ... (parseDateRangeFromQuery function contents remain the same) ...
  if (!q) return null;
  const s = q.toLowerCase();

  // explicit YYYY-MM or YYYY-MM-DD ranges
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

  // “august 2025”, “ağustos 2025”
  const monthYear = new RegExp(
    `(${Object.keys(MONTHS).join("|")})\\s*(\\d{4})`,
    "i"
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

  // relative windows
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
        999
      ),
      label: "yesterday",
    };
  }

  return null;
}

const CATEGORY_ALIASES = [
  // ... (CATEGORY_ALIASES array contents remain the same) ...
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
  // ... (detectCategoryFromQuery function contents remain the same) ...
  if (!q) return null;
  for (const { key, re } of CATEGORY_ALIASES) {
    if (re.test(q)) return key;
  }
  return null;
}

function filterTx(
  txs,
  { start = null, end = null, type = null, category = null } = {}
) {
  // ... (filterTx function contents remain the same) ...
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
  // ... (sumAmounts function contents remain the same) ...
  return arr.reduce((a, b) => a + Number(b.amount || 0), 0);
}

function groupByCategory(arr) {
  // ... (groupByCategory function contents remain the same) ...
  const m = {};
  for (const t of arr) {
    const k = t.category || "Other";
    m[k] = (m[k] || 0) + Number(t.amount || 0);
  }
  return Object.entries(m).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
}

function topN(arr, n) {
  // ... (topN function contents remain the same) ...
  return arr.slice(0, n);
}

// ---------- HELPERS ----------
function normalizeAmount(s) {
  // ... (normalizeAmount function contents remain the same) ...
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

function csvToTxRows(buf) {
  // ... (csvToTxRows function contents remain the same) ...
  const text = buf.toString("utf8");
  const rows = parseCSV(text, {
    columns: true,
    skip_empty_lines: true,
    // try common delimiters
    delimiter: [",", ";", "\t", "|"],
    relax_column_count: true,
    relax_quotes: true,
  });
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
      amount = (isNaN(c) ? 0 : c) - (isNaN(d) ? 0 : d); // credit - debit
    }

    if (!date || isNaN(amount)) continue;

    const parts = String(date)
      .replace(/-/g, "/")
      .replace(/\./g, "/")
      .split("/");
    let d, m, y;
    if (parts[2] && parts[2].length === 4) {
      const a = +parts[0],
        b = +parts[1];
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
      y = parts[2];
    } else {
      const a = +parts[0],
        b = +parts[1];
      y = String(2000 + +(parts[2] || "0"));
      if (a > 12) {
        d = a;
        m = b;
      } else {
        m = a;
        d = b;
      }
    }
    const iso = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(
      2,
      "0"
    )}`;

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

async function simpleRegexExtract(text) {
  // ... (simpleRegexExtract function contents remain the same) ...
  const lines = text
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  const DATE = /\b(\d{1,2}[\/\.\-]\d{1,2}[\/\.\-]\d{2,4})\b/;
  const AMT =
    /([-+]?\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})|[-+]?\d+(?:[.,]\d{2})?)/;

  const txs = [];
  for (let i = 0; i < lines.length; i++) {
    const li = lines[i];
    const d = li.match(DATE);
    const a = li.match(AMT);
    if (d && a) {
      const iso = normalizeDate(d[1]);
      const amt = normalizeAmount(a[1]);
      if (!isNaN(amt)) {
        txs.push({
          date: iso,
          description: li
            .replace(d[0], "")
            .replace(a[0], "")
            .replace(/\s{2,}/g, " ")
            .trim(),
          category: "Other",
          amount: amt,
          type: amt >= 0 ? "income" : "expense",
        });
      }
    }
  }
  return txs;
}

function normalizeDate(s) {
  // ... (normalizeDate function contents remain the same) ...
  const p = s.replace(/-/g, "/").replace(/\./g, "/").split("/");
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

/* ---------------------- OFFLINE, INTENT-AWARE ANSWERS ---------------------- */
/* eslint-disable */
function buildRuleBasedReply(ctx, tone, userMsg) {
  // ... (buildRuleBasedReply function contents remain the same) ...
  const txs = ctx.parsedTransactions || [];
  const m = ctx.computedMetrics || {};
  const txCount = txs.length;
  const bullet = "•";
  const head = tone === "buddy" ? "Alright bro, here's the read:" : "Summary:";
  const disclaimer =
    tone === "buddy"
      ? "This is educational, not licensed financial advice."
      : "Note: Educational guidance, not licensed financial advice.";

  // If no data, keep it simple and honest:
  if (!txCount) {
    return `${
      tone === "buddy" ? "Heads up:" : "Note:"
    } I don't see any transactions yet. Upload a CSV (preferred) or a text-based PDF so I can run the numbers.\n\n${disclaimer}`;
  }

  // -------------------- 1) Try to answer the user's question --------------------
  const q = (userMsg || "").trim();
  if (q) {
    const range = parseDateRangeFromQuery(q);
    const category = detectCategoryFromQuery(q);

    // intent heuristics
    const askSpend =
      /(how much|ne kadar).*(spend|harca|gider)|total.*(spend|gider)|harcamam|giderim/i.test(
        q
      );
    const askIncome =
      /(how much|ne kadar).*(income|gelir)|total.*(income|gelir)|maa[sş]/i.test(
        q
      );
    const askInvest =
      /(how much|ne kadar).*(invest|yatır)|invest(ed|ment)|yat[ıi]r[ıi]m/i.test(
        q
      );
    const askTopCats =
      /(top|en [cç]ok).*(categories|kategoriler)|category breakdown|dağılım/i.test(
        q
      );
    const askLargest =
      /(largest|biggest|en b[uü]y[uü]k).*(expense|gider)/i.test(q);
    const askBurn =
      /(burn rate|monthly burn|ayl[ıi]k gider|ayl[ıi]k harcama)/i.test(q);
    const askTrend = /(trend|ay baz[ıi]nda|month over month|m[oa]m)/i.test(q);

    const start = range?.start || null;
    const end = range?.end || null;
    const label = range?.label || "selected period";

    // SPEND by category or overall
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
            2
          )} (${cnt} tx, avg ${avg.toFixed(2)}).`,
        ];
        const byCat = groupByCategory(base).map(
          ([k, v]) => `${k}: ${Math.abs(v).toFixed(2)}`
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

    // INCOME
    if (askIncome) {
      const base = filterTx(txs, { start, end, type: "income" });
      const total = sumAmounts(base.filter((t) => t.amount > 0));
      const cnt = base.length;
      const avg = cnt ? total / cnt : 0;
      if (cnt) {
        return `${head}\n${bullet} Income in ${label}: ${total.toFixed(
          2
        )} (${cnt} tx, avg ${avg.toFixed(2)}).\n\n${disclaimer}`;
      } else {
        return `${head}\n${bullet} I don't see income in ${label}. If this seems wrong, upload a period covering payroll.\n\n${disclaimer}`;
      }
    }

    // INVESTMENTS
    if (askInvest) {
      const base = filterTx(txs, { start, end, category: "Investments" });
      const total = Math.abs(sumAmounts(base.filter((t) => t.amount !== 0)));
      const cnt = base.length;
      if (cnt) {
        return `${head}\n${bullet} Investments in ${label}: ${total.toFixed(
          2
        )} (${cnt} tx).\n\n${disclaimer}`;
      } else {
        return `${head}\n${bullet} No investment transactions found in ${label}. Try a wider window or confirm category labels.\n\n${disclaimer}`;
      }
    }

    // TOP CATEGORIES
    if (askTopCats) {
      const base = filterTx(txs, { start, end });
      if (!base.length) {
        return `${head}\n${bullet} No transactions in ${label}. Try a wider range.\n\n${disclaimer}`;
      }
      const byCat = groupByCategory(base).map(
        ([k, v]) => `${k}: ${v.toFixed(2)}`
      );
      return `${head}\n${bullet} Top categories in ${label}: ${topN(
        byCat,
        5
      ).join(" • ")}\n\n${disclaimer}`;
    }

    // LARGEST EXPENSES
    if (askLargest) {
      const base = filterTx(txs, { start, end, type: "expense" }).filter(
        (t) => t.amount < 0
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
              t.amount
            ).toFixed(2)})`
        )
        .join("\n");
      return `${head}\nLargest expenses in ${label}:\n${list}\n\n${disclaimer}`;
    }

    // BURN RATE (monthly)
    if (askBurn) {
      // if a month window is given, use that; otherwise last month
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

    // TRENDS (month over month, last 3 months)
    if (askTrend) {
      const now = startOfMonth(new Date());
      const m3 = [addMonths(now, -3), addMonths(now, -2), addMonths(now, -1)];
      const lines = m3
        .map((d) => {
          const startM = d,
            endM = endOfMonth(d);
          const income = sumAmounts(
            filterTx(txs, { start: startM, end: endM, type: "income" }).filter(
              (t) => t.amount > 0
            )
          );
          const expense = Math.abs(
            sumAmounts(
              filterTx(txs, {
                start: startM,
                end: endM,
                type: "expense",
              }).filter((t) => t.amount < 0)
            )
          );
          const net = income - expense;
          return `- ${startM.getFullYear()}-${String(
            startM.getMonth() + 1
          ).padStart(2, "0")}: income ${income.toFixed(
            2
          )} • out ${expense.toFixed(2)} • net ${net.toFixed(2)}`;
        })
        .join("\n");
      return `${head}\nLast 3 months trend:\n${lines}\n\n${disclaimer}`;
    }
  }

  // -------------------- 2) Fallback to generic summary if unknown --------------------
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
        `Push savings rate toward 20%+. Start with +5% auto-transfer on payday.`
      );
    else if (sr < 30)
      recs.push(`Solid savings rate (${sr}%). Nudge +1% each quarter.`);
    else
      recs.push(
        `Strong savings rate (${sr}%). Maintain ≥20% and review quarterly.`
      );
  }
  if (typeof burn === "number" && burn > 0) {
    recs.push(
      `Monthly burn ≈ ${burn.toFixed(
        2
      )}. Set weekly caps for Dining/Groceries/Transport and enable alerts.`
    );
  }
  if (typeof alloc === "number") {
    if (alloc < 10)
      recs.push(
        `Low investment allocation (${alloc}%). After 3–6 mo EF, DCA into diversified ETFs.`
      );
    else if (alloc > 60)
      recs.push(
        `High allocation (${alloc}%). Ensure 3–6 months liquidity and rebalance.`
      );
    else
      recs.push(
        `Investment allocation (${alloc}%). Rebalance quarterly to your target mix.`
      );
  }
  if (typeof stab === "number" && stab < 70) {
    recs.push(
      `Income stability ${stab}%. Build/maintain a 3–6 month emergency fund first.`
    );
  }
  if (typeof risk === "number") {
    recs.push(
      risk < 55
        ? `Risk score ${risk}/100 (riskier). Trim concentrated bets and rebalance.`
        : `Risk score ${risk}/100 (okay). Rebalance quarterly.`
    );
  }
  if (!recs.length)
    recs.push(
      `Upload more months (CSV preferred) so I can give sharper, number-backed actions.`
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

// ---------- CONTROLLERS ----------
export async function ingestPdf(req, res) {
  // ... (ingestPdf function contents remain the same) ...
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const name = (req.file.originalname || "").toLowerCase();
    const isCsv = req.file.mimetype === "text/csv" || name.endsWith(".csv");

    let parsedTransactions = [];
    let note;

    if (isCsv) {
      parsedTransactions = csvToTxRows(req.file.buffer);
      note = "csv";
    } else {
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

      // NOTE: This now checks for EITHER OPENAI_API_KEY OR GEMINI_API_KEY inside pdfParser.js
      parsedTransactions = await parseTransactionsFromText(contentText, {
        useLLMFallback: Boolean(
          process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY
        ),
      });
      console.log("txCount:", parsedTransactions.length);
      if (parsedTransactions.length)
        console.log("firstTx:", parsedTransactions[0]);

      if (!parsedTransactions.length) {
        return res.status(422).json({
          ok: false,
          code: "NO_TRANSACTIONS",
          message:
            "We couldn't read any transactions from this file. Try your bank’s CSV export or another statement format.",
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
          userId: req.user?._id || req.body.userId || null,
          fileName: req.file.originalname,
          contentText: undefined, // skip storing large text
          parsedTransactions,
          computedMetrics,
        });
        fileId = doc._id;
      } else if (isDev) {
        console.warn(
          "Mongo not connected (readyState:",
          mongoose.connection.readyState,
          ")"
        );
      }
    } catch (e) {
      if (isDev) console.warn("Mongo save skipped:", e.message);
    }

    return res.json({
      ok: true,
      fileId,
      totals: {
        txCount: parsedTransactions.length,
        income: parsedTransactions
          .filter((t) => t.amount > 0)
          .reduce((a, b) => a + b.amount, 0),
        expense: parsedTransactions
          .filter((t) => t.amount < 0)
          .reduce((a, b) => a + b.amount, 0),
      },
      computedMetrics,
      note,
    });
  } catch (err) {
    console.error("ingestPdf error:", err);
    return res.status(500).json({
      error: "Failed to ingest file",
      details: isDev ? String(err.message || err) : undefined,
    });
  }
}

export async function chat(req, res) {
  try {
    const userId = req.user?._id || req.body.userId || null;
    const { message, tonePreference, fileId } = req.body;
    if (!message && !tonePreference) {
      return res.status(400).json({ error: "Missing message" });
    }

    // Find latest file (supports dev usage without userId)
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

    // 4. UPDATE: No LLM key? Use rule-based fallback.
    if (!openai && !gemini) {
      const reply = buildRuleBasedReply(
        context,
        tonePreference || "formal",
        message
      );
      return res.json({ reply });
    }

    // The agent to use is determined by the environment variable ACTIVE_AGENT
    const agentToUse = ACTIVE_AGENT;

    // 5. UPDATE: Call the central LLM function
    try {
      const reply = await callLLM(context, tonePreference, message, agentToUse);
      return res.json({ reply });
    } catch (e) {
      if (isDev)
        console.warn(
          `${agentToUse} failed, using fallback:`, // Log which agent failed
          e?.status || e?.code,
          e?.message
        );
      const reply = buildRuleBasedReply(
        context,
        tonePreference || "formal",
        message
      );
      if (isDev) {
        return res.json({
          reply:
            reply +
            `\n\n(Dev note: AI call to ${agentToUse} failed; served rule-based reply. Check API Key / network.)`, // Updated dev note
        });
      }
      return res.json({ reply });
    }
  } catch (err) {
    console.error("chat error:", err);
    return res.status(500).json({ error: "Chat failed" });
  }
}

// ---------- EXPORTS ----------
export default { ingestPdf, chat };
