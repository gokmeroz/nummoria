// NO hard import of yahoo-finance2 here.
// import yahooFinance from "yahoo-finance2";
import { Transaction } from "../models/transaction.js"; // or "../models/transactions.js" if that's your file

function decimalsForCurrency(code) {
  const zero = new Set(["JPY", "KRW", "CLP", "VND"]);
  const three = new Set(["BHD", "IQD", "JOD", "KWD", "OMR", "TND"]);
  if (zero.has(code)) return 0;
  if (three.has(code)) return 3;
  return 2;
}

// Optional flag to (re)enable quotes later without changing code
const ENABLE_QUOTES = process.env.ENABLE_QUOTES === "true";

// Lazy/dynamic import so the server still runs if the package isn't installed
async function fetchQuote(symbol) {
  if (!ENABLE_QUOTES) return null;
  try {
    const mod = await import("yahoo-finance2");
    const yf = mod.default || mod;
    return await yf.quote(symbol);
  } catch {
    return null;
  }
}

/**
 * GET /investments/performance
 * Aggregates investment transactions by (assetSymbol, currency).
 * If quotes are disabled/unavailable, price/value/PL are returned as null.
 */
export async function getInvestmentPerformance(req, res) {
  try {
    const txns = await Transaction.find({
      userId: req.userId,
      isDeleted: { $ne: true },
      type: "investment",
      assetSymbol: { $exists: true, $ne: null },
      units: { $exists: true, $ne: null },
    }).lean();

    if (!txns.length) {
      return res.json({ holdings: [], totals: {} });
    }

    // Aggregate by symbol|currency
    const map = new Map();
    for (const t of txns) {
      const symbol = String(t.assetSymbol || "")
        .toUpperCase()
        .trim();
      const currency = t.currency || "USD";
      const units = Number(t.units || 0);
      const amountMinor = Number(t.amountMinor || 0);
      if (!symbol || !units) continue;

      const key = `${symbol}|${currency}`;
      const agg = map.get(key) || {
        symbol,
        currency,
        units: 0,
        costMinor: 0,
      };
      agg.units += units;
      agg.costMinor += amountMinor;
      map.set(key, agg);
    }

    const groups = Array.from(map.values()).filter((g) => g.units !== 0);
    if (!groups.length) {
      return res.json({ holdings: [], totals: {} });
    }

    // Try to fetch quotes only if enabled; otherwise all nulls
    const symbols = [...new Set(groups.map((g) => g.symbol))];
    const quotes = {};
    await Promise.all(
      symbols.map(async (sym) => {
        quotes[sym] = await fetchQuote(sym); // may be null
      })
    );

    const holdings = [];
    const totalsByCur = {};

    for (const g of groups) {
      const q = quotes[g.symbol];
      const cur = g.currency;
      const dec = decimalsForCurrency(cur);

      // Keep both names to be frontend-compatible: quote/price & currentValueMinor/valueMinor
      const quote =
        typeof q?.regularMarketPrice === "number" ? q.regularMarketPrice : null;
      const price = quote; // alias
      const priceCurrency = q?.currency ?? null;

      let valueMinor = null;
      let plMinor = null;

      // Only compute value/PL if we have a quote AND its currency matches
      if (
        typeof quote === "number" &&
        (!priceCurrency || priceCurrency === cur)
      ) {
        valueMinor = Math.round(quote * g.units * Math.pow(10, dec));
        plMinor = valueMinor - g.costMinor;

        if (!totalsByCur[cur]) {
          totalsByCur[cur] = { costMinor: 0, valueMinor: 0, plMinor: 0 };
        }
        totalsByCur[cur].costMinor += g.costMinor;
        totalsByCur[cur].valueMinor += valueMinor;
        totalsByCur[cur].plMinor += plMinor;
      } else {
        // Totals at least include cost; value/PL stay null when we have no quote
        if (!totalsByCur[cur]) {
          totalsByCur[cur] = { costMinor: 0, valueMinor: null, plMinor: null };
        }
        totalsByCur[cur].costMinor += g.costMinor;
      }

      const avgCostPerUnit = g.units
        ? g.costMinor / g.units / Math.pow(10, dec)
        : null;

      // Provide both property names to avoid breaking older frontend code
      holdings.push({
        symbol: g.symbol,
        currency: cur,
        units: g.units,
        costMinor: g.costMinor,
        avgCostPerUnit,

        // aliases for compatibility
        quote,
        price,
        priceCurrency,

        // both names for value
        valueMinor,
        currentValueMinor: valueMinor,

        plMinor,
      });
    }

    return res.json({ holdings, totals: totalsByCur });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

// (Alias export keeps other imports working)
export const getInvestmentsPerformance = getInvestmentPerformance;
