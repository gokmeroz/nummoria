/* eslint-disable */
import OpenAI from "openai";
import { GoogleGenAI } from "@google/genai"; // <-- ADDED

// Make key optional; fall back gracefully to regex-only
const openai2 = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

// Initialize Gemini client (for LLM fallback on transaction parsing)
const gemini2 = process.env.GEMINI_API_KEY // <-- ADDED
  ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  : null;

const DATE_RGX = /\b(\d{1,2}[\/\.\-]\d{1,2}[\/\.\-]\d{2,4})\b/; // 01/15/2025 or 15.01.2025
const AMOUNT_RGX =
  /([-+]?\d{1,3}(?:[\.,]\d{3})*(?:[\.,]\d{2})|[-+]?\d+(?:[\.,]\d{2})?)/;

export async function parseTransactionsFromText(
  text,
  { useLLMFallback = false } = {}
) {
  const lines = text
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  const txs = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const dateM = line.match(DATE_RGX);
    const amtM = line.match(AMOUNT_RGX);

    if (dateM && amtM) {
      const date = normalizeDate(dateM[1]);
      const amount = normalizeAmount(amtM[1]);
      const description = line
        .replace(dateM[0], "")
        .replace(amtM[0], "")
        .replace(/\s{2,}/g, " ")
        .trim();

      if (!Number.isNaN(amount)) {
        txs.push({
          date,
          description,
          category: guessCategory(description),
          amount,
          type: amount >= 0 ? "income" : "expense",
        });
        continue;
      }
    }

    // Heuristic: date on line i, amount on i+1, description on i+2
    if (DATE_RGX.test(line) && AMOUNT_RGX.test(lines[i + 1] || "")) {
      const date = normalizeDate(line.match(DATE_RGX)[1]);
      const amount = normalizeAmount((lines[i + 1].match(AMOUNT_RGX) || [])[1]);
      const desc = (lines[i + 2] || "").slice(0, 120);
      if (!Number.isNaN(amount)) {
        txs.push({
          date,
          description: desc,
          category: guessCategory(desc),
          amount,
          type: amount >= 0 ? "income" : "expense",
        });
      }
      i += 2;
    }
  }

  // Optional LLM fallback if few txs parsed (CHECK FOR EITHER KEY)
  if (txs.length < 5 && useLLMFallback && (openai2 || gemini2)) {
    const prompt = `Extract bank-like transactions as JSON array with keys:
- date (YYYY-MM-DD)
- description (string)
- amount (number, negative for expenses)

Text:
---
${text.slice(0, 12000)}
---`;

    try {
      let payloadText = null;

      if (gemini2) {
        // <-- NEW: Prioritize Gemini with JSON Schema
        const resp = await gemini2.models.generateContent({
          model: "gemini-2.5-flash",
          contents: prompt,
          config: {
            temperature: 0,
            responseMimeType: "application/json",
            responseSchema: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  date: { type: "string", description: "YYYY-MM-DD" },
                  description: { type: "string" },
                  amount: {
                    type: "number",
                    description: "Negative for expenses",
                  },
                },
                required: ["date", "description", "amount"],
              },
            },
          },
        });
        payloadText = resp.text.trim();
      } else if (openai2) {
        // <-- EXISTING: OpenAI Fallback
        // Prefer Responses API if available, but keep chat.completions as a backup for compatibility
        try {
          const resp = await openai2.responses.create({
            model: "gpt-4o-mini",
            temperature: 0,
            input: prompt,
          });
          payloadText =
            resp.output_text?.trim() || resp.content?.[0]?.text?.trim() || null;
        } catch {
          const resp2 = await openai2.chat.completions.create({
            model: "gpt-4o-mini",
            temperature: 0,
            messages: [{ role: "user", content: prompt }],
          });
          payloadText = resp2.choices?.[0]?.message?.content?.trim() || null;
        }
      }

      if (payloadText) {
        // Try to find JSON anywhere in the text
        const jsonMatch = payloadText.match(/\[[\s\S]*\]|\{[\s\S]*\}/);
        const jsonStr = jsonMatch ? jsonMatch[0] : payloadText;
        const arr = JSON.parse(jsonStr);

        if (Array.isArray(arr)) {
          return arr
            .map((t) => ({
              date: t.date,
              description: t.description,
              amount: Number(t.amount),
              category: guessCategory(t.description),
              type: Number(t.amount) >= 0 ? "income" : "expense",
            }))
            .filter((t) => t.date && !Number.isNaN(t.amount));
        }
      }
    } catch (e) {
      console.warn("LLM fallback parse failed:", e?.message || e);
    }
  }

  return txs;
}

function normalizeDate(s) {
  // ... (normalizeDate function remains the same) ...
  // supports DD.MM.YYYY, MM/DD/YYYY, etc. Returns YYYY-MM-DD
  const parts = s
    .replace(/-/g, "/")
    .replace(/\./g, "/")
    .split("/")
    .map((p) => p.padStart(2, "0"));
  let d, m, y;
  if (parts[2]?.length === 4) {
    const a = Number(parts[0]);
    const b = Number(parts[1]);
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
    y = String(2000 + Number(parts[2] || "0"));
    const a = Number(parts[0]);
    const b = Number(parts[1]);
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

function normalizeAmount(s) {
  // ... (normalizeAmount function remains the same) ...
  // handle 1.234,56 or 1,234.56 or -1234.56
  const neg = /-/.test(s);
  const cleaned = s.replace(/[^0-9.,-]/g, "");
  const hasDot = cleaned.includes(".");
  const hasComma = cleaned.includes(",");
  let numStr = cleaned;
  if (hasDot && hasComma) {
    if (cleaned.lastIndexOf(",") > cleaned.lastIndexOf(".")) {
      numStr = cleaned.replace(/\./g, "").replace(",", ".");
    } else {
      numStr = cleaned.replace(/,/g, "");
    }
  } else if (hasComma && !hasDot) {
    numStr = cleaned.replace(",", ".");
  } else {
    numStr = cleaned;
  }
  const val = parseFloat(numStr);
  return neg ? -Math.abs(val) : val;
}

function guessCategory(desc = "") {
  // ... (guessCategory function remains the same) ...
  const d = desc.toLowerCase();
  if (/(salary|payroll|maas|maaş|ucret|ücret)/.test(d)) return "Salary";
  if (/(rent|kira)/.test(d)) return "Rent";
  if (/(market|grocery|migros|carrefour|bim|a101)/.test(d)) return "Groceries";
  if (
    /(restaurant|cafe|bar|yemek|yemeksepeti|trendyol yemek|getir yemek)/.test(d)
  )
    return "Dining";
  if (/(uber|taxi|metro|otobus|otobüs|taksi)/.test(d)) return "Transport";
  if (/(btc|bitcoin|eth|avax|binance|bist|borsa|etf|hisse|fon)/.test(d))
    return "Investments";
  if (/(electric|water|gas|internet|bill|fatura)/.test(d)) return "Utilities";
  return "Other";
}
