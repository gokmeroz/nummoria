/* eslint-disable no-unused-vars */
// frontend/src/pages/InvestmentPerformance.jsx
import { useEffect, useMemo, useState } from "react";
import api from "../lib/api";

const main = "#4f772d";
const secondary = "#90a955";

/** Match backend's minor-unit handling */
function decimalsForCurrency(code) {
  const zero = new Set(["JPY", "KRW", "CLP", "VND"]);
  const three = new Set(["BHD", "IQD", "JOD", "KWD", "OMR", "TND"]);
  if (zero.has(code)) return 0;
  if (three.has(code)) return 3;
  return 2;
}

function formatMoneyMinor(amountMinor, currency) {
  if (amountMinor === null || amountMinor === undefined) return "—";
  const dec = decimalsForCurrency(currency);
  const major = amountMinor / Math.pow(10, dec);
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: dec,
      maximumFractionDigits: dec,
    }).format(major);
  } catch {
    return `${major.toFixed(dec)} ${currency}`;
  }
}

function formatNumber(n, digits = 2) {
  if (n === null || n === undefined) return "—";
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(n);
}

/** ---------- NEW: Market Search widget ---------- **/
function MarketSearch() {
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [data, setData] = useState(null);

  async function search(sym) {
    const symbol = String(sym || q)
      .trim()
      .toUpperCase();
    if (!symbol) return;
    setBusy(true);
    setErr("");
    setData(null);
    try {
      const { data } = await api.get("/investments/quote", {
        params: { symbol },
      });
      setData(data || null);
    } catch (e) {
      setErr(e?.response?.data?.error || e.message || "Lookup failed");
    } finally {
      setBusy(false);
    }
  }

  function onKeyDown(e) {
    if (e.key === "Enter") search();
  }

  const price =
    typeof data?.regularMarketPrice === "number"
      ? data.regularMarketPrice
      : null;
  const prev =
    typeof data?.regularMarketPreviousClose === "number"
      ? data.regularMarketPreviousClose
      : null;
  const chg = price != null && prev != null ? price - prev : null;
  const chgPct = price != null && prev ? (chg / prev) * 100 : null;

  const priceCur = data?.currency || data?.financialCurrency || "USD";

  return (
    <section className="mb-6">
      <div className="rounded-2xl border p-4 bg-white">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div className="w-full sm:max-w-md">
            <label className="block text-sm text-gray-600 mb-1">
              Market Search
            </label>
            <div className="flex gap-2">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Try AAPL, MSFT, BTC-USD, VOO, USDTRY=X…"
                className="flex-1 border rounded-lg px-3 py-2"
              />
              <button
                onClick={() => search()}
                disabled={busy}
                className="px-4 py-2 rounded-lg text-white font-semibold disabled:opacity-60"
                style={{ background: main }}
              >
                {busy ? "Searching…" : "Search"}
              </button>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              Tips: US stocks (AAPL), ETFs (VOO), forex (USDTRY=X), crypto
              (BTC-USD), metals (XAUUSD=X)
            </p>
          </div>

          {data && (
            <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Stat label="Symbol" value={data.symbol || "—"} />
              <Stat
                label="Name"
                value={data.shortName || data.longName || "—"}
              />
              <Stat
                label="Price"
                value={
                  price != null
                    ? new Intl.NumberFormat("en-US", {
                        style: "currency",
                        currency: priceCur,
                        minimumFractionDigits: decimalsForCurrency(priceCur),
                        maximumFractionDigits: decimalsForCurrency(priceCur),
                      }).format(price)
                    : "—"
                }
              />
              <Stat
                label="Change"
                value={
                  chg != null
                    ? `${chg.toFixed(2)} (${chgPct?.toFixed(2)}%)`
                    : "—"
                }
                className={
                  chg == null
                    ? ""
                    : chg > 0
                    ? "text-emerald-600"
                    : chg < 0
                    ? "text-red-600"
                    : ""
                }
              />

              <Stat label="Currency" value={priceCur} />
              <Stat label="Previous Close" value={prev ?? "—"} />
              <Stat label="Open" value={data?.regularMarketOpen ?? "—"} />
              <Stat
                label="Day Range"
                value={
                  data?.regularMarketDayLow != null &&
                  data?.regularMarketDayHigh != null
                    ? `${data.regularMarketDayLow} – ${data.regularMarketDayHigh}`
                    : "—"
                }
              />
              <Stat
                label="52W Range"
                value={
                  data?.fiftyTwoWeekLow != null &&
                  data?.fiftyTwoWeekHigh != null
                    ? `${data.fiftyTwoWeekLow} – ${data.fiftyTwoWeekHigh}`
                    : "—"
                }
              />
              <Stat
                label="Volume"
                value={
                  data?.regularMarketVolume != null
                    ? data.regularMarketVolume.toLocaleString()
                    : "—"
                }
              />
              <Stat
                label="Market Cap"
                value={
                  data?.marketCap != null
                    ? abbreviateNumber(data.marketCap)
                    : "—"
                }
              />
              <Stat
                label="Exchange"
                value={data?.fullExchangeName || data?.exchange || "—"}
              />
            </div>
          )}
        </div>

        {err && (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 text-red-700 p-2">
            {err}
          </div>
        )}
      </div>
    </section>
  );
}

