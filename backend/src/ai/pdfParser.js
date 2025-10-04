/* eslint-disable */
import OpenAI from "openai";
const openai2 = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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
    } // Heuristic: sometimes next line holds amount
    if (DATE_RGX.test(line) && AMOUNT_RGX.test(lines[i + 1] || "")) {
      const date = normalizeDate(line.match(DATE_RGX)[1]);
      const amount = normalizeAmount((lines[i + 1].match(AMOUNT_RGX) || [])[1]);
      const desc = (lines[i + 2] || "").slice(0, 120);
      if (!Number.isNaN(amount))
        txs.push({
          date,
          description: desc,
          category: guessCategory(desc),
          amount,
          type: amount >= 0 ? "income" : "expense",
        });
      i += 2; // skip consumed lines
    }
  }

  if (txs.length < 5 && useLLMFallback) {
    const prompt = `Extract bank-like transactions as JSON array with keys: date (YYYY-MM-DD), description, amount (number, negative for expenses). Text:\n---\n${text.slice(
      0,
      12000
    )}\n---`;
    try {
      const resp = await openai2.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0,
        messages: [{ role: "user", content: prompt }],
      });
      const payload = resp.choices?.[0]?.message?.content?.trim();
      const arr = JSON.parse(payload);
      return arr.map((t) => ({
        date: t.date,
        description: t.description,
        amount: Number(t.amount),
        category: guessCategory(t.description),
        type: Number(t.amount) >= 0 ? "income" : "expense",
      }));
    } catch (e) {
      console.warn("LLM fallback parse failed:", e.message);
    }
  }

  return txs;
}
function normalizeDate(s) {
  // supports DD.MM.YYYY, MM/DD/YYYY, etc. Returns YYYY-MM-DD
  const parts = s
    .replace(/-/g, "/")
    .replace(/\./g, "/")
    .split("/")
    .map((p) => p.padStart(2, "0"));
  let d, m, y;
  if (parts[2]?.length === 4) {
    // either DD/MM/YYYY or MM/DD/YYYY — we’ll infer by >12 heuristic
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
    // YY fallback
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
  // handle 1.234,56 or 1,234.56 or -1234.56
  const neg = /-/.test(s);
  const cleaned = s.replace(/[^0-9.,-]/g, "");
  // if comma appears after dot, assume dot as thousands => remove dots, replace comma with dot
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
