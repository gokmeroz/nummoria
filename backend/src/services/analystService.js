// backend/src/services/analystService.js
//
// Aggregated third-party analyst consensus (rating counts + 12-month price targets),
// modelled on Midas' "Analist Tahminleri": we show what analysts say, we never
// generate our own buy/sell call.
//
// Cache policy (Mongo, shared across users and instances):
//   - fresh (< 24h)        → serve from Mongo, no provider call
//   - covered / no_coverage → cached for 24h (plan-blocked symbols stay blocked,
//                             so re-asking would only burn quota)
//   - transient failure    → never cached; serve the stale row if we have one

import AnalystConsensus from "../models/AnalystConsensus.js";

export const FRESH_MS = 24 * 60 * 60 * 1000;
export const MAX_SYMBOLS = 25;
const FETCH_TIMEOUT_MS = 8000;
const FMP_BASE = "https://financialmodelingprep.com/stable";

// Yahoo-style tickers: AAPL, BRK-B, THYAO.IS
const SYMBOL_RE = /^[A-Z0-9][A-Z0-9.\-]{0,14}$/;

export const DISCLAIMER =
  "Analyst ratings and 12-month price targets are third-party estimates aggregated " +
  "by Financial Modeling Prep. They are not investment advice and are not guaranteed.";

export function normalizeSymbols(raw) {
  const symbols = [
    ...new Set(
      String(raw || "")
        .split(",")
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean),
    ),
  ];

  if (!symbols.length) return { error: "symbols is required" };
  if (symbols.length > MAX_SYMBOLS) {
    return { error: `At most ${MAX_SYMBOLS} symbols per request` };
  }
  const bad = symbols.find((s) => !SYMBOL_RE.test(s));
  if (bad) return { error: `Invalid symbol: ${bad}` };

  return { symbols };
}

const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);

/**
 * Merge FMP grades-consensus + price-target-consensus rows into one cache doc.
 * Either side may be null (empty / plan-blocked).
 */
export function toConsensusDoc(symbol, grades, targets, now) {
  const ratings = {
    strongBuy: num(grades?.strongBuy) ?? 0,
    buy: num(grades?.buy) ?? 0,
    hold: num(grades?.hold) ?? 0,
    sell: num(grades?.sell) ?? 0,
    strongSell: num(grades?.strongSell) ?? 0,
  };
  const target = {
    high: num(targets?.targetHigh),
    low: num(targets?.targetLow),
    mean: num(targets?.targetConsensus),
    median: num(targets?.targetMedian),
  };

  const totalRatings = Object.values(ratings).reduce((a, b) => a + b, 0);
  const hasTarget = target.mean !== null;

  return {
    symbol,
    provider: "fmp",
    status: totalRatings > 0 || hasTarget ? "covered" : "no_coverage",
    ratings,
    providerConsensus: grades?.consensus || null,
    target,
    fetchedAt: new Date(now),
  };
}

/**
 * Shape a cache doc for the API. Collapses five buckets into AL / TUT / SAT
 * (buy / hold / sell) and computes upside vs the live quote.
 */
export function toView(doc, quote, { stale = false } = {}) {
  if (!doc || doc.status === "unavailable") {
    return { symbol: doc?.symbol, status: "unavailable" };
  }
  if (doc.status === "no_coverage") {
    return { symbol: doc.symbol, status: "no_coverage", fetchedAt: doc.fetchedAt, stale };
  }

  const r = doc.ratings || {};
  const counts = {
    buy: (r.strongBuy || 0) + (r.buy || 0),
    hold: r.hold || 0,
    sell: (r.sell || 0) + (r.strongSell || 0),
  };
  counts.total = counts.buy + counts.hold + counts.sell;

  // FMP's price-target endpoint does not report a currency; its coverage on our
  // plan is US listings, so targets are assumed USD and upside is only computed
  // against a USD quote of the same listing.
  const price = num(quote?.regularMarketPrice);
  const mean = num(doc.target?.mean);
  const upsidePct =
    price && mean && quote?.currency === "USD"
      ? Math.round((mean / price - 1) * 1000) / 10
      : null;

  return {
    symbol: doc.symbol,
    status: "covered",
    counts,
    ratings: r,
    providerConsensus: doc.providerConsensus,
    target: doc.target,
    targetCurrency: "USD",
    price,
    upsidePct,
    fetchedAt: doc.fetchedAt,
    stale,
  };
}

