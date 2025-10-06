/* eslint-disable */

// ---------- IMPORTS ----------
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const pdf = require("pdf-parse"); // CJS import that works in ESM

import OpenAI from "openai";
import mongoose from "mongoose";
import { parse as parseCSV } from "csv-parse/sync";

import AiAdvisorFile from "../models/AiAdvisorFile.js";
import { computeMetrics } from "../ai/financialMetrics.js";

// If you don't have a prompts file, we keep a minimal system prompt inline
const systemPrompt = `You are Nummora Financial Helper.
- Educational only; not licensed financial advice.
- Keep the user's tonePreference (formal|buddy).
- Use provided parsedTransactions and computedMetrics as ground truth.
- Output: 1–2 sentence summary, 3–5 bullets, then a metric snapshot.`;

// ---------- OPENAI (optional) ----------
const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

const isDev = process.env.NODE_ENV !== "production";

// ---------- HELPERS ----------
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

function csvToTxRows(buf) {
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

function buildRuleBasedReply(ctx, tone, userMsg) {
  const m = ctx.computedMetrics || {};
  const sr = m.savingsRate ?? null; // %
  const burn = m.monthlyBurn ?? null; // +
  const stab = m.incomeStability ?? null; // %
  const alloc = m.investmentAllocation ?? null; // %
  const risk = m.riskScore ?? null;

  const topCats =
    Object.entries(m.categoryBreakdown || {})
      .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
      .slice(0, 3)
      .map(([k, v]) => `${k} (${Number(v).toFixed(2)})`)
      .join(", ") || "n/a";

  const head = tone === "buddy" ? "Alright bro, here’s the read:" : "Summary:";
  const bullet = tone === "buddy" ? "-" : "•";
  const recs = [];

  if (sr !== null) {
    if (sr < 15)
      recs.push(
        `Push savings rate toward 20%+. Start with +5% auto-transfer on payday.`
      );
    else
      recs.push(
        `Good savings rate (${sr}%). Keep it ≥20% and bump +1% quarterly.`
      );
  }
  if (burn !== null && burn > 0)
    recs.push(
      `Monthly burn ~${burn.toFixed(
        2
      )}. Cap Dining/Groceries/Transport with weekly limits + alerts.`
    );
  if (stab !== null && stab < 70)
    recs.push(
      `Income stability ${stab}%. Build 3–6 month emergency fund before adding risk.`
    );
  if (alloc !== null) {
    if (alloc < 10)
      recs.push(
        `Low investment allocation (${alloc}%). After EF, DCA into diversified ETFs.`
      );
    if (alloc > 60)
      recs.push(
        `High allocation (${alloc}%). Ensure 3–6 months liquidity and rebalance.`
      );
  }
  if (risk !== null) {
    recs.push(
      risk < 55
        ? `Risk score ${risk}/100 (aggressive). Trim high-vol bets; rebalance.`
        : `Risk score ${risk}/100 (ok). Rebalance quarterly.`
    );
  }
  if (!recs.length)
    recs.push(
      `Upload a transactions PDF/CSV or ask a specific question for tailored steps.`
    );

  const snap = [
    sr !== null ? `Savings rate: ${sr}%` : null,
    burn !== null ? `Monthly burn: ${burn.toFixed(2)}` : null,
    stab !== null ? `Income stability: ${stab}%` : null,
    alloc !== null ? `Investment allocation: ${alloc}%` : null,
    risk !== null ? `Risk score: ${risk}/100` : null,
    `Top categories: ${topCats}`,
  ]
    .filter(Boolean)
    .join(" • ");

  const disclaimer =
    tone === "buddy"
      ? `Heads up: this is educational, not licensed financial advice.`
      : `Note: Educational guidance, not licensed financial advice.`;

  return `${head}\n${recs
    .map((r) => `${bullet} ${r}`)
    .join("\n")}\n\n${snap}\n\n${disclaimer}`;
}

// ---------- CONTROLLERS ----------
export async function ingestPdf(req, res) {
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

      parsedTransactions = await parseTransactionsFromText(contentText, {
        useLLMFallback: Boolean(process.env.OPENAI_API_KEY),
      });
      console.log("txCount:", parsedTransactions.length);
      if (parsedTransactions.length)
        console.log("firstTx:", parsedTransactions[0]);

      // in ingestPdf, right after building parsedTransactions
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
      return res.json({
        reply:
          "I don’t see any uploaded transactions yet. Upload a PDF/CSV first and I’ll analyze it.",
      });
    }

    const context = {
      parsedTransactions: fileDoc.parsedTransactions || [],
      computedMetrics: fileDoc.computedMetrics || {},
    };

    // No key? Offline fallback.
    if (!openai) {
      const reply = buildRuleBasedReply(
        context,
        tonePreference || "formal",
        message
      );
      return res.json({ reply });
    }

    // Try OpenAI, on error/quota → fallback
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0.3,
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: JSON.stringify(
              { tonePreference, context, message },
              null,
              2
            ),
          },
        ],
      });
      const reply =
        completion.choices?.[0]?.message?.content ??
        "Sorry, I could not generate a response.";
      return res.json({ reply });
    } catch (e) {
      if (isDev)
        console.warn(
          "OpenAI failed, using fallback:",
          e?.status || e?.code,
          e?.message
        );
      const reply =
        buildRuleBasedReply(context, tonePreference || "formal", message) +
        "\n\n(Using offline fallback due to AI quota or connection issue.)";
      return res.json({ reply });
    }
  } catch (err) {
    console.error("chat error:", err);
    return res.status(500).json({ error: "Chat failed" });
  }
}

// ---------- EXPORTS ----------
export default { ingestPdf, chat };
