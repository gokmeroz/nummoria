import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createAnalystService,
  normalizeSymbols,
  toView,
  FRESH_MS,
  MAX_SYMBOLS,
} from "./analystService.js";

const GRADES = { symbol: "AAPL", strongBuy: 1, buy: 70, hold: 32, sell: 9, strongSell: 0, consensus: "Buy" };
const TARGETS = { symbol: "AAPL", targetHigh: 400, targetLow: 245, targetConsensus: 341.68, targetMedian: 357.5 };

function memoryStore(initial = []) {
  const rows = new Map(initial.map((d) => [d.symbol, d]));
  return {
    rows,
    async findMany(symbols) {
      return symbols.map((s) => rows.get(s)).filter(Boolean);
    },
    async upsert(doc) {
      rows.set(doc.symbol, doc);
    },
  };
}

const json = (status, body) => ({ status, ok: status >= 200 && status < 300, json: async () => body });

// Routes by endpoint; `handler(endpoint, symbol)` returns a fake Response or throws.
function fakeFetch(handler) {
  const calls = [];
  const impl = async (url) => {
    const u = new URL(url);
    const endpoint = u.pathname.split("/").pop();
    const symbol = u.searchParams.get("symbol");
    calls.push(`${endpoint}:${symbol}`);
    return handler(endpoint, symbol);
  };
  impl.calls = calls;
  return impl;
}

const covered = (endpoint) =>
  endpoint === "grades-consensus" ? json(200, [GRADES]) : json(200, [TARGETS]);

function service(opts) {
  return createAnalystService({ getApiKey: () => "test-key", now: () => 1_000_000_000_000, ...opts });
}

test("normalizeSymbols dedupes, uppercases and caps", () => {
  assert.deepEqual(normalizeSymbols(" aapl,AAPL, thyao.is ").symbols, ["AAPL", "THYAO.IS"]);
  assert.match(normalizeSymbols("").error, /required/);
  assert.match(normalizeSymbols("AAPL,$(rm)").error, /Invalid symbol/);
  const many = Array.from({ length: MAX_SYMBOLS + 1 }, (_, i) => `S${i}`).join(",");
  assert.match(normalizeSymbols(many).error, /At most/);
});

test("covered symbol is fetched once, cached, and collapsed into buy/hold/sell", async () => {
  const store = memoryStore();
  const fetchImpl = fakeFetch(covered);
  const svc = service({ store, fetchImpl });

  const { doc, stale } = (await svc.getMany(["AAPL"])).get("AAPL");
  assert.equal(stale, false);
  assert.equal(doc.status, "covered");

  const view = toView(doc, { regularMarketPrice: 300, currency: "USD" });
  assert.deepEqual(view.counts, { buy: 71, hold: 32, sell: 9, total: 112 });
  assert.equal(view.providerConsensus, "Buy");
  assert.equal(view.target.mean, 341.68);
  assert.equal(view.upsidePct, 13.9);

  // Second request is served from the store.
  await svc.getMany(["AAPL"]);
  assert.equal(fetchImpl.calls.length, 2);
});

test("plan-blocked (402) symbol is cached as no_coverage", async () => {
  const store = memoryStore();
  const fetchImpl = fakeFetch(() => json(402, "Premium Query Parameter"));
  const svc = service({ store, fetchImpl });

  const { doc } = (await svc.getMany(["DKNG"])).get("DKNG");
  assert.equal(doc.status, "no_coverage");
  assert.equal(store.rows.get("DKNG").status, "no_coverage");

  await svc.getMany(["DKNG"]);
  assert.equal(fetchImpl.calls.length, 2, "no_coverage must not re-hit the provider within 24h");
});

test("transient failure is not cached and falls back to the stale row", async () => {
  const old = {
    symbol: "AAPL",
    status: "covered",
    ratings: { strongBuy: 0, buy: 5, hold: 1, sell: 0, strongSell: 0 },
    target: { mean: 200 },
    fetchedAt: new Date(1_000_000_000_000 - FRESH_MS - 1),
  };
  const store = memoryStore([old]);
  const fetchImpl = fakeFetch((endpoint) =>
    endpoint === "grades-consensus" ? json(200, [GRADES]) : json(500, {}),
  );
  const svc = service({ store, fetchImpl });

  const { doc, stale } = (await svc.getMany(["AAPL"])).get("AAPL");
  assert.equal(stale, true);
  assert.equal(doc, old);
  assert.equal(store.rows.get("AAPL"), old, "half-answer must not overwrite the cache");
});

test("transient failure with nothing cached is 'unavailable', not 'no_coverage'", async () => {
  const store = memoryStore();
  const fetchImpl = fakeFetch(() => {
    throw Object.assign(new Error("aborted"), { name: "TimeoutError" });
  });
  const svc = service({ store, fetchImpl });

  const { doc } = (await svc.getMany(["MSFT"])).get("MSFT");
  assert.equal(toView(doc).status, "unavailable");
  assert.equal(store.rows.size, 0);
});

test("missing API key never calls the provider", async () => {
  const fetchImpl = fakeFetch(covered);
  const svc = service({ store: memoryStore(), fetchImpl, getApiKey: () => undefined });

  const { doc } = (await svc.getMany(["AAPL"])).get("AAPL");
  assert.equal(doc.status, "unavailable");
  assert.equal(fetchImpl.calls.length, 0);
});

test("concurrent requests for the same symbol share one refresh", async () => {
  const fetchImpl = fakeFetch(covered);
  const svc = service({ store: memoryStore(), fetchImpl });

  await Promise.all([svc.getMany(["AAPL"]), svc.getMany(["AAPL"])]);
  assert.equal(fetchImpl.calls.length, 2);
});

test("upside is withheld when the quote is not USD or missing", () => {
  const doc = { symbol: "X", status: "covered", ratings: {}, target: { mean: 110 } };
  assert.equal(toView(doc, { regularMarketPrice: 100, currency: "TRY" }).upsidePct, null);
  assert.equal(toView(doc, null).upsidePct, null);
  assert.equal(toView(doc, { regularMarketPrice: 100, currency: "USD" }).upsidePct, 10);
});