/**
 * One FMP call → { kind: "ok", row } | { kind: "empty" } | { kind: "error", message }
 * 402 = symbol not on our plan (or unknown); treated as "empty", i.e. no coverage.
 */
async function fetchFmpRow(fetchImpl, apiKey, endpoint, symbol) {
  const url = `${FMP_BASE}/${endpoint}?symbol=${encodeURIComponent(symbol)}&apikey=${apiKey}`;
  let res;
  try {
    res = await fetchImpl(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  } catch (e) {
    return { kind: "error", message: e?.name === "TimeoutError" ? "timeout" : e?.message };
  }

  if (res.status === 402) return { kind: "empty" };
  if (!res.ok) return { kind: "error", message: `FMP ${endpoint} HTTP ${res.status}` };

  let data;
  try {
    data = await res.json();
  } catch {
    return { kind: "error", message: `FMP ${endpoint} returned non-JSON` };
  }

  if (!Array.isArray(data)) {
    return { kind: "error", message: data?.["Error Message"] || `FMP ${endpoint} unexpected payload` };
  }
  return data.length ? { kind: "ok", row: data[0] } : { kind: "empty" };
}

const mongoStore = {
  async findMany(symbols) {
    return AnalystConsensus.find({ symbol: { $in: symbols } }).lean();
  },
  async upsert(doc) {
    await AnalystConsensus.updateOne({ symbol: doc.symbol }, { $set: doc }, { upsert: true });
  },
};

export function createAnalystService({
  store = mongoStore,
  fetchImpl = fetch,
  getApiKey = () => process.env.FMP_API_KEY,
  now = () => Date.now(),
} = {}) {
  const inflight = new Map();

  async function refresh(symbol) {
    const apiKey = getApiKey();
    if (!apiKey) return { kind: "error", message: "FMP_API_KEY not configured" };

    const [grades, targets] = await Promise.all([
      fetchFmpRow(fetchImpl, apiKey, "grades-consensus", symbol),
      fetchFmpRow(fetchImpl, apiKey, "price-target-consensus", symbol),
    ]);

    // Never cache a half-answer: if either call failed transiently, the "no
    // coverage" we'd derive could be wrong for the next 24h.
    const failed = [grades, targets].find((r) => r.kind === "error");
    if (failed) return failed;

    const doc = toConsensusDoc(symbol, grades.row, targets.row, now());
    await store.upsert(doc);
    return { kind: "ok", doc };
  }

  function refreshOnce(symbol) {
    if (!inflight.has(symbol)) {
      inflight.set(
        symbol,
        refresh(symbol).finally(() => inflight.delete(symbol)),
      );
    }
    return inflight.get(symbol);
  }

  /** @returns {Promise<Map<string, { doc, stale }>>} */
  async function getMany(symbols) {
    const cached = new Map(
      (await store.findMany(symbols)).map((d) => [d.symbol, d]),
    );
    const out = new Map();

    await Promise.all(
      symbols.map(async (symbol) => {
        const doc = cached.get(symbol);
        if (doc && now() - new Date(doc.fetchedAt).getTime() < FRESH_MS) {
          out.set(symbol, { doc, stale: false });
          return;
        }

        let result;
        try {
          result = await refreshOnce(symbol);
        } catch (e) {
          result = { kind: "error", message: e?.message };
        }

        if (result.kind === "ok") {
          out.set(symbol, { doc: result.doc, stale: false });
          return;
        }

        console.error("[ANALYST] refresh failed:", { symbol, message: result.message });
        out.set(
          symbol,
          doc ? { doc, stale: true } : { doc: { symbol, status: "unavailable" }, stale: false },
        );
      }),
    );

    return out;
  }

  return { getMany };
}

export const analystService = createAnalystService();
