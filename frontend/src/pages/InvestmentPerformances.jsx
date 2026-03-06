/* eslint-disable no-empty */
/* eslint-disable no-unused-vars */
// frontend/src/pages/InvestmentPerformance.jsx
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import api from "../lib/api";
import logoUrl from "../assets/nummoria_logo.png";

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

/** ---------- helper to exclude INV ---------- **/
function isInvSymbol(sym) {
  const s = String(sym || "")
    .trim()
    .toUpperCase();
  return /^INV(\b|[-_])/i.test(s) || s === "INV";
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

function SectionCard({ title, subtitle, right, children, className = "" }) {
  return (
    <div
      className={`relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-md ${className}`}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(500px_180px_at_10%_0%,rgba(19,226,67,0.06),transparent_60%),radial-gradient(420px_180px_at_90%_10%,rgba(153,23,70,0.08),transparent_60%)]" />
      <div className="relative p-5 md:p-6">
        {(title || right) && (
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              {title ? (
                <h2 className="text-lg font-semibold tracking-tight text-white">
                  {title}
                </h2>
              ) : null}
              {subtitle ? (
                <p className="mt-1 text-sm text-white/55">{subtitle}</p>
              ) : null}
            </div>
            {right ? <div>{right}</div> : null}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

function MetricCard({ label, value, valueClassName = "" }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
      <div className="text-xs uppercase tracking-[0.18em] text-white/40">
        {label}
      </div>
      <div
        className={`mt-2 text-2xl font-semibold tracking-tight text-white ${valueClassName}`}
      >
        {value}
      </div>
    </div>
  );
}

function MiniStat({ label, value, className = "" }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
      <div className="text-xs uppercase tracking-[0.16em] text-white/40">
        {label}
      </div>
      <div className={`mt-2 text-sm font-semibold text-white ${className}`}>
        {String(value)}
      </div>
    </div>
  );
}

/** ---------- Market Search widget ---------- **/
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
    <SectionCard
      title="Market Search"
      subtitle="Look up live market data for stocks, ETFs, forex, crypto, and metals."
      className="mb-6"
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col xl:flex-row xl:items-end gap-3">
          <div className="w-full xl:max-w-xl">
            <label className="mb-1 block text-sm text-white/60">Symbol</label>
            <div className="flex gap-2">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Try AAPL, MSFT, BTC-USD, VOO, USDTRY=X…"
                className="w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-white placeholder:text-white/30 outline-none transition focus:border-white/20"
              />
              <button
                onClick={() => search()}
                disabled={busy}
                className="rounded-2xl px-4 py-3 text-sm font-semibold text-white transition disabled:opacity-60"
                style={{
                  background: "linear-gradient(135deg, #90a955, #4f772d)",
                }}
              >
                {busy ? "Searching…" : "Search"}
              </button>
            </div>
            <p className="mt-2 text-xs text-white/40">
              Tips: US stocks (AAPL), ETFs (VOO), forex (USDTRY=X), crypto
              (BTC-USD), metals (XAUUSD=X)
            </p>
          </div>

          {data ? (
            <div className="w-full xl:flex-1 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
              <MiniStat label="Symbol" value={data.symbol || "—"} />
              <MiniStat
                label="Name"
                value={data.shortName || data.longName || "—"}
              />
              <MiniStat
                label="Price"
                value={
                  typeof price === "number"
                    ? new Intl.NumberFormat("en-US", {
                        style: "currency",
                        currency: priceCur,
                        minimumFractionDigits: decimalsForCurrency(priceCur),
                        maximumFractionDigits: decimalsForCurrency(priceCur),
                      }).format(price)
                    : "—"
                }
              />
              <MiniStat
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
                      ? "text-emerald-400"
                      : chg < 0
                        ? "text-red-400"
                        : ""
                }
              />
            </div>
          ) : null}
        </div>

        {data ? (
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
            <MiniStat label="Currency" value={priceCur} />
            <MiniStat label="Previous Close" value={prev ?? "—"} />
            <MiniStat label="Open" value={data?.regularMarketOpen ?? "—"} />
            <MiniStat
              label="Day Range"
              value={
                data?.regularMarketDayLow != null &&
                data?.regularMarketDayHigh != null
                  ? `${data.regularMarketDayLow} – ${data.regularMarketDayHigh}`
                  : "—"
              }
            />
            <MiniStat
              label="52W Range"
              value={
                data?.fiftyTwoWeekLow != null && data?.fiftyTwoWeekHigh != null
                  ? `${data.fiftyTwoWeekLow} – ${data.fiftyTwoWeekHigh}`
                  : "—"
              }
            />
            <MiniStat
              label="Volume"
              value={
                data?.regularMarketVolume != null
                  ? data.regularMarketVolume.toLocaleString()
                  : "—"
              }
            />
            <MiniStat
              label="Market Cap"
              value={
                data?.marketCap != null ? abbreviateNumber(data.marketCap) : "—"
              }
            />
            <MiniStat
              label="Exchange"
              value={data?.fullExchangeName || data?.exchange || "—"}
            />
          </div>
        ) : null}

        {err ? (
          <div className="rounded-2xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-100">
            {err}
          </div>
        ) : null}
      </div>
    </SectionCard>
  );
}

