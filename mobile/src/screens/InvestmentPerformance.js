/* eslint-disable no-unused-vars */
/* eslint-disable no-empty */
// mobile/src/screens/InvestmentPerformance.js

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
  FlatList,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";

import api from "../lib/api";
import logo from "../../assets/nummoria_logo.png";

/* ──────────────────────────────────────────────────────────
   THEME — synced with InvestmentScreen / IncomeScreen HUD
────────────────────────────────────────────────────────── */
const BG = "#030508";
const MINT = "#00ff87";
const CYAN = "#00d4ff";
const VIOLET = "#a78bfa";
const ORANGE = "#f97316";
const GOLD = "#fbbf24";

const CARD_BG = "rgba(255,255,255,0.025)";
const CARD_BD = "rgba(255,255,255,0.07)";
const T_HI = "#e2e8f0";
const T_MID = "rgba(226,232,240,0.55)";
const T_DIM = "rgba(226,232,240,0.32)";

const DATE_LANG = "en-US";

/* ──────────────────────────────────────────────────────────
   DATE / MONEY HELPERS
────────────────────────────────────────────────────────── */
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
  if (major === null || major === undefined || Number.isNaN(Number(major))) {
    return "—";
  }

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

function isInvSymbol(sym) {
  const s = String(sym || "")
    .trim()
    .toUpperCase();
  return /^INV(\b|[-_])/i.test(s) || s === "INV";
}

/** Normalize quote payloads */
function normalizeQuote(q) {
  const symbol = q?.symbol || "—";
  const name = q?.shortName || q?.longName || q?.name || "—";

  const currency =
    q?.currency || q?.financialCurrency || q?.priceCurrency || "USD";

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

/* ──────────────────────────────────────────────────────────
   HUD PRIMITIVES
────────────────────────────────────────────────────────── */
function Brackets({ color = MINT, size = 10, thick = 1.5 }) {
  const defs = [
    {
      top: 0,
      left: 0,
      borderTopWidth: thick,
      borderLeftWidth: thick,
      borderTopLeftRadius: 2,
    },
    {
      top: 0,
      right: 0,
      borderTopWidth: thick,
      borderRightWidth: thick,
      borderTopRightRadius: 2,
    },
    {
      bottom: 0,
      left: 0,
      borderBottomWidth: thick,
      borderLeftWidth: thick,
      borderBottomLeftRadius: 2,
    },
    {
      bottom: 0,
      right: 0,
      borderBottomWidth: thick,
      borderRightWidth: thick,
      borderBottomRightRadius: 2,
    },
  ];

  return (
    <>
      {defs.map((d, i) => (
        <View
          key={i}
          style={[
            {
              position: "absolute",
              width: size,
              height: size,
              borderColor: color,
            },
            d,
          ]}
        />
      ))}
    </>
  );
}

function ScanLine({ color = MINT, style: extra }) {
  return (
    <View
      style={[{ flexDirection: "row", alignItems: "center", gap: 6 }, extra]}
    >
      <View
        style={{
          width: 3,
          height: 3,
          borderRadius: 999,
          backgroundColor: color,
          opacity: 0.6,
        }}
      />
      <View
        style={{ flex: 1, height: 1, backgroundColor: color, opacity: 0.2 }}
      />
      <View
        style={{
          width: 3,
          height: 3,
          borderRadius: 999,
          backgroundColor: color,
          opacity: 0.6,
        }}
      />
    </View>
  );
}

function GridBG() {
  const { width, height } = require("react-native").Dimensions.get("window");
  const COLS = 10;
  const ROWS = 22;
  const cw = width / COLS;
  const rh = height / ROWS;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {Array.from({ length: ROWS + 1 }, (_, i) => (
        <View
          key={`h${i}`}
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: i * rh,
            height: 1,
            backgroundColor: "rgba(0,255,135,0.035)",
          }}
        />
      ))}
      {Array.from({ length: COLS + 1 }, (_, i) => (
        <View
          key={`v${i}`}
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: i * cw,
            width: 1,
            backgroundColor: "rgba(0,212,255,0.025)",
          }}
        />
      ))}
      <View
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 2,
          backgroundColor: MINT,
          opacity: 0.15,
        }}
      />
      <View
        style={{
          position: "absolute",
          top: height * 0.44,
          left: 0,
          right: 0,
          height: 1,
          backgroundColor: CYAN,
          opacity: 0.06,
        }}
      />
      <View
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: 1,
          backgroundColor: VIOLET,
          opacity: 0.1,
        }}
      />
    </View>
  );
}

