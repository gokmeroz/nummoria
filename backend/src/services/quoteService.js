// backend/src/services/quoteService.js

const QUOTE_TTL_MS = 60 * 1000; // 60s success cache
const ERROR_TTL_MS = 20 * 1000; // 20s error cache

const quoteCache = new Map();
const inflight = new Map();

export const quotesEnabled = () =>
  String(process.env.ENABLE_QUOTES || "").toLowerCase() === "true";

function getCached(symbol) {
  const entry = quoteCache.get(symbol);
  if (!entry) return null;

  if (Date.now() > entry.expiresAt) {
    quoteCache.delete(symbol);
    return null;
  }

  return entry;
}

function setCached(symbol, payload, ttlMs, isError = false) {
  quoteCache.set(symbol, {
    payload,
    expiresAt: Date.now() + ttlMs,
    isError,
  });
}

/**
 * Bypasses Yahoo's IP rate limits using a free proxy fallback.
 */
async function fetchYahooChart(symbol) {
  // We append a timestamp (_ts) to bypass aggressive proxy caching
  const targetUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d&_ts=${Date.now()}`;
  const userAgent =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

  let response;
  try {
    // 1. Try Direct Connection First
    response = await fetch(targetUrl, {
      headers: { "User-Agent": userAgent, Accept: "application/json" },
    });

    // If Yahoo blocks the IP, force it to the catch block
    if (
      response.status === 429 ||
      response.status === 403 ||
      response.status === 401
    ) {
      throw new Error("IP_BANNED");
    }
  } catch (err) {
    // 2. Fallback to Free Public Proxy if banned (The Ghost Route)
    console.log(
      `[MARKET/PROXY] Direct fetch blocked for ${symbol}. Routing through proxy...`,
    );
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`;
    response = await fetch(proxyUrl, {
      headers: { "User-Agent": userAgent },
    });
  }

  if (!response.ok) {
    if (response.status === 404 || response.status === 422) {
      throw new Error("Symbol not found");
    }
    throw new Error(`Yahoo API error: ${response.status}`);
  }

  // Yahoo sometimes returns HTML error pages instead of JSON on severe bans
  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch (parseErr) {
    throw new Error("Yahoo returned invalid data (likely a captcha page).");
  }

  const result = data?.chart?.result?.[0];
  if (!result) {
    throw new Error("Symbol not found or no data returned");
  }

  const meta = result.meta;
  const quote = result.indicators?.quote?.[0] || {};
  const getLast = (arr) => (arr && arr.length > 0 ? arr[arr.length - 1] : null);

  return {
    symbol: meta.symbol || symbol,
    shortName: meta.symbol || symbol,
    regularMarketPrice: meta.regularMarketPrice,
    regularMarketPreviousClose: meta.chartPreviousClose || meta.previousClose,
    regularMarketOpen: getLast(quote.open),
    regularMarketDayHigh: getLast(quote.high),
    regularMarketDayLow: getLast(quote.low),
    regularMarketVolume: getLast(quote.volume),
    currency: meta.currency || "USD",
    exchange: meta.exchangeName,
    fullExchangeName: meta.exchangeName,
    fiftyTwoWeekHigh: null,
    fiftyTwoWeekLow: null,
    marketCap: null,
  };
}

export async function getLiveQuote(symbolInput) {
  const symbol = String(symbolInput || "")
    .trim()
    .toUpperCase();

  if (!symbol) {
    const err = new Error("symbol is required");
    err.statusCode = 400;
    throw err;
  }

  if (!quotesEnabled()) {
    const err = new Error("Quotes are disabled (ENABLE_QUOTES=false)");
    err.statusCode = 400;
    throw err;
  }

  const cached = getCached(symbol);
  if (cached) {
    if (cached.isError) {
      const err = new Error(cached.payload.error);
      err.statusCode = cached.payload.status;
      throw err;
    }
    return cached.payload;
  }

  if (inflight.has(symbol)) {
    return inflight.get(symbol);
  }

  const promise = (async () => {
    try {
      const mappedQuote = await fetchYahooChart(symbol);
      setCached(symbol, mappedQuote, QUOTE_TTL_MS, false);
      return mappedQuote;
    } catch (e) {
      const isNotFound = e.message.toLowerCase().includes("not found");

      let status = 502;
      let errorMsg = "Quote service is temporarily unavailable.";

      if (isNotFound) {
        status = 404;
        errorMsg = "Symbol not found.";
      } else if (
        e.message.includes("429") ||
        e.message.includes("IP_BANNED") ||
        e.message.includes("invalid data")
      ) {
        status = 429;
        errorMsg =
          "Quote provider is rate-limited right now. Please try again shortly.";
      }

      const normalized = { status, error: errorMsg };
      setCached(symbol, normalized, ERROR_TTL_MS, true);

      const err = new Error(normalized.error);
      err.statusCode = normalized.status;
      throw err;
    } finally {
      inflight.delete(symbol);
    }
  })();

  inflight.set(symbol, promise);
  return promise;
}

export async function getLiveQuoteSoft(symbolInput) {
  try {
    return await getLiveQuote(symbolInput);
  } catch (e) {
    console.error("[QUOTE/SOFT] failed:", {
      symbol: symbolInput,
      status: e?.statusCode || 500,
      message: e?.message,
    });
    return null;
  }
}

export async function getLiveQuotesBulk(symbolsArray) {
  if (!quotesEnabled() || !symbolsArray.length) return {};

  const results = {};
  const missingSymbols = [];

  for (const sym of symbolsArray) {
    const cached = getCached(sym);
    if (cached && !cached.isError) {
      results[sym] = cached.payload;
    } else {
      missingSymbols.push(sym);
    }
  }

  if (missingSymbols.length > 0) {
    const fetchPromises = missingSymbols.map(async (sym) => {
      try {
        const q = await fetchYahooChart(sym);
        results[sym] = q;
        setCached(sym, q, QUOTE_TTL_MS, false);
      } catch (e) {
        console.error(`[QUOTE/BULK] failed for ${sym}:`, e.message);
      }
    });

    await Promise.all(fetchPromises);
  }

  return results;
}
