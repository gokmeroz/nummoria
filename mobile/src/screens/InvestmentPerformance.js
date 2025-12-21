/* eslint-disable no-unused-vars */
/* eslint-disable no-empty */
// mobile/src/screens/InvestmentPerformance.js

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Image,
  Modal,
  Pressable,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";

import api from "../lib/api";
import logo from "../assets/nummoria_logo.png";

const main = "#4f772d";
const secondary = "#90a955";
const BG_DARK = "#050816";
const CARD_BG = "#111827";
const BORDER_DARK = "#1f2937";
const TEXT_MUTED = "#9ca3af";
const TEXT_SOFT = "#e5e7eb";

const DATE_LANG = "en-US";

/* ------------------------------ helpers ------------------------------ */
function decimalsForCurrency(code) {
  const zero = new Set(["JPY", "KRW", "CLP", "VND"]);
  const three = new Set(["BHD", "IQD", "JOD", "KWD", "OMR", "TND"]);
  if (zero.has(code)) return 0;
  if (three.has(code)) return 3;
  return 2;
}

function fmtMoneyMinor(minor, cur = "USD") {
  if (minor === null || minor === undefined) return "—";

  const currency = cur || "USD";
  const dec = decimalsForCurrency(currency);
  const major = Number(minor) / Math.pow(10, dec);

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

function fmtMoneyMajor(major, cur = "USD") {
  if (major === null || major === undefined || Number.isNaN(Number(major)))
    return "—";

  const currency = cur || "USD";
  const dec = decimalsForCurrency(currency);
  const val = Number(major);

  try {
    return new Intl.NumberFormat(DATE_LANG, {
      style: "currency",
      currency,
      minimumFractionDigits: dec,
      maximumFractionDigits: dec,
    }).format(val);
  } catch {
    return `${val.toFixed(dec)} ${currency}`;
  }
}

function fmtNumber(n, digits = 2) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return "—";
  return new Intl.NumberFormat(DATE_LANG, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(Number(n));
}

function fmtInt(n) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return "—";
  return Number(n).toLocaleString(DATE_LANG);
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
  const dp = num >= 100 ? 0 : num >= 10 ? 1 : 2;
  return `${num.toFixed(dp)}${units[i]}`;
}

function isInvSymbol(sym) {
  const s = String(sym || "")
    .trim()
    .toUpperCase();
  return /^INV(\b|[-_])/i.test(s) || s === "INV";
}

function fmtPct(val) {
  if (val == null || Number.isNaN(val)) return "-";
  return `${(val * 100).toFixed(2)}%`;
}

