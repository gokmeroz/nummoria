/* eslint-disable no-empty */
/* eslint-disable no-unused-vars */
// frontend/src/pages/InvestmentPerformance.jsx

import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import api from "../lib/api";

/* ─────────────────────────────────────────────────────────────
   CONSTANTS & THEME
───────────────────────────────────────────────────────────── */
const BG = "#030508";
const MINT = "#00ff87";
const CYAN = "#00d4ff";
const VIOLET = "#a78bfa";
const DATE_LANG = "en-US";

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

function formatMoneyMinor(amountMinor, currency) {
  if (amountMinor === null || amountMinor === undefined) return "—";
  const dec = decimalsForCurrency(currency);
  const major = amountMinor / Math.pow(10, dec);

  try {
    return new Intl.NumberFormat(DATE_LANG, {
      style: "currency",
      currency,
      minimumFractionDigits: dec,
      maximumFractionDigits: dec,
    }).format(major);
  } catch {
    return `${major.toFixed(dec)} ${currency}`;
  }
}

function formatPrice(value, currency) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "—";
  }

  try {
    return new Intl.NumberFormat(DATE_LANG, {
      style: "currency",
      currency: currency || "USD",
      minimumFractionDigits: decimalsForCurrency(currency || "USD"),
      maximumFractionDigits: decimalsForCurrency(currency || "USD"),
    }).format(Number(value));
  } catch {
    return `${Number(value).toFixed(decimalsForCurrency(currency || "USD"))} ${currency || "USD"}`;
  }
}