function Stat({ label, value, className = "" }) {
  return (
    <div className="p-3 rounded-xl border">
      <div className="text-xs text-gray-500">{label}</div>
      <div className={`text-sm font-semibold truncate ${className}`}>
        {String(value)}
      </div>
    </div>
  );
}

function abbreviateNumber(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return "—";
  const units = ["", "K", "M", "B", "T"];
  let i = 0;
  let num = v;
  while (num >= 1000 && i < units.length - 1) {
    num /= 1000;
    i++;
  }
  return `${num.toFixed(num >= 100 ? 0 : num >= 10 ? 1 : 2)}${units[i]}`;
}

/** ---------- Page ---------- **/
export default function InvestmentPerformance() {
  const [data, setData] = useState({ holdings: [], totals: {} });
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [lastRefreshed, setLastRefreshed] = useState(null);

  const [sort, setSort] = useState({ key: "symbol", dir: "asc" });

  async function fetchPerf() {
    setLoading(true);
    setErr("");
    try {
      const { data } = await api.get("/investments/performance");
      setData(data || { holdings: [], totals: {} });
      setLastRefreshed(new Date());
    } catch (e) {
      setErr(e.response?.data?.error || e.message || "Failed to load.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchPerf();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const anyQuotes = useMemo(
    () => (data?.holdings || []).some((h) => typeof h.price === "number"),
    [data]
  );

  const holdingsSorted = useMemo(() => {
    const rows = [...(data?.holdings || [])];
    rows.sort((a, b) => {
      const dir = sort.dir === "asc" ? 1 : -1;
      const ak = a[sort.key];
      const bk = b[sort.key];

      if (["valueMinor", "plMinor", "costMinor"].includes(sort.key)) {
        const av = ak ?? -Infinity;
        const bv = bk ?? -Infinity;
        return (av - bv) * dir;
      }
      if (["price", "avgCostPerUnit", "units"].includes(sort.key)) {
        const av = ak ?? -Infinity;
        const bv = bk ?? -Infinity;
        return av > bv ? dir : av < bv ? -dir : 0;
      }

      const as = String(ak ?? "");
      const bs = String(bk ?? "");
      return as.localeCompare(bs) * dir;
    });
    return rows;
  }, [data, sort]);

  function setSortKey(key) {
    setSort((s) =>
      s.key === key
        ? { key, dir: s.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "asc" }
    );
  }

  function SortBtn({ k, children }) {
    const active = sort.key === k;
    return (
      <button
        type="button"
        onClick={() => setSortKey(k)}
        className={`inline-flex items-center gap-1 ${
          active ? "font-semibold" : "font-normal"
        }`}
        title="Sort"
      >
        {children}
        <span className={`text-xs ${active ? "opacity-100" : "opacity-40"}`}>
          {active ? (sort.dir === "asc" ? "▲" : "▼") : "↕"}
        </span>
      </button>
    );
  }

  return (
    <div className="min-h-dvh bg-white">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur border-b">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img
              src="../src/assets/nummoria_logo.png"
              alt="Nummoria Logo"
              className="h-8 w-8"
            />
            <h1
              className="text-lg sm:text-xl font-semibold"
              style={{ color: main }}
            >
              Investment Performance
            </h1>
            <img
              src="../src/assets/nummoria_logo.png"
              alt="Nummoria Logo"
              className="h-8 w-8"
            />
          </div>

          <div className="flex items-center gap-3">
            {lastRefreshed && (
              <div className="text-xs sm:text-sm text-gray-500">
                Refreshed:{" "}
                {new Intl.DateTimeFormat("en-US", {
                  dateStyle: "medium",
                  timeStyle: "short",
                }).format(lastRefreshed)}
              </div>
            )}
            <button
              onClick={fetchPerf}
              className="px-3 py-2 rounded-xl border text-sm"
              style={{ borderColor: main, color: main }}
              disabled={loading}
            >
              {loading ? "Loading..." : "Refresh"}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
        {/* ---------- NEW: Market Search ---------- */}
        <MarketSearch />

        {/* Notices */}
        {err && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 text-red-700 p-3">
            {err}
          </div>
        )}
        {!err && !loading && !anyQuotes && (data.holdings?.length ?? 0) > 0 && (
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 text-amber-700 p-3">
            Live quotes are disabled or unavailable. Value &amp; P/L shown as
            “—”.
          </div>
        )}

        {/* Totals by currency */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {Object.entries(data?.totals || {}).map(([cur, t]) => {
            const hasVal = t.valueMinor !== null && t.valueMinor !== undefined;
            const hasPL = t.plMinor !== null && t.plMinor !== undefined;
            const plPositive = (t.plMinor ?? 0) > 0;
            const plNegative = (t.plMinor ?? 0) < 0;

            return (
              <div
                key={cur}
                className="rounded-2xl border p-4 shadow-sm"
                style={{ borderColor: "#e5e7eb" }}
              >
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-medium text-gray-600">Totals</h2>
                  <span
                    className="text-xs px-2 py-1 rounded-full"
                    style={{ backgroundColor: `${secondary}22`, color: main }}
                  >
                    {cur}
                  </span>
                </div>

                <dl className="space-y-2">
                  <div className="flex items-center justify-between">
                    <dt className="text-gray-500">Cost</dt>
                    <dd className="font-semibold">
                      {formatMoneyMinor(t.costMinor, cur)}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-gray-500">Current Value</dt>
                    <dd className="font-semibold">
                      {hasVal ? formatMoneyMinor(t.valueMinor, cur) : "—"}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-gray-500">P/L</dt>
                    <dd
                      className={`font-semibold ${
                        hasPL
                          ? plPositive
                            ? "text-emerald-600"
                            : plNegative
                            ? "text-red-600"
                            : "text-gray-800"
                          : "text-gray-800"
                      }`}
                    >
                      {hasPL ? formatMoneyMinor(t.plMinor, cur) : "—"}
                    </dd>
                  </div>
                </dl>
              </div>
            );
          })}
          {Object.keys(data?.totals || {}).length === 0 && !loading && (
            <div className="text-gray-500">
              No totals yet — add investment transactions.
            </div>
          )}
        </section>

        {/* Holdings table */}
        <section className="rounded-2xl border overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-700">
              <tr>
                <th className="px-4 py-3 text-left">
                  <SortBtn k="symbol">Symbol</SortBtn>
                </th>
                <th className="px-4 py-3 text-left">
                  <SortBtn k="currency">Currency</SortBtn>
                </th>
                <th className="px-4 py-3 text-right">
                  <SortBtn k="units">Units</SortBtn>
                </th>
                <th className="px-4 py-3 text-right">
                  <SortBtn k="costMinor">Cost</SortBtn>
                </th>
                <th className="px-4 py-3 text-right">
                  <SortBtn k="avgCostPerUnit">Avg Cost/Unit</SortBtn>
                </th>
                <th className="px-4 py-3 text-right">
                  <SortBtn k="price">Price</SortBtn>
                </th>
                <th className="px-4 py-3 text-right">
                  <SortBtn k="valueMinor">Current Value</SortBtn>
                </th>
                <th className="px-4 py-3 text-right">
                  <SortBtn k="plMinor">P/L</SortBtn>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading && (
                <tr>
                  <td className="px-4 py-4 text-gray-500" colSpan={8}>
                    Loading...
                  </td>
                </tr>
              )}

              {!loading && (data?.holdings?.length ?? 0) === 0 && (
                <tr>
                  <td className="px-4 py-6 text-gray-500" colSpan={8}>
                    No holdings found. Add some <em>investment</em> transactions
                    with an <code>assetSymbol</code>.
                  </td>
                </tr>
              )}

              {!loading &&
                (data?.holdings || []).map((h, idx) => {
                  const dec = decimalsForCurrency(h.currency);
                  const priceStr =
                    typeof h.price === "number"
                      ? new Intl.NumberFormat("en-US", {
                          style: "currency",
                          currency: h.priceCurrency || h.currency,
                          minimumFractionDigits: decimalsForCurrency(
                            h.priceCurrency || h.currency
                          ),
                          maximumFractionDigits: decimalsForCurrency(
                            h.priceCurrency || h.currency
                          ),
                        }).format(h.price)
                      : "—";

                  const priceCurMismatch =
                    typeof h.price === "number" &&
                    h.priceCurrency &&
                    h.priceCurrency !== h.currency;

                  return (
                    <tr
                      key={`${h.symbol}-${idx}`}
                      className="hover:bg-gray-50/60"
                    >
                      <td className="px-4 py-3 font-medium">{h.symbol}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-2">
                          {h.currency}
                          {priceCurMismatch && (
                            <span
                              className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800"
                              title={`Quote currency (${h.priceCurrency}) differs from holding currency (${h.currency}). Value/P&L not computed.`}
                            >
                              FX mismatch
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {formatNumber(h.units, 4)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {formatMoneyMinor(h.costMinor, h.currency)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {h.avgCostPerUnit == null
                          ? "—"
                          : new Intl.NumberFormat("en-US", {
                              style: "currency",
                              currency: h.currency,
                              minimumFractionDigits: dec,
                              maximumFractionDigits: dec,
                            }).format(h.avgCostPerUnit)}
                      </td>
                      <td className="px-4 py-3 text-right">{priceStr}</td>
                      <td className="px-4 py-3 text-right">
                        {formatMoneyMinor(h.valueMinor, h.currency)}
                      </td>
                      <td
                        className={`px-4 py-3 text-right ${
                          (h.plMinor ?? 0) > 0
                            ? "text-emerald-600"
                            : (h.plMinor ?? 0) < 0
                            ? "text-red-600"
                            : ""
                        }`}
                      >
                        {formatMoneyMinor(h.plMinor, h.currency)}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </section>
      </main>

      <div className="h-1 w-full" style={{ backgroundColor: secondary }} />
    </div>
  );
}