function fmtDateTime(dateLike) {
  if (!dateLike) return "-";
  const d = new Date(dateLike);
  if (Number.isNaN(d.getTime())) return "-";
  return `${d.toLocaleDateString(DATE_LANG, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })} ${d.toLocaleTimeString(DATE_LANG, {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

/** Normalize quote payloads (backend may return either "minor" fields or Yahoo-like fields) */
function normalizeQuote(q) {
  const symbol = q?.symbol || "—";
  const name = q?.shortName || q?.longName || q?.name || "—";

  const currency =
    q?.currency || q?.financialCurrency || q?.priceCurrency || "USD";

  // Two possible shapes:
  // 1) Yahoo-like: regularMarketPrice, regularMarketPreviousClose, regularMarketOpen, etc (major units)
  // 2) Minor-based: priceMinor, changeMinor, changePct (minor units + pct)
  const hasYahoo = typeof q?.regularMarketPrice === "number";

  const price = hasYahoo
    ? q.regularMarketPrice
    : q?.priceMinor != null
    ? Number(q.priceMinor) / Math.pow(10, decimalsForCurrency(currency))
    : null;

  const prevClose = hasYahoo ? q?.regularMarketPreviousClose : null;
  const open = hasYahoo ? q?.regularMarketOpen : null;

  const dayLow = hasYahoo ? q?.regularMarketDayLow : null;
  const dayHigh = hasYahoo ? q?.regularMarketDayHigh : null;

  const wkLow = hasYahoo ? q?.fiftyTwoWeekLow : null;
  const wkHigh = hasYahoo ? q?.fiftyTwoWeekHigh : null;

  const volume = hasYahoo ? q?.regularMarketVolume : q?.volume;
  const marketCap = hasYahoo ? q?.marketCap : q?.marketCap;

  const exchange = q?.fullExchangeName || q?.exchange || "—";

  let changeMajor = null;
  let changePct = null;

  if (q?.changeMinor != null) {
    changeMajor =
      Number(q.changeMinor) / Math.pow(10, decimalsForCurrency(currency));
    changePct = typeof q?.changePct === "number" ? q.changePct : null;
  } else if (
    hasYahoo &&
    typeof prevClose === "number" &&
    typeof price === "number"
  ) {
    changeMajor = price - prevClose;
    changePct = prevClose ? changeMajor / prevClose : null;
  }

  // Prefer backend's lastUpdated; fallback none.
  const lastUpdated = q?.lastUpdated || q?.regularMarketTime || null;

  return {
    symbol,
    name,
    currency,
    price,
    prevClose,
    open,
    dayLow,
    dayHigh,
    wkLow,
    wkHigh,
    volume,
    marketCap,
    exchange,
    changeMajor,
    changePct,
    lastUpdated,
  };
}

/* ------------------------------ toast ------------------------------ */
function useToasts() {
  const [toast, setToast] = useState(null);

  const show = useCallback((t) => {
    const obj = { type: t.type || "info", msg: t.msg || String(t) };
    setToast(obj);
    setTimeout(() => setToast(null), 3000);
  }, []);

  return { toast, show };
}

function Toast({ toast }) {
  if (!toast) return null;

  const border =
    toast.type === "error"
      ? "#fecaca"
      : toast.type === "success"
      ? "#6ee7b7"
      : toast.type === "warning"
      ? "#fde68a"
      : "#4b5563";

  const bg =
    toast.type === "error"
      ? "#450a0a"
      : toast.type === "success"
      ? "#022c22"
      : toast.type === "warning"
      ? "#3a2a00"
      : "#020617";

  return (
    <View style={[styles.toast, { borderColor: border, backgroundColor: bg }]}>
      <Text style={styles.toastType}>{toast.type}</Text>
      <Text style={styles.toastMsg}>{toast.msg}</Text>
    </View>
  );
}

/* ------------------------------ rows ------------------------------ */
function HoldingRow({ h }) {
  const symbol = h.symbol || h.assetSymbol || "—";
  const side = h.side || "long";

  const cost = fmtMoneyMinor(h.costMinor, h.currency);
  const value = fmtMoneyMinor(h.valueMinor, h.currency);
  const pl = fmtMoneyMinor(h.plMinor, h.currency);
  const plPct = fmtPct(h.plPct);

  const daily = h.dailyChangeMinor;
  const dailyPct = fmtPct(h.dailyChangePct);

  const isUp = (h.plMinor || 0) >= 0;

  return (
    <View style={styles.row}>
      <View style={styles.rowLeft}>
        <View style={styles.rowTitleRow}>
          <Text style={styles.rowSymbol}>{symbol}</Text>
          <View
            style={[
              styles.rowSideBadge,
              side === "short" && {
                borderColor: "#fecaca",
                backgroundColor: "#450a0a33",
              },
            ]}
          >
            <Text style={styles.rowSideText}>{side}</Text>
          </View>
        </View>

        <Text style={styles.rowCurrency}>
          {h.currency} •{" "}
          {h.units != null ? `${fmtNumber(h.units, 4)} units` : "size n/a"}
        </Text>

        <View style={styles.rowLine}>
          <Text style={styles.rowLabel}>Cost</Text>
          <Text style={styles.rowValue}>{cost}</Text>
        </View>
        <View style={styles.rowLine}>
          <Text style={styles.rowLabel}>Value</Text>
          <Text style={styles.rowValue}>{value}</Text>
        </View>
      </View>

      <View style={styles.rowRight}>
        <Text style={[styles.rowPL, isUp ? styles.rowPLPos : styles.rowPLNeg]}>
          {pl} ({plPct})
        </Text>

        {daily != null && (
          <Text
            style={[
              styles.rowDaily,
              (h.dailyChangeMinor || 0) >= 0
                ? styles.rowPLPos
                : styles.rowPLNeg,
            ]}
          >
            {fmtMoneyMinor(daily, h.currency)} ({dailyPct}) today
          </Text>
        )}
      </View>
    </View>
  );
}

/* ------------------------------ quote modal ------------------------------ */
function QuoteStat({ label, value, valueStyle }) {
  return (
    <View style={styles.qStat}>
      <Text style={styles.qStatLabel}>{label}</Text>
      <Text style={[styles.qStatValue, valueStyle]} numberOfLines={2}>
        {String(value)}
      </Text>
    </View>
  );
}

function QuoteModal({ visible, onClose, quoteData }) {
  const q = useMemo(() => normalizeQuote(quoteData || {}), [quoteData]);
  const isUp = (q.changeMajor || 0) > 0;
  const isDown = (q.changeMajor || 0) < 0;

  const changeStr =
    q.changeMajor == null
      ? "—"
      : `${fmtNumber(q.changeMajor, 2)} (${
          q.changePct != null ? (q.changePct * 100).toFixed(2) : "—"
        }%)`;

  const dayRange =
    q.dayLow != null && q.dayHigh != null ? `${q.dayLow} – ${q.dayHigh}` : "—";
  const wkRange =
    q.wkLow != null && q.wkHigh != null ? `${q.wkLow} – ${q.wkHigh}` : "—";

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable style={styles.modalCard} onPress={() => {}}>
          <View style={styles.modalHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.modalTitle}>Market Details</Text>
              <Text style={styles.modalSubtitle}>
                More quote info (like web)
              </Text>
            </View>

            {/* <TouchableOpacity
              onPress={onClose}
              style={styles.modalCloseBtn}
              activeOpacity={0.85}
            >
              <Text style={styles.modalCloseText}>✕</Text>
            </TouchableOpacity> 
            */}
          </View>

          <View style={styles.modalTopLine}>
            <Text style={styles.modalSymbol}>{q.symbol}</Text>
            <Text style={styles.modalName} numberOfLines={1}>
              {q.name}
            </Text>
          </View>

          <View style={styles.modalPriceRow}>
            <Text style={styles.modalPrice}>
              {fmtMoneyMajor(q.price, q.currency)}
            </Text>
            <Text
              style={[
                styles.modalChange,
                isUp ? styles.rowPLPos : isDown ? styles.rowPLNeg : null,
              ]}
            >
              {changeStr}
            </Text>
          </View>

          {q.lastUpdated ? (
            <Text style={styles.modalUpdated}>
              Updated {fmtDateTime(q.lastUpdated)}
            </Text>
          ) : null}

          <View style={styles.qGrid}>
            <QuoteStat label="Symbol" value={q.symbol} />
            <QuoteStat label="Currency" value={q.currency} />
            <QuoteStat label="Previous Close" value={q.prevClose ?? "—"} />
            <QuoteStat label="Open" value={q.open ?? "—"} />
            <QuoteStat label="Day Range" value={dayRange} />
            <QuoteStat label="52W Range" value={wkRange} />
            <QuoteStat
              label="Volume"
              value={q.volume != null ? fmtInt(q.volume) : "—"}
            />
            <QuoteStat
              label="Market Cap"
              value={q.marketCap != null ? abbreviateNumber(q.marketCap) : "—"}
            />
            <QuoteStat label="Exchange" value={q.exchange} />
          </View>

          <View style={styles.modalFooter}>
            <TouchableOpacity
              onPress={onClose}
              style={styles.modalPrimaryBtn}
              activeOpacity={0.9}
            >
              <Text style={styles.modalPrimaryBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/* =============================== screen =============================== */
export default function InvestmentPerformanceScreen() {
  const navigation = useNavigation();
  const route = useRoute();

  const { toast, show } = useToasts();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [data, setData] = useState({ holdings: [], totals: {} });
  const [lastRefreshed, setLastRefreshed] = useState(null);

  const [search, setSearch] = useState("");
  const [sideFilter, setSideFilter] = useState("ALL"); // "ALL" | "long" | "short"
  const [curFilter, setCurFilter] = useState("ALL");

  const [quoteSymbol, setQuoteSymbol] = useState("");
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteData, setQuoteData] = useState(null);
  const [quoteModalOpen, setQuoteModalOpen] = useState(false);

  const fetchPerf = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const { data: payload } = await api.get("/investments/performance");
      setData(payload || { holdings: [], totals: {} });
      setLastRefreshed(new Date());
    } catch (e) {
      const msg = e?.response?.data?.error || e.message || "Failed to load.";
      setErr(msg);
      show({ type: "error", msg });
    } finally {
      setLoading(false);
    }
  }, [show]);

  useEffect(() => {
    fetchPerf();
  }, [fetchPerf]);

  // Filter out INV holdings (match web)
  const holdings = useMemo(() => {
    const rows = data?.holdings || [];
    return rows.filter((h) => !isInvSymbol(h.symbol || h.assetSymbol));
  }, [data]);

  const [listMode, setListMode] = useState("HOLDINGS"); // "HOLDINGS" | "FAVORITES"

  // favorites passed from InvestmentScreen navigation
  const favorites = (route?.params?.favorites || [])
    .map((s) =>
      String(s || "")
        .toUpperCase()
        .trim()
    )
    .filter(Boolean);
  const favoritesSet = useMemo(() => new Set(favorites), [favorites]);

  const currencies = useMemo(() => {
    const s = new Set(holdings.map((h) => h.currency || "USD"));
    return ["ALL", ...Array.from(s)];
  }, [holdings]);

  const holdingsFiltered = useMemo(() => {
    const needle = search.trim().toLowerCase();

    const filtered = holdings.filter((h) => {
      if (sideFilter !== "ALL" && (h.side || "long") !== sideFilter)
        return false;

      const cur = h.currency || "USD";
      if (curFilter !== "ALL" && cur !== curFilter) return false;

      if (needle) {
        const hay = `${h.symbol || h.assetSymbol || ""} ${h.notes || ""} ${
          (h.tags || []).join(" ") || ""
        }`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }

      return true;
    });

    filtered.sort((a, b) => (b.plMinor || 0) - (a.plMinor || 0)); // P/L desc
    return filtered;
  }, [holdings, search, sideFilter, curFilter]);

  const favoritesFiltered = useMemo(() => {
    if (!favoritesSet.size) return [];
    return holdingsFiltered.filter((h) => {
      const sym = String(h.symbol || h.assetSymbol || "")
        .toUpperCase()
        .trim();
      return favoritesSet.has(sym);
    });
  }, [holdingsFiltered, favoritesSet]);

  const listToRender =
    listMode === "FAVORITES" ? favoritesFiltered : holdingsFiltered;

  const anyQuotes = useMemo(
    () => holdings.some((h) => typeof h.price === "number"),
    [holdings]
  );

  // Totals should follow current tab + filters (match web behavior)
  const totalsByCurrency = useMemo(() => {
    const m = {};
    const rows = listToRender;

    for (const h of rows) {
      const cur = h.currency || "USD";
      if (!m[cur]) m[cur] = { costMinor: 0, valueMinor: null, plMinor: null };

      m[cur].costMinor += Number(h.costMinor || 0);

      if (typeof h.valueMinor === "number") {
        m[cur].valueMinor = (m[cur].valueMinor ?? 0) + h.valueMinor;
      }
      if (typeof h.plMinor === "number") {
        m[cur].plMinor = (m[cur].plMinor ?? 0) + h.plMinor;
      }
    }

    return Object.entries(m).map(([cur, v]) => ({
      cur,
      costMinor: v.costMinor,
      valueMinor: v.valueMinor,
      plMinor: v.plMinor,
      plPct:
        v.plMinor != null && v.costMinor !== 0
          ? v.plMinor / Math.abs(v.costMinor || 1)
          : null,
    }));
  }, [listToRender]);

  const handleQuoteLookup = async () => {
    const symbol = quoteSymbol.trim().toUpperCase();
    if (!symbol) {
      show({ type: "warning", msg: "Enter a symbol to lookup." });
      return;
    }

    try {
      setQuoteLoading(true);
      setQuoteData(null);
      const { data: qd } = await api.get("/investments/quote", {
        params: { symbol },
      });
      setQuoteData(qd || null);
      setQuoteModalOpen(true); // ✅ show the popup
    } catch (e) {
      const msg = e?.response?.data?.error || e.message || "Lookup failed.";
      show({ type: "error", msg });
    } finally {
      setQuoteLoading(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.screen, { justifyContent: "center" }]}>
        <ActivityIndicator size="large" color={main} />
        <Text style={styles.loadingText}>Crunching your performance...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      {/* ✅ Top bar: Logo + Back */}
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={() => {
            const state = navigation.getState?.();
            const hasDashboardHere = state?.routeNames?.includes("Dashboard");

            if (hasDashboardHere) {
              navigation.navigate("Dashboard");
              return;
            }

            let parent = navigation.getParent?.();
            while (parent) {
              const ps = parent.getState?.();
              if (ps?.routeNames?.includes("Dashboard")) {
                parent.navigate("Dashboard");
                return;
              }
              parent = parent.getParent?.();
            }

            navigation.goBack();
          }}
          activeOpacity={0.85}
          style={styles.headerLogoBtn}
        >
          <Image source={logo} style={styles.headerLogoImg} />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          activeOpacity={0.8}
        >
          <Text style={styles.backArrow}>←</Text>
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Investment Performance</Text>
            <Text style={styles.headerSubtitle}>
              See P/L per symbol and by currency.
            </Text>
          </View>

          <TouchableOpacity onPress={fetchPerf} style={styles.headerButton}>
            <Text style={styles.headerButtonText}>Refresh</Text>
          </TouchableOpacity>
        </View>

        {lastRefreshed && (
          <Text style={styles.asOf}>As of {fmtDateTime(lastRefreshed)}</Text>
        )}

        {err ? <Text style={styles.errorText}>{err}</Text> : null}

        {/* Live quotes unavailable notice (match web semantics) */}
        {!err && !loading && !anyQuotes && holdings.length > 0 && (
          <View
            style={{
              marginBottom: 10,
              padding: 10,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: "#fbbf24",
              backgroundColor: "#92400e33",
            }}
          >
            <Text style={{ color: "#fbbf24", fontSize: 12 }}>
              Live quotes are disabled or unavailable. Value &amp; P/L shown as
              “—”.
            </Text>
          </View>
        )}

        {/* Totals by currency */}
        <View style={styles.totalsRow}>
          {totalsByCurrency.map((t) => {
            const isUp = (t.plMinor || 0) >= 0;
            return (
              <View key={t.cur} style={styles.totalCard}>
                <Text style={styles.totalLabel}>{t.cur}</Text>

                <Text style={styles.totalMiniLabel}>Value</Text>
                <Text style={styles.totalValue}>
                  {fmtMoneyMinor(t.valueMinor, t.cur)}
                </Text>

                <Text style={styles.totalMiniLabel}>Invested</Text>
                <Text style={styles.totalInvested}>
                  {fmtMoneyMinor(t.costMinor, t.cur)}
                </Text>

                <Text
                  style={[
                    styles.totalPL,
                    isUp ? styles.totalPLPos : styles.totalPLNeg,
                  ]}
                >
                  {fmtMoneyMinor(t.plMinor, t.cur)} ({fmtPct(t.plPct)})
                </Text>
              </View>
            );
          })}
        </View>

        {/* Filters */}
        <View style={styles.filterCard}>
          <Text style={styles.filterTitle}>Filters</Text>

          <Text style={styles.filterLabel}>Search symbol / tags</Text>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="AAPL, BTC-USD, long-term..."
            placeholderTextColor={TEXT_MUTED}
            style={styles.searchInput}
          />

          <Text style={[styles.filterLabel, { marginTop: 10 }]}>Side</Text>
          <View style={styles.chipRow}>
            {["ALL", "long", "short"].map((s) => (
              <TouchableOpacity
                key={s}
                onPress={() => setSideFilter(s)}
                style={[
                  styles.chip,
                  sideFilter === s && {
                    backgroundColor: main,
                    borderColor: secondary,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.chipText,
                    sideFilter === s && { color: "white" },
                  ]}
                >
                  {s === "ALL" ? "All" : s}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.filterLabel, { marginTop: 10 }]}>Currency</Text>
          <View style={styles.chipRow}>
            {currencies.map((c) => (
              <TouchableOpacity
                key={c}
                onPress={() => setCurFilter(c)}
                style={[
                  styles.chip,
                  curFilter === c && {
                    backgroundColor: main,
                    borderColor: secondary,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.chipText,
                    curFilter === c && { color: "white" },
                  ]}
                >
                  {c === "ALL" ? "All" : c}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Quick quote */}
        <View style={styles.quoteCard}>
          <Text style={styles.sectionTitle}>Quick Quote</Text>
          <Text style={styles.sectionSubtitle}>
            Check a symbol&apos;s latest market price.
          </Text>

          <View style={styles.quoteRow}>
            <TextInput
              value={quoteSymbol}
              onChangeText={setQuoteSymbol}
              placeholder="AAPL, BTC-USD..."
              placeholderTextColor={TEXT_MUTED}
              autoCapitalize="characters"
              style={[styles.searchInput, { flex: 1 }]}
            />

            <TouchableOpacity
              onPress={handleQuoteLookup}
              disabled={quoteLoading}
              style={styles.quoteBtn}
            >
              {quoteLoading ? (
                <ActivityIndicator size="small" color="#d1fae5" />
              ) : (
                <Text style={styles.quoteBtnText}>Check</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Minimal hint (the real info is in the popup) */}
          <Text style={{ color: TEXT_MUTED, fontSize: 11 }}>
            Tip: Tap “Check” to open a detailed quote popup.
          </Text>
        </View>

        {/* Holdings / Favorites list */}
        <View style={styles.listCard}>
          <View style={styles.listHeaderRow}>
            <View style={styles.listHeaderLeft}>
              <TouchableOpacity
                onPress={() => setListMode("HOLDINGS")}
                activeOpacity={0.8}
                style={[
                  styles.listHeaderPill,
                  listMode === "HOLDINGS" && styles.listHeaderPillActive,
                ]}
              >
                <Text
                  style={[
                    styles.listHeaderTitle,
                    listMode !== "HOLDINGS" && styles.listHeaderTitleInactive,
                  ]}
                >
                  Holdings ({holdingsFiltered.length})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setListMode("FAVORITES")}
                activeOpacity={0.8}
                style={[
                  styles.listHeaderPill,
                  listMode === "FAVORITES" && styles.listHeaderPillActive,
                ]}
              >
                <Text
                  style={[
                    styles.listHeaderMeta,
                    listMode !== "FAVORITES" && styles.listHeaderMetaInactive,
                  ]}
                >
                  Favorites ({favoritesFiltered.length})
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {listToRender.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>
                {listMode === "FAVORITES" ? "No favorites" : "No positions"}
              </Text>
              <Text style={styles.emptySubtitle}>
                {listMode === "FAVORITES"
                  ? "Add favorites from the Investments screen to see them here."
                  : "Try changing filters or add investments first."}
              </Text>
            </View>
          ) : (
            listToRender.map((h) => (
              <HoldingRow
                key={`${h.symbol || h.assetSymbol}-${h.currency}-${
                  h.side || "long"
                }`}
                h={h}
              />
            ))
          )}
        </View>
      </ScrollView>

      <QuoteModal
        visible={quoteModalOpen}
        onClose={() => setQuoteModalOpen(false)}
        quoteData={quoteData}
      />

      <Toast toast={toast} />
    </SafeAreaView>
  );
}

/* =============================== styles =============================== */
const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: BG_DARK,
  },
  scroll: {
    padding: 16,
    paddingBottom: 80,
  },

  // Top bar (logo + back)
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 6,
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  backArrow: {
    fontSize: 18,
    color: "white",
    marginRight: 6,
  },
  backText: {
    fontSize: 14,
    color: "white",
  },

  // Clickable logo
  headerLogoBtn: {
    width: 34,
    height: 34,
    borderRadius: 999,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: BORDER_DARK,
    backgroundColor: "#020617",
    alignItems: "center",
    justifyContent: "center",
  },
  headerLogoImg: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "white",
  },
  headerSubtitle: {
    fontSize: 13,
    color: TEXT_MUTED,
    marginTop: 2,
  },
  headerButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BORDER_DARK,
    backgroundColor: "#020617",
  },
  headerButtonText: {
    color: TEXT_SOFT,
    fontSize: 12,
    fontWeight: "500",
  },

  asOf: {
    fontSize: 11,
    color: TEXT_MUTED,
    marginBottom: 8,
  },
  loadingText: {
    marginTop: 8,
    textAlign: "center",
    color: TEXT_MUTED,
    fontSize: 13,
  },
  errorText: {
    color: "#fecaca",
    fontSize: 13,
    marginBottom: 8,
  },

  totalsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  totalCard: {
    flexGrow: 1,
    minWidth: 130,
    padding: 10,
    borderRadius: 14,
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: BORDER_DARK,
  },
  totalLabel: {
    fontSize: 11,
    color: TEXT_MUTED,
    marginBottom: 4,
  },
  totalMiniLabel: {
    fontSize: 10,
    color: TEXT_MUTED,
  },
  totalValue: {
    fontSize: 15,
    fontWeight: "700",
    color: TEXT_SOFT,
    marginBottom: 4,
  },
  totalInvested: {
    fontSize: 13,
    color: "#e5e7eb",
    marginBottom: 4,
  },
  totalPL: {
    fontSize: 13,
    fontWeight: "600",
  },
  totalPLPos: {
    color: "#4ade80",
  },
  totalPLNeg: {
    color: "#fb7185",
  },

  filterCard: {
    borderRadius: 16,
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: BORDER_DARK,
    padding: 12,
    marginBottom: 12,
  },
  filterTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: TEXT_SOFT,
    marginBottom: 6,
  },
  filterLabel: {
    fontSize: 11,
    color: TEXT_MUTED,
    marginBottom: 4,
  },
  searchInput: {
    borderWidth: 1,
    borderColor: BORDER_DARK,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: "#020617",
    color: "white",
    fontSize: 13,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BORDER_DARK,
    backgroundColor: "#020617",
  },
  chipText: {
    fontSize: 11,
    color: TEXT_SOFT,
  },

  quoteCard: {
    borderRadius: 16,
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: BORDER_DARK,
    padding: 12,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: TEXT_SOFT,
  },
  sectionSubtitle: {
    fontSize: 11,
    color: TEXT_MUTED,
    marginTop: 2,
    marginBottom: 8,
  },
  quoteRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  quoteBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: main,
  },
  quoteBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: "white",
  },

  listCard: {
    borderRadius: 16,
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: BORDER_DARK,
    marginBottom: 16,
    overflow: "hidden",
  },
  listHeaderRow: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: BORDER_DARK,
  },

  row: {
    flexDirection: "row",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: BORDER_DARK,
  },
  rowLeft: {
    flex: 1,
    paddingRight: 8,
  },
  rowRight: {
    alignItems: "flex-end",
    justifyContent: "center",
  },
  rowTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 2,
  },
  rowSymbol: {
    fontSize: 14,
    fontWeight: "700",
    color: TEXT_SOFT,
    marginRight: 6,
  },
  rowSideBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#4ade80",
    backgroundColor: "#022c2233",
  },
  rowSideText: {
    fontSize: 10,
    color: "#bbf7d0",
    textTransform: "capitalize",
  },
  rowCurrency: {
    fontSize: 11,
    color: TEXT_MUTED,
    marginBottom: 4,
  },
  rowLine: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  rowLabel: {
    fontSize: 11,
    color: TEXT_MUTED,
  },
  rowValue: {
    fontSize: 12,
    color: TEXT_SOFT,
  },
  rowPL: {
    fontSize: 13,
    fontWeight: "700",
  },
  rowDaily: {
    fontSize: 11,
    marginTop: 2,
  },

  emptyState: {
    paddingVertical: 20,
    paddingHorizontal: 12,
    alignItems: "center",
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: TEXT_SOFT,
  },
  emptySubtitle: {
    fontSize: 12,
    color: TEXT_MUTED,
    marginTop: 4,
    textAlign: "center",
  },

  toast: {
    position: "absolute",
    bottom: 16,
    left: 16,
    right: 16,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  toastType: {
    fontSize: 11,
    textTransform: "capitalize",
    color: TEXT_SOFT,
    fontWeight: "600",
  },
  toastMsg: {
    flex: 1,
    fontSize: 12,
    color: TEXT_SOFT,
  },

  listHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  listHeaderPill: {
    paddingVertical: 2,
    paddingHorizontal: 2,
    borderRadius: 999,
  },
  listHeaderPillActive: {
    backgroundColor: "rgba(79,119,45,0.12)",
  },
  listHeaderTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: TEXT_SOFT,
  },
  listHeaderTitleInactive: {
    color: TEXT_MUTED,
    fontWeight: "600",
  },
  listHeaderMeta: {
    fontSize: 14,
    fontWeight: "700",
    color: secondary,
  },
  listHeaderMetaInactive: {
    color: TEXT_MUTED,
    fontWeight: "600",
  },

  /* ------------------ Modal (quote popup) ------------------ */
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    padding: 16,
    justifyContent: "center",
  },
  modalCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BORDER_DARK,
    backgroundColor: "#0b1220",
    padding: 14,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  modalTitle: {
    color: "white",
    fontSize: 16,
    fontWeight: "800",
  },
  modalSubtitle: {
    color: TEXT_MUTED,
    fontSize: 11,
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BORDER_DARK,
    backgroundColor: "#020617",
    alignItems: "center",
    justifyContent: "center",
  },
  modalCloseText: {
    color: TEXT_SOFT,
    fontSize: 14,
    fontWeight: "800",
  },
  modalTopLine: {
    marginBottom: 6,
  },
  modalSymbol: {
    color: TEXT_SOFT,
    fontSize: 18,
    fontWeight: "900",
  },
  modalName: {
    color: TEXT_MUTED,
    fontSize: 12,
    marginTop: 2,
  },
  modalPriceRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 10,
    marginTop: 6,
  },
  modalPrice: {
    color: "white",
    fontSize: 20,
    fontWeight: "900",
  },
  modalChange: {
    color: TEXT_SOFT,
    fontSize: 12,
    fontWeight: "700",
    textAlign: "right",
  },
  modalUpdated: {
    color: TEXT_MUTED,
    fontSize: 11,
    marginTop: 6,
    marginBottom: 10,
  },
  qGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  qStat: {
    width: "48%",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER_DARK,
    backgroundColor: "#020617",
    padding: 10,
  },
  qStatLabel: {
    color: TEXT_MUTED,
    fontSize: 10,
    marginBottom: 4,
  },
  qStatValue: {
    color: TEXT_SOFT,
    fontSize: 12,
    fontWeight: "700",
  },
  modalFooter: {
    marginTop: 12,
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  modalPrimaryBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: main,
  },
  modalPrimaryBtnText: {
    color: "white",
    fontSize: 13,
    fontWeight: "800",
  },
});