/** ---------- Page ---------- **/
export default function InvestmentPerformance() {
  const [data, setData] = useState({ holdings: [], totals: {} });
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [lastRefreshed, setLastRefreshed] = useState(null);

  const [sort, setSort] = useState({ key: "symbol", dir: "asc" });
  const [listMode, setListMode] = useState("HOLDINGS");

  const location = useLocation();
  const navigate = useNavigate();

  const favorites = useMemo(() => {
    const sp = new URLSearchParams(location.search);
    const qp = sp.get("favorites");

    const fromQuery = String(qp || "")
      .split(",")
      .map((s) =>
        String(s || "")
          .trim()
          .toUpperCase(),
      )
      .filter(Boolean);

    if (fromQuery.length) return fromQuery;

    const tryKeys = [
      "favorites",
      "investmentFavorites",
      "nummoriaFavorites",
      "nummoria_investment_favorites",
      "NummoriaFavorites",
    ];

    for (const k of tryKeys) {
      try {
        const raw = localStorage.getItem(k);
        if (!raw) continue;

        const parsed = JSON.parse(raw);
        const arr = Array.isArray(parsed) ? parsed : [];

        const normalized = arr
          .map((x) =>
            String(x?.symbol ?? x?.assetSymbol ?? x ?? "")
              .trim()
              .toUpperCase(),
          )
          .filter(Boolean);

        if (normalized.length) return normalized;
      } catch {}
    }

    return [];
  }, [location.search]);

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

  useEffect(() => {
    const sp = new URLSearchParams(location.search);
    const hasFav = Boolean(sp.get("favorites"));
    setListMode(hasFav ? "FAVORITES" : "HOLDINGS");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search]);

  function setMode(mode) {
    setListMode(mode);

    const sp = new URLSearchParams(location.search);

    if (mode === "FAVORITES") {
      if (favorites.length) sp.set("favorites", favorites.join(","));
    } else {
      sp.delete("favorites");
    }

    navigate(
      { search: sp.toString() ? `?${sp.toString()}` : "" },
      { replace: true },
    );
  }

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

  const holdingsFiltered = useMemo(
    () => holdingsSorted.filter((h) => !isInvSymbol(h.symbol)),
    [holdingsSorted],
  );

  const favoritesSet = useMemo(() => new Set(favorites), [favorites]);

  const favoritesFiltered = useMemo(() => {
    if (!favoritesSet.size) return [];
    return holdingsFiltered.filter((h) => {
      const sym = String(h.symbol || h.assetSymbol || "")
        .trim()
        .toUpperCase();
      return favoritesSet.has(sym);
    });
  }, [holdingsFiltered, favoritesSet]);

  const rowsToRender =
    listMode === "FAVORITES" ? favoritesFiltered : holdingsFiltered;

  const anyQuotes = useMemo(
    () => holdingsFiltered.some((h) => typeof h.price === "number"),
    [holdingsFiltered],
  );

  const totalsFiltered = useMemo(() => {
    const totals = {};
    for (const h of rowsToRender) {
      const cur = h.currency || "USD";
      if (!totals[cur])
        totals[cur] = { costMinor: 0, valueMinor: 0, plMinor: 0 };
      totals[cur].costMinor += h.costMinor ?? 0;

      if (typeof h.valueMinor === "number") {
        totals[cur].valueMinor += h.valueMinor;
      } else {
        totals[cur].valueMinor = totals[cur].valueMinor || null;
      }

      if (typeof h.plMinor === "number") {
        totals[cur].plMinor += h.plMinor;
      } else {
        totals[cur].plMinor = totals[cur].plMinor || null;
      }
    }
    return totals;
  }, [rowsToRender]);

  function setSortKey(key) {
    setSort((s) =>
      s.key === key
        ? { key, dir: s.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "asc" },
    );
  }

  function SortBtn({ k, children, className = "" }) {
    const active = sort.key === k;
    return (
      <button
        type="button"
        onClick={() => setSortKey(k)}
        className={`inline-flex items-center gap-1 ${
          active ? "font-semibold text-white" : "font-normal text-white/65"
        } ${className}`}
        title="Sort"
      >
        {children}
        <span className={`text-xs ${active ? "opacity-100" : "opacity-40"}`}>
          {active ? (sort.dir === "asc" ? "▲" : "▼") : "↕"}
        </span>
      </button>
    );
  }

  if (loading) {
    return (
      <div className="min-h-[60vh] grid place-items-center bg-[#070A07] px-4">
        <div className="relative w-full max-w-sm">
          <div className="pointer-events-none absolute -inset-10 opacity-40">
            <div className="absolute left-4 top-6 h-40 w-40 rounded-full blur-3xl bg-[#13e243]/20" />
            <div className="absolute right-6 top-10 h-40 w-40 rounded-full blur-3xl bg-[#991746]/20" />
          </div>

          <div className="relative rounded-3xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <img
                src={logoUrl}
                alt="Nummoria logo"
                className="h-9 w-9 rounded-xl"
              />
              <div>
                <div className="text-lg font-semibold text-white">Nummoria</div>
                <div className="text-sm text-white/50">
                  Loading investment performance…
                </div>
              </div>
            </div>

            <div className="mt-5 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
              <div className="h-full w-1/3 animate-[perflogload_1.2s_ease-in-out_infinite] bg-white/30" />
            </div>

            <style>{`
              @keyframes perflogload {
                0% { transform: translateX(-120%); }
                100% { transform: translateX(320%); }
              }
            `}</style>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-[#070A07] text-white">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[#070A07]" />
        <div className="absolute inset-0 bg-[radial-gradient(1200px_800px_at_15%_0%,rgba(19,226,67,0.10),transparent_55%),radial-gradient(1000px_700px_at_85%_10%,rgba(153,23,70,0.10),transparent_55%),radial-gradient(900px_700px_at_50%_100%,rgba(255,255,255,0.04),transparent_60%)]" />
        <div className="absolute inset-0 opacity-[0.10] mix-blend-overlay bg-[linear-gradient(to_right,rgba(255,255,255,0.10)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.10)_1px,transparent_1px)] bg-[size:56px_56px]" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/35 to-black/70" />
      </div>

      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#070A07]/80 backdrop-blur">
        <div className="mx-4 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src={logoUrl}
              alt="Nummoria Logo"
              className="h-8 w-8 rounded-xl"
            />
            <h1 className="text-lg sm:text-xl font-semibold tracking-tight text-white">
              Investment Performance
            </h1>
          </div>

          <div className="flex items-center gap-3">
            {lastRefreshed ? (
              <div className="hidden sm:block text-xs text-white/45">
                Refreshed:{" "}
                {new Intl.DateTimeFormat("en-US", {
                  dateStyle: "medium",
                  timeStyle: "short",
                }).format(lastRefreshed)}
              </div>
            ) : null}
            <button
              onClick={fetchPerf}
              className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white/75 transition hover:bg-white/[0.07] hover:text-white disabled:opacity-60"
              disabled={loading}
            >
              {loading ? "Loading..." : "Refresh"}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-4 py-6">
        <SectionCard
          className="mb-6"
          title="Performance dashboard"
          subtitle="Review live pricing, track unrealized profit and loss, and compare current value against invested cost."
        >
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <button
                type="button"
                onClick={() => setMode("HOLDINGS")}
                className={`rounded-2xl border px-4 py-2.5 font-semibold transition ${
                  listMode === "HOLDINGS"
                    ? "border-white/15 bg-white/[0.08] text-white"
                    : "border-white/10 bg-white/[0.03] text-white/55 hover:bg-white/[0.05] hover:text-white"
                }`}
              >
                Holdings ({holdingsFiltered.length})
              </button>

              <button
                type="button"
                onClick={() => setMode("FAVORITES")}
                className={`rounded-2xl border px-4 py-2.5 font-semibold transition ${
                  listMode === "FAVORITES"
                    ? "border-white/15 bg-white/[0.08] text-white"
                    : "border-white/10 bg-white/[0.03] text-white/55 hover:bg-white/[0.05] hover:text-white"
                }`}
              >
                Favorites ({favoritesFiltered.length})
              </button>
            </div>

            {lastRefreshed ? (
              <div className="sm:hidden text-xs text-white/45">
                Refreshed:{" "}
                {new Intl.DateTimeFormat("en-US", {
                  dateStyle: "medium",
                  timeStyle: "short",
                }).format(lastRefreshed)}
              </div>
            ) : null}
          </div>
        </SectionCard>

        <MarketSearch />

        {err ? (
          <div className="mb-6 rounded-2xl border border-red-400/20 bg-red-400/10 p-4 text-red-100">
            {err}
          </div>
        ) : null}

        {!err && !loading && !anyQuotes && holdingsFiltered.length > 0 ? (
          <div className="mb-6 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-amber-100">
            Live quotes are disabled or unavailable. Value and P/L are shown as
            “—”.
          </div>
        ) : null}

        <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 mb-6">
          {Object.entries(totalsFiltered).map(([cur, t]) => {
            const hasVal = t.valueMinor !== null && t.valueMinor !== undefined;
            const hasPL = t.plMinor !== null && t.plMinor !== undefined;
            const plPositive = (t.plMinor ?? 0) > 0;
            const plNegative = (t.plMinor ?? 0) < 0;

            return (
              <SectionCard
                key={cur}
                title="Totals"
                right={
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] text-white/60">
                    {cur}
                  </span>
                }
              >
                <div className="grid grid-cols-1 gap-3">
                  <MetricCard
                    label="Cost"
                    value={formatMoneyMinor(t.costMinor, cur)}
                  />
                  <MetricCard
                    label="Current Value"
                    value={hasVal ? formatMoneyMinor(t.valueMinor, cur) : "—"}
                  />
                  <MetricCard
                    label="P/L"
                    value={hasPL ? formatMoneyMinor(t.plMinor, cur) : "—"}
                    valueClassName={
                      hasPL
                        ? plPositive
                          ? "text-emerald-400"
                          : plNegative
                            ? "text-red-400"
                            : "text-white"
                        : "text-white"
                    }
                  />
                </div>
              </SectionCard>
            );
          })}

          {Object.keys(totalsFiltered).length === 0 && !loading ? (
            <SectionCard title="Totals">
              <div className="text-sm text-white/50">
                No totals yet — add investment transactions.
              </div>
            </SectionCard>
          ) : null}
        </section>

        <SectionCard
          title={listMode === "FAVORITES" ? "Favorite holdings" : "Holdings"}
          subtitle={
            listMode === "FAVORITES"
              ? "Tracked positions limited to your saved favorites."
              : "All current holdings with live quote comparison where available."
          }
          className="min-w-0"
        >
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b border-white/8 text-white/65">
                <tr>
                  <th className="px-4 py-3 text-left whitespace-nowrap">
                    <SortBtn k="symbol">Symbol</SortBtn>
                  </th>
                  <th className="px-4 py-3 text-left whitespace-nowrap">
                    <SortBtn k="currency">Currency</SortBtn>
                  </th>
                  <th className="px-4 py-3 text-right whitespace-nowrap">
                    <SortBtn k="units">Units</SortBtn>
                  </th>
                  <th className="px-4 py-3 text-right whitespace-nowrap">
                    <SortBtn k="costMinor">Cost</SortBtn>
                  </th>
                  <th className="px-4 py-3 text-right whitespace-nowrap">
                    <SortBtn k="avgCostPerUnit">Avg Cost/Unit</SortBtn>
                  </th>
                  <th className="px-4 py-3 text-right whitespace-nowrap">
                    <SortBtn k="price">Price</SortBtn>
                  </th>
                  <th className="px-4 py-3 text-right whitespace-nowrap">
                    <SortBtn k="valueMinor">Current Value</SortBtn>
                  </th>
                  <th className="px-4 py-3 text-right whitespace-nowrap">
                    <SortBtn k="plMinor">P/L</SortBtn>
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-white/8">
                {loading ? (
                  <tr>
                    <td className="px-4 py-5 text-white/50" colSpan={8}>
                      Loading...
                    </td>
                  </tr>
                ) : null}

                {!loading && rowsToRender.length === 0 ? (
                  <tr>
                    <td className="px-4 py-8 text-white/50" colSpan={8}>
                      {listMode === "FAVORITES"
                        ? "No favorites found in your current holdings."
                        : "No holdings found. Add some investment transactions with an assetSymbol."}
                    </td>
                  </tr>
                ) : null}

                {!loading &&
                  rowsToRender.map((h, idx) => {
                    const dec = decimalsForCurrency(h.currency);
                    const priceStr =
                      typeof h.price === "number"
                        ? new Intl.NumberFormat("en-US", {
                            style: "currency",
                            currency: h.priceCurrency || h.currency,
                            minimumFractionDigits: decimalsForCurrency(
                              h.priceCurrency || h.currency,
                            ),
                            maximumFractionDigits: decimalsForCurrency(
                              h.priceCurrency || h.currency,
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
                        className="hover:bg-white/[0.03] transition"
                      >
                        <td className="px-4 py-4 font-medium text-white whitespace-nowrap">
                          {h.symbol}
                        </td>

                        <td className="px-4 py-4 whitespace-nowrap text-white/75">
                          <span className="inline-flex items-center gap-2">
                            {h.currency}
                            {priceCurMismatch ? (
                              <span
                                className="rounded-full border border-amber-400/20 bg-amber-400/10 px-2 py-0.5 text-[10px] text-amber-200"
                                title={`Quote currency (${h.priceCurrency}) differs from holding currency (${h.currency}). Value/P&L not computed.`}
                              >
                                FX mismatch
                              </span>
                            ) : null}
                          </span>
                        </td>

                        <td className="px-4 py-4 text-right whitespace-nowrap text-white/75">
                          {formatNumber(h.units, 4)}
                        </td>

                        <td className="px-4 py-4 text-right whitespace-nowrap text-white">
                          {formatMoneyMinor(h.costMinor, h.currency)}
                        </td>

                        <td className="px-4 py-4 text-right whitespace-nowrap text-white/75">
                          {h.avgCostPerUnit == null
                            ? "—"
                            : new Intl.NumberFormat("en-US", {
                                style: "currency",
                                currency: h.currency,
                                minimumFractionDigits: dec,
                                maximumFractionDigits: dec,
                              }).format(h.avgCostPerUnit)}
                        </td>

                        <td className="px-4 py-4 text-right whitespace-nowrap text-white/75">
                          {priceStr}
                        </td>

                        <td className="px-4 py-4 text-right whitespace-nowrap text-white">
                          {formatMoneyMinor(h.valueMinor, h.currency)}
                        </td>

                        <td
                          className={`px-4 py-4 text-right whitespace-nowrap ${
                            (h.plMinor ?? 0) > 0
                              ? "text-emerald-400"
                              : (h.plMinor ?? 0) < 0
                                ? "text-red-400"
                                : "text-white"
                          }`}
                        >
                          {formatMoneyMinor(h.plMinor, h.currency)}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </SectionCard>
      </main>
    </div>
  );
}
