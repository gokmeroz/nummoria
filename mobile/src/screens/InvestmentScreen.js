// mobile/src/screens/InvestmentScreen.js
/* eslint-disable no-unused-vars */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useRef,
} from "react";

import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Modal,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Image,
  Animated,
  Easing,
} from "react-native";

import { useNavigation } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";

import api from "../lib/api";
import logo from "../../assets/nummoria_logo.png";

/* ─────────────────────────────────────────────────────────────
   CONSTANTS & THEME
───────────────────────────────────────────────────────────── */
const BG = "#030508";
const MINT = "#00ff87";
const CYAN = "#00d4ff";
const VIOLET = "#a78bfa";
const ORANGE = "#f97316";
const GOLD = "#fbbf24";
const NEON_PALETTE = [ORANGE, GOLD, CYAN, VIOLET, MINT, "#ff007c"];

const CARD_BG = "rgba(255,255,255,0.025)";
const CARD_BD = "rgba(255,255,255,0.07)";
const T_HI = "#e2e8f0";
const T_MID = "rgba(226,232,240,0.55)";
const T_DIM = "rgba(226,232,240,0.32)";
const DATE_LANG = "en-US";

const FAVORITES_KEY = "@nummoria:favoritesSymbols";

/* ─────────────────────────────────────────────────────────────
   DATE HELPERS
───────────────────────────────────────────────────────────── */
function startOfUTC(dateLike) {
  const d = new Date(dateLike);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}
function startOfMonthUTC(dateLike) {
  const d = new Date(dateLike);
  return startOfUTC(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)));
}
function endOfMonthUTC(dateLike) {
  const d = new Date(dateLike);
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0, 23, 59, 59, 999),
  );
}
function addMonthsUTC(dateLike, n) {
  const d = new Date(dateLike);
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, d.getUTCDate()),
  );
}
function startOfYearUTC(dateLike) {
  const d = new Date(dateLike);
  return startOfUTC(new Date(Date.UTC(d.getUTCFullYear(), 0, 1)));
}
function endOfYearUTC(dateLike) {
  const d = new Date(dateLike);
  return new Date(Date.UTC(d.getUTCFullYear(), 11, 31, 23, 59, 59, 999));
}
function fmtDateUTC(dateLike) {
  const d = new Date(dateLike);
  return d.toLocaleDateString(DATE_LANG, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

/* ─────────────────────────────────────────────────────────────
   MONEY HELPERS
───────────────────────────────────────────────────────────── */
function decimalsForCurrency(code) {
  if (new Set(["JPY", "KRW", "CLP", "VND"]).has(code)) return 0;
  if (new Set(["BHD", "IQD", "JOD", "KWD", "OMR", "TND"]).has(code)) return 3;
  return 2;
}
function majorToMinor(amountStr, currency) {
  const dec = decimalsForCurrency(currency);
  const n = Number(String(amountStr).replace(",", "."));
  if (Number.isNaN(n)) return NaN;
  return Math.round(n * Math.pow(10, dec));
}
function minorToMajor(minor, currency) {
  const dec = decimalsForCurrency(currency);
  return (Number(minor || 0) / Math.pow(10, dec)).toFixed(dec);
}
const fmtMoney = (minor, cur = "USD") =>
  new Intl.NumberFormat(DATE_LANG, {
    style: "currency",
    currency: cur || "USD",
  }).format((minor || 0) / Math.pow(10, decimalsForCurrency(cur || "USD")));

/* ─────────────────────────────────────────────────────────────
   CATEGORY HELPERS
───────────────────────────────────────────────────────────── */
function normalizeValue(v) {
  return String(v || "")
    .trim()
    .toLowerCase();
}

function looksLikeInvestmentCategory(category) {
  const kind = normalizeValue(category?.kind);
  const type = normalizeValue(category?.type);
  const categoryType = normalizeValue(category?.categoryType);
  const direction = normalizeValue(category?.direction);
  const transactionType = normalizeValue(category?.transactionType);

  if (
    kind === "investment" ||
    type === "investment" ||
    categoryType === "investment" ||
    direction === "investment" ||
    transactionType === "investment"
  ) {
    return true;
  }
  return false;
}

function getInvestmentCategories(rawCategories) {
  return (rawCategories || []).filter(
    (c) => !c?.isDeleted && looksLikeInvestmentCategory(c),
  );
}

function isStockOrCryptoCategoryName(name) {
  return (
    String(name || "").trim() === "Stock Market" ||
    String(name || "").trim() === "Crypto Currency Exchange"
  );
}

/* ─────────────────────────────────────────────────────────────
   HUD PRIMITIVES & COMPONENTS
───────────────────────────────────────────────────────────── */
function Brackets({ color = ORANGE, size = 10, thick = 1.5 }) {
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
              shadowColor: color,
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.5,
              shadowRadius: 3,
            },
            d,
          ]}
        />
      ))}
    </>
  );
}

function HoloCard({
  title,
  subtitle,
  right,
  children,
  accent = "orange",
  containerStyle,
}) {
  const AC = {
    violet: {
      col: VIOLET,
      from: "rgba(167,139,250,0.08)",
      to: "rgba(167,139,250,0.01)",
    },
    cyan: {
      col: CYAN,
      from: "rgba(0,212,255,0.08)",
      to: "rgba(0,212,255,0.01)",
    },
    mint: {
      col: MINT,
      from: "rgba(0,255,135,0.08)",
      to: "rgba(0,255,135,0.01)",
    },
    orange: {
      col: ORANGE,
      from: "rgba(249,115,22,0.08)",
      to: "rgba(249,115,22,0.01)",
    },
    gold: {
      col: GOLD,
      from: "rgba(251,191,36,0.08)",
      to: "rgba(251,191,36,0.01)",
    },
  }[accent] || {
    col: ORANGE,
    from: "rgba(249,115,22,0.08)",
    to: "rgba(249,115,22,0.01)",
  };

  return (
    <LinearGradient
      colors={[AC.from, AC.to]}
      style={[s.holoCard, containerStyle]}
    >
      <Brackets color={AC.col} size={12} thick={1.5} />
      <View
        style={[
          s.sectionHairline,
          {
            backgroundColor: AC.col,
            shadowColor: AC.col,
            shadowOpacity: 0.8,
            shadowRadius: 4,
          },
        ]}
      />
      {(title || right) && (
        <View style={s.sectionHeaderRow}>
          <View style={{ flex: 1 }}>
            {title && <Text style={s.sectionTitle}>{title}</Text>}
            {subtitle && <Text style={s.sectionSubtitle}>{subtitle}</Text>}
          </View>
          {right && <View style={{ marginLeft: 8 }}>{right}</View>}
        </View>
      )}
      {children}
    </LinearGradient>
  );
}

function PulseButton({ onPress, color = ORANGE, icon }) {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.15,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, [pulseAnim]);

  return (
    <TouchableOpacity
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onPress();
      }}
      activeOpacity={0.8}
      style={s.pulseWrap}
    >
      <Animated.View
        style={[
          s.pulseRing,
          {
            borderColor: color,
            transform: [{ scale: pulseAnim }],
            opacity: pulseAnim.interpolate({
              inputRange: [1, 1.15],
              outputRange: [0.6, 0],
            }),
          },
        ]}
      />
      <LinearGradient
        colors={[`${color}99`, `${color}33`]}
        style={[s.fabCore, { borderColor: color }]}
      >
        <Text style={s.fabIcon}>{icon}</Text>
      </LinearGradient>
    </TouchableOpacity>
  );
}

function ScanLine({ color = ORANGE, style: extra }) {
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
  const { width, height } = Dimensions.get("window");
  const COLS = 10,
    ROWS = 22,
    cw = width / COLS,
    rh = height / ROWS;
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
            backgroundColor: "rgba(249,115,22,0.035)",
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
          backgroundColor: ORANGE,
          opacity: 0.15,
        }}
      />
      <View
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: 1,
          backgroundColor: GOLD,
          opacity: 0.1,
        }}
      />
    </View>
  );
}

