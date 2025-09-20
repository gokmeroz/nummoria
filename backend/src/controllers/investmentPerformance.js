import yahooFinance from "yahoo-finance2";
import { Transaction } from "../models/transaction.js"; // change to "../models/transactions.js" if your file is plural

function decimalsForCurrency(code) {
  const zero = new Set(["JPY", "KRW", "CLP", "VND"]);
  const three = new Set(["BHD", "IQD", "JOD", "KWD", "OMR", "TND"]);
  if (zero.has(code)) return 0;
  if (three.has(code)) return 3;
  return 2;
}

/**
 * GET /investments/performance
 * Aggregates investment transactions by (assetSymbol, currency),
 * fetches current price, and returns value & P/L in minor units.
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

    // aggregate by symbol|currency
    const map = new Map();
    for (const t of txns) {
      const symbol = String(t.assetSymbol || "")
        .toUpperCase()
        .trim();
      const currency = t.currency || "USD";
      if (!symbol || !t.units) continue;

      const key = `${symbol}|${currency}`;
      const agg = map.get(key) || { symbol, currency, units: 0, costMinor: 0 };
      agg.units += Number(t.units || 0);
      agg.costMinor += Number(t.amountMinor || 0);
      map.set(key, agg);
    }

    const groups = Array.from(map.values()).filter((g) => g.units !== 0);
    if (!groups.length) {
      return res.json({ holdings: [], totals: {} });
    }

    // fetch quotes
    const symbols = [...new Set(groups.map((g) => g.symbol))];
    const quotes = {};
    await Promise.all(
      symbols.map(async (sym) => {
        try {
          const q = await yahooFinance.quote(sym);
          quotes[sym] = q || null;
        } catch {
          quotes[sym] = null; // keep going even if one fails
        }
      })
    );

    const holdings = [];
    const totalsByCur = {};

    for (const g of groups) {
      const q = quotes[g.symbol];
      const cur = g.currency;
      const dec = decimalsForCurrency(cur);

      const price = q?.regularMarketPrice ?? null;
      const priceCurrency = q?.currency ?? null;

      let valueMinor = null;
      let plMinor = null;

      // Only compute P/L if quote currency matches txn currency
      if (
        typeof price === "number" &&
        (!priceCurrency || priceCurrency === cur)
      ) {
        const raw = price * g.units * Math.pow(10, dec);
        valueMinor = Math.round(raw);
        plMinor = valueMinor - g.costMinor;

        totalsByCur[cur] = totalsByCur[cur] || {
          costMinor: 0,
          valueMinor: 0,
          plMinor: 0,
        };
        totalsByCur[cur].costMinor += g.costMinor;
        totalsByCur[cur].valueMinor += valueMinor;
        totalsByCur[cur].plMinor += plMinor;
      }

      holdings.push({
        symbol: g.symbol,
        currency: cur,
        units: g.units,
        costMinor: g.costMinor,
        avgCostPerUnit: g.units
          ? g.costMinor / g.units / Math.pow(10, dec)
          : null,
        price,
        priceCurrency,
        valueMinor,
        plMinor,
      });
    }

    return res.json({ holdings, totals: totalsByCur });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

// alias export to be tolerant with different import names
export const getInvestmentsPerformance = getInvestmentPerformance;