function formatNumber(n, digits = 2) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return "—";
  return new Intl.NumberFormat(DATE_LANG, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(Number(n));
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

function isInvSymbol(sym) {
  const s = String(sym || "")
    .trim()
    .toUpperCase();
  return /^INV(\b|[-_])/i.test(s) || s === "INV";
}

/* ─────────────────────────────────────────────────────────────
   UI PRIMITIVES
───────────────────────────────────────────────────────────── */
const Brackets = React.memo(
  ({ color = MINT, size = "10px", thick = "1.5px" }) => (
    <>
      <div
        className="absolute top-0 left-0"
        style={{
          width: size,
          height: size,
          borderTop: `${thick} solid ${color}`,
          borderLeft: `${thick} solid ${color}`,
        }}
      />
      <div
        className="absolute top-0 right-0"
        style={{
          width: size,
          height: size,
          borderTop: `${thick} solid ${color}`,
          borderRight: `${thick} solid ${color}`,
        }}
      />
      <div
        className="absolute bottom-0 left-0"
        style={{
          width: size,
          height: size,
          borderBottom: `${thick} solid ${color}`,
          borderLeft: `${thick} solid ${color}`,
        }}
      />
      <div
        className="absolute bottom-0 right-0"
        style={{
          width: size,
          height: size,
          borderBottom: `${thick} solid ${color}`,
          borderRight: `${thick} solid ${color}`,
        }}
      />
    </>
  ),
);

const ScanLine = React.memo(({ color = MINT, className = "" }) => (
  <div className={`flex items-center gap-1.5 ${className}`}>
    <div
      className="w-[3px] h-[3px] rounded-full opacity-60"
      style={{ backgroundColor: color }}
    />
    <div
      className="flex-1 h-[1px] opacity-20"
      style={{ backgroundColor: color }}
    />
    <div
      className="w-[3px] h-[3px] rounded-full opacity-60"
      style={{ backgroundColor: color }}
    />
  </div>
));

const SectionCard = React.memo(
  ({ title, subtitle, right, children, className = "", accent = "violet" }) => {
    const AC = {
      violet: {
        col: VIOLET,
        bg: "rgba(167,139,250,0.02)",
        bd: "rgba(167,139,250,0.2)",
      },
      cyan: {
        col: CYAN,
        bg: "rgba(0,212,255,0.02)",
        bd: "rgba(0,212,255,0.2)",
      },
      mint: {
        col: MINT,
        bg: "rgba(0,255,135,0.02)",
        bd: "rgba(0,255,135,0.2)",
      },
    }[accent] || {
      col: VIOLET,
      bg: "rgba(167,139,250,0.02)",
      bd: "rgba(167,139,250,0.2)",
    };

    return (
      <div
        className={`relative border p-4 md:p-5 flex flex-col h-full ${className}`}
        style={{ backgroundColor: AC.bg, borderColor: AC.bd }}
      >
        <Brackets color={AC.col} size="10px" thick="1.5px" />
        <div
          className="absolute top-0 inset-x-[15%] h-[1px] opacity-40"
          style={{ backgroundColor: AC.col }}
        />
        {(title || right) && (
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              {title && (
                <h2 className="text-base font-extrabold tracking-wider text-white uppercase">
                  {title}
                </h2>
              )}
              {subtitle && (
                <p className="mt-1 text-xs text-white/80 tracking-wider uppercase">
                  {subtitle}
                </p>
              )}
            </div>
            {right && <div>{right}</div>}
          </div>
        )}
        <div className="flex-1 min-h-0">{children}</div>
      </div>
    );
  },
);

const MetricCard = React.memo(({ label, value, accent, className = "" }) => {
  const color = { violet: VIOLET, cyan: CYAN, mint: MINT }[accent] || CYAN;

  return (
    <div
      className={`border border-white/10 bg-black/40 p-4 relative overflow-hidden h-full flex flex-col justify-center ${className}`}
    >
      <Brackets color={color} size="6px" thick="1px" />
      <div className="text-[10px] font-bold uppercase tracking-wider text-white/70 mb-1">
        {label}
      </div>
      <div
        className="text-lg md:text-xl font-extrabold tracking-tight truncate"
        style={{ color }}
        title={String(value)}
      >
        {value}
      </div>
    </div>
  );
});

const MiniStat = React.memo(
  ({ label, value, accent = "cyan", className = "" }) => {
    const color = { violet: VIOLET, cyan: CYAN, mint: MINT }[accent] || CYAN;

    return (
      <div
        className={`border border-white/10 bg-black/40 p-4 relative ${className}`}
      >
        <Brackets color={color} size="6px" thick="1px" />
        <div className="text-[10px] font-bold uppercase tracking-wider text-white/60 mb-1">
          {label}
        </div>
        <div className="text-sm font-extrabold tracking-wide text-white break-words">
          {value}
        </div>
      </div>
    );
  },
);

/* ─────────────────────────────────────────────────────────────
   MARKET SEARCH
───────────────────────────────────────────────────────────── */
function MarketSearch() {
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [data, setData] = useState(null);

  const getReadableError = (e) => {
    const apiError = e?.response?.data?.error;
    const apiMessage = e?.response?.data?.message;
    const rawMessage = e?.message;

    const combined = [apiError, apiMessage, rawMessage]
      .filter(Boolean)
      .join(" | ");

    const normalized = String(combined || "").toLowerCase();

    if (
      e?.response?.status === 429 ||
      normalized.includes("too many requests") ||
      normalized.includes("not valid json") ||
      normalized.includes("unexpected token")
    ) {
      return "Quote provider is rate-limited right now. Please wait a moment and try again.";
    }

    if (e?.response?.status === 404) {
      return "Symbol not found. Please check the ticker and try again.";
    }

    if (e?.response?.status >= 500) {
      return "Quote service is temporarily unavailable. Please try again later.";
    }

    return apiError || apiMessage || rawMessage || "Lookup failed";
  };

const search = async (sym) => {
  const symbol = String(sym || q)
    .trim()
    .toUpperCase();

  if (!symbol || busy) return;

  setBusy(true);
  setErr("");
  setData(null);

  try {
    const res = await api.get("/investments/quote", {
      params: { symbol },
    });
    setData(res?.data || null);
  } catch (e) {
    setErr(getReadableError(e));
  } finally {
    setBusy(false);
  }
};

  const onKeyDown = (e) => {
    if (e.key === "Enter") search();
  };

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
      subtitle="LIVE LOOKUP FOR STOCKS, ETFS, FOREX, CRYPTO, AND METALS"
      accent="cyan"
      className="mb-5"
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col xl:flex-row xl:items-end gap-3">
          <div className="w-full xl:max-w-xl">
            <label className="mb-1 block text-xs font-bold tracking-wider text-white/70 uppercase">
              Symbol
            </label>
            <div className="flex gap-2">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="AAPL, MSFT, BTC-USD, VOO, USDTRY=X..."
                className="w-full border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white placeholder:text-white/40 outline-none focus:border-[#00d4ff]/50"
              />
              <button
                onClick={() => search()}
                disabled={busy}
                className="px-4 py-3 text-xs font-extrabold tracking-wider text-[#030508] uppercase disabled:opacity-50"
                style={{ backgroundColor: CYAN }}
              >
                {busy ? "Searching..." : "Search"}
              </button>
            </div>
            <p className="mt-2 text-[11px] tracking-wide text-white/45">
              Tips: AAPL, VOO, BTC-USD, USDTRY=X, XAUUSD=X
            </p>
          </div>

          {data ? (
            <div className="w-full xl:flex-1 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
              <MiniStat
                label="Symbol"
                value={data.symbol || "—"}
                accent="mint"
              />
              <MiniStat
                label="Name"
                value={data.shortName || data.longName || "—"}
                accent="violet"
              />
              <MiniStat
                label="Price"
                value={formatPrice(price, priceCur)}
                accent="cyan"
              />
              <MiniStat
                label="Change"
                value={
                  chg != null
                    ? `${chg.toFixed(2)} (${chgPct?.toFixed(2)}%)`
                    : "—"
                }
                accent={chg == null ? "cyan" : chg > 0 ? "mint" : "violet"}
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
            <MiniStat label="Currency" value={priceCur} accent="cyan" />
            <MiniStat
              label="Previous Close"
              value={formatPrice(prev, priceCur)}
              accent="violet"
            />
            <MiniStat
              label="Open"
              value={formatPrice(data?.regularMarketOpen, priceCur)}
              accent="mint"
            />
            <MiniStat
              label="Day Range"
              value={
                data?.regularMarketDayLow != null &&
                data?.regularMarketDayHigh != null
                  ? `${formatPrice(data.regularMarketDayLow, priceCur)} – ${formatPrice(data.regularMarketDayHigh, priceCur)}`
                  : "—"
              }
              accent="cyan"
            />
            <MiniStat
              label="52W Range"
              value={
                data?.fiftyTwoWeekLow != null && data?.fiftyTwoWeekHigh != null
                  ? `${formatPrice(data.fiftyTwoWeekLow, priceCur)} – ${formatPrice(data.fiftyTwoWeekHigh, priceCur)}`
                  : "—"
              }
              accent="violet"
            />
            <MiniStat
              label="Volume"
              value={
                data?.regularMarketVolume != null
                  ? data.regularMarketVolume.toLocaleString()
                  : "—"
              }
              accent="mint"
            />
            <MiniStat
              label="Market Cap"
              value={
                data?.marketCap != null ? abbreviateNumber(data.marketCap) : "—"
              }
              accent="cyan"
            />
            <MiniStat
              label="Exchange"
              value={data?.fullExchangeName || data?.exchange || "—"}
              accent="violet"
            />
          </div>
        ) : null}

        {err && (
          <div className="border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-200">
            {err}
          </div>
        )}
      </div>
    </SectionCard>
  );
}

