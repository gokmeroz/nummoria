/* eslint-disable */

// ---------- IMPORTS ----------
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const pdf = require("pdf-parse");

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
// AGENT CONFIGURATION
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

/* -------------------------------------------------------------------------- */
/*                               LLM CALL HELPER                              */
/* -------------------------------------------------------------------------- */

async function callLLM(
  systemPrompt,
  context,
  tonePreference,
  message,
  modelType,
) {
  const safeTone = tonePreference === "buddy" ? "buddy" : "formal";

  const userPayload = {
    tonePreference: safeTone,
    message: String(message || "").trim(),
    context: {
      parsedTransactions: Array.isArray(context?.parsedTransactions)
        ? context.parsedTransactions
        : [],
      computedMetrics:
        context?.computedMetrics && typeof context.computedMetrics === "object"
          ? context.computedMetrics
          : {},
    },
  };

  if (modelType === "gemini" && gemini) {
    const model = gemini.getGenerativeModel({
      model: GEMINI_MODEL,
      systemInstruction: systemPrompt,
    });

    const response = await model.generateContent({
      contents: [
        {
          role: "user",
          parts: [
            {
              text: JSON.stringify(userPayload, null, 2),
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.3,
      },
    });

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
        instructions: systemPrompt,
        input: JSON.stringify(userPayload, null, 2),
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
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: JSON.stringify(userPayload, null, 2),
          },
        ],
      });

      return (
        completion.choices?.[0]?.message?.content?.trim() ||
        "Sorry, I couldn't generate a response."
      );
    }
  }

  throw new Error(`Agent '${modelType}' not configured or API key missing.`);
}

/* -------------------------------------------------------------------------- */
/*                          OFFLINE Q&A / RULE HELPERS                        */
/* -------------------------------------------------------------------------- */

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
  if (between) {
    return {
      start: new Date(between[1]),
      end: new Date(between[2]),
      label: `between ${between[1]} and ${between[2]}`,
    };
  }

  const yyyymm = /(\d{4})[-\/\.](\d{1,2})/.exec(s);
  if (yyyymm) {
    const y = +yyyymm[1];
    const m = +yyyymm[2] - 1;
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
    const m = MONTHS[monthYear[1].toLowerCase()];
    const y = +monthYear[2];
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

/* -------------------------------------------------------------------------- */
/*                            FILE / CSV HELPER UTILS                         */
/* -------------------------------------------------------------------------- */

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
    const a = +p[0];
    const b = +p[1];

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
    const a = +p[0];
    const b = +p[1];
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
      r.islemTarihi;

    const desc =
      r.Description ||
      r.Açıklama ||
      r["Transaction Description"] ||
      r.Aciklama ||
      r["Islem Aciklama"];

    const credit = r.Credit || r.Alacak || r.Yatan || r["Credit Amount"];
    const debit = r.Debit || r.Borç || r.Çekilen || r["Debit Amount"];
    const amountRaw =
      r.Amount || r.Tutar || r["İşlem Tutarı"] || r["Islem Tutari"];

    let amount = NaN;

    if (amountRaw != null) {
      amount = normalizeAmount(amountRaw);
    } else if (credit != null || debit != null) {
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

/* -------------------------------------------------------------------------- */
/*                        RULE-BASED FALLBACK REPLIES                         */
/* -------------------------------------------------------------------------- */

function buildNoDataReply(tone, userMsg) {
  const isBuddy = tone === "buddy";
  const q = String(userMsg || "").toLowerCase();

  const savingQuestion =
    /save|saving|budget|cut back|spend less|spending|before summer|75 days|money plan/.test(
      q,
    );

  if (savingQuestion) {
    if (isBuddy) {
      return [
        "Quick take: if you only have 75 days, the fastest wins usually come from cutting variable spending hard and automating savings immediately.",
        "",
        "• Freeze non-essential shopping for the full 75 days.",
        "• Set a weekly spending cap for dining, coffee, delivery, and random small purchases.",
        "• Move a fixed amount into savings the same day income hits, even if it’s modest.",
        "• Cancel or pause at least 1–3 subscriptions you do not actively use.",
        "• Track every discretionary purchase for the next 14 days so the leaks become obvious.",
        "",
        "Metric snapshot: even saving just 10 per day for 75 days creates 750 in extra cash.",
        "",
        "Upload a CSV or text-based PDF whenever you want a deeper analysis based on your real numbers.",
        "",
        "This is educational, not licensed financial advice.",
      ].join("\n");
    }

    return [
      "Quick take: with only 75 days, the highest-impact approach is to reduce variable expenses aggressively and automate savings immediately.",
      "",
      "• Pause non-essential spending for the next 75 days.",
      "• Set a weekly cap for dining, coffee, delivery, and impulse purchases.",
      "• Transfer a fixed amount to savings on each payday before spending anything else.",
      "• Cancel or pause 1–3 subscriptions that are not actively useful.",
      "• Track every discretionary purchase for the next 14 days to identify recurring leaks.",
      "",
      "Metric snapshot: saving just 10 per day for 75 days adds 750 in extra cash.",
      "",
      "You can upload a CSV or text-based PDF later if you want a more precise analysis.",
      "",
      "Note: Educational guidance, not licensed financial advice.",
    ].join("\n");
  }

  if (isBuddy) {
    return [
      "I can still help without an uploaded file.",
      "",
      "• Ask me a budgeting, saving, spending, or investing question and I’ll answer directly.",
      "• If you upload a CSV or text-based PDF later, I can make the advice more precise.",
      "• If you want, I can also work from rough numbers you type manually.",
      "",
      "This is educational, not licensed financial advice.",
    ].join("\n");
  }

  return [
    "I can still help without an uploaded file.",
    "",
    "• Ask a budgeting, saving, spending, or investing question and I will answer directly.",
    "• If you upload a CSV or text-based PDF later, I can make the analysis more precise.",
    "• I can also work from rough numbers you type manually.",
    "",
    "Note: Educational guidance, not licensed financial advice.",
  ].join("\n");
}

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
    return buildNoDataReply(tone, userMsg);
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

        if (!category && byCat.length) {
          lines.push(`\nBreakdown: ${topN(byCat, 5).join(" • ")}`);
        }

        lines.push(`\n${disclaimer}`);
        return lines.join("\n");
      }

      return `${head}\n${bullet} I don't see ${
        category ? `${category} ` : ""
      }expenses in ${label}. Try a wider range.\n\n${disclaimer}`;
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
      }

      return `${head}\n${bullet} I don't see income in ${label}.\n\n${disclaimer}`;
    }

    if (askInvest) {
      const base = filterTx(txs, { start, end, category: "Investments" });
      const total = Math.abs(sumAmounts(base.filter((t) => t.amount !== 0)));
      const cnt = base.length;

      if (cnt) {
        return `${head}\n${bullet} Investments in ${label}: ${total.toFixed(
          2,
        )} (${cnt} tx).\n\n${disclaimer}`;
      }

      return `${head}\n${bullet} No investment transactions found in ${label}.\n\n${disclaimer}`;
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
      let startM;
      let endM;
      let lbl = label;

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
        cnt ? `(${cnt} tx)` : ""
      }\n\n${disclaimer}`;
    }

    if (askTrend) {
      const now = startOfMonth(new Date());
      const m3 = [addMonths(now, -3), addMonths(now, -2), addMonths(now, -1)];

      const lines = m3
        .map((d) => {
          const startM = d;
          const endM = endOfMonth(d);

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
    if (sr < 15) {
      recs.push(
        "Push savings rate toward 20%+. Start with a small automatic transfer on payday.",
      );
    } else if (sr < 30) {
      recs.push(`Solid savings rate (${sr}%). Nudge it upward gradually.`);
    } else {
      recs.push(`Strong savings rate (${sr}%). Maintain and review quarterly.`);
    }
  }

  if (typeof burn === "number" && burn > 0) {
    recs.push(
      `Monthly burn is about ${burn.toFixed(
        2,
      )}. Set weekly caps for dining, groceries, and transport.`,
    );
  }

  if (typeof alloc === "number") {
    if (alloc < 10) {
      recs.push(
        `Investment allocation is low (${alloc}%). Build liquidity first, then increase steadily.`,
      );
    } else if (alloc > 60) {
      recs.push(
        `Investment allocation is high (${alloc}%). Make sure liquidity is sufficient and rebalance if needed.`,
      );
    } else {
      recs.push(
        `Investment allocation is ${alloc}%. Rebalance periodically to stay aligned with your target mix.`,
      );
    }
  }

  if (typeof stab === "number" && stab < 70) {
    recs.push(
      `Income stability is ${stab}%. Prioritize emergency fund strength.`,
    );
  }

  if (typeof risk === "number") {
    recs.push(
      risk < 55
        ? `Risk score is ${risk}/100. Consider reducing concentration and tightening cash reserves.`
        : `Risk score is ${risk}/100. Continue reviewing allocation and liquidity periodically.`,
    );
  }

  if (!recs.length) {
    recs.push(
      "Upload more months of data for sharper, number-backed guidance.",
    );
  }

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

/* -------------------------------------------------------------------------- */
/*                        UNIFIED CONTEXT / SUBSCRIPTION                       */
/* -------------------------------------------------------------------------- */

async function getSubscriptionForUser(userId) {
  if (!userId) return "Free";

  const user = await User.findById(userId).select("subscription");
  if (user?.subscription === "Premium" || user?.subscription === "Plus") {
    return user.subscription;
  }

  return "Free";
}

async function getLatestFileForUser(userId, fileId) {
  if (fileId) {
    return await AiAdvisorFile.findById(fileId);
  }

  if (!userId) {
    return null;
  }

  return await AiAdvisorFile.findOne({ userId }).sort({ createdAt: -1 });
}

function buildContextFromFile(fileDoc) {
  if (!fileDoc) {
    return {
      parsedTransactions: [],
      computedMetrics: {},
    };
  }

  return {
    parsedTransactions: fileDoc.parsedTransactions || [],
    computedMetrics: fileDoc.computedMetrics || {},
  };
}

/* -------------------------------------------------------------------------- */
/*                            FILE INGEST FOR ADVISOR                          */
/* -------------------------------------------------------------------------- */

export async function ingestPdf(req, res) {
  try {
    const ct = String(req.headers["content-type"] || "").toLowerCase();
    if (!ct.includes("multipart/form-data")) {
      return res.status(415).json({
        ok: false,
        code: "BAD_CONTENT_TYPE",
        message:
          "Upload requires multipart/form-data. If you use Axios, do NOT set Content-Type manually; let the browser set it for FormData.",
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
      mimetype === "application/vnd.ms-excel";

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
    const note = isCsv ? "csv" : "pdf";

    if (isCsv) {
      parsedTransactions = csvToTxRows(req.file.buffer);

      if (!parsedTransactions.length) {
        return res.status(422).json({
          ok: false,
          code: "NO_TRANSACTIONS",
          message:
            "We couldn't read any transactions from this CSV. Ensure it has headers like Date/Description/Amount or Credit/Debit.",
          note,
        });
      }
    } else {
      const data = await pdf(req.file.buffer);
      const contentText = (data.text || "").replace(/\u0000/g, "");

      if (!contentText.trim()) {
        return res.status(400).json({
          ok: false,
          code: "PDF_NO_TEXT",
          message:
            "PDF has no extractable text. Upload a text-based PDF or CSV.",
        });
      }

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

    let fileId = null;
    try {
      if (mongoose.connection.readyState === 1) {
        const doc = await AiAdvisorFile.create({
          userId:
            req.user?._id ||
            req.user?.id ||
            req.userId ||
            req.body.userId ||
            null,
          fileName: req.file.originalname,
          contentText: undefined,
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

/* -------------------------------------------------------------------------- */
/*                              AI ADVISOR ROUTE                              */
/* -------------------------------------------------------------------------- */

export async function aiAdvisor(req, res) {
  try {
    const userId = req.user?._id || req.user?.id || null;
    const { message, tonePreference, fileId } = req.body;

    if (!message || !String(message).trim()) {
      return res.status(400).json({ error: "Missing message" });
    }

    const subscription = await getSubscriptionForUser(userId);
    const systemPrompt = getPromptForSubscription(subscription);
    const fileDoc = await getLatestFileForUser(userId, fileId);
    const context = buildContextFromFile(fileDoc);
    const safeTone = tonePreference === "buddy" ? "buddy" : "formal";

    if (!openai && !gemini) {
      const reply = buildRuleBasedReply(context, safeTone, message);
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
        safeTone,
        message,
        agentToUse,
      );

      return res.json({
        reply,
        quota: req.aiQuota || null,
      });
    } catch (e) {
      if (isDev) {
        console.warn(
          `${agentToUse} failed in aiAdvisor, using rule fallback:`,
          e?.status || e?.code,
          e?.message,
        );
      }

      const reply = buildRuleBasedReply(context, safeTone, message);

      return res.json({
        reply: isDev
          ? `${reply}\n\n(Dev note: AI call to ${agentToUse} failed; served rule-based reply.)`
          : reply,
        quota: req.aiQuota || null,
      });
    }
  } catch (err) {
    console.error("aiAdvisor error:", err);
    return res.status(500).json({ error: "AI advisor failed" });
  }
}

/* -------------------------------------------------------------------------- */
/*                                  CHAT ROUTE                                */
/* -------------------------------------------------------------------------- */

export async function chat(req, res) {
  try {
    const userId = req.user?._id || req.user?.id || req.userId || null;
    const { message, tonePreference, fileId } = req.body;

    if (!message || !String(message).trim()) {
      return res.status(400).json({ error: "Missing message" });
    }

    const subscription = await getSubscriptionForUser(userId);
    const systemPrompt = getPromptForSubscription(subscription);
    const fileDoc = await getLatestFileForUser(userId, fileId);
    const context = buildContextFromFile(fileDoc);
    const safeTone = tonePreference === "buddy" ? "buddy" : "formal";

    // IMPORTANT:
    // No more hardcoded "upload CSV/PDF" early-return.
    // The model or fallback should still answer even with empty context.

    if (!openai && !gemini) {
      const reply = buildRuleBasedReply(context, safeTone, message);
      return res.json({ reply });
    }

    const agentToUse = ACTIVE_AGENT;

    try {
      const reply = await callLLM(
        systemPrompt,
        context,
        safeTone,
        message,
        agentToUse,
      );

      return res.json({ reply });
    } catch (e) {
      if (isDev) {
        console.warn(
          `${agentToUse} failed in chat, using rule fallback:`,
          e?.status || e?.code,
          e?.message,
        );
      }

      const reply = buildRuleBasedReply(context, safeTone, message);

      if (isDev) {
        return res.json({
          reply:
            reply +
            `\n\n(Dev note: AI call to ${agentToUse} failed; served rule-based reply. Check API key, network, or model config.)`,
        });
      }

      return res.json({ reply });
    }
  } catch (err) {
    console.error("chat error:", err);
    return res.status(500).json({ error: "Chat failed" });
  }
}

export default { ingestPdf, aiAdvisor, chat };