/* ──────────────────────────────────────────────────────────
   CHIP / STAT CARD
────────────────────────────────────────────────────────── */
function Chip({ label, selected, onPress, small, accent = MINT }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        s.chip,
        small && s.chipSmall,
        selected && [s.chipSelected, { borderColor: accent + "55" }],
      ]}
      activeOpacity={0.75}
    >
      {selected && <View style={[s.chipDot, { backgroundColor: accent }]} />}
      <Text
        style={[
          s.chipText,
          small && s.chipTextSmall,
          selected && [s.chipTextSelected, { color: accent }],
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function StatCard({
  title,
  value,
  accent = "neutral",
  chipText = "SNAPSHOT",
  hint = "Updated from filters",
}) {
  const accentMap = {
    market: {
      color: GOLD,
      glow: "rgba(251,191,36,0.08)",
      bd: "rgba(251,191,36,0.22)",
    },
    investment: {
      color: ORANGE,
      glow: "rgba(249,115,22,0.09)",
      bd: "rgba(249,115,22,0.22)",
    },
    neutral: {
      color: CYAN,
      glow: "rgba(0,212,255,0.09)",
      bd: "rgba(0,212,255,0.22)",
    },
    violet: {
      color: VIOLET,
      glow: "rgba(167,139,250,0.10)",
      bd: "rgba(167,139,250,0.22)",
    },
    mint: {
      color: MINT,
      glow: "rgba(0,255,135,0.10)",
      bd: "rgba(0,255,135,0.22)",
    },
  };

  const a = accentMap[accent] || accentMap.neutral;

  return (
    <View style={[s.statCard, { borderColor: a.bd, backgroundColor: a.glow }]}>
      <Brackets color={a.color} size={9} thick={1.5} />
      <View style={[s.statHairline, { backgroundColor: a.color }]} />
      <View style={[s.statBadge, { borderColor: a.bd }]}>
        <View style={[s.statBadgeDot, { backgroundColor: a.color }]} />
        <Text style={[s.statBadgeTxt, { color: a.color }]}>{chipText}</Text>
      </View>
      <Text style={s.statLabel}>{title}</Text>
      <Text style={[s.statValue, { color: a.color }]}>{value}</Text>
      <ScanLine color={a.color} style={{ marginTop: 12 }} />
      <Text style={s.statHint}>{hint}</Text>
    </View>
  );
}

/* ──────────────────────────────────────────────────────────
   QUOTE STAT / HOLDING ROW
────────────────────────────────────────────────────────── */
function QuoteStat({ label, value, valueStyle }) {
  return (
    <View style={s.qStat}>
      <Text style={s.qStatLabel}>{label}</Text>
      <Text style={[s.qStatValue, valueStyle]} numberOfLines={2}>
        {String(value)}
      </Text>
    </View>
  );
}

function HoldingRow({ item }) {
  const symbol = item.symbol || item.assetSymbol || "—";
  const side = item.side || "long";

  const cost = fmtMoneyMinor(item.costMinor, item.currency);
  const value = fmtMoneyMinor(item.valueMinor, item.currency);
  const pl = fmtMoneyMinor(item.plMinor, item.currency);
  const plPct = fmtPct(item.plPct);

  const daily = item.dailyChangeMinor;
  const dailyPct = fmtPct(item.dailyChangePct);

  const isUp = (item.plMinor || 0) >= 0;

  return (
    <View style={s.rowCard}>
      <Brackets color={ORANGE} size={7} thick={1} />
      <View style={s.rowTopLine}>
        <View style={[s.rowCatPill, { borderColor: "rgba(249,115,22,0.22)" }]}>
          <View style={[s.rowCatDot, { backgroundColor: ORANGE }]} />
          <Text style={[s.rowCatTxt, { color: ORANGE }]}>{symbol}</Text>
        </View>

        <View
          style={[
            s.badge,
            side === "short"
              ? {
                  borderColor: "rgba(244,114,182,0.28)",
                  backgroundColor: "rgba(244,114,182,0.10)",
                }
              : {
                  borderColor: "rgba(0,255,135,0.28)",
                  backgroundColor: "rgba(0,255,135,0.10)",
                },
          ]}
        >
          <Text
            style={[s.badgeTxt, { color: side === "short" ? "#fb7185" : MINT }]}
          >
            {side.toUpperCase()}
          </Text>
        </View>

        <Text style={[s.rowAmount, { color: isUp ? MINT : "#fb7185" }]}>
          {pl} <Text style={{ fontSize: 9, opacity: 0.7 }}>({plPct})</Text>
        </Text>
      </View>

      <View style={s.rowAccLine}>
        <View style={s.rowAccPill}>
          <Text style={s.rowAccTxt}>
            {item.currency} •{" "}
            {item.units != null
              ? `${fmtNumber(item.units, 4)} units`
              : "size n/a"}
          </Text>
        </View>
      </View>

      <View style={s.metricGrid}>
        <View style={s.metricCell}>
          <Text style={s.metricLabel}>COST</Text>
          <Text style={s.metricValue}>{cost}</Text>
        </View>
        <View style={s.metricCell}>
          <Text style={s.metricLabel}>VALUE</Text>
          <Text style={s.metricValue}>{value}</Text>
        </View>
      </View>

      {daily != null ? (
        <Text
          style={[
            s.rowTags,
            { color: (item.dailyChangeMinor || 0) >= 0 ? CYAN : VIOLET },
          ]}
        >
          Today: {fmtMoneyMinor(daily, item.currency)} ({dailyPct})
        </Text>
      ) : (
        <Text style={[s.rowTags, { color: T_DIM }]}>
          Live daily move unavailable
        </Text>
      )}
    </View>
  );
}

/* ──────────────────────────────────────────────────────────
   QUOTE MODAL
────────────────────────────────────────────────────────── */
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
      <Pressable style={s.modalOverlay} onPress={onClose}>
        <Pressable style={s.quoteModalCard} onPress={() => {}}>
          <Brackets color={GOLD} size={10} thick={1.5} />
          <View style={[s.modalHairline, { backgroundColor: GOLD }]} />

          <View style={s.sectionHeaderRow}>
            <View>
              <Text style={s.sectionEyebrow}>MARKET QUOTE</Text>
              <Text style={s.sectionTitle}>Quote details</Text>
            </View>
            <TouchableOpacity onPress={onClose}>
              <Text style={[s.sectionClose, { color: T_DIM }]}>CLOSE</Text>
            </TouchableOpacity>
          </View>

          <Text style={s.quoteModalSymbol}>{q.symbol}</Text>
          <Text style={s.quoteModalName} numberOfLines={1}>
            {q.name}
          </Text>

          <View style={s.quoteModalPriceRow}>
            <Text style={s.quoteModalPrice}>
              {fmtMoneyMajor(q.price, q.currency)}
            </Text>
            <Text
              style={[
                s.quoteModalChange,
                isUp ? { color: MINT } : isDown ? { color: "#fb7185" } : null,
              ]}
            >
              {changeStr}
            </Text>
          </View>

          {q.lastUpdated ? (
            <Text style={s.sectionNote}>
              Updated {fmtDateTime(q.lastUpdated)}
            </Text>
          ) : null}

          <ScanLine color={GOLD} style={{ marginTop: 12, marginBottom: 14 }} />

          <View style={s.qGrid}>
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

          <View style={s.modalActions}>
            <TouchableOpacity
              style={[s.modalBtnPrimary, { backgroundColor: GOLD }]}
              onPress={onClose}
            >
              <Text style={[s.modalBtnTxt, { color: BG }]}>CLOSE</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/* ══════════════════════════════════════════════════════════
   SCREEN
══════════════════════════════════════════════════════════ */
export default function InvestmentPerformanceScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const scrollRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [data, setData] = useState({ holdings: [], totals: {} });
  const [lastRefreshed, setLastRefreshed] = useState(null);

  const [search, setSearch] = useState("");
  const [sideFilter, setSideFilter] = useState("ALL");
  const [curFilter, setCurFilter] = useState("ALL");
  const [listMode, setListMode] = useState("HOLDINGS");

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
      setErr(e?.response?.data?.error || e.message || "Failed to load.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPerf();
  }, [fetchPerf]);

  const holdings = useMemo(() => {
    const rows = data?.holdings || [];
    return rows.filter((h) => !isInvSymbol(h.symbol || h.assetSymbol));
  }, [data]);

  const favorites = (route?.params?.favorites || [])
    .map((s) =>
      String(s || "")
        .toUpperCase()
        .trim(),
    )
    .filter(Boolean);

  const favoritesSet = useMemo(() => new Set(favorites), [favorites]);

  const currencies = useMemo(() => {
    const set = new Set(holdings.map((h) => h.currency || "USD"));
    return ["ALL", ...Array.from(set)];
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

    filtered.sort((a, b) => (b.plMinor || 0) - (a.plMinor || 0));
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
    [holdings],
  );

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

  const kpis = useMemo(() => {
    const totalHoldings = listToRender.length;
    const winners = listToRender.filter((h) => (h.plMinor || 0) > 0).length;
    const losers = listToRender.filter((h) => (h.plMinor || 0) < 0).length;
    const priced = listToRender.filter(
      (h) => typeof h.valueMinor === "number",
    ).length;

    return { totalHoldings, winners, losers, priced };
  }, [listToRender]);

  const handleQuoteLookup = async () => {
    const symbol = quoteSymbol.trim().toUpperCase();
    if (!symbol) return;

    try {
      setQuoteLoading(true);
      setQuoteData(null);
      const { data: qd } = await api.get("/investments/quote", {
        params: { symbol },
      });
      setQuoteData(qd || null);
      setQuoteModalOpen(true);
    } catch (e) {
      setErr(e?.response?.data?.error || e.message || "Lookup failed.");
    } finally {
      setQuoteLoading(false);
    }
  };

  function Header() {
    const filterGroups = [
      {
        label: "SIDE",
        small: true,
        chips: [
          {
            key: "ALL",
            label: "All",
            sel: sideFilter === "ALL",
            onPress: () => setSideFilter("ALL"),
            accent: CYAN,
          },
          {
            key: "long",
            label: "Long",
            sel: sideFilter === "long",
            onPress: () => setSideFilter("long"),
            accent: MINT,
          },
          {
            key: "short",
            label: "Short",
            sel: sideFilter === "short",
            onPress: () => setSideFilter("short"),
            accent: VIOLET,
          },
        ],
      },
      {
        label: "CURRENCY",
        small: true,
        chips: currencies.map((c) => ({
          key: c,
          label: c === "ALL" ? "All currencies" : c,
          sel: curFilter === c,
          onPress: () => setCurFilter(c),
          accent: CYAN,
        })),
      },
      {
        label: "VIEW",
        small: true,
        chips: [
          {
            key: "HOLDINGS",
            label: `Holdings (${holdingsFiltered.length})`,
            sel: listMode === "HOLDINGS",
            onPress: () => setListMode("HOLDINGS"),
            accent: ORANGE,
          },
          {
            key: "FAVORITES",
            label: `Favorites (${favoritesFiltered.length})`,
            sel: listMode === "FAVORITES",
            onPress: () => setListMode("FAVORITES"),
            accent: GOLD,
          },
        ],
      },
    ];

    return (
      <View
        style={[
          s.headerCard,
          {
            borderColor: "rgba(251,191,36,0.22)",
            backgroundColor: "rgba(251,191,36,0.04)",
          },
        ]}
      >
        <Brackets color={GOLD} size={12} thick={1.5} />
        <View style={[s.headerHairline, { backgroundColor: GOLD }]} />

        <View style={s.topBar}>
          <View style={s.logoRow}>
            <View style={[s.statusDot, { backgroundColor: GOLD }]} />
            <Text style={s.logoTxt}>MARKET PERFORMANCE</Text>
            <View
              style={[
                s.livePill,
                {
                  borderColor: "rgba(251,191,36,0.25)",
                  backgroundColor: "rgba(251,191,36,0.12)",
                },
              ]}
            >
              <Text style={[s.livePillTxt, { color: GOLD }]}>ANALYTICS</Text>
            </View>
          </View>

          <TouchableOpacity
            onPress={() => navigation.navigate("Dashboard")}
            activeOpacity={0.8}
            style={s.homeBtn}
          >
            <Image source={logo} style={s.homeBtnImg} />
            <Brackets color={GOLD} size={7} thick={1} />
          </TouchableOpacity>
        </View>

        <Text style={s.heroTitle}>Performance{"\n"}Control</Text>
        <Text style={s.heroSub}>
          See current positioning, P/L distribution, and quick market checks for
          your tracked assets.
        </Text>

        <ScanLine color={GOLD} style={{ marginTop: 12, marginBottom: 14 }} />

        <View style={s.controlsRow}>
          <TouchableOpacity
            style={[s.ctrlPill, { borderColor: "rgba(0,212,255,0.22)" }]}
            onPress={fetchPerf}
            activeOpacity={0.75}
          >
            <View style={[s.ctrlDot, { backgroundColor: CYAN }]} />
            <Text style={[s.ctrlTxt, { color: CYAN }]}>REFRESH</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.ctrlPill, { borderColor: "rgba(251,191,36,0.25)" }]}
            onPress={() => {
              requestAnimationFrame(() =>
                scrollRef.current?.scrollTo({ y: 620, animated: true }),
              );
            }}
            activeOpacity={0.75}
          >
            <View style={[s.ctrlDot, { backgroundColor: GOLD }]} />
            <Text style={[s.ctrlTxt, { color: GOLD }]}>QUOTE LOOKUP</Text>
          </TouchableOpacity>
        </View>

        {!!lastRefreshed && (
          <Text style={s.sectionNote}>As of {fmtDateTime(lastRefreshed)}</Text>
        )}

        <View style={s.searchWrap}>
          <View style={[s.searchDot, { backgroundColor: GOLD }]} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search symbol or tags"
            placeholderTextColor={T_DIM}
            style={s.searchInput}
          />
        </View>

        {filterGroups.map((g) => (
          <View key={g.label} style={{ marginBottom: 2 }}>
            <Text style={s.filterGroupLabel}>{g.label}</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.chipScroll}
              keyboardShouldPersistTaps="handled"
            >
              {g.chips.map((c) => (
                <Chip
                  key={c.key}
                  label={c.label}
                  selected={c.sel}
                  onPress={c.onPress}
                  small={g.small}
                  accent={c.accent}
                />
              ))}
            </ScrollView>
          </View>
        ))}
      </View>
    );
  }

  function Insights() {
    const firstCurrency = totalsByCurrency[0]?.cur || "USD";
    const totalValueMinor = totalsByCurrency.reduce(
      (acc, t) => acc + Number(t.valueMinor || 0),
      0,
    );
    const totalCostMinor = totalsByCurrency.reduce(
      (acc, t) => acc + Number(t.costMinor || 0),
      0,
    );
    const totalPlMinor = totalsByCurrency.reduce(
      (acc, t) => acc + Number(t.plMinor || 0),
      0,
    );

    return (
      <View style={s.sectionCard}>
        <Brackets color={CYAN} size={10} thick={1} />
        <View style={[s.sectionHairline, { backgroundColor: CYAN }]} />
        <View style={s.sectionHeaderRow}>
          <View>
            <Text style={s.sectionEyebrow}>PORTFOLIO KPIs</Text>
            <Text style={s.sectionTitle}>Insights</Text>
          </View>
          <View
            style={[s.currencyPill, { borderColor: "rgba(0,212,255,0.22)" }]}
          >
            <View style={[s.ctrlDot, { backgroundColor: CYAN }]} />
            <Text style={[s.currencyPillTxt, { color: CYAN }]}>{listMode}</Text>
          </View>
        </View>

        <View style={{ marginBottom: 10 }}>
          <StatCard
            title="Open Positions"
            value={String(kpis.totalHoldings)}
            accent="neutral"
            chipText="COUNT"
          />
          <StatCard
            title="Winners"
            value={String(kpis.winners)}
            accent="mint"
            chipText="POSITIVE"
          />
          <StatCard
            title="Losers"
            value={String(kpis.losers)}
            accent="violet"
            chipText="NEGATIVE"
          />
          <StatCard
            title="Priced Assets"
            value={String(kpis.priced)}
            accent="market"
            chipText="LIVE DATA"
          />
        </View>

        <View style={s.chartBlock}>
          <View style={s.chartHeaderRow}>
            <View style={[s.ctrlDot, { backgroundColor: ORANGE }]} />
            <Text style={[s.chartTitle, { color: ORANGE }]}>
              AGGREGATE SNAPSHOT
            </Text>
          </View>

          <View style={s.metricGridBig}>
            <View style={s.metricCellBig}>
              <Text style={s.metricLabel}>VALUE</Text>
              <Text style={s.metricValueBig}>
                {fmtMoneyMinor(totalValueMinor, firstCurrency)}
              </Text>
            </View>
            <View style={s.metricCellBig}>
              <Text style={s.metricLabel}>INVESTED</Text>
              <Text style={s.metricValueBig}>
                {fmtMoneyMinor(totalCostMinor, firstCurrency)}
              </Text>
            </View>
            <View style={s.metricCellBig}>
              <Text style={s.metricLabel}>P/L</Text>
              <Text
                style={[
                  s.metricValueBig,
                  { color: totalPlMinor >= 0 ? MINT : "#fb7185" },
                ]}
              >
                {fmtMoneyMinor(totalPlMinor, firstCurrency)}
              </Text>
            </View>
          </View>
        </View>

        {!err && !loading && !anyQuotes && holdings.length > 0 && (
          <View style={s.chartBlock}>
            <View style={s.chartHeaderRow}>
              <View style={[s.ctrlDot, { backgroundColor: GOLD }]} />
              <Text style={[s.chartTitle, { color: GOLD }]}>
                LIVE DATA STATUS
              </Text>
            </View>
            <Text style={s.chartEmpty}>
              Live quotes are disabled or unavailable. Value and P/L may show as
              “—”.
            </Text>
          </View>
        )}

        <View style={s.totalWrap}>
          {totalsByCurrency.map((t) => (
            <View
              key={t.cur}
              style={[s.totalPill, { borderColor: "rgba(0,212,255,0.22)" }]}
            >
              <View style={[s.ctrlDot, { backgroundColor: CYAN }]} />
              <Text style={[s.totalPillTxt, { color: CYAN }]}>
                {t.cur}: {fmtMoneyMinor(t.valueMinor, t.cur)}
              </Text>
            </View>
          ))}
        </View>
      </View>
    );
  }

  function QuoteLookup() {
    return (
      <View style={s.sectionCard}>
        <Brackets color={GOLD} size={10} thick={1} />
        <View style={[s.sectionHairline, { backgroundColor: GOLD }]} />
        <View style={s.sectionHeaderRow}>
          <View>
            <Text style={s.sectionEyebrow}>MARKET ACCESS</Text>
            <Text style={s.sectionTitle}>Quick quote</Text>
          </View>
        </View>

        <Text style={s.sectionNote}>
          Check a symbol’s latest market data and open a detailed quote panel.
        </Text>

        <View style={s.searchWrap}>
          <View style={[s.searchDot, { backgroundColor: GOLD }]} />
          <TextInput
            value={quoteSymbol}
            onChangeText={setQuoteSymbol}
            placeholder="AAPL, BTC-USD..."
            placeholderTextColor={T_DIM}
            autoCapitalize="characters"
            style={s.searchInput}
          />
        </View>

        <View style={s.modalActions}>
          <TouchableOpacity
            style={[
              s.modalBtnPrimary,
              { backgroundColor: GOLD, opacity: quoteLoading ? 0.75 : 1 },
            ]}
            onPress={handleQuoteLookup}
            disabled={quoteLoading}
          >
            {quoteLoading ? (
              <ActivityIndicator size="small" color={BG} />
            ) : (
              <Text style={[s.modalBtnTxt, { color: BG }]}>CHECK</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={s.loadingScreen}>
        <GridBG />
        <View style={s.loadingInner}>
          <View
            style={{
              width: 70,
              height: 70,
              alignItems: "center",
              justifyContent: "center",
              position: "relative",
              marginBottom: 16,
            }}
          >
            <Brackets color={GOLD} size={20} thick={2} />
            <ActivityIndicator size="large" color={GOLD} />
          </View>
          <Text style={s.loadingTitle}>PERFORMANCE</Text>
          <Text style={s.loadingMono}>Crunching portfolio analytics…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.screen}>
      <GridBG />

      <ScrollView
        ref={scrollRef}
        style={s.content}
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {Header()}

        {!!err && (
          <View
            style={[
              s.errorCard,
              {
                backgroundColor: "rgba(167,139,250,0.06)",
                borderColor: "rgba(167,139,250,0.22)",
              },
            ]}
          >
            <Brackets color={VIOLET} size={8} thick={1} />
            <View style={s.errorIconBox}>
              <Text style={[s.errorIconTxt, { color: VIOLET }]}>!</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.errorTitle}>Performance data failed</Text>
              <Text style={s.errorBody}>{err}</Text>
            </View>
          </View>
        )}

        {Insights()}
        {QuoteLookup()}

        <View style={s.sectionCard}>
          <Brackets color={ORANGE} size={10} thick={1} />
          <View style={[s.sectionHairline, { backgroundColor: ORANGE }]} />
          <View style={s.sectionHeaderRow}>
            <View>
              <Text style={s.sectionEyebrow}>POSITION FEED</Text>
              <Text style={s.sectionTitle}>
                {listMode === "FAVORITES"
                  ? "Favorite holdings"
                  : "All holdings"}
              </Text>
            </View>
            <View
              style={[s.currencyPill, { borderColor: "rgba(249,115,22,0.22)" }]}
            >
              <View style={[s.ctrlDot, { backgroundColor: ORANGE }]} />
              <Text style={[s.currencyPillTxt, { color: ORANGE }]}>
                {listToRender.length} rows
              </Text>
            </View>
          </View>

          {listToRender.length === 0 ? (
            <Text style={s.emptyText}>
              {listMode === "FAVORITES"
                ? "No favorite positions found."
                : "No positions found. Adjust filters or add investments first."}
            </Text>
          ) : (
            <FlatList
              data={listToRender}
              keyExtractor={(item, index) =>
                `${item.symbol || item.assetSymbol}-${item.currency}-${item.side || "long"}-${index}`
              }
              renderItem={({ item }) => <HoldingRow item={item} />}
              scrollEnabled={false}
            />
          )}
        </View>
      </ScrollView>

      <View style={s.fabWrap}>
        <TouchableOpacity
          style={[
            s.fabAuto,
            {
              backgroundColor: "rgba(0,212,255,0.10)",
              borderColor: "rgba(0,212,255,0.30)",
            },
          ]}
          onPress={fetchPerf}
          activeOpacity={0.8}
        >
          <Brackets color={CYAN} size={8} thick={1} />
          <Text style={[s.fabTxt, { color: CYAN }]}>SYNC</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            s.fabAdd,
            {
              backgroundColor: GOLD,
              width: 54,
              height: 54,
            },
          ]}
          onPress={() => navigation.goBack()}
          activeOpacity={0.8}
        >
          <Brackets color={BG} size={8} thick={1} />
          <Text style={[s.fabAddTxt, { fontSize: 18 }]}>←</Text>
        </TouchableOpacity>
      </View>

      <QuoteModal
        visible={quoteModalOpen}
        onClose={() => setQuoteModalOpen(false)}
        quoteData={quoteData}
      />
    </SafeAreaView>
  );
}