function Chip({ label, selected, onPress, small, accent = ORANGE }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        s.chip,
        small && s.chipSmall,
        selected && [s.chipSelected, { borderColor: `${accent}55` }],
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
        numberOfLines={1}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function MetricCard({ label, value, accent = "cyan" }) {
  const color =
    { violet: VIOLET, cyan: CYAN, orange: ORANGE, gold: GOLD }[accent] || CYAN;
  const bd = {
    violet: "rgba(167,139,250,0.22)",
    cyan: "rgba(0,212,255,0.22)",
    orange: "rgba(249,115,22,0.22)",
    gold: "rgba(251,191,36,0.22)",
  }[accent];
  const bg = {
    violet: "rgba(167,139,250,0.04)",
    cyan: "rgba(0,212,255,0.04)",
    orange: "rgba(249,115,22,0.04)",
    gold: "rgba(251,191,36,0.04)",
  }[accent];
  return (
    <View style={[s.metricCard, { borderColor: bd, backgroundColor: bg }]}>
      <Brackets color={color} size={6} thick={1} />
      <Text style={s.metricLabel}>{label}</Text>
      <Text style={[s.metricValue, { color }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function CurrencyPill({ currencies, value, onChange, accent = CYAN }) {
  if (!currencies || currencies.length <= 1) {
    return (
      <View style={[s.currPill, { borderColor: `${accent}44` }]}>
        <View style={[s.currPillDot, { backgroundColor: accent }]} />
        <Text style={[s.currPillTxt, { color: accent }]}>
          {value || currencies?.[0] || "USD"}
        </Text>
      </View>
    );
  }
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 4 }}
    >
      {currencies.map((c) => (
        <TouchableOpacity
          key={c}
          onPress={() => onChange(c)}
          style={[
            s.currPill,
            {
              borderColor: c === value ? `${accent}88` : `${accent}22`,
              backgroundColor: c === value ? `${accent}14` : "transparent",
            },
          ]}
          activeOpacity={0.75}
        >
          {c === value && (
            <View style={[s.currPillDot, { backgroundColor: accent }]} />
          )}
          <Text
            style={[s.currPillTxt, { color: c === value ? accent : T_DIM }]}
          >
            {c}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

function BarChart({ data, currency }) {
  if (!data || data.length === 0) {
    return <Text style={s.chartEmpty}>No data matching filter.</Text>;
  }
  const maxMinor = Math.max(...data.map((d) => d.minor), 1);
  return (
    <View style={s.barChartWrap}>
      {data.map((item, i) => {
        const pct = item.minor / maxMinor;
        return (
          <View key={i} style={s.barRow}>
            <Text style={s.barLabel} numberOfLines={1}>
              {item.name}
            </Text>
            <View style={s.barTrackWrap}>
              <View style={s.barTrack}>
                <View
                  style={[
                    s.barFill,
                    {
                      width: `${Math.max(pct * 100, 2)}%`,
                      backgroundColor: ORANGE,
                      opacity: 0.4 + pct * 0.6,
                    },
                  ]}
                />
              </View>
            </View>
            <Text style={s.barValue} numberOfLines={1}>
              {fmtMoney(item.minor, currency)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function SparklineChart({ data }) {
  if (!data || !data.points || data.points.length === 0 || data.max <= 0) {
    return <Text style={s.chartEmpty}>No recent data.</Text>;
  }
  return (
    <View style={s.sparklineRow}>
      {data.points.map((p) => {
        const ratio = data.max ? p.value / data.max : 0;
        const barH = 8 + ratio * 34;
        return (
          <View key={p.label} style={s.sparkCol}>
            <View style={s.sparkBarTrack}>
              <View
                style={[
                  s.sparkBarFill,
                  {
                    height: barH,
                    marginTop: 42 - barH,
                    backgroundColor: CYAN,
                  },
                ]}
              />
            </View>
            <Text style={s.sparkLabel}>{p.label}</Text>
          </View>
        );
      })}
    </View>
  );
}

function CyberNode({ label, selected, onPress, accent }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={[
        s.cNode,
        selected && { borderColor: accent, backgroundColor: `${accent}15` },
      ]}
    >
      {selected && <View style={[s.cNodeGlow, { backgroundColor: accent }]} />}
      <Text
        style={[s.cNodeTxt, selected && { color: accent, fontWeight: "800" }]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function FilterDataRow({ label, val, set, opts, accent }) {
  return (
    <View style={s.cRowWrap}>
      <Text style={s.cRowLabel}>{label}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={s.cRowScroll}
        keyboardShouldPersistTaps="handled"
      >
        {opts.map((o) => (
          <CyberNode
            key={o._id}
            label={o.label}
            selected={val === o._id}
            onPress={() => set(o._id)}
            accent={accent}
          />
        ))}
      </ScrollView>
    </View>
  );
}

/* ─────────────────────────────────────────────────────────────
   MAIN SCREEN
───────────────────────────────────────────────────────────── */
export default function InvestmentScreen({ route }) {
  const navigation = useNavigation();
  const scrollRef = useRef(null);
  const accountId = route?.params?.accountId;

  /* ── data ── */
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [favoriteSymbols, setFavoriteSymbols] = useState(new Set());
  const [initialDone, setInitialDone] = useState(false);
  const [err, setErr] = useState("");

  /* ── filters ── */
  const [q, setQ] = useState("");
  const [fAccountId, setFAccountId] = useState("ALL");
  const [fCategoryId, setFCategoryId] = useState("ALL");
  const [fCurrency, setFCurrency] = useState("ALL");
  const [fTag, setFTag] = useState("ALL");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [minDate, setMinDate] = useState("");
  const [maxDate, setMaxDate] = useState("");
  const [sortKey, setSortKey] = useState("date_desc");
  const [datePreset, setDatePreset] = useState("ALL");
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  /* ── ui state ── */
  const [showUpcoming, setShowUpcoming] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  /* ── per-section pickers ── */
  const [kpiCurrency, setKpiCurrency] = useState("");
  const [barCurrency, setBarCurrency] = useState("");

  /* ── modal ── */
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    amount: "",
    currency: "USD",
    date: new Date().toISOString().slice(0, 10),
    nextDate: "",
    categoryId: "",
    assetSymbol: "",
    units: "",
    description: "",
    tagsCsv: "",
    accountId: "",
  });

  /* ── auto-add modal ── */
  const [autoOpen, setAutoOpen] = useState(false);
  const [autoText, setAutoText] = useState("");
  const [autoAccountId, setAutoAccountId] = useState("");
  const [autoLoading, setAutoLoading] = useState(false);

  /* ── derived lookups ── */
  const categoriesById = useMemo(
    () => new Map(categories.map((c) => [c._id, c])),
    [categories],
  );
  const accountsById = useMemo(
    () => new Map(accounts.map((a) => [a._id, a])),
    [accounts],
  );
  const defaultAccountId = accounts[0]?._id || "";

  /* ── dynamic tags extractor ── */
  const allTags = useMemo(() => {
    const tags = new Set();
    transactions.forEach((t) => {
      if (t.type === "investment" && !t.isDeleted && t.tags) {
        t.tags.forEach((tag) => tags.add(tag.toLowerCase()));
      }
    });
    return Array.from(tags).sort();
  }, [transactions]);

  /* ── load ── */
  const loadAll = useCallback(async () => {
    try {
      setErr("");
      const [txRes, catRes, accRes] = await Promise.all([
        api.get("/transactions", { params: { type: "investment" } }),
        api.get("/categories"),
        api.get("/accounts"),
      ]);
      setCategories(getInvestmentCategories(catRes.data || []));
      setAccounts((accRes.data || []).filter((a) => !a.isDeleted));
      setTransactions(
        (txRes.data || []).filter(
          (t) => t.type === "investment" && !t.isDeleted,
        ),
      );
    } catch (e) {
      setErr(e?.response?.data?.error || e.message || "Failed to load data");
    } finally {
      setInitialDone(true);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(FAVORITES_KEY);
        const arr = raw ? JSON.parse(raw) : [];
        const cleaned = (Array.isArray(arr) ? arr : [])
          .map((s) =>
            String(s || "")
              .toUpperCase()
              .trim(),
          )
          .filter(Boolean);
        setFavoriteSymbols(new Set(cleaned));
      } catch {
        setFavoriteSymbols(new Set());
      }
    })();
  }, []);

  const toggleFavorite = useCallback(async (symbol) => {
    const sym = String(symbol || "")
      .toUpperCase()
      .trim();
    if (!sym) return;

    setFavoriteSymbols((prev) => {
      const next = new Set(prev);
      if (next.has(sym)) next.delete(sym);
      else next.add(sym);

      AsyncStorage.setItem(
        FAVORITES_KEY,
        JSON.stringify(Array.from(next)),
      ).catch(() => {});
      return next;
    });
  }, []);

  /* ─────────────────────────────────────────────────────────
     FILTERING
  ───────────────────────────────────────────────────────── */
  function passesDateFilter(dateStr, preset) {
    if (preset === "ALL") return true;
    const txDate = startOfUTC(new Date(dateStr));
    if (Number.isNaN(txDate.getTime())) return false;
    const today = startOfUTC(new Date());

    if (preset === "THIS_MONTH")
      return txDate >= startOfMonthUTC(today) && txDate <= endOfMonthUTC(today);
    if (preset === "LAST_MONTH") {
      const r = addMonthsUTC(today, -1);
      return txDate >= startOfMonthUTC(r) && txDate <= endOfMonthUTC(r);
    }
    if (preset === "LAST_90") {
      const from = new Date(today);
      from.setUTCDate(from.getUTCDate() - 90);
      return txDate >= from && txDate <= today;
    }
    if (preset === "THIS_YEAR") {
      return txDate >= startOfYearUTC(today) && txDate <= endOfYearUTC(today);
    }
    return true;
  }

  const clearFilters = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setQ("");
    setFAccountId("ALL");
    setFCategoryId("ALL");
    setFCurrency("ALL");
    setFTag("ALL");
    setMinAmount("");
    setMaxAmount("");
    setMinDate("");
    setMaxDate("");
    setDatePreset("ALL");
    setSortKey("date_desc");
    setShowFavoritesOnly(false);
  };

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const filtered = transactions.filter((t) => {
      if ((t.type || "") !== "investment" || t.isDeleted) return false;
      if (fAccountId !== "ALL" && String(t.accountId) !== String(fAccountId))
        return false;
      if (fCategoryId !== "ALL" && String(t.categoryId) !== String(fCategoryId))
        return false;
      if (fCurrency !== "ALL" && (t.currency || "USD") !== fCurrency)
        return false;

      if (fTag !== "ALL") {
        const lowerTags = (t.tags || []).map((x) => x.toLowerCase());
        if (!lowerTags.includes(fTag)) return false;
      }

      const symbol = String(t.assetSymbol || "")
        .toUpperCase()
        .trim();
      if (showFavoritesOnly && !favoriteSymbols.has(symbol)) return false;

      const txMajor =
        Number(t.amountMinor || 0) /
        Math.pow(10, decimalsForCurrency(t.currency || "USD"));
      if (minAmount !== "") {
        const minNode = parseFloat(minAmount);
        if (!isNaN(minNode) && txMajor < minNode) return false;
      }
      if (maxAmount !== "") {
        const maxNode = parseFloat(maxAmount);
        if (!isNaN(maxNode) && txMajor > maxNode) return false;
      }

      if (minDate.length >= 10) {
        const dMin = startOfUTC(minDate);
        if (!isNaN(dMin.getTime()) && new Date(t.date) < dMin) return false;
      }
      if (maxDate.length >= 10) {
        const dMax = new Date(maxDate);
        dMax.setUTCHours(23, 59, 59, 999);
        if (!isNaN(dMax.getTime()) && new Date(t.date) > dMax) return false;
      }

      if (!passesDateFilter(t.date, datePreset)) return false;

      if (needle) {
        const hay =
          `${t.description || ""} ${t.notes || ""} ${categoriesById.get(t.categoryId)?.name || ""} ${accountsById.get(t.accountId)?.name || ""} ${(t.tags || []).join(" ")} ${t.assetSymbol || ""}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });

    filtered.sort((a, b) => {
      switch (sortKey) {
        case "date_asc":
          return new Date(a.date) - new Date(b.date);
        case "amount_desc":
          return (
            Number(b.amountMinor || 0) /
              Math.pow(10, decimalsForCurrency(b.currency || "USD")) -
            Number(a.amountMinor || 0) /
              Math.pow(10, decimalsForCurrency(a.currency || "USD"))
          );
        case "amount_asc":
          return (
            Number(a.amountMinor || 0) /
              Math.pow(10, decimalsForCurrency(a.currency || "USD")) -
            Number(b.amountMinor || 0) /
              Math.pow(10, decimalsForCurrency(b.currency || "USD"))
          );
        default:
          return new Date(b.date) - new Date(a.date);
      }
    });
    return filtered;
  }, [
    transactions,
    q,
    fAccountId,
    fCategoryId,
    fCurrency,
    fTag,
    minAmount,
    maxAmount,
    minDate,
    maxDate,
    categoriesById,
    accountsById,
    sortKey,
    datePreset,
    showFavoritesOnly,
    favoriteSymbols,
  ]);

  /* ─────────────────────────────────────────────────────────
     AVAILABLE CURRENCIES
  ───────────────────────────────────────────────────────── */
  const distCurrencies = useMemo(
    () => [...new Set(rows.map((t) => t.currency || "USD"))],
    [rows],
  );

  const currentKpiCurrency = distCurrencies.includes(kpiCurrency)
    ? kpiCurrency
    : distCurrencies[0] || "USD";
  const currentBarCurrency = distCurrencies.includes(barCurrency)
    ? barCurrency
    : distCurrencies[0] || "USD";

  /* ─────────────────────────────────────────────────────────
     TOTALS & UPCOMING
  ───────────────────────────────────────────────────────── */
  const totals = useMemo(() => {
    const byCur = {};
    for (const t of rows) {
      const cur = t.currency || "USD";
      byCur[cur] = (byCur[cur] || 0) + Number(t.amountMinor || 0);
    }
    return Object.entries(byCur).map(([cur, minor]) => ({
      cur,
      major: (Number(minor) / Math.pow(10, decimalsForCurrency(cur))).toFixed(
        decimalsForCurrency(cur),
      ),
    }));
  }, [rows]);

  const upcoming = useMemo(() => {
    const today = startOfUTC(new Date());
    const keyOf = (t) =>
      [
        t.accountId,
        t.categoryId,
        t.type,
        t.amountMinor,
        t.currency,
        startOfUTC(t.date).toISOString(),
        (t.description || "").trim(),
        (t.assetSymbol || "").trim().toUpperCase(),
        t.units || "",
      ].join("|");

    const map = new Map();
    for (const t of transactions) {
      if (t.type !== "investment" || t.isDeleted) continue;
      if (new Date(t.date) > today)
        map.set(keyOf(t), { ...t, __kind: "actual" });
    }

    for (const t of transactions) {
      if (t.type !== "investment" || !t.nextDate || t.isDeleted) continue;
      const nd = new Date(t.nextDate);
      if (nd <= today) continue;
      const v = {
        ...t,
        _id: `virtual-${t._id}`,
        date: nd.toISOString(),
        __kind: "virtual",
        __parentId: t._id,
      };
      if (!map.has(keyOf(v))) map.set(keyOf(v), v);
    }

    const arr = Array.from(map.values()).sort(
      (a, b) => new Date(a.date) - new Date(b.date),
    );
    return arr;
  }, [transactions]);

  /* ─────────────────────────────────────────────────────────
     KPI INSIGHTS
  ───────────────────────────────────────────────────────── */
  const insights = useMemo(() => {
    const chosen = currentKpiCurrency;
    const filteredByCur = rows.filter((r) => r.currency === chosen);
    const now = new Date();
    const thisStart = startOfMonthUTC(now),
      thisEnd = endOfMonthUTC(now);
    const lastStart = startOfMonthUTC(addMonthsUTC(now, -1)),
      lastEnd = endOfMonthUTC(addMonthsUTC(now, -1));
    const minorSum = (arr) =>
      arr.reduce((acc, t) => acc + Number(t.amountMinor || 0), 0);
    const within = (arr, s, e) =>
      arr.filter((t) => {
        const d = new Date(t.date);
        return d >= s && d <= e;
      });
    const passed = now.getUTCMonth() + 1;
    let yearMinor = 0;
    for (let m = 0; m < passed; m++) {
      const ref = new Date(Date.UTC(now.getUTCFullYear(), m, 1));
      yearMinor += minorSum(
        within(filteredByCur, startOfMonthUTC(ref), endOfMonthUTC(ref)),
      );
    }
    return {
      statsCurrency: chosen,
      kpis: {
        last: minorSum(within(filteredByCur, lastStart, lastEnd)),
        this: minorSum(within(filteredByCur, thisStart, thisEnd)),
        yearlyAvg: passed ? Math.round(yearMinor / passed) : 0,
      },
      noteMixed: fCurrency === "ALL",
    };
  }, [rows, currentKpiCurrency, fCurrency]);

  const barChartData = useMemo(() => {
    const curRows = rows.filter(
      (r) => (r.currency || "USD") === currentBarCurrency,
    );
    const catMap = new Map();
    for (const t of curRows)
      catMap.set(
        t.categoryId || "—",
        (catMap.get(t.categoryId || "—") || 0) + Number(t.amountMinor || 0),
      );
    return Array.from(catMap.entries())
      .map(([cid, minor]) => ({
        name: categoriesById.get(cid)?.name || "—",
        minor,
      }))
      .sort((a, b) => b.minor - a.minor);
  }, [rows, currentBarCurrency, categoriesById]);

  const dailySeries = useMemo(() => {
    const today = startOfUTC(new Date());
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setUTCDate(d.getUTCDate() - i);
      days.push({ key: d.toISOString().slice(0, 10), date: d });
    }

    const sums = new Map();
    for (const t of rows) {
      if ((t.currency || "USD") !== currentKpiCurrency) continue;
      const key = startOfUTC(new Date(t.date)).toISOString().slice(0, 10);
      sums.set(key, (sums.get(key) || 0) + Number(t.amountMinor || 0));
    }

    const points = days.map((d) => ({
      label: d.date.toLocaleDateString(DATE_LANG, {
        month: "2-digit",
        day: "2-digit",
      }),
      value:
        (sums.get(d.key) || 0) /
        Math.pow(10, decimalsForCurrency(currentKpiCurrency || "USD")),
    }));

    return { points, max: points.reduce((m, p) => Math.max(m, p.value), 0) };
  }, [rows, currentKpiCurrency]);

  const favoriteCount = useMemo(() => favoriteSymbols.size, [favoriteSymbols]);
  const favoriteRowsCount = useMemo(
    () =>
      rows.filter((r) =>
        favoriteSymbols.has(
          String(r.assetSymbol || "")
            .toUpperCase()
            .trim(),
        ),
      ).length,
    [rows, favoriteSymbols],
  );

  /* ─────────────────────────────────────────────────────────
     ACTIONS
  ───────────────────────────────────────────────────────── */
  function openCreate() {
    const aId = accountId || accounts[0]?._id || "";
    const cur = accounts.find((a) => a._id === aId)?.currency || "USD";
    setEditing(null);
    setForm({
      amount: "",
      currency: cur,
      date: new Date().toISOString().slice(0, 10),
      nextDate: "",
      categoryId: categories[0]?._id || "",
      assetSymbol: "",
      units: "",
      description: "",
      tagsCsv: "",
      accountId: aId,
    });
    setModalOpen(true);
  }

  function openCreateSeed(seed) {
    setEditing(null);
    setForm({
      amount: minorToMajor(seed.amountMinor, seed.currency),
      currency: seed.currency,
      date: new Date(seed.date).toISOString().slice(0, 10),
      nextDate: "",
      categoryId: seed.categoryId || categories[0]?._id || "",
      assetSymbol: (seed.assetSymbol || "").toUpperCase(),
      units: seed.units != null ? String(seed.units) : "",
      description: seed.description || "",
      tagsCsv: (seed.tags || []).join(", "),
      accountId: seed.accountId || accountId || accounts[0]?._id || "",
    });
    setModalOpen(true);
  }

  function openEdit(tx) {
    setEditing(tx);
    setForm({
      amount: minorToMajor(tx.amountMinor, tx.currency),
      currency: tx.currency,
      date: new Date(tx.date).toISOString().slice(0, 10),
      nextDate: tx.nextDate
        ? new Date(tx.nextDate).toISOString().slice(0, 10)
        : "",
      categoryId: tx.categoryId || categories[0]?._id || "",
      assetSymbol: (tx.assetSymbol || "").toUpperCase(),
      units: tx.units != null ? String(tx.units) : "",
      description: tx.description || "",
      tagsCsv: (tx.tags || []).join(", "),
      accountId: tx.accountId || accountId || accounts[0]?._id || "",
    });
    setModalOpen(true);
  }

  async function softDelete(tx) {
    Alert.alert("Delete investment?", "This action can't be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await api.delete(`/transactions/${tx._id}`);
            setTransactions((prev) =>
              prev.filter((t) => String(t._id) !== String(tx._id)),
            );
          } catch (e) {
            Alert.alert(
              "Error",
              e?.response?.data?.error || e.message || "Error deleting",
            );
          }
        },
      },
    ]);
  }

  async function addVirtual(v) {
    try {
      const { data } = await api.post("/transactions", {
        accountId: v.accountId,
        categoryId: v.categoryId,
        type: "investment",
        amountMinor: v.amountMinor,
        currency: v.currency,
        date: new Date(v.date).toISOString(),
        description: v.description || null,
        tags: v.tags || [],
        assetSymbol: v.assetSymbol || undefined,
        units: v.units || undefined,
      });

      if (v.__kind === "virtual" && v.__parentId) {
        try {
          const { data: p } = await api.put(`/transactions/${v.__parentId}`, {
            nextDate: null,
          });
          setTransactions((prev) =>
            prev.map((t) => (String(t._id) === String(p._id) ? p : t)),
          );
        } catch {}
      }
      const created = Array.isArray(data?.created) ? data.created : [data];
      setTransactions((prev) => [...created, ...prev]);
    } catch (e) {
      Alert.alert(
        "Error",
        e?.response?.data?.error || e.message || "Add failed",
      );
    }
  }

  async function deleteUpcoming(item) {
    if (item.__kind === "virtual") {
      try {
        const { data } = await api.put(`/transactions/${item.__parentId}`, {
          nextDate: null,
        });
        setTransactions((prev) =>
          prev.map((t) => (String(t._id) === String(data._id) ? data : t)),
        );
      } catch (e) {
        Alert.alert(
          "Error",
          e?.response?.data?.error || e.message || "Delete failed",
        );
      }
    } else {
      await softDelete(item);
    }
  }

  const openAutoAdd = useCallback(() => {
    setAutoAccountId(accountId || defaultAccountId || "");
    setAutoText("");
    setAutoOpen(true);
  }, [accountId, defaultAccountId]);

  const submitAuto = useCallback(async () => {
    const text = String(autoText || "").trim();
    const accId = autoAccountId || accountId || defaultAccountId;
    if (!accId) {
      Alert.alert("Missing account", "Pick an account.");
      return;
    }
    if (!text) {
      Alert.alert("Missing text", "Type what you want to add.");
      return;
    }
    try {
      setAutoLoading(true);
      await api.post("/auto/transactions/text", { accountId: accId, text });
      setAutoOpen(false);
      setAutoText("");
      setAutoAccountId("");
      await loadAll();
    } catch (e) {
      Alert.alert(
        "Auto add failed",
        e?.response?.data?.error || e.message || "Auto add failed.",
      );
    } finally {
      setAutoLoading(false);
    }
  }, [autoText, autoAccountId, accountId, defaultAccountId, loadAll]);

  /* ─────────────────────────────────────────────────────────
     RENDER HELPERS
  ───────────────────────────────────────────────────────── */
  function renderRow({ item }) {
    const catName =
      categories.find((c) => c._id === item.categoryId)?.name || "—";
    const accName = accountsById.get(item.accountId)?.name || "—";
    const isFuture = new Date(item.date) > startOfUTC(new Date());
    const symbol = String(item.assetSymbol || "")
      .toUpperCase()
      .trim();
    const isFavorite = symbol ? favoriteSymbols.has(symbol) : false;
    const canFavorite = isStockOrCryptoCategoryName(catName);

    return (
      <View style={s.rowCard}>
        <Brackets color={ORANGE} size={7} thick={1} />
        <View style={s.rowTopLine}>
          <View
            style={[s.rowCatPill, { borderColor: "rgba(249,115,22,0.22)" }]}
          >
            <View style={[s.rowCatDot, { backgroundColor: ORANGE }]} />
            <Text style={[s.rowCatTxt, { color: ORANGE }]} numberOfLines={1}>
              {symbol ? `${symbol} • ${catName}` : catName}
            </Text>
          </View>

          {canFavorite && symbol ? (
            <TouchableOpacity
              onPress={() => toggleFavorite(symbol)}
              activeOpacity={0.75}
              style={[
                s.badge,
                {
                  borderColor: isFavorite
                    ? "rgba(251,191,36,0.28)"
                    : "rgba(226,232,240,0.12)",
                  backgroundColor: isFavorite
                    ? "rgba(251,191,36,0.10)"
                    : "rgba(255,255,255,0.03)",
                },
              ]}
            >
              <Text style={[s.badgeTxt, { color: isFavorite ? GOLD : T_DIM }]}>
                {isFavorite ? "★ FAV" : "☆ STAR"}
              </Text>
            </TouchableOpacity>
          ) : null}

          {isFuture && (
            <View
              style={[
                s.badge,
                {
                  borderColor: "rgba(249,115,22,0.28)",
                  backgroundColor: "rgba(249,115,22,0.10)",
                },
              ]}
            >
              <Text style={[s.badgeTxt, { color: ORANGE }]}>UPCOMING</Text>
            </View>
          )}

          <Text style={[s.rowAmount, { color: ORANGE }]}>
            -{minorToMajor(item.amountMinor, item.currency)}{" "}
            <Text style={{ fontSize: 9, opacity: 0.6 }}>{item.currency}</Text>
          </Text>
        </View>

        <View style={s.rowAccLine}>
          <View style={s.rowAccPill}>
            <Text style={s.rowAccTxt}>{accName}</Text>
          </View>
          {item.units != null && item.units !== "" ? (
            <View style={[s.rowAccPill, { marginLeft: 6 }]}>
              <Text style={s.rowAccTxt}>{item.units} units</Text>
            </View>
          ) : null}
        </View>

        <Text style={s.rowDesc} numberOfLines={2}>
          {item.description || "No description"}
        </Text>
        <Text style={s.rowDate}>{fmtDateUTC(item.date)}</Text>
        {item.tags?.length ? (
          <Text style={[s.rowTags, { color: CYAN }]}>
            #{item.tags.join("  #")}
          </Text>
        ) : null}

        <ScanLine color={ORANGE} style={{ marginTop: 10, marginBottom: 8 }} />

        <View style={s.rowActions}>
          <TouchableOpacity
            style={s.rowBtnEdit}
            onPress={() => openEdit(item)}
            activeOpacity={0.75}
          >
            <Text style={[s.rowBtnTxt, { color: CYAN }]}>EDIT</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={s.rowBtnDel}
            onPress={() => softDelete(item)}
            activeOpacity={0.75}
          >
            <Text style={[s.rowBtnTxt, { color: VIOLET }]}>DELETE</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  function HeaderSection() {
    const activeCatName =
      fCategoryId === "ALL"
        ? "ALL_CATS"
        : categoriesById.get(fCategoryId)?.name || "CAT";
    const activeAccName =
      fAccountId === "ALL"
        ? "ALL_ACCS"
        : accountsById.get(fAccountId)?.name || "ACC";
    const activePeriod = datePreset === "ALL" ? "INF_LOOP" : datePreset;
    const activeReadout = `ACTV // ${activeAccName} · ${activeCatName} · ${fCurrency} · ${activePeriod}`;

    return (
      <HoloCard accent="orange" containerStyle={{ marginBottom: 0 }}>
        <View style={s.topBar}>
          <View style={s.logoRow}>
            <View style={[s.statusDot, { backgroundColor: ORANGE }]} />
            <Text style={s.logoTxt}>INVESTMENTS</Text>
          </View>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TouchableOpacity
              onPress={() =>
                navigation.navigate("InvestmentPerformance", {
                  favorites: Array.from(favoriteSymbols),
                })
              }
              activeOpacity={0.8}
              style={[
                s.ctrlPill,
                { borderColor: "rgba(251,191,36,0.25)", paddingHorizontal: 10 },
              ]}
            >
              <View style={[s.ctrlDot, { backgroundColor: GOLD }]} />
              <Text style={[s.ctrlTxt, { color: GOLD }]}>MARKET</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => navigation.navigate("Dashboard")}
              activeOpacity={0.8}
              style={[s.homeBtn, { borderColor: "rgba(249,115,22,0.20)" }]}
            >
              <Image source={logo} style={s.homeBtnImg} />
              <Brackets color={ORANGE} size={7} thick={1} />
            </TouchableOpacity>
          </View>
        </View>

        <Text style={s.heroTitle}>Investment{"\n"}Control</Text>
        <Text style={s.heroSub}>
          Track deployed capital, monitor favorite assets, and keep your
          long-term positioning decision-ready.
        </Text>
        <ScanLine color={ORANGE} style={{ marginTop: 12, marginBottom: 14 }} />

        <View style={s.controlsRow}>
          <TouchableOpacity
            style={[
              s.ctrlPill,
              {
                borderColor: showFilters ? `${CYAN}55` : `${ORANGE}33`,
                backgroundColor: showFilters ? `${CYAN}15` : "transparent",
                flex: 1,
              },
            ]}
            onPress={() => setShowFilters(!showFilters)}
            activeOpacity={0.75}
          >
            <View
              style={[
                s.ctrlDot,
                { backgroundColor: showFilters ? CYAN : ORANGE },
              ]}
            />
            <Text style={[s.ctrlTxt, { color: showFilters ? CYAN : ORANGE }]}>
              {showFilters ? "SYS_RDY" : "FILTER"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.ctrlPill, { borderColor: "rgba(249,115,22,0.25)" }]}
            onPress={() => setShowUpcoming((v) => !v)}
            activeOpacity={0.75}
          >
            <View style={[s.ctrlDot, { backgroundColor: ORANGE }]} />
            <Text style={[s.ctrlTxt, { color: ORANGE }]}>UPCOMING</Text>
            <View
              style={[
                s.upcomingBadge,
                {
                  backgroundColor: "rgba(249,115,22,0.18)",
                  borderColor: "rgba(249,115,22,0.28)",
                },
              ]}
            >
              <Text style={[s.upcomingBadgeTxt, { color: ORANGE }]}>
                {upcoming.length}
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.ctrlPill, { borderColor: "rgba(0,212,255,0.22)" }]}
            onPress={loadAll}
            activeOpacity={0.75}
          >
            <View style={[s.ctrlDot, { backgroundColor: CYAN }]} />
            <Text style={[s.ctrlTxt, { color: CYAN }]}>REFRESH</Text>
          </TouchableOpacity>
        </View>

        <View style={s.cyberLinkBox}>
          <ScanLine
            color={ORANGE}
            style={{
              position: "absolute",
              top: -1,
              left: 10,
              right: 10,
              opacity: 0.3,
            }}
          />
          <View style={s.cyberSearchRow}>
            <View style={[s.cyberBlinker, { backgroundColor: ORANGE }]} />
            <TextInput
              value={q}
              onChangeText={setQ}
              placeholder="SEARCH_DB..."
              placeholderTextColor={"rgba(226,232,240,0.40)"}
              style={s.cyberSearchInput}
            />
          </View>

          {!showFilters && (
            <View style={s.cyberReadoutRow}>
              <Text style={s.cyberReadoutTxt} numberOfLines={1}>
                {activeReadout}
              </Text>
            </View>
          )}

          {showFilters && (
            <View style={s.cyberMatrix}>
              <Brackets color={CYAN} size={6} thick={1} />

              <FilterDataRow
                label="NODE"
                val={fAccountId}
                set={setFAccountId}
                accent={ORANGE}
                opts={[
                  { _id: "ALL", label: "ALL_ACCS" },
                  ...accounts.map((a) => ({ _id: a._id, label: a.name })),
                ]}
              />
              <FilterDataRow
                label="TYPE"
                val={fCategoryId}
                set={setFCategoryId}
                accent={GOLD}
                opts={[
                  { _id: "ALL", label: "ALL_CATS" },
                  ...categories.map((c) => ({ _id: c._id, label: c.name })),
                ]}
              />

              {allTags.length > 0 && (
                <FilterDataRow
                  label="TAGS"
                  val={fTag}
                  set={setFTag}
                  accent={CYAN}
                  opts={[
                    { _id: "ALL", label: "ALL_TAGS" },
                    ...allTags.map((tag) => ({
                      _id: tag,
                      label: `#${tag.toUpperCase()}`,
                    })),
                  ]}
                />
              )}

              <FilterDataRow
                label="CRED"
                val={fCurrency}
                set={setFCurrency}
                accent={ORANGE}
                opts={[
                  { _id: "ALL", label: "ALL_CCY" },
                  ...[
                    ...new Set(transactions.map((t) => t.currency || "USD")),
                  ].map((c) => ({ _id: c, label: c })),
                ]}
              />
              <FilterDataRow
                label="TIME"
                val={datePreset}
                set={setDatePreset}
                accent={GOLD}
                opts={[
                  { _id: "ALL", label: "INF_LOOP" },
                  { _id: "THIS_MONTH", label: "CUR_CYC" },
                  { _id: "LAST_MONTH", label: "PRV_CYC" },
                  { _id: "LAST_90", label: "-90_CYC" },
                  { _id: "THIS_YEAR", label: "CUR_ANN" },
                ]}
              />
              <FilterDataRow
                label="SORT"
                val={sortKey}
                set={setSortKey}
                accent={CYAN}
                opts={[
                  { _id: "date_desc", label: "LATEST" },
                  { _id: "date_asc", label: "OLDEST" },
                  { _id: "amount_desc", label: "MAX_VOL" },
                  { _id: "amount_asc", label: "MIN_VOL" },
                ]}
              />

              <View style={s.cRowWrap}>
                <Text style={s.cRowLabel}>W-LIST</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={s.cRowScroll}
                  keyboardShouldPersistTaps="handled"
                >
                  <CyberNode
                    label="ALL ASSETS"
                    selected={!showFavoritesOnly}
                    onPress={() => setShowFavoritesOnly(false)}
                    accent={CYAN}
                  />
                  <CyberNode
                    label={`FAV_ONLY (${favoriteCount})`}
                    selected={showFavoritesOnly}
                    onPress={() => setShowFavoritesOnly(true)}
                    accent={GOLD}
                  />
                </ScrollView>
              </View>

              <View style={s.cRowWrap}>
                <Text style={s.cRowLabel}>RANGE</Text>
                <View style={{ flexDirection: "row", gap: 8, flex: 1 }}>
                  <TextInput
                    value={minAmount}
                    onChangeText={setMinAmount}
                    placeholder="MIN AMT"
                    keyboardType="numeric"
                    placeholderTextColor={T_DIM}
                    style={[
                      s.modalInput,
                      {
                        flex: 1,
                        paddingVertical: 6,
                        fontSize: 11,
                        backgroundColor: "transparent",
                      },
                    ]}
                  />
                  <TextInput
                    value={maxAmount}
                    onChangeText={setMaxAmount}
                    placeholder="MAX AMT"
                    keyboardType="numeric"
                    placeholderTextColor={T_DIM}
                    style={[
                      s.modalInput,
                      {
                        flex: 1,
                        paddingVertical: 6,
                        fontSize: 11,
                        backgroundColor: "transparent",
                      },
                    ]}
                  />
                </View>
              </View>

              <View style={s.cRowWrap}>
                <Text style={s.cRowLabel}>D-RNG</Text>
                <View style={{ flexDirection: "row", gap: 8, flex: 1 }}>
                  <TextInput
                    value={minDate}
                    onChangeText={setMinDate}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={T_DIM}
                    maxLength={10}
                    style={[
                      s.modalInput,
                      {
                        flex: 1,
                        paddingVertical: 6,
                        fontSize: 11,
                        backgroundColor: "transparent",
                      },
                    ]}
                  />
                  <TextInput
                    value={maxDate}
                    onChangeText={setMaxDate}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={T_DIM}
                    maxLength={10}
                    style={[
                      s.modalInput,
                      {
                        flex: 1,
                        paddingVertical: 6,
                        fontSize: 11,
                        backgroundColor: "transparent",
                      },
                    ]}
                  />
                </View>
              </View>

              <TouchableOpacity
                style={s.resetBtn}
                onPress={clearFilters}
                activeOpacity={0.7}
              >
                <Text style={s.resetBtnTxt}>[ RESET SYS ]</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </HoloCard>
    );
  }

  function UpcomingPanel() {
    if (!showUpcoming) return null;
    return (
      <HoloCard
        title="Scheduled Flow"
        subtitle={`${upcoming.length} planned deployments`}
        accent="gold"
      >
        {upcoming.length === 0 ? (
          <Text style={s.emptyText}>
            Nothing upcoming within current filters.
          </Text>
        ) : (
          upcoming.map((u) => {
            const catName = categoriesById.get(u.categoryId)?.name || "—";
            const accName = accountsById.get(u.accountId)?.name || "—";
            const isVirtual = u.__kind === "virtual";
            const ac = isVirtual ? CYAN : ORANGE;
            const symbol = String(u.assetSymbol || "")
              .toUpperCase()
              .trim();

            return (
              <View key={u._id} style={s.timelineItem}>
                <View
                  style={[
                    s.timelineDot,
                    { backgroundColor: ac, shadowColor: ac },
                  ]}
                />
                <View style={[s.flowCard, { borderColor: `${ac}22` }]}>
                  <View style={[s.flowAccent, { backgroundColor: ac }]} />
                  <View style={{ paddingLeft: 10 }}>
                    <View style={s.rowTopLine}>
                      <Text
                        style={[s.flowCat, { color: ac }]}
                        numberOfLines={1}
                      >
                        {symbol ? `${symbol} • ${catName}` : catName}
                      </Text>
                      <View
                        style={[
                          s.badge,
                          {
                            borderColor: `${ac}33`,
                            backgroundColor: `${ac}11`,
                            marginLeft: 4,
                          },
                        ]}
                      >
                        <Text style={[s.badgeTxt, { color: ac }]}>
                          {isVirtual ? "PLANNED" : "IN DB"}
                        </Text>
                      </View>
                    </View>
                    <Text style={s.rowDesc} numberOfLines={2}>
                      {u.description || "No description"}
                    </Text>
                    <View
                      style={[
                        s.rowTopLine,
                        {
                          marginTop: 8,
                          borderTopWidth: 1,
                          borderTopColor: "rgba(255,255,255,0.05)",
                          paddingTop: 6,
                        },
                      ]}
                    >
                      <Text style={[s.rowDate, { flex: 1 }]}>
                        {fmtDateUTC(u.date)}
                      </Text>
                      <Text style={[s.rowAmount, { fontSize: 13 }]}>
                        -{minorToMajor(u.amountMinor, u.currency)}{" "}
                        <Text style={{ fontSize: 8, opacity: 0.7 }}>
                          {u.currency}
                        </Text>
                      </Text>
                    </View>

                    <View style={[s.rowActions, { marginTop: 8 }]}>
                      {isVirtual ? (
                        <>
                          <TouchableOpacity
                            style={[
                              s.rowBtnEdit,
                              { borderColor: ORANGE + "44" },
                            ]}
                            onPress={() => addVirtual(u)}
                          >
                            <Text style={[s.rowBtnTxt, { color: ORANGE }]}>
                              ADD
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={s.rowBtnEdit}
                            onPress={() => openCreateSeed(u)}
                          >
                            <Text style={[s.rowBtnTxt, { color: CYAN }]}>
                              EDIT
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={s.rowBtnDel}
                            onPress={() => deleteUpcoming(u)}
                          >
                            <Text style={[s.rowBtnTxt, { color: VIOLET }]}>
                              SKIP
                            </Text>
                          </TouchableOpacity>
                        </>
                      ) : (
                        <>
                          <TouchableOpacity
                            style={s.rowBtnEdit}
                            onPress={() => openEdit(u)}
                          >
                            <Text style={[s.rowBtnTxt, { color: CYAN }]}>
                              EDIT
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={s.rowBtnDel}
                            onPress={() => deleteUpcoming(u)}
                          >
                            <Text style={[s.rowBtnTxt, { color: VIOLET }]}>
                              DELETE
                            </Text>
                          </TouchableOpacity>
                        </>
                      )}
                    </View>
                  </View>
                </View>
              </View>
            );
          })
        )}
        <TouchableOpacity
          style={{ marginTop: 10, alignSelf: "flex-end" }}
          onPress={() => setShowUpcoming(false)}
        >
          <Text style={[s.ctrlTxt, { color: "rgba(226,232,240,0.40)" }]}>
            CLOSE PANEL
          </Text>
        </TouchableOpacity>
      </HoloCard>
    );
  }

  /* ── Modals ── */
  const InvestmentModal = useCallback(() => {
    if (!modalOpen) return null;
    const submit = async () => {
      const {
        amount,
        currency,
        date,
        nextDate,
        categoryId,
        assetSymbol,
        units,
        description,
        tagsCsv,
        accountId: aId,
      } = form;
      const cur = (currency || "USD").toString().toUpperCase();
      const pickedAccountId = aId || accountId || accounts[0]?._id || "";
      const amountMinor = majorToMinor(amount, cur);
      const pickedCategory = categories.find((c) => c._id === categoryId);
      const symbol = String(assetSymbol || "")
        .toUpperCase()
        .trim();
      const unitsNum =
        String(units || "").trim() === "" ? NaN : Number(String(units).trim());

      if (Number.isNaN(amountMinor)) {
        Alert.alert("Invalid amount", "Enter a valid number.");
        return;
      }
      if (!categoryId) {
        Alert.alert("Missing category", "Pick a category.");
        return;
      }
      if (!pickedAccountId) {
        Alert.alert("Missing account", "Pick an account.");
        return;
      }

      const requiresSymbolUnits = isStockOrCryptoCategoryName(
        pickedCategory?.name || "",
      );
      if (requiresSymbolUnits && !symbol) {
        Alert.alert("Missing symbol", "Asset symbol is required.");
        return;
      }
      if (
        requiresSymbolUnits &&
        !(Number.isFinite(unitsNum) && Number(unitsNum) > 0)
      ) {
        Alert.alert("Invalid units", "Units must be a positive number.");
        return;
      }

      const payload = {
        accountId: pickedAccountId,
        categoryId,
        type: "investment",
        amountMinor,
        currency: cur,
        date: new Date(date || new Date()).toISOString(),
        description: (description || "").trim() || null,
        tags: (tagsCsv || "")
          .split(",")
          .map((x) => x.trim())
          .filter((x) => x.length > 0),
      };

      if (symbol) payload.assetSymbol = symbol;
      if (Number.isFinite(unitsNum) && unitsNum > 0) payload.units = unitsNum;
      if ((nextDate || "").trim())
        payload.nextDate = new Date(nextDate).toISOString();

      try {
        if (!editing) {
          const { data } = await api.post("/transactions", payload);
          const created = Array.isArray(data?.created) ? data.created : [data];
          setTransactions((prev) => [...created, ...prev]);
        } else {
          const { data } = await api.put(
            `/transactions/${editing._id}`,
            payload,
          );
          setTransactions((prev) =>
            prev.map((t) => (String(t._id) === String(data._id) ? data : t)),
          );
        }
        setModalOpen(false);
      } catch (e) {
        Alert.alert("Error", e?.response?.data?.error || e.message || "Error");
      }
    };

    return (
      <Modal
        visible={modalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setModalOpen(false)}
      >
        <KeyboardAvoidingView
          style={s.modalBackdrop}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={s.modalCard}>
            <Brackets color={ORANGE} size={10} thick={1.5} />
            <View style={[s.modalHairline, { backgroundColor: ORANGE }]} />
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <Text style={[s.modalTitle, { color: ORANGE }]}>
                {editing ? "EDIT INVESTMENT" : "NEW INVESTMENT"}
              </Text>
              <ScanLine color={ORANGE} style={{ marginBottom: 16 }} />

              <Text style={s.modalLabel}>ACCOUNT</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                style={{ marginBottom: 10 }}
              >
                {accounts.map((a) => (
                  <Chip
                    key={a._id}
                    label={a.name}
                    accent={CYAN}
                    selected={form.accountId === a._id}
                    onPress={() =>
                      setForm((f) => ({
                        ...f,
                        accountId: a._id,
                        currency: a.currency || f.currency,
                      }))
                    }
                  />
                ))}
              </ScrollView>

              <View style={s.modalRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.modalLabel}>TOTAL COST</Text>
                  <TextInput
                    value={form.amount}
                    onChangeText={(v) => setForm((f) => ({ ...f, amount: v }))}
                    keyboardType="numeric"
                    placeholder="0.00"
                    placeholderTextColor={T_DIM}
                    style={s.modalInput}
                  />
                </View>
                <View style={{ width: 80 }}>
                  <Text style={s.modalLabel}>CCY</Text>
                  <TextInput
                    value={form.currency}
                    onChangeText={(v) =>
                      setForm((f) => ({ ...f, currency: v.toUpperCase() }))
                    }
                    autoCapitalize="characters"
                    placeholder="USD"
                    placeholderTextColor={T_DIM}
                    style={s.modalInput}
                  />
                </View>
              </View>

              <View style={s.modalRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.modalLabel}>ASSET SYMBOL</Text>
                  <TextInput
                    value={form.assetSymbol}
                    onChangeText={(v) =>
                      setForm((f) => ({ ...f, assetSymbol: v.toUpperCase() }))
                    }
                    autoCapitalize="characters"
                    placeholder="AAPL, BTC"
                    placeholderTextColor={T_DIM}
                    style={s.modalInput}
                  />
                </View>
                <View style={{ width: 110 }}>
                  <Text style={s.modalLabel}>UNITS</Text>
                  <TextInput
                    value={form.units}
                    onChangeText={(v) => setForm((f) => ({ ...f, units: v }))}
                    keyboardType="numeric"
                    placeholder="2.5"
                    placeholderTextColor={T_DIM}
                    style={s.modalInput}
                  />
                </View>
              </View>

              <View style={s.modalRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.modalLabel}>DATE</Text>
                  <TextInput
                    value={form.date}
                    onChangeText={(v) => setForm((f) => ({ ...f, date: v }))}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={T_DIM}
                    style={s.modalInput}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.modalLabel}>NEXT DATE</Text>
                  <TextInput
                    value={form.nextDate}
                    onChangeText={(v) =>
                      setForm((f) => ({ ...f, nextDate: v }))
                    }
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={T_DIM}
                    style={s.modalInput}
                  />
                </View>
              </View>

              <Text style={s.modalLabel}>CATEGORY</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                style={{ marginBottom: 10 }}
              >
                {categories.map((c) => (
                  <Chip
                    key={c._id}
                    label={c.name}
                    accent={ORANGE}
                    selected={form.categoryId === c._id}
                    onPress={() =>
                      setForm((f) => ({ ...f, categoryId: c._id }))
                    }
                  />
                ))}
              </ScrollView>

              <Text style={s.modalLabel}>DESCRIPTION</Text>
              <TextInput
                value={form.description}
                onChangeText={(v) => setForm((f) => ({ ...f, description: v }))}
                placeholder="Optional memo"
                placeholderTextColor={T_DIM}
                style={[s.modalInput, { marginBottom: 10 }]}
              />

              <Text style={s.modalLabel}>TAGS</Text>
              <TextInput
                value={form.tagsCsv}
                onChangeText={(v) => setForm((f) => ({ ...f, tagsCsv: v }))}
                placeholder="long-term, dividend"
                placeholderTextColor={T_DIM}
                style={s.modalInput}
              />

              <ScanLine
                color={ORANGE}
                style={{ marginTop: 18, marginBottom: 14 }}
              />
              <View style={s.modalActions}>
                <TouchableOpacity
                  style={s.modalBtnCancel}
                  onPress={() => setModalOpen(false)}
                >
                  <Text style={[s.modalBtnTxt, { color: T_MID }]}>CANCEL</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.modalBtnPrimary, { backgroundColor: ORANGE }]}
                  onPress={submit}
                >
                  <Text style={[s.modalBtnTxt, { color: BG }]}>
                    {editing ? "SAVE" : "ADD"}
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    );
  }, [modalOpen, form, editing, accounts, categories, accountId]);

  if (!initialDone) {
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
            <Brackets color={ORANGE} size={20} thick={2} />
            <ActivityIndicator size="large" color={ORANGE} />
          </View>
          <Text style={s.loadingTitle}>INVESTMENTS</Text>
          <Text style={s.loadingMono}>Initialising module…</Text>
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
        contentContainerStyle={{
          paddingBottom: 132,
          gap: 10,
          paddingHorizontal: 12,
          paddingTop: 12,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <HeaderSection />
        <UpcomingPanel />

        {!!err && (
          <View style={s.errorCard}>
            <Brackets color={VIOLET} size={8} thick={1} />
            <View style={s.errorIconBox}>
              <Text style={[s.errorIconTxt, { color: VIOLET }]}>!</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.errorTitle}>Something didn't load</Text>
              <Text style={s.errorBody}>{err}</Text>
            </View>
          </View>
        )}

        <HoloCard
          title="KPIs"
          accent="orange"
          right={
            <CurrencyPill
              currencies={distCurrencies}
              value={currentKpiCurrency}
              onChange={setKpiCurrency}
              accent={ORANGE}
            />
          }
        >
          {insights.noteMixed && (
            <Text style={[s.sectionNote, { marginBottom: 8 }]}>
              Mixed currency — KPIs in {insights.statsCurrency}.
            </Text>
          )}
          <View style={{ gap: 8 }}>
            <MetricCard
              label="Last Month"
              value={fmtMoney(insights.kpis.last, insights.statsCurrency)}
              accent="cyan"
            />
            <MetricCard
              label="This Month"
              value={fmtMoney(insights.kpis.this, insights.statsCurrency)}
              accent="orange"
            />
            <MetricCard
              label="Yearly Avg"
              value={fmtMoney(insights.kpis.yearlyAvg, insights.statsCurrency)}
              accent="gold"
            />
          </View>

          <View style={s.chartBlock}>
            <View style={s.chartHeaderRow}>
              <View style={[s.ctrlDot, { backgroundColor: CYAN }]} />
              <Text style={[s.chartTitle, { color: CYAN }]}>LAST 7 DAYS</Text>
            </View>
            <SparklineChart data={dailySeries} />
          </View>

          <View style={s.totalWrap}>
            {totals.map(({ cur, major }) => (
              <View
                key={cur}
                style={[s.totalPill, { borderColor: `rgba(0,212,255,0.22)` }]}
              >
                <View style={[s.ctrlDot, { backgroundColor: CYAN }]} />
                <Text style={[s.totalPillTxt, { color: CYAN }]}>
                  Total {cur}: <Text style={{ color: "#fff" }}>{major}</Text>
                </Text>
              </View>
            ))}
            <View
              style={[s.totalPill, { borderColor: `rgba(251,191,36,0.22)` }]}
            >
              <View style={[s.ctrlDot, { backgroundColor: GOLD }]} />
              <Text style={[s.totalPillTxt, { color: GOLD }]}>
                Favorites tracked:{" "}
                <Text style={{ color: "#fff" }}>{favoriteCount}</Text>
              </Text>
            </View>
          </View>
        </HoloCard>

        <HoloCard
          title="By Category"
          subtitle="Distribution"
          accent="gold"
          right={
            <CurrencyPill
              currencies={distCurrencies}
              value={currentBarCurrency}
              onChange={setBarCurrency}
              accent={GOLD}
            />
          }
        >
          <BarChart data={barChartData} currency={currentBarCurrency} />
        </HoloCard>

        <HoloCard
          title="Transaction Feed"
          subtitle={`${rows.length} records in view`}
          accent="orange"
        >
          {rows.length === 0 ? (
            <Text style={s.emptyText}>
              No investments found. Add your first one or adjust filters.
            </Text>
          ) : (
            <FlatList
              data={rows}
              keyExtractor={(item) => String(item._id)}
              renderItem={renderRow}
              scrollEnabled={false}
            />
          )}
        </HoloCard>
      </ScrollView>

      {/* FAB Array */}
      <View style={s.fabContainer}>
        <TouchableOpacity
          style={s.fabSecondary}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            openAutoAdd();
          }}
          activeOpacity={0.8}
        >
          <Brackets color={CYAN} size={8} thick={1} />
          <Text style={[s.fabSecondaryTxt, { color: CYAN }]}>AUTO</Text>
        </TouchableOpacity>

        <PulseButton onPress={openCreate} color={ORANGE} icon="+" />
      </View>

      <InvestmentModal />

      {/* AUTO-ADD MODAL */}
      <Modal
        visible={autoOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setAutoOpen(false)}
      >
        <KeyboardAvoidingView
          style={s.modalBackdrop}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={s.modalCard}>
            <Brackets color={CYAN} size={10} thick={1.5} />
            <View style={[s.modalHairline, { backgroundColor: CYAN }]} />
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <Text style={[s.modalTitle, { color: CYAN }]}>
                AUTO ADD INVESTMENT
              </Text>
              <Text style={s.modalHint}>
                Parse a short sentence into an investment.
              </Text>
              <ScanLine color={CYAN} style={{ marginVertical: 12 }} />

              <Text style={s.modalLabel}>ACCOUNT</Text>
              {accounts.length === 0 ? (
                <Text style={s.modalHint}>
                  No active accounts. Create one first.
                </Text>
              ) : (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  style={{ marginBottom: 10 }}
                >
                  {accounts.map((a) => (
                    <Chip
                      key={a._id}
                      label={`${a.name} · ${a.currency}`}
                      accent={CYAN}
                      selected={autoAccountId === a._id}
                      onPress={() => setAutoAccountId(a._id)}
                    />
                  ))}
                </ScrollView>
              )}

              <Text style={s.modalLabel}>TEXT INPUT</Text>
              <TextInput
                value={autoText}
                onChangeText={setAutoText}
                placeholder="e.g. bought 2 AAPL for 380 usd"
                placeholderTextColor={T_DIM}
                style={[s.modalInput, { minHeight: 90 }]}
                multiline
              />
              <Text style={s.modalHint}>
                Include symbol + units + total cost + currency if possible.
              </Text>

              <ScanLine
                color={CYAN}
                style={{ marginTop: 16, marginBottom: 14 }}
              />
              <View style={s.modalActions}>
                <TouchableOpacity
                  style={s.modalBtnCancel}
                  onPress={() => setAutoOpen(false)}
                >
                  <Text style={[s.modalBtnTxt, { color: T_MID }]}>CANCEL</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    s.modalBtnPrimary,
                    { backgroundColor: CYAN },
                    autoLoading && { opacity: 0.7 },
                  ]}
                  onPress={submitAuto}
                  disabled={autoLoading}
                >
                  <Text style={[s.modalBtnTxt, { color: BG }]}>
                    {autoLoading ? "PARSING…" : "CREATE"}
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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

  holoCard: {
    padding: 18,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
    position: "relative",
    overflow: "hidden",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: 2,
    textTransform: "uppercase",
    color: "#ffffff",
  },
  sectionSubtitle: {
    fontSize: 12,
    color: "rgba(226,232,240,0.70)",
    marginTop: 2,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  sectionHairline: {
    height: 1,
    width: "100%",
    position: "absolute",
    top: 0,
    left: 0,
  },
  sectionNote: { fontSize: 10, color: T_MID, lineHeight: 15 },

  metricCard: {
    position: "relative",
    borderRadius: 2,
    borderWidth: 1,
    padding: 14,
    overflow: "hidden",
    flex: 1,
  },
  metricLabel: {
    fontSize: 9,
    fontWeight: "800",
    color: T_DIM,
    letterSpacing: 2,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  metricValue: { fontSize: 22, fontWeight: "800", letterSpacing: -0.5 },

  currPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderRadius: 2,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: "rgba(255,255,255,0.025)",
  },
  currPillDot: { width: 4, height: 4, borderRadius: 999 },
  currPillTxt: { fontSize: 9, fontWeight: "800", letterSpacing: 1 },

  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  logoRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  statusDot: { width: 6, height: 6, borderRadius: 999 },
  logoTxt: {
    fontSize: 11,
    fontWeight: "800",
    color: T_HI,
    letterSpacing: 3,
    textTransform: "uppercase",
  },
  homeBtn: {
    width: 36,
    height: 36,
    borderRadius: 2,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(249,115,22,0.20)",
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
  ctrlTxt: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  upcomingBadge: {
    marginLeft: 4,
    minWidth: 20,
    height: 20,
    borderRadius: 2,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  upcomingBadgeTxt: { fontSize: 10, fontWeight: "800" },

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

  barChartWrap: { gap: 10 },
  barRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  barLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: T_MID,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    width: 90,
  },
  barTrackWrap: { flex: 1 },
  barTrack: {
    height: 18,
    backgroundColor: "rgba(249,115,22,0.06)",
    borderRadius: 1,
    overflow: "hidden",
    justifyContent: "center",
  },
  barFill: { height: "100%", borderRadius: 1 },
  barValue: {
    fontSize: 10,
    fontWeight: "800",
    color: T_HI,
    width: 90,
    textAlign: "right",
  },

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
  chartEmpty: {
    fontSize: 11,
    color: T_DIM,
    textAlign: "center",
    paddingVertical: 10,
  },
  sparklineRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginTop: 2,
  },
  sparkCol: { alignItems: "center", flex: 1 },
  sparkBarTrack: {
    width: 8,
    height: 42,
    borderRadius: 1,
    backgroundColor: "rgba(255,255,255,0.04)",
    overflow: "hidden",
    justifyContent: "flex-end",
  },
  sparkBarFill: { width: "100%", borderRadius: 1 },
  sparkLabel: { marginTop: 4, fontSize: 7, color: T_DIM },

  timelineItem: {
    flexDirection: "row",
    marginBottom: 12,
    paddingLeft: 16,
    position: "relative",
  },
  timelineDot: {
    position: "absolute",
    left: 0,
    top: 16,
    width: 10,
    height: 10,
    borderRadius: 999,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 4,
  },
  flowCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 2,
    overflow: "hidden",
    position: "relative",
    paddingBottom: 10,
    paddingRight: 10,
  },
  flowAccent: { position: "absolute", left: 0, top: 0, bottom: 0, width: 2 },
  flowCat: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
  },

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
  rowCatTxt: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  badge: {
    borderWidth: 1,
    borderRadius: 2,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  badgeTxt: {
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  rowAmount: { marginLeft: "auto", fontSize: 15, fontWeight: "800" },
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
  rowDesc: { fontSize: 12, color: T_MID, lineHeight: 17, marginBottom: 3 },
  rowDate: { fontSize: 10, color: T_DIM, letterSpacing: 0.3 },
  rowTags: { fontSize: 10, marginTop: 4, letterSpacing: 0.5 },
  rowActions: { flexDirection: "row", gap: 8 },
  rowBtnEdit: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: "rgba(0,212,255,0.25)",
    backgroundColor: "rgba(0,212,255,0.06)",
  },
  rowBtnDel: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: "rgba(167,139,250,0.25)",
    backgroundColor: "rgba(167,139,250,0.06)",
  },
  rowBtnTxt: {
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
  },

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
    backgroundColor: "rgba(167,139,250,0.06)",
    borderWidth: 1,
    borderColor: "rgba(167,139,250,0.22)",
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

  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(3,5,8,0.92)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  modalCard: {
    width: "100%",
    maxHeight: "90%",
    borderRadius: 4,
    padding: 18,
    backgroundColor: BG,
    borderWidth: 1,
    borderColor: CARD_BD,
    overflow: "hidden",
    position: "relative",
  },
  modalHairline: {
    position: "absolute",
    top: 0,
    left: "10%",
    right: "10%",
    height: 1.5,
    opacity: 0.65,
  },
  modalTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: T_HI,
    letterSpacing: 3,
    textTransform: "uppercase",
    marginBottom: 4,
    marginTop: 4,
  },
  modalLabel: {
    fontSize: 8,
    fontWeight: "800",
    color: T_DIM,
    letterSpacing: 2,
    textTransform: "uppercase",
    marginBottom: 6,
    marginTop: 10,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: CARD_BD,
    borderRadius: 2,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    backgroundColor: "rgba(255,255,255,0.025)",
    color: T_HI,
  },
  modalHint: {
    marginTop: 5,
    fontSize: 10,
    color: T_DIM,
    lineHeight: 15,
    letterSpacing: 0.3,
  },
  modalRow: { flexDirection: "row", gap: 8 },
  modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: 8 },
  modalBtnCancel: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: CARD_BD,
    backgroundColor: "rgba(255,255,255,0.025)",
  },
  modalBtnPrimary: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 2,
  },
  modalBtnTxt: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
  },

  fabContainer: {
    position: "absolute",
    right: 20,
    bottom: 30,
    alignItems: "center",
    gap: 16,
  },
  pulseWrap: {
    width: 60,
    height: 60,
    justifyContent: "center",
    alignItems: "center",
  },
  pulseRing: {
    position: "absolute",
    width: 75,
    height: 75,
    borderRadius: 40,
    borderWidth: 1,
  },
  fabCore: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: ORANGE,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 8,
  },
  fabIcon: { fontSize: 30, color: BG, fontWeight: "300", marginTop: -4 },
  fabSecondary: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(0,212,255,0.1)",
    borderWidth: 1,
    borderColor: "rgba(0,212,255,0.4)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: CYAN,
    shadowOpacity: 0.4,
    shadowRadius: 5,
  },
  fabSecondaryTxt: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1,
    marginTop: 2,
  },

  cyberLinkBox: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: CARD_BD,
    backgroundColor: "rgba(0,0,0,0.4)",
    borderRadius: 2,
    position: "relative",
  },
  cyberSearchRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  cyberBlinker: { width: 4, height: 12, marginRight: 10, opacity: 0.8 },
  cyberSearchInput: {
    flex: 1,
    color: T_HI,
    fontSize: 12,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    paddingVertical: 4,
  },
  cyberReadoutRow: { paddingHorizontal: 12, paddingBottom: 10 },
  cyberReadoutTxt: {
    fontSize: 9,
    color: T_MID,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    letterSpacing: 0.5,
  },
  cyberMatrix: {
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: CARD_BD,
    backgroundColor: "rgba(249,115,22,0.02)",
    position: "relative",
    gap: 12,
  },
  cRowWrap: { flexDirection: "row", alignItems: "center" },
  cRowLabel: {
    width: 42,
    fontSize: 9,
    fontWeight: "800",
    color: T_DIM,
    letterSpacing: 1,
  },
  cRowScroll: { flex: 1 },
  cNode: {
    borderWidth: 1,
    borderColor: CARD_BD,
    paddingHorizontal: 8,
    paddingVertical: 5,
    marginRight: 6,
    borderRadius: 2,
    position: "relative",
    backgroundColor: "rgba(255,255,255,0.01)",
  },
  cNodeGlow: { position: "absolute", left: 0, top: 0, bottom: 0, width: 2 },
  cNodeTxt: {
    fontSize: 9,
    color: T_DIM,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  resetBtn: { alignSelf: "flex-end", marginTop: 6, paddingVertical: 4 },
  resetBtnTxt: {
    fontSize: 9,
    fontWeight: "800",
    color: "rgba(255, 115, 0, 0.8)",
    letterSpacing: 1,
  },
});
