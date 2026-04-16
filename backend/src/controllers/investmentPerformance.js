import { Transaction } from "../models/transaction.js";
import { getLiveQuotesBulk, quotesEnabled } from "../services/quoteService.js";

console.log("[INVESTMENT/QUOTES] ENABLE_QUOTES =", process.env.ENABLE_QUOTES);

/* ─────────────────────────────────────────────────────────────
   PERFORMANCE CACHE (Step C)
───────────────────────────────────────────────────────────── */

const PERF_TTL_MS = 60 * 1000; // 60 seconds
const performanceCache = new Map();

function getPerfCache(userId) {
  const entry = performanceCache.get(String(userId));
  if (!entry) return null;

  if (Date.now() > entry.expiresAt) {
    performanceCache.delete(String(userId));
    return null;
  }

  return entry.payload;
}

function setPerfCache(userId, payload) {
  performanceCache.set(String(userId), {
    payload,
    expiresAt: Date.now() + PERF_TTL_MS,
  });
}

/* ─────────────────────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────────────────────── */

function decimalsForCurrency(code) {
  const zero = new Set(["JPY", "KRW", "CLP", "VND"]);
  const three = new Set(["BHD", "IQD", "JOD", "KWD", "OMR", "TND"]);
  if (zero.has(code)) return 0;
  if (three.has(code)) return 3;
  return 2;
}

/**
 * GET /investments/performance
 */
export async function getInvestmentPerformance(req, res) {
  try {
    /* ───────── CACHE HIT ───────── */
    const cached = getPerfCache(req.userId);
    if (cached) {
      return res.json(cached);
    }

    const txns = await Transaction.find({
      userId: req.userId,
      isDeleted: { $ne: true },
      type: "investment",
      assetSymbol: { $exists: true, $ne: null },
      units: { $exists: true, $ne: null },
    }).lean();

    if (!txns.length) {
      const empty = { holdings: [], totals: {} };
      setPerfCache(req.userId, empty);
      return res.json(empty);
    }

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
      const empty = { holdings: [], totals: {} };
      setPerfCache(req.userId, empty);
      return res.json(empty);
    }

    const symbols = [...new Set(groups.map((g) => g.symbol))];
    let quotes = {};

    /* ───────── SAFE QUOTE FETCH (BATCHED) ───────── */
    if (quotesEnabled()) {
      // One request for all symbols instead of an N+1 loop!
      quotes = await getLiveQuotesBulk(symbols);
    }

    const holdings = [];
    const totalsByCur = {};

    for (const g of groups) {
      const q = quotes[g.symbol] || null;
      const cur = g.currency;
      const dec = decimalsForCurrency(cur);

      const quote =
        typeof q?.regularMarketPrice === "number" ? q.regularMarketPrice : null;

      const price = quote;
      const priceCurrency = q?.currency ?? q?.financialCurrency ?? null;

      let valueMinor = null;
      let plMinor = null;

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
        if (!totalsByCur[cur]) {
          totalsByCur[cur] = { costMinor: 0, valueMinor: null, plMinor: null };
        }

        totalsByCur[cur].costMinor += g.costMinor;
      }

      const avgCostPerUnit = g.units
        ? g.costMinor / g.units / Math.pow(10, dec)
        : null;

      holdings.push({
        symbol: g.symbol,
        currency: cur,
        units: g.units,
        costMinor: g.costMinor,
        avgCostPerUnit,

        quote,
        price,
        priceCurrency,

        valueMinor,
        currentValueMinor: valueMinor,

        plMinor,
      });
    }

    const payload = { holdings, totals: totalsByCur };

    /* ───────── CACHE SET ───────── */
    setPerfCache(req.userId, payload);

    return res.json(payload);
  } catch (err) {
    console.error("[INVESTMENT/PERFORMANCE] failed:", err);
    return res.status(500).json({
      error: "Failed to load investment performance.",
    });
  }
}

console.log("[INVESTMENT/QUOTES] enabled?", quotesEnabled());

export const getInvestmentsPerformance = getInvestmentPerformance;