/* ══════════════════════════════════════════════════════════
   STYLES
══════════════════════════════════════════════════════════ */
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },
  content: { flex: 1 },

  loadingScreen: {
    flex: 1,
    backgroundColor: BG,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingInner: { alignItems: "center", position: "relative", padding: 30 },
  loadingTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: T_HI,
    letterSpacing: 4,
    marginBottom: 6,
  },
  loadingMono: { fontSize: 10, color: T_DIM, letterSpacing: 1.5 },

  headerCard: {
    margin: 12,
    padding: 16,
    borderRadius: 4,
    borderWidth: 1,
    overflow: "hidden",
    position: "relative",
  },
  headerHairline: {
    position: "absolute",
    top: 0,
    left: "10%",
    right: "10%",
    height: 1.5,
    opacity: 0.65,
  },

  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  logoRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  statusDot: { width: 6, height: 6, borderRadius: 999 },
  logoTxt: { fontSize: 13, fontWeight: "800", color: T_HI, letterSpacing: 3 },
  livePill: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 2,
    borderWidth: 1,
  },
  livePillTxt: { fontSize: 8, fontWeight: "800", letterSpacing: 1.5 },
  homeBtn: {
    width: 36,
    height: 36,
    borderRadius: 2,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(251,191,36,0.20)",
    backgroundColor: "rgba(255,255,255,0.04)",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  homeBtnImg: { width: "100%", height: "100%", resizeMode: "cover" },

  heroTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: T_HI,
    letterSpacing: -0.6,
    lineHeight: 32,
    marginBottom: 6,
  },
  heroSub: { fontSize: 13, color: T_MID, lineHeight: 18 },

  controlsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
    flexWrap: "wrap",
  },
  ctrlPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 2,
    borderWidth: 1,
    backgroundColor: "rgba(255,255,255,0.025)",
  },
  ctrlDot: { width: 5, height: 5, borderRadius: 999 },
  ctrlTxt: { fontSize: 9, fontWeight: "800", letterSpacing: 1.2 },

  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: CARD_BD,
    borderRadius: 2,
    paddingHorizontal: 10,
    paddingVertical: 2,
    backgroundColor: "rgba(255,255,255,0.025)",
    marginBottom: 10,
  },
  searchDot: {
    width: 5,
    height: 5,
    borderRadius: 999,
    marginRight: 8,
    opacity: 0.7,
  },
  searchInput: { flex: 1, fontSize: 13, color: T_HI, paddingVertical: 10 },

  filterGroupLabel: {
    fontSize: 8,
    fontWeight: "800",
    color: T_DIM,
    letterSpacing: 2,
    marginBottom: 3,
    marginTop: 8,
  },
  chipScroll: { paddingBottom: 6, paddingRight: 8 },

  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: CARD_BD,
    backgroundColor: "rgba(255,255,255,0.025)",
    marginRight: 6,
  },
  chipSmall: { paddingHorizontal: 8, paddingVertical: 5 },
  chipSelected: { backgroundColor: "rgba(255,255,255,0.04)" },
  chipDot: { width: 4, height: 4, borderRadius: 999 },
  chipText: { fontSize: 11, color: T_DIM },
  chipTextSmall: { fontSize: 10 },
  chipTextSelected: { fontWeight: "700" },

  sectionCard: {
    margin: 12,
    marginTop: 10,
    padding: 16,
    borderRadius: 4,
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: CARD_BD,
    overflow: "hidden",
    position: "relative",
  },
  sectionHairline: {
    position: "absolute",
    top: 0,
    left: "10%",
    right: "10%",
    height: 1.5,
    opacity: 0.65,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  sectionEyebrow: {
    fontSize: 8,
    fontWeight: "800",
    color: T_DIM,
    letterSpacing: 2,
    marginBottom: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: T_HI,
    letterSpacing: -0.3,
  },
  sectionClose: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.5,
    marginTop: 2,
  },
  sectionNote: {
    marginTop: -4,
    marginBottom: 12,
    fontSize: 11,
    color: T_MID,
    lineHeight: 17,
  },

  currencyPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 2,
    borderWidth: 1,
    backgroundColor: "rgba(255,255,255,0.025)",
  },
  currencyPillTxt: { fontSize: 9, fontWeight: "800", letterSpacing: 1 },

  statCard: {
    position: "relative",
    borderRadius: 4,
    borderWidth: 1,
    padding: 16,
    marginBottom: 9,
    overflow: "hidden",
  },
  statHairline: {
    position: "absolute",
    top: 0,
    left: "10%",
    right: "10%",
    height: 1.5,
    opacity: 0.65,
  },
  statBadge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 2,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 10,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  statBadgeDot: { width: 5, height: 5, borderRadius: 999 },
  statBadgeTxt: { fontSize: 8, fontWeight: "800", letterSpacing: 1.4 },
  statLabel: {
    fontSize: 9,
    textTransform: "uppercase",
    letterSpacing: 1.2,
    color: T_DIM,
    marginBottom: 4,
  },
  statValue: { fontSize: 28, fontWeight: "700", letterSpacing: -0.8 },
  statHint: { fontSize: 9, color: T_DIM, marginTop: 5, letterSpacing: 0.3 },

  chartBlock: {
    marginTop: 12,
    padding: 12,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.02)",
    borderWidth: 1,
    borderColor: CARD_BD,
  },
  chartHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 10,
  },
  chartTitle: { fontSize: 9, fontWeight: "800", letterSpacing: 2 },
  chartEmpty: { fontSize: 11, color: T_DIM },

  totalWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  totalPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 2,
    borderWidth: 1,
    backgroundColor: "rgba(255,255,255,0.025)",
  },
  totalPillTxt: { fontSize: 11, fontWeight: "700" },

  rowCard: {
    position: "relative",
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.04)",
    marginBottom: 2,
  },
  rowTopLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
    flexWrap: "wrap",
  },
  rowCatPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    borderRadius: 2,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  rowCatDot: { width: 5, height: 5, borderRadius: 999 },
  rowCatTxt: { fontSize: 9, fontWeight: "800", letterSpacing: 0.8 },

  badge: {
    borderWidth: 1,
    borderRadius: 2,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  badgeTxt: { fontSize: 8, fontWeight: "800", letterSpacing: 1.2 },

  rowAmount: {
    marginLeft: "auto",
    fontSize: 15,
    fontWeight: "800",
  },
  rowAccLine: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
    flexWrap: "wrap",
  },
  rowAccPill: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: CARD_BD,
    borderRadius: 2,
    paddingHorizontal: 7,
    paddingVertical: 3,
    backgroundColor: "rgba(255,255,255,0.025)",
  },
  rowAccTxt: { fontSize: 9, color: T_DIM, letterSpacing: 0.3 },
  rowTags: { fontSize: 10, marginTop: 8, letterSpacing: 0.5 },

  metricGrid: {
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
  },
  metricCell: {
    flex: 1,
    borderWidth: 1,
    borderColor: CARD_BD,
    backgroundColor: "rgba(255,255,255,0.02)",
    borderRadius: 2,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  metricGridBig: {
    gap: 8,
  },
  metricCellBig: {
    borderWidth: 1,
    borderColor: CARD_BD,
    backgroundColor: "rgba(255,255,255,0.02)",
    borderRadius: 2,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 8,
  },
  metricLabel: {
    fontSize: 8,
    fontWeight: "800",
    color: T_DIM,
    letterSpacing: 2,
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 12,
    color: T_HI,
    fontWeight: "700",
  },
  metricValueBig: {
    fontSize: 18,
    color: T_HI,
    fontWeight: "800",
  },

  emptyText: {
    paddingVertical: 12,
    fontSize: 12,
    color: T_DIM,
    textAlign: "center",
    letterSpacing: 0.5,
  },

  errorCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    borderRadius: 4,
    padding: 14,
    margin: 12,
    marginTop: 8,
    borderWidth: 1,
    position: "relative",
    overflow: "hidden",
  },
  errorIconBox: {
    width: 36,
    height: 36,
    borderRadius: 2,
    backgroundColor: "rgba(167,139,250,0.18)",
    borderWidth: 1,
    borderColor: "rgba(167,139,250,0.28)",
    alignItems: "center",
    justifyContent: "center",
  },
  errorIconTxt: { fontSize: 16, fontWeight: "800" },
  errorTitle: { fontSize: 12, fontWeight: "700", color: T_HI, marginBottom: 3 },
  errorBody: { fontSize: 12, color: T_MID, lineHeight: 17 },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(3,5,8,0.92)",
    padding: 16,
    justifyContent: "center",
  },
  quoteModalCard: {
    borderRadius: 4,
    borderWidth: 1,
    borderColor: CARD_BD,
    backgroundColor: BG,
    padding: 18,
    position: "relative",
    overflow: "hidden",
  },
  modalHairline: {
    position: "absolute",
    top: 0,
    left: "10%",
    right: "10%",
    height: 1.5,
    opacity: 0.65,
  },
  quoteModalSymbol: {
    color: T_HI,
    fontSize: 24,
    fontWeight: "900",
    marginBottom: 4,
  },
  quoteModalName: {
    color: T_MID,
    fontSize: 12,
    marginBottom: 8,
  },
  quoteModalPriceRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 6,
  },
  quoteModalPrice: {
    color: T_HI,
    fontSize: 22,
    fontWeight: "900",
  },
  quoteModalChange: {
    fontSize: 12,
    fontWeight: "700",
    textAlign: "right",
  },

  qGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  qStat: {
    width: "48%",
    borderRadius: 2,
    borderWidth: 1,
    borderColor: CARD_BD,
    backgroundColor: "rgba(255,255,255,0.02)",
    padding: 10,
  },
  qStatLabel: {
    color: T_DIM,
    fontSize: 10,
    marginBottom: 4,
    letterSpacing: 1.2,
  },
  qStatValue: {
    color: T_HI,
    fontSize: 12,
    fontWeight: "700",
  },

  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
    marginTop: 14,
  },
  modalBtnPrimary: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 2,
  },
  modalBtnTxt: { fontSize: 9, fontWeight: "800", letterSpacing: 1 },

  fabWrap: {
    position: "absolute",
    right: 16,
    bottom: 24,
    alignItems: "flex-end",
    gap: 10,
  },
  fabAuto: {
    width: 52,
    height: 52,
    borderRadius: 2,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    position: "relative",
  },
  fabTxt: { fontSize: 9, fontWeight: "800", letterSpacing: 1 },
  fabAdd: {
    width: 54,
    height: 54,
    borderRadius: 2,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  fabAddTxt: { fontSize: 26, lineHeight: 28, color: BG, fontWeight: "800" },
});