/* ─────────────────────────────────────────────────────────────
   PAGE
───────────────────────────────────────────────────────────── */
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
      "nummoria:favInvestments:v1",
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

  const fetchPerf = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const { data } = await api.get("/investments/performance");
      setData(data || { holdings: [], totals: {} });
      setLastRefreshed(new Date());
    } catch (e) {
      setErr(e?.response?.data?.error || e.message || "Failed to load.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPerf();
  }, [fetchPerf]);

  useEffect(() => {
    const sp = new URLSearchParams(location.search);
    const hasFav = Boolean(sp.get("favorites"));
    setListMode(hasFav ? "FAVORITES" : "HOLDINGS");
  }, [location.search]);

  const setMode = (mode) => {
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
  };

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

      return String(ak ?? "").localeCompare(String(bk ?? "")) * dir;
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

      if (!totals[cur]) {
        totals[cur] = { costMinor: 0, valueMinor: 0, plMinor: 0 };
      }

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

  const setSortKey = (key) => {
    setSort((s) =>
      s.key === key
        ? { key, dir: s.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "asc" },
    );
  };

  const SortBtn = ({ k, children, className = "" }) => {
    const active = sort.key === k;

    return (
      <button
        type="button"
        onClick={() => setSortKey(k)}
        className={`inline-flex items-center gap-1 ${
          active ? "font-bold text-white" : "font-normal text-white/65"
        } ${className}`}
        title="Sort"
      >
        {children}
        <span className={`text-xs ${active ? "opacity-100" : "opacity-40"}`}>
          {active ? (sort.dir === "asc" ? "▲" : "▼") : "↕"}
        </span>
      </button>
    );
  };

  if (loading) {
    return (
      <div className="min-h-dvh grid place-items-center bg-[#030508] px-4">
        <div className="flex flex-col items-center">
          <Brackets color={VIOLET} size="20px" thick="2px" />
          <div className="w-16 h-16 border border-[#a78bfa]/30 flex items-center justify-center mb-4 bg-[#a78bfa]/10">
            <div className="w-8 h-8 rounded-full border-t-2 border-[#a78bfa] animate-spin" />
          </div>
          <div className="text-[11px] font-extrabold tracking-[0.3em] text-white/90 uppercase">
            Loading Performance...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-[#030508] text-[#e2e8f0] font-sans selection:bg-[#a78bfa]/30">
      <style
        dangerouslySetInnerHTML={{
          __html: `
            .custom-scrollbar::-webkit-scrollbar { width: 4px; height: 4px; }
            .custom-scrollbar::-webkit-scrollbar-track { background: rgba(255,255,255,0.02); }
            .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 4px; }
            .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.4); }
          `,
        }}
      />

      <div className="mx-auto max-w-screen-2xl w-full px-4 sm:px-6 lg:px-8 py-6 flex flex-col gap-5">
        <div className="relative border border-[#a78bfa]/20 bg-[#a78bfa]/[0.03] p-5 md:p-6 overflow-hidden">
          <Brackets color={VIOLET} size="12px" thick="1.5px" />
          <div
            className="absolute top-0 inset-x-[10%] h-[1px] opacity-40"
            style={{ backgroundColor: VIOLET }}
          />

          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 border border-white/10 bg-black/40 px-3 py-1 mb-4">
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: MINT }}
                />
                <span className="text-[11px] font-extrabold tracking-wider text-white/80 uppercase">
                  Performance Module
                </span>
              </div>

              <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-white leading-none">
                Investment Performance
              </h1>

              <p className="mt-3 max-w-2xl text-base text-white/80 leading-relaxed">
                Review live pricing, track unrealized P/L, and compare current
                value against invested cost.
              </p>

              <ScanLine color={VIOLET} className="mt-6 w-full max-w-md" />
            </div>

            <div className="flex flex-wrap items-center gap-3 lg:justify-end">
              <button
                type="button"
                onClick={() => setMode("HOLDINGS")}
                className={`border px-4 py-2 text-xs font-bold tracking-wider uppercase transition-colors ${
                  listMode === "HOLDINGS"
                    ? "border-[#00ff87]/40 bg-[#00ff87]/10 text-[#00ff87]"
                    : "border-white/10 bg-black/40 text-white/80 hover:bg-white/5"
                }`}
              >
                Holdings ({holdingsFiltered.length})
              </button>

              <button
                type="button"
                onClick={() => setMode("FAVORITES")}
                className={`border px-4 py-2 text-xs font-bold tracking-wider uppercase transition-colors ${
                  listMode === "FAVORITES"
                    ? "border-[#00d4ff]/40 bg-[#00d4ff]/10 text-[#00d4ff]"
                    : "border-white/10 bg-black/40 text-white/80 hover:bg-white/5"
                }`}
              >
                Favorites ({favoritesFiltered.length})
              </button>

              <button
                onClick={fetchPerf}
                className="inline-flex items-center border border-white/10 bg-black/40 px-4 py-2 hover:bg-white/5 transition-colors"
              >
                <span className="text-xs font-bold tracking-wider text-white/80 uppercase">
                  Refresh
                </span>
              </button>
            </div>
          </div>

          {lastRefreshed ? (
            <div className="mt-4 text-[11px] tracking-wider text-white/55 uppercase">
              Refreshed:{" "}
              {new Intl.DateTimeFormat("en-US", {
                dateStyle: "medium",
                timeStyle: "short",
              }).format(lastRefreshed)}
            </div>
          ) : null}
        </div>

        <MarketSearch />

        {err && (
          <div className="flex gap-3 border border-red-400/30 bg-red-400/10 p-4">
            <div className="font-bold text-red-300">[!]</div>
            <div className="text-sm text-red-100">{err}</div>
          </div>
        )}

        {!err && !loading && !anyQuotes && holdingsFiltered.length > 0 && (
          <div className="flex gap-3 border border-amber-400/30 bg-amber-400/10 p-4">
            <div className="font-bold text-amber-300">[!]</div>
            <div className="text-sm text-amber-100">
              Live quotes are disabled or unavailable. Value and P/L are shown
              as “—”.
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Object.entries(totalsFiltered).map(([cur, t]) => {
            const hasVal = t.valueMinor !== null && t.valueMinor !== undefined;
            const hasPL = t.plMinor !== null && t.plMinor !== undefined;

            return (
              <SectionCard
                key={cur}
                title="Totals"
                subtitle="AGGREGATED BY CURRENCY"
                accent="cyan"
                right={
                  <span className="border border-[#00d4ff]/30 bg-[#00d4ff]/10 px-2 py-0.5 text-[10px] font-bold tracking-wider text-[#00d4ff] uppercase">
                    {cur}
                  </span>
                }
              >
                <div className="grid grid-cols-1 gap-3">
                  <MetricCard
                    label="Cost"
                    value={formatMoneyMinor(t.costMinor, cur)}
                    accent="cyan"
                  />
                  <MetricCard
                    label="Current Value"
                    value={hasVal ? formatMoneyMinor(t.valueMinor, cur) : "—"}
                    accent="violet"
                  />
                  <MetricCard
                    label="P/L"
                    value={hasPL ? formatMoneyMinor(t.plMinor, cur) : "—"}
                    accent="mint"
                    className={
                      hasPL
                        ? (t.plMinor ?? 0) > 0
                          ? "text-emerald-400"
                          : (t.plMinor ?? 0) < 0
                            ? "text-red-400"
                            : ""
                        : ""
                    }
                  />
                </div>
              </SectionCard>
            );
          })}

          {Object.keys(totalsFiltered).length === 0 && !loading && (
            <SectionCard title="Totals" accent="cyan">
              <div className="text-sm text-white/50">
                No totals yet — add investment transactions.
              </div>
            </SectionCard>
          )}
        </div>

        <SectionCard
          title={listMode === "FAVORITES" ? "Favorite Holdings" : "Holdings"}
          subtitle={
            listMode === "FAVORITES"
              ? "Tracked positions limited to saved favorites"
              : "All current holdings with live quote comparison where available"
          }
          accent="mint"
          className="min-w-0"
        >
          <div className="overflow-x-auto custom-scrollbar border border-white/10 bg-black/20">
            <table className="min-w-full text-sm">
              <thead className="border-b border-white/8 text-white/65 bg-white/[0.02]">
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
                        <td className="px-4 py-4 font-extrabold tracking-wider text-white whitespace-nowrap uppercase">
                          {h.symbol}
                        </td>

                        <td className="px-4 py-4 whitespace-nowrap text-white/75">
                          <span className="inline-flex items-center gap-2">
                            {h.currency}
                            {priceCurMismatch ? (
                              <span
                                className="border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[10px] font-bold tracking-wider text-amber-200 uppercase"
                                title={`Quote currency (${h.priceCurrency}) differs from holding currency (${h.currency}). Value/P&L not computed.`}
                              >
                                FX mismatch
                              </span>
                            ) : null}
                          </span>
                        </td>

                        <td className="px-4 py-4 text-right whitespace-nowrap text-white/75 font-mono">
                          {formatNumber(h.units, 4)}
                        </td>

                        <td className="px-4 py-4 text-right whitespace-nowrap text-white font-mono">
                          {formatMoneyMinor(h.costMinor, h.currency)}
                        </td>

                        <td className="px-4 py-4 text-right whitespace-nowrap text-white/75 font-mono">
                          {h.avgCostPerUnit == null
                            ? "—"
                            : new Intl.NumberFormat("en-US", {
                                style: "currency",
                                currency: h.currency,
                                minimumFractionDigits: dec,
                                maximumFractionDigits: dec,
                              }).format(h.avgCostPerUnit)}
                        </td>

                        <td className="px-4 py-4 text-right whitespace-nowrap text-white/75 font-mono">
                          {priceStr}
                        </td>

                        <td className="px-4 py-4 text-right whitespace-nowrap text-white font-mono">
                          {formatMoneyMinor(h.valueMinor, h.currency)}
                        </td>

                        <td
                          className={`px-4 py-4 text-right whitespace-nowrap font-mono ${
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
      </div>
    </div>
  );
}