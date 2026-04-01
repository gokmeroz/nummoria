// mobile/src/screens/ExpensesScreen.js
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
} from "react-native";
import TextRecognition from "@react-native-ml-kit/text-recognition";
import { useNavigation } from "@react-navigation/native";
import { CameraView, useCameraPermissions } from "expo-camera";

import api from "../lib/api";
import logo from "../../assets/nummoria_logo.png";

/* ──────────────────────────────────────────────────────────
   THEME — synced with DashboardScreen cyberpunk HUD
────────────────────────────────────────────────────────── */
const BG = "#030508";
const MINT = "#00ff87";
const CYAN = "#00d4ff";
const VIOLET = "#a78bfa";
const CARD_BG = "rgba(255,255,255,0.025)";
const CARD_BD = "rgba(255,255,255,0.07)";
const T_HI = "#e2e8f0";
const T_MID = "rgba(226,232,240,0.55)";
const T_DIM = "rgba(226,232,240,0.32)";

/* legacy aliases so business-logic helpers compile unchanged */
const TEXT_PRIMARY = T_HI;
const TEXT_MUTED = T_MID;
const TEXT_SOFT = T_DIM;
const SECONDARY = MINT;
const DATE_LANG = "en-US";

/* ──────────────────────────────────────────────────────────
   DATE HELPERS  (unchanged)
────────────────────────────────────────────────────────── */
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
function fmtDateUTC(dateLike) {
  const d = new Date(dateLike);
  return d.toLocaleDateString(DATE_LANG, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

/* ──────────────────────────────────────────────────────────
   MONEY HELPERS  (unchanged)
────────────────────────────────────────────────────────── */
function decimalsForCurrency(code) {
  const zero = new Set(["JPY", "KRW", "CLP", "VND"]);
  const three = new Set(["BHD", "IQD", "JOD", "KWD", "OMR", "TND"]);
  if (zero.has(code)) return 0;
  if (three.has(code)) return 3;
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
  return (minor / Math.pow(10, dec)).toFixed(dec);
}
const fmtMoney = (minor, cur = "USD") =>
  new Intl.NumberFormat(DATE_LANG, {
    style: "currency",
    currency: cur || "USD",
  }).format((minor || 0) / Math.pow(10, decimalsForCurrency(cur || "USD")));

/* ──────────────────────────────────────────────────────────
   RECEIPT HELPERS  (unchanged)
────────────────────────────────────────────────────────── */
function parseReceiptFromQR(data) {
  if (!data || typeof data !== "string") return null;
  let amount, currency, dateStr, description;
  try {
    const obj = JSON.parse(data);
    if (obj && typeof obj === "object") {
      amount = obj.amount ?? obj.total ?? obj.amt ?? amount;
      currency = obj.currency ?? obj.cur ?? currency;
      dateStr = obj.date ?? obj.txDate ?? dateStr;
      description = obj.description ?? obj.desc ?? description;
    }
  } catch {}
  if (amount == null) {
    const m = data.match(/([0-9]+[.,][0-9]{2})/);
    if (m) amount = m[1];
  }
  if (!currency) {
    const m = data.match(/\b(USD|EUR|TRY|GBP)\b/i);
    if (m) currency = m[1].toUpperCase();
  }
  if (!dateStr) {
    const iso = data.match(/(\d{4}-\d{2}-\d{2})/);
    const eu = data.match(/(\d{2}\.\d{2}\.\d{4})/);
    if (iso) {
      dateStr = iso[1];
    } else if (eu) {
      const [dd, mm, yyyy] = eu[1].split(".");
      dateStr = `${yyyy}-${mm}-${dd}`;
    }
  }
  if (!amount && !currency && !dateStr) return null;
  return {
    amount: amount != null ? String(amount).replace(",", ".") : null,
    currency: currency || null,
    date: dateStr || null,
    description: description || null,
  };
}

function parseReceiptFromText(rawText) {
  if (!rawText) return null;
  const textRaw = String(rawText);
  const text = textRaw.replace(/\s+/g, " ").toUpperCase();
  const totalRegex =
    /(GENEL TOPLAM|TOPLAM|TOPLAM TUTAR|ÖDENECEK|ODENECEK|TOTAL|GRAND TOTAL|AMOUNT)[^\d]*([0-9]+[.,][0-9]{2})/;
  const totalMatch = text.match(totalRegex);
  let amount = null;
  if (totalMatch && totalMatch[2]) {
    amount = totalMatch[2].replace(",", ".");
  } else {
    const allMoney = [...text.matchAll(/([0-9]{1,6}[.,][0-9]{2})/g)].map(
      (m) => m[1],
    );
    if (allMoney.length) {
      const nums = allMoney
        .map((s) => ({ s, n: Number(s.replace(",", ".")) }))
        .filter((x) => !Number.isNaN(x.n));
      if (nums.length) {
        nums.sort((a, b) => b.n - a.n);
        amount = String(nums[0].s).replace(",", ".");
      }
    }
  }
  let currency = null;
  if (/\b(TRY|TL|₺)\b/.test(text)) currency = "TRY";
  else if (/\b(USD|\$)\b/.test(text)) currency = "USD";
  else if (/\b(EUR|€)\b/.test(text)) currency = "EUR";
  else if (/\b(GBP|£)\b/.test(text)) currency = "GBP";
  let dateStr = null;
  const iso = text.match(/(\d{4}[-/.]\d{2}[-/.]\d{2})/);
  const eu = text.match(/(\d{2}[-/.]\d{2}[-/.]\d{4})/);
  if (iso) {
    dateStr = iso[1].replace(/\./g, "-").replace(/\//g, "-");
  } else if (eu) {
    const [dd, mm, yyyy] = eu[1].split(/[./-]/);
    dateStr = `${yyyy}-${mm}-${dd}`;
  }
  let seller = null;
  const lines = textRaw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length) {
    const stopIdx = lines.findIndex((l) =>
      /TARİH|TARIH|DATE|FİŞ|FIS|FİŞ NO|FIS NO|FATURA|VERGI|VKN|RECEIPT/i.test(
        l,
      ),
    );
    const headerLines =
      stopIdx > 0 ? lines.slice(0, stopIdx) : lines.slice(0, 3);
    seller = headerLines.join(" ").trim();
    if (seller.length > 80) seller = seller.slice(0, 80).trim();
  }
  if (!amount && !dateStr && !seller) return null;
  return {
    amount: amount || null,
    currency: currency || null,
    date: dateStr || null,
    seller: seller || null,
  };
}

/* ──────────────────────────────────────────────────────────
   CATEGORY INFERENCE  (unchanged)
────────────────────────────────────────────────────────── */
function normalizeKey(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[ıİ]/g, "i")
    .replace(/[şŞ]/g, "s")
    .replace(/[ğĞ]/g, "g")
    .replace(/[üÜ]/g, "u")
    .replace(/[öÖ]/g, "o")
    .replace(/[çÇ]/g, "c")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
function pickCategoryIdByName(categories, wantedNames) {
  const wanted = wantedNames.map(normalizeKey);
  for (const w of wanted) {
    const found = categories.find((c) => normalizeKey(c?.name).includes(w));
    if (found?._id) return found._id;
  }
  return "";
}
function inferCategoryIdFromReceipt({ seller, rawText }, categories) {
  if (!Array.isArray(categories) || !categories.length) return "";
  const blob = normalizeKey(`${seller || ""} ${rawText || ""}`);
  const rules = [
    {
      rx: /(migros|carrefour|bim|a101|sok|şok|market|supermarket|gross|grocer)/,
      targets: ["groceries", "grocery", "market", "supermarket", "food"],
    },
    {
      rx: /(starbucks|kahve|coffee|cafe|kafe|restoran|restaurant|burger|pizza|doner|döner|kebab|yemek|lokanta)/,
      targets: ["dining", "restaurants", "food", "eat out", "cafe"],
    },
    {
      rx: /(opet|shell|bp|petrol|akaryakit|akaryakıt|fuel|gasoline|istasyon)/,
      targets: ["transport", "fuel", "car", "gas", "vehicle"],
    },
    {
      rx: /(eczane|pharmacy|hastane|hospital|clinic|doktor|doctor|ilac|ilaç)/,
      targets: ["health", "medical", "pharmacy"],
    },
    {
      rx: /(fatura|electric|elektrik|su|water|dogalgaz|doğalgaz|internet|telekom|vodafone|turkcell|turktelekom|ttnet)/,
      targets: ["bills", "utilities", "internet", "phone"],
    },
    {
      rx: /(giyim|clothing|zara|hm|h&m|bershka|pull&bear|pull bear|decathlon|nike|adidas)/,
      targets: ["shopping", "clothing", "apparel"],
    },
    {
      rx: /(sinema|cinema|netflix|spotify|entertainment|eglence|eğlence|game|oyun)/,
      targets: ["entertainment", "fun"],
    },
    {
      rx: /(otel|hotel|airbnb|flight|ucus|uçuş|thy|turkish airlines|pegasus|travel|seyahat)/,
      targets: ["travel", "transport"],
    },
    {
      rx: /(egitim|eğitim|course|udemy|coursera|school|okul|university|universite)/,
      targets: ["education"],
    },
  ];
  for (const r of rules) {
    if (r.rx.test(blob)) {
      const id = pickCategoryIdByName(categories, r.targets);
      if (id) return id;
    }
  }
  return pickCategoryIdByName(categories, ["other", "misc", "general"]) || "";
}

/* ──────────────────────────────────────────────────────────
   HUD PRIMITIVES  (mirrors DashboardScreen)
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
   CHIP
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
        numberOfLines={1}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

/* ──────────────────────────────────────────────────────────
   STAT CARD
────────────────────────────────────────────────────────── */
function StatCard({
  title,
  value,
  accent = "expense",
  chipText = "THIS MONTH",
}) {
  const accentMap = {
    expense: {
      color: VIOLET,
      glow: "rgba(167,139,250,0.10)",
      bd: "rgba(167,139,250,0.22)",
    },
    neutral: {
      color: CYAN,
      glow: "rgba(0,212,255,0.09)",
      bd: "rgba(0,212,255,0.22)",
    },
    green: {
      color: MINT,
      glow: "rgba(0,255,135,0.08)",
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
      <Text style={s.statHint}>Updated from filters</Text>
    </View>
  );
}

/* ══════════════════════════════════════════════════════════
   SCREEN
══════════════════════════════════════════════════════════ */
export default function ExpensesScreen({ route }) {
  const navigation = useNavigation();
  const scrollRef = useRef(null);
  const accountId = route?.params?.accountId;

  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [autoOpen, setAutoOpen] = useState(false);
  const [autoText, setAutoText] = useState("");
  const [autoAccountId, setAutoAccountId] = useState("");
  const [autoLoading, setAutoLoading] = useState(false);
  const [scanProcessing, setScanProcessing] = useState(false);
  const [initialDone, setInitialDone] = useState(false);
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");
  const [fAccountId, setFAccountId] = useState("ALL");
  const [fCategoryId, setFCategoryId] = useState("ALL");
  const [fCurrency, setFCurrency] = useState("ALL");
  const [sortKey, setSortKey] = useState("date_desc");
  const [showUpcoming, setShowUpcoming] = useState(false);
  const [datePreset, setDatePreset] = useState("ALL");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    amount: "",
    currency: "USD",
    date: new Date().toISOString().slice(0, 10),
    nextDate: "",
    categoryId: "",
    description: "",
    tagsCsv: "",
    accountId: "",
  });
  const [scannerVisible, setScannerVisible] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState("back");
  const [flash, setFlash] = useState("off");
  const scannedOnceRef = useRef(false);
  const cameraRef = useRef(null);
  const ocrBusyRef = useRef(false);

  const categoriesById = useMemo(() => {
    const m = new Map();
    for (const c of categories) m.set(c._id, c);
    return m;
  }, [categories]);
  const accountsById = useMemo(() => {
    const m = new Map();
    for (const a of accounts) m.set(a._id, a);
    return m;
  }, [accounts]);
  const defaultAccountId = accounts[0]?._id || "";

  const currencies = useMemo(() => {
    const s = new Set(
      transactions
        .filter((t) => t.type === "expense" && !t.isDeleted)
        .map((t) => t.currency || "USD"),
    );
    return ["ALL", ...Array.from(s)];
  }, [transactions]);

  const loadAll = useCallback(async () => {
    try {
      setErr("");
      const [txRes, catRes, accRes] = await Promise.all([
        api.get("/transactions", { params: { type: "expense" } }),
        api.get("/categories"),
        api.get("/accounts"),
      ]);
      setCategories(
        (catRes.data || []).filter((c) => c.kind === "expense" && !c.isDeleted),
      );
      setAccounts((accRes.data || []).filter((a) => !a.isDeleted));
      setTransactions(
        (txRes.data || []).filter((t) => t.type === "expense" && !t.isDeleted),
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
    return true;
  }

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const filtered = transactions.filter((t) => {
      if ((t.type || "") !== "expense" || t.isDeleted) return false;
      if (fAccountId !== "ALL" && String(t.accountId) !== String(fAccountId))
        return false;
      if (fCategoryId !== "ALL" && String(t.categoryId) !== String(fCategoryId))
        return false;
      if (fCurrency !== "ALL" && (t.currency || "USD") !== fCurrency)
        return false;
      if (!passesDateFilter(t.date, datePreset)) return false;
      if (needle) {
        const hay =
          `${t.description || ""} ${t.notes || ""} ${categoriesById.get(t.categoryId)?.name || ""} ${accountsById.get(t.accountId)?.name || ""} ${(t.tags || []).join(" ")}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
    filtered.sort((a, b) => {
      switch (sortKey) {
        case "date_asc":
          return new Date(a.date) - new Date(b.date);
        case "amount_desc": {
          const av =
            Number(a.amountMinor || 0) /
            Math.pow(10, decimalsForCurrency(a.currency || "USD"));
          const bv =
            Number(b.amountMinor || 0) /
            Math.pow(10, decimalsForCurrency(b.currency || "USD"));
          return bv - av;
        }
        case "amount_asc": {
          const av =
            Number(a.amountMinor || 0) /
            Math.pow(10, decimalsForCurrency(a.currency || "USD"));
          const bv =
            Number(b.amountMinor || 0) /
            Math.pow(10, decimalsForCurrency(b.currency || "USD"));
          return av - bv;
        }
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
    categoriesById,
    accountsById,
    sortKey,
    datePreset,
  ]);

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
      ].join("|");
    const map = new Map();
    for (const t of transactions) {
      if (t.type !== "expense" || t.isDeleted) continue;
      if (new Date(t.date) > today)
        map.set(keyOf(t), { ...t, __kind: "actual" });
    }
    for (const t of transactions) {
      if (t.type !== "expense" || !t.nextDate || t.isDeleted) continue;
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
    const needle = q.trim().toLowerCase();
    const arr = Array.from(map.values()).filter((t) => {
      if (fAccountId !== "ALL" && String(t.accountId) !== String(fAccountId))
        return false;
      if (fCategoryId !== "ALL" && String(t.categoryId) !== String(fCategoryId))
        return false;
      if (fCurrency !== "ALL" && (t.currency || "USD") !== fCurrency)
        return false;
      if (!passesDateFilter(t.date, datePreset)) return false;
      if (needle) {
        const hay =
          `${t.description || ""} ${t.notes || ""} ${categoriesById.get(t.categoryId)?.name || ""} ${accountsById.get(t.accountId)?.name || ""} ${(t.tags || []).join(" ")}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
    arr.sort((a, b) => new Date(a.date) - new Date(b.date));
    return arr;
  }, [
    transactions,
    q,
    fAccountId,
    fCategoryId,
    fCurrency,
    categoriesById,
    accountsById,
    datePreset,
  ]);

  const { statsCurrency, kpis, noteMixedCurrency } = useMemo(() => {
    const chosen = fCurrency !== "ALL" ? fCurrency : rows[0]?.currency || "USD";
    const byCur = rows.filter((r) => r.currency === chosen);
    const now = new Date();
    const within = (arr, s, e) =>
      arr.filter((t) => {
        const d = new Date(t.date);
        return d >= s && d <= e;
      });
    const minSum = (arr) =>
      arr.reduce((acc, t) => acc + Number(t.amountMinor || 0), 0);
    const passed = now.getUTCMonth() + 1;
    let yearMinor = 0;
    for (let m = 0; m < passed; m++) {
      const ref = new Date(Date.UTC(now.getUTCFullYear(), m, 1));
      yearMinor += minSum(
        within(byCur, startOfMonthUTC(ref), endOfMonthUTC(ref)),
      );
    }
    return {
      statsCurrency: chosen,
      kpis: {
        last: minSum(
          within(
            byCur,
            startOfMonthUTC(addMonthsUTC(now, -1)),
            endOfMonthUTC(addMonthsUTC(now, -1)),
          ),
        ),
        this: minSum(within(byCur, startOfMonthUTC(now), endOfMonthUTC(now))),
        yearlyAvg: passed ? Math.round(yearMinor / passed) : 0,
      },
      noteMixedCurrency: fCurrency === "ALL",
    };
  }, [rows, fCurrency]);

  const spendingByCategory = useMemo(() => {
    if (!rows.length) return [];
    const map = new Map();
    for (const t of rows) {
      if (t.currency !== statsCurrency) continue;
      const key = t.categoryId || "UNCAT";
      map.set(key, (map.get(key) || 0) + Number(t.amountMinor || 0));
    }
    const entries = Array.from(map.entries()).filter(([, sum]) => sum > 0);
    if (!entries.length) return [];
    const total = entries.reduce((acc, [, s]) => acc + s, 0);
    entries.sort((a, b) => b[1] - a[1]);
    return entries.slice(0, 5).map(([catId, sum]) => ({
      catId,
      catName: categoriesById.get(catId)?.name || "Other",
      major: sum / Math.pow(10, decimalsForCurrency(statsCurrency || "USD")),
      pct: total ? Math.round((sum / total) * 100) : 0,
    }));
  }, [rows, statsCurrency, categoriesById]);

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
      if (t.currency !== statsCurrency) continue;
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
        Math.pow(10, decimalsForCurrency(statsCurrency || "USD")),
    }));
    return { points, max: points.reduce((m, p) => Math.max(m, p.value), 0) };
  }, [rows, statsCurrency]);

  /* ── actions ── */
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
      categoryId: seed.categoryId || "",
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
      categoryId: tx.categoryId || "",
      description: tx.description || "",
      tagsCsv: (tx.tags || []).join(", "),
      accountId: tx.accountId || accountId || accounts[0]?._id || "",
    });
    setModalOpen(true);
  }
  async function softDelete(tx) {
    Alert.alert("Delete expense?", "This action can't be undone.", [
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
        type: "expense",
        amountMinor: v.amountMinor,
        currency: v.currency,
        date: new Date(v.date).toISOString(),
        description: v.description || null,
        tags: v.tags || [],
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
  const openUpcomingAuto = useCallback(() => {
    setShowUpcoming(true);
    requestAnimationFrame(() =>
      scrollRef.current?.scrollTo({ y: 0, animated: true }),
    );
  }, []);

  async function parseReceiptViaBackend(photoUri) {
    const fd = new FormData();
    fd.append("file", {
      uri: photoUri,
      name: `receipt_${Date.now()}.jpg`,
      type: "image/jpeg",
    });
    const res = await api.post("/receipt/parse", fd, { timeout: 30000 });
    return res?.data || null;
  }
  function applyParsedToForm(parsed, rawTextForCategory) {
    const pickedAccId = form.accountId || accountId || accounts[0]?._id || "";
    const pickedAccCur =
      accounts.find((a) => String(a._id) === String(pickedAccId))?.currency ||
      form.currency ||
      "USD";
    const inferredCategoryId = inferCategoryIdFromReceipt(
      {
        seller: parsed?.seller || parsed?.description || "",
        rawText: rawTextForCategory || "",
      },
      categories,
    );
    setForm((prev) => ({
      ...prev,
      amount: parsed?.amount || prev.amount,
      currency: (parsed?.currency || pickedAccCur || prev.currency || "USD")
        .toString()
        .toUpperCase(),
      date: parsed?.date || prev.date,
      description:
        parsed?.description || parsed?.seller || prev.description || "",
      categoryId:
        inferredCategoryId || prev.categoryId || categories[0]?._id || "",
    }));
  }
  const runSmartScanFromPhoto = useCallback(
    async (photoUri, { receiptId } = {}) => {
      let rawText = "",
        parsed = null;
      const canOcr = Platform.OS !== "ios";
      if (canOcr) {
        try {
          const r = await TextRecognition.recognize(photoUri);
          rawText = r?.text || "";
          parsed = parseReceiptFromText(rawText);
        } catch {}
      }
      const missing = !parsed?.amount || !parsed?.date || !parsed?.seller;
      if (!parsed || missing) {
        const b = (await parseReceiptViaBackend(photoUri)) || {};
        rawText = b.rawText || b.text || rawText || "";
        parsed = {
          amount: b.amount || b.total || null,
          currency: b.currency || parsed?.currency || null,
          date: b.date || parsed?.date || null,
          seller: b.seller || b.merchant || parsed?.seller || null,
          description: b.description || b.seller || null,
        };
      }
      if (!parsed || (!parsed.amount && !parsed.date && !parsed.seller))
        return { ok: false, parsed: null, rawText: "" };
      applyParsedToForm(parsed, rawText);
      if (receiptId)
        setForm((prev) => ({
          ...prev,
          description: prev.description?.trim()
            ? `${prev.description} (Receipt ID: ${receiptId})`
            : `Receipt ID: ${receiptId}`,
        }));
      return { ok: true, parsed, rawText };
    },
    [accountId, accounts, categories, form.accountId, form.currency],
  );

  const openScanner = useCallback(async () => {
    const ok =
      !permission || !permission.granted
        ? (await requestPermission())?.granted
        : true;
    if (!ok) {
      Alert.alert(
        "Camera permission needed",
        "Enable camera access in settings.",
      );
      return;
    }
    setModalOpen(false);
    scannedOnceRef.current = false;
    setIsScanning(true);
    setScannerVisible(true);
  }, [permission, requestPermission]);

  const handleBarCodeScanned = useCallback(
    async ({ type, data }) => {
      if (scannedOnceRef.current) return;
      scannedOnceRef.current = true;
      setScanProcessing(true);
      try {
        if (!cameraRef.current) throw new Error("Camera not ready");
        const photo = await cameraRef.current.takePictureAsync({
          base64: false,
          quality: 0.85,
        });
        setIsScanning(false);
        setScannerVisible(false);
        setModalOpen(true);
        const isIdOnly =
          type === "code128" && /^[0-9]{10,30}$/.test(String(data || ""));
        const { ok } = await runSmartScanFromPhoto(photo.uri, {
          receiptId: isIdOnly ? String(data) : null,
        });
        if (!ok)
          Alert.alert(
            "Could not auto-fill",
            "Retake with good lighting and the TOTAL line visible.",
          );
        else
          Alert.alert(
            "Receipt captured",
            "Auto-filled amount + date + description. Review and save.",
          );
      } catch (e) {
        setScannerVisible(false);
        setIsScanning(false);
        setModalOpen(true);
        Alert.alert(
          "Scan error",
          e?.response?.data?.error || e.message || "Failed to scan receipt.",
        );
      } finally {
        setScanProcessing(false);
      }
    },
    [runSmartScanFromPhoto],
  );

  const openOcrScanner = useCallback(async () => {
    const ok =
      !permission || !permission.granted
        ? (await requestPermission())?.granted
        : true;
    if (!ok) {
      Alert.alert("Camera permission needed", "Enable camera access.");
      return;
    }
    setModalOpen(false);
    setScannerVisible(true);
    setIsScanning(false);
  }, [permission, requestPermission]);

  /* ── row renderer ── */
  function renderRow({ item }) {
    const catName =
      categories.find((c) => c._id === item.categoryId)?.name || "—";
    const accName = accountsById.get(item.accountId)?.name || "—";
    const isFuture = new Date(item.date) > startOfUTC(new Date());
    return (
      <View style={s.rowCard}>
        <Brackets color={VIOLET} size={7} thick={1} />
        <View style={s.rowTopLine}>
          <View
            style={[s.rowCatPill, { borderColor: "rgba(167,139,250,0.22)" }]}
          >
            <View style={[s.rowCatDot, { backgroundColor: VIOLET }]} />
            <Text style={[s.rowCatTxt, { color: VIOLET }]} numberOfLines={1}>
              {catName}
            </Text>
          </View>
          {isFuture && (
            <View
              style={[
                s.badge,
                {
                  borderColor: "rgba(167,139,250,0.28)",
                  backgroundColor: "rgba(167,139,250,0.10)",
                },
              ]}
            >
              <Text style={[s.badgeTxt, { color: VIOLET }]}>UPCOMING</Text>
            </View>
          )}
          <Text style={s.rowAmount}>
            -{minorToMajor(item.amountMinor, item.currency)}{" "}
            <Text style={{ fontSize: 9, opacity: 0.6 }}>{item.currency}</Text>
          </Text>
        </View>
        <View style={s.rowAccPill}>
          <Text style={s.rowAccTxt}>{accName}</Text>
        </View>
        <Text style={s.rowDesc} numberOfLines={2}>
          {item.description || "No description"}
        </Text>
        <Text style={s.rowDate}>{fmtDateUTC(item.date)}</Text>
        {item.tags?.length ? (
          <Text style={s.rowTags}>#{item.tags.join("  #")}</Text>
        ) : null}
        <ScanLine color={VIOLET} style={{ marginTop: 10, marginBottom: 8 }} />
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

  /* ── expense modal ── */
  const ExpenseModal = useCallback(() => {
    if (!modalOpen) return null;
    const submit = async () => {
      const {
        amount,
        currency,
        date,
        nextDate,
        categoryId,
        description,
        tagsCsv,
        accountId: aId,
      } = form;
      const cur = (currency || "USD").toString().toUpperCase();
      const pickedAccountId = aId || accountId || accounts[0]?._id || "";
      const amountMinor = majorToMinor(amount, cur);
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
      const payload = {
        accountId: pickedAccountId,
        categoryId,
        type: "expense",
        amountMinor,
        currency: cur,
        date: new Date(date || new Date()).toISOString(),
        description: (description || "").trim() || null,
        tags: (tagsCsv || "")
          .split(",")
          .map((x) => x.trim())
          .filter((x) => x.length > 0),
      };
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
            <Brackets color={VIOLET} size={10} thick={1.5} />
            <View style={[s.modalHairline, { backgroundColor: VIOLET }]} />
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <Text style={s.modalTitle}>
                {editing ? "EDIT EXPENSE" : "NEW EXPENSE"}
              </Text>
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
                  <Text style={s.modalLabel}>AMOUNT</Text>
                  <TextInput
                    value={form.amount}
                    onChangeText={(v) => setForm((f) => ({ ...f, amount: v }))}
                    keyboardType="numeric"
                    placeholder="0.00"
                    placeholderTextColor={T_DIM}
                    style={s.modalInput}
                  />
                </View>
                <View style={{ width: 88 }}>
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
              <View style={{ marginBottom: 10, marginTop: 10 }}>
                <TouchableOpacity
                  style={s.scanBtn}
                  onPress={openScanner}
                  activeOpacity={0.8}
                >
                  <View style={[s.scanBtnDot, { backgroundColor: MINT }]} />
                  <Text style={[s.scanBtnTxt, { color: MINT }]}>
                    SCAN QR / BARCODE
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    s.scanBtn,
                    { marginTop: 8, borderColor: "rgba(0,212,255,0.30)" },
                  ]}
                  onPress={openOcrScanner}
                  activeOpacity={0.8}
                >
                  <View style={[s.scanBtnDot, { backgroundColor: CYAN }]} />
                  <Text style={[s.scanBtnTxt, { color: CYAN }]}>
                    SMART SCAN → AUTO-FILL
                  </Text>
                </TouchableOpacity>
                <Text style={s.modalHint}>
                  Extracts total, date, merchant and infers category.
                </Text>
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
                    accent={VIOLET}
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
                placeholder="Optional description"
                placeholderTextColor={T_DIM}
                style={[s.modalInput, { marginBottom: 10 }]}
              />
              <Text style={s.modalLabel}>TAGS</Text>
              <TextInput
                value={form.tagsCsv}
                onChangeText={(v) => setForm((f) => ({ ...f, tagsCsv: v }))}
                placeholder="groceries, dinner"
                placeholderTextColor={T_DIM}
                style={s.modalInput}
              />
              <Text style={s.modalHint}>
                Comma-separated · e.g. groceries, dinner, weekend
              </Text>
              <ScanLine
                color={VIOLET}
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
                  style={[s.modalBtnPrimary, { backgroundColor: VIOLET }]}
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
  }, [
    modalOpen,
    form,
    editing,
    accounts,
    categories,
    accountId,
    openScanner,
    openOcrScanner,
  ]);

  /* ── sub-sections ── */
  function Header() {
    const filterGroups = [
      {
        label: "CATEGORY",
        chips: [
          {
            key: "ALL",
            label: "All categories",
            sel: fCategoryId === "ALL",
            onPress: () => setFCategoryId("ALL"),
            accent: CYAN,
          },
          ...categories.map((c) => ({
            key: c._id,
            label: c.name,
            sel: fCategoryId === c._id,
            onPress: () => setFCategoryId(c._id),
            accent: VIOLET,
          })),
        ],
      },
      {
        label: "ACCOUNT",
        small: true,
        chips: [
          {
            key: "ALL",
            label: "All accounts",
            sel: fAccountId === "ALL",
            onPress: () => setFAccountId("ALL"),
            accent: CYAN,
          },
          ...accounts.map((a) => ({
            key: a._id,
            label: a.name,
            sel: fAccountId === a._id,
            onPress: () => setFAccountId(a._id),
            accent: MINT,
          })),
        ],
      },
      {
        label: "CURRENCY",
        small: true,
        chips: currencies.map((c) => ({
          key: c,
          label: c === "ALL" ? "All currencies" : c,
          sel: fCurrency === c,
          onPress: () => setFCurrency(c),
          accent: CYAN,
        })),
      },
      {
        label: "SORT",
        small: true,
        chips: [
          {
            key: "date_desc",
            label: "Newest",
            sel: sortKey === "date_desc",
            onPress: () => setSortKey("date_desc"),
            accent: MINT,
          },
          {
            key: "date_asc",
            label: "Oldest",
            sel: sortKey === "date_asc",
            onPress: () => setSortKey("date_asc"),
            accent: MINT,
          },
          {
            key: "amount_desc",
            label: "Amount ↓",
            sel: sortKey === "amount_desc",
            onPress: () => setSortKey("amount_desc"),
            accent: MINT,
          },
          {
            key: "amount_asc",
            label: "Amount ↑",
            sel: sortKey === "amount_asc",
            onPress: () => setSortKey("amount_asc"),
            accent: MINT,
          },
        ],
      },
      {
        label: "PERIOD",
        small: true,
        chips: [
          {
            key: "ALL",
            label: "All time",
            sel: datePreset === "ALL",
            onPress: () => setDatePreset("ALL"),
            accent: CYAN,
          },
          {
            key: "THIS_MONTH",
            label: "This month",
            sel: datePreset === "THIS_MONTH",
            onPress: () => setDatePreset("THIS_MONTH"),
            accent: CYAN,
          },
          {
            key: "LAST_MONTH",
            label: "Last month",
            sel: datePreset === "LAST_MONTH",
            onPress: () => setDatePreset("LAST_MONTH"),
            accent: CYAN,
          },
          {
            key: "LAST_90",
            label: "Last 90 days",
            sel: datePreset === "LAST_90",
            onPress: () => setDatePreset("LAST_90"),
            accent: CYAN,
          },
        ],
      },
    ];
    return (
      <View style={s.headerCard}>
        <Brackets color={VIOLET} size={12} thick={1.5} />
        <View style={[s.headerHairline, { backgroundColor: VIOLET }]} />
        <View style={s.topBar}>
          <View style={s.logoRow}>
            <View style={[s.statusDot, { backgroundColor: VIOLET }]} />
            <Text style={s.logoTxt}>EXPENSES</Text>
            <View
              style={[
                s.livePill,
                {
                  borderColor: "rgba(167,139,250,0.25)",
                  backgroundColor: "rgba(167,139,250,0.12)",
                },
              ]}
            >
              <Text style={[s.livePillTxt, { color: VIOLET }]}>MODULE</Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={() => navigation.navigate("Dashboard")}
            activeOpacity={0.8}
            style={s.homeBtn}
          >
            <Image source={logo} style={s.homeBtnImg} />
            <Brackets color={MINT} size={7} thick={1} />
          </TouchableOpacity>
        </View>
        <Text style={s.heroTitle}>Expense{"\n"}Control</Text>
        <Text style={s.heroSub}>
          Review spending, spot patterns, and keep your outflow decision-ready.
        </Text>
        <ScanLine color={VIOLET} style={{ marginTop: 12, marginBottom: 14 }} />
        <View style={s.controlsRow}>
          <TouchableOpacity
            style={[s.ctrlPill, { borderColor: "rgba(167,139,250,0.25)" }]}
            onPress={() => setShowUpcoming((v) => !v)}
            activeOpacity={0.75}
          >
            <View style={[s.ctrlDot, { backgroundColor: VIOLET }]} />
            <Text style={[s.ctrlTxt, { color: VIOLET }]}>UPCOMING</Text>
            <View style={s.upcomingBadge}>
              <Text style={s.upcomingBadgeTxt}>{upcoming.length}</Text>
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
        <View style={s.searchWrap}>
          <View style={[s.searchDot, { backgroundColor: MINT }]} />
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Search description, account, category or #tags"
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

  function UpcomingPanel() {
    if (!showUpcoming) return null;
    return (
      <View style={s.sectionCard}>
        <Brackets color={VIOLET} size={10} thick={1} />
        <View style={[s.sectionHairline, { backgroundColor: VIOLET }]} />
        <View style={s.sectionHeaderRow}>
          <View>
            <Text style={s.sectionEyebrow}>SCHEDULED FLOW</Text>
            <Text style={s.sectionTitle}>Upcoming expenses</Text>
          </View>
          <TouchableOpacity onPress={() => setShowUpcoming(false)}>
            <Text style={[s.sectionClose, { color: T_DIM }]}>CLOSE</Text>
          </TouchableOpacity>
        </View>
        {upcoming.length === 0 ? (
          <Text style={s.emptyText}>
            Nothing upcoming within current filters.
          </Text>
        ) : (
          upcoming.map((u) => {
            const catName =
              categories.find((c) => c._id === u.categoryId)?.name || "—";
            const accName = accountsById.get(u.accountId)?.name || "—";
            const isVirtual = u.__kind === "virtual";
            const ac = isVirtual ? MINT : CYAN;
            return (
              <View key={u._id} style={s.rowCard}>
                <Brackets color={ac} size={7} thick={1} />
                <View style={s.rowTopLine}>
                  <View style={[s.rowCatPill, { borderColor: ac + "44" }]}>
                    <View style={[s.rowCatDot, { backgroundColor: ac }]} />
                    <Text
                      style={[s.rowCatTxt, { color: ac }]}
                      numberOfLines={1}
                    >
                      {catName}
                    </Text>
                  </View>
                  <View
                    style={[
                      s.badge,
                      { borderColor: ac + "44", backgroundColor: ac + "14" },
                    ]}
                  >
                    <Text style={[s.badgeTxt, { color: ac }]}>
                      {isVirtual ? "PLANNED" : "IN DB"}
                    </Text>
                  </View>
                  <Text style={s.rowAmount}>
                    -{minorToMajor(u.amountMinor, u.currency)}{" "}
                    <Text style={{ fontSize: 9, opacity: 0.6 }}>
                      {u.currency}
                    </Text>
                  </Text>
                </View>
                <View style={s.rowAccPill}>
                  <Text style={s.rowAccTxt}>{accName}</Text>
                </View>
                <Text style={s.rowDesc} numberOfLines={2}>
                  {u.description || "No description"}
                </Text>
                <Text style={s.rowDate}>Scheduled: {fmtDateUTC(u.date)}</Text>
                <ScanLine
                  color={ac}
                  style={{ marginTop: 10, marginBottom: 8 }}
                />
                <View style={s.rowActions}>
                  {isVirtual ? (
                    <>
                      <TouchableOpacity
                        style={[s.rowBtnEdit, { borderColor: MINT + "44" }]}
                        onPress={() => addVirtual(u)}
                        activeOpacity={0.75}
                      >
                        <Text style={[s.rowBtnTxt, { color: MINT }]}>ADD</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={s.rowBtnEdit}
                        onPress={() => openCreateSeed(u)}
                        activeOpacity={0.75}
                      >
                        <Text style={[s.rowBtnTxt, { color: CYAN }]}>EDIT</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={s.rowBtnDel}
                        onPress={() => deleteUpcoming(u)}
                        activeOpacity={0.75}
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
                        activeOpacity={0.75}
                      >
                        <Text style={[s.rowBtnTxt, { color: CYAN }]}>EDIT</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={s.rowBtnDel}
                        onPress={() => deleteUpcoming(u)}
                        activeOpacity={0.75}
                      >
                        <Text style={[s.rowBtnTxt, { color: VIOLET }]}>
                          DELETE
                        </Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              </View>
            );
          })
        )}
      </View>
    );
  }

  function Insights() {
    const effectiveCur =
      (fCurrency !== "ALL" ? fCurrency : rows[0]?.currency) || "—";
    return (
      <View style={s.sectionCard}>
        <Brackets color={CYAN} size={10} thick={1} />
        <View style={[s.sectionHairline, { backgroundColor: CYAN }]} />
        <View style={s.sectionHeaderRow}>
          <View>
            <Text style={s.sectionEyebrow}>SPENDING KPIs</Text>
            <Text style={s.sectionTitle}>Insights</Text>
          </View>
          <View
            style={[s.currencyPill, { borderColor: "rgba(0,212,255,0.22)" }]}
          >
            <View style={[s.ctrlDot, { backgroundColor: CYAN }]} />
            <Text style={[s.currencyPillTxt, { color: CYAN }]}>
              {effectiveCur}
            </Text>
          </View>
        </View>
        {noteMixedCurrency && (
          <Text style={s.sectionNote}>
            KPIs calculated in {statsCurrency}. Pick a currency above to switch.
          </Text>
        )}
        <View style={{ marginBottom: 10 }}>
          <StatCard
            title="Last Month"
            value={fmtMoney(kpis.last, statsCurrency)}
            accent="neutral"
            chipText="LOOKBACK"
          />
          <StatCard
            title="This Month"
            value={fmtMoney(kpis.this, statsCurrency)}
            accent="expense"
            chipText="CURRENT"
          />
          <StatCard
            title="Yearly Avg"
            value={fmtMoney(kpis.yearlyAvg, statsCurrency)}
            accent="green"
            chipText="AVERAGE"
          />
        </View>
        <View style={s.chartBlock}>
          <View style={s.chartHeaderRow}>
            <View style={[s.ctrlDot, { backgroundColor: VIOLET }]} />
            <Text style={[s.chartTitle, { color: VIOLET }]}>BY CATEGORY</Text>
          </View>
          {!spendingByCategory.length ? (
            <Text style={s.chartEmpty}>No data yet.</Text>
          ) : (
            spendingByCategory.map((c) => (
              <View key={c.catId} style={s.catRow}>
                <View style={s.catRowTop}>
                  <Text style={s.catName} numberOfLines={1}>
                    {c.catName}
                  </Text>
                  <Text style={[s.catAmount, { color: VIOLET }]}>
                    {fmtMoney(
                      c.major *
                        Math.pow(10, decimalsForCurrency(statsCurrency)),
                      statsCurrency,
                    )}
                  </Text>
                </View>
                <View style={s.catBarTrack}>
                  <View
                    style={[
                      s.catBarFill,
                      {
                        width: `${Math.max(6, c.pct)}%`,
                        backgroundColor: VIOLET,
                      },
                    ]}
                  />
                </View>
              </View>
            ))
          )}
        </View>
        <View style={s.chartBlock}>
          <View style={s.chartHeaderRow}>
            <View style={[s.ctrlDot, { backgroundColor: MINT }]} />
            <Text style={[s.chartTitle, { color: MINT }]}>LAST 7 DAYS</Text>
          </View>
          {!dailySeries.points.length || dailySeries.max <= 0 ? (
            <Text style={s.chartEmpty}>No recent data.</Text>
          ) : (
            <View style={s.sparklineRow}>
              {dailySeries.points.map((p) => {
                const ratio = dailySeries.max ? p.value / dailySeries.max : 0;
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
                            backgroundColor: MINT,
                          },
                        ]}
                      />
                    </View>
                    <Text style={s.sparkLabel}>{p.label}</Text>
                  </View>
                );
              })}
            </View>
          )}
        </View>
        <View style={s.totalWrap}>
          {totals.map(({ cur, major }) => (
            <View
              key={cur}
              style={[s.totalPill, { borderColor: "rgba(0,212,255,0.22)" }]}
            >
              <View style={[s.ctrlDot, { backgroundColor: CYAN }]} />
              <Text style={[s.totalPillTxt, { color: CYAN }]}>
                Total {cur}: {major}
              </Text>
            </View>
          ))}
        </View>
      </View>
    );
  }

  /* ── loading ── */
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
            <Brackets color={VIOLET} size={20} thick={2} />
            <ActivityIndicator size="large" color={VIOLET} />
          </View>
          <Text style={s.loadingTitle}>EXPENSES</Text>
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
        contentContainerStyle={{ paddingBottom: 132 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Header />
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
        <Insights />
        <View style={s.sectionCard}>
          <Brackets color={MINT} size={10} thick={1} />
          <View style={[s.sectionHairline, { backgroundColor: MINT }]} />
          <View style={s.sectionHeaderRow}>
            <View>
              <Text style={s.sectionEyebrow}>TRANSACTION FEED</Text>
              <Text style={s.sectionTitle}>Expense history</Text>
            </View>
            <View
              style={[s.currencyPill, { borderColor: "rgba(0,255,135,0.22)" }]}
            >
              <View style={[s.ctrlDot, { backgroundColor: MINT }]} />
              <Text style={[s.currencyPillTxt, { color: MINT }]}>
                {rows.length} records
              </Text>
            </View>
          </View>
          {rows.length === 0 ? (
            <Text style={s.emptyText}>
              No expenses found. Add your first one or adjust filters.
            </Text>
          ) : (
            <FlatList
              data={rows}
              keyExtractor={(item) => String(item._id)}
              renderItem={renderRow}
              scrollEnabled={false}
            />
          )}
        </View>
      </ScrollView>

      {/* FABs */}
      <View style={s.fabWrap}>
        <TouchableOpacity
          style={s.fabAuto}
          onPress={openAutoAdd}
          activeOpacity={0.8}
        >
          <Brackets color={VIOLET} size={8} thick={1} />
          <Text style={[s.fabTxt, { color: VIOLET }]}>AUTO</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={s.fabAdd}
          onPress={openCreate}
          activeOpacity={0.8}
        >
          <Brackets color={BG} size={8} thick={1} />
          <Text style={s.fabAddTxt}>+</Text>
        </TouchableOpacity>
      </View>

      {/* Auto-add modal */}
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
            <Brackets color={MINT} size={10} thick={1.5} />
            <View style={[s.modalHairline, { backgroundColor: MINT }]} />
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <Text style={s.modalTitle}>AUTO ADD EXPENSE</Text>
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
                      accent={MINT}
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
                placeholder="e.g. groceries 45 usd today, category groceries"
                placeholderTextColor={T_DIM}
                style={[s.modalInput, { minHeight: 90 }]}
                multiline
              />
              <Text style={s.modalHint}>
                Include amount + currency + category + date if possible.
              </Text>
              <ScanLine
                color={MINT}
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
                    { backgroundColor: MINT },
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
              <TouchableOpacity
                onPress={() => {
                  setAutoOpen(false);
                  openUpcomingAuto();
                }}
                style={{ marginTop: 10 }}
              >
                <Text
                  style={[
                    s.modalHint,
                    { color: CYAN, textDecorationLine: "underline" },
                  ]}
                >
                  Open Upcoming panel instead
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {ExpenseModal()}

      {/* Camera overlay */}
      {scannerVisible && (
        <View style={s.camOverlay}>
          <SafeAreaView>
            <View style={s.camTopBar}>
              <TouchableOpacity
                onPress={() => {
                  setScannerVisible(false);
                  setIsScanning(false);
                  setModalOpen(true);
                }}
              >
                <Text style={[s.camTopTxt, { color: MINT }]}>CANCEL</Text>
              </TouchableOpacity>
              <View style={s.logoRow}>
                <View style={[s.statusDot, { backgroundColor: MINT }]} />
                <Text style={s.logoTxt}>SCANNER</Text>
              </View>
              <TouchableOpacity
                onPress={() => setFlash((p) => (p === "off" ? "torch" : "off"))}
              >
                <Text
                  style={[
                    s.camTopTxt,
                    { color: flash === "off" ? T_DIM : MINT },
                  ]}
                >
                  FLASH
                </Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
          <View style={s.camBody}>
            <CameraView
              ref={cameraRef}
              style={StyleSheet.absoluteFillObject}
              facing={facing}
              flash={flash}
              barcodeScannerSettings={{
                barcodeTypes: [
                  "ean13",
                  "code128",
                  "code39",
                  "upc_a",
                  "upc_e",
                  "ean8",
                ],
              }}
              onBarcodeScanned={isScanning ? handleBarCodeScanned : undefined}
            />
            <View
              pointerEvents="none"
              style={[
                s.camHudFrame,
                {
                  position: "absolute",
                  left: 24,
                  right: 24,
                  top: "18%",
                  bottom: "22%",
                },
              ]}
            >
              <Brackets color={MINT} size={20} thick={2} />
              <View
                style={{
                  position: "absolute",
                  top: "50%",
                  left: 0,
                  right: 0,
                  height: 1,
                  backgroundColor: MINT,
                  opacity: 0.3,
                }}
              />
            </View>
          </View>
          <View style={s.camBottomBar}>
            <TouchableOpacity
              style={s.camIconBtn}
              onPress={() =>
                setFacing((p) => (p === "back" ? "front" : "back"))
              }
            >
              <Text style={[s.camIconTxt, { color: CYAN }]}>FLIP</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.shutterOuter, { borderColor: MINT }]}
              disabled={isScanning}
              activeOpacity={0.7}
              onPress={async () => {
                if (isScanning || ocrBusyRef.current) return;
                ocrBusyRef.current = true;
                try {
                  if (!cameraRef.current) return;
                  const photo = await cameraRef.current.takePictureAsync({
                    base64: false,
                    quality: 0.85,
                  });
                  setScannerVisible(false);
                  let rawText = "",
                    parsed = null;
                  const canOcr = Platform.OS !== "ios";
                  if (canOcr) {
                    try {
                      const r = await TextRecognition.recognize(photo.uri);
                      rawText = r?.text || "";
                      parsed = parseReceiptFromText(rawText);
                    } catch {}
                  }
                  const missing =
                    !parsed?.amount || !parsed?.date || !parsed?.seller;
                  if (!parsed || missing) {
                    try {
                      const b = (await parseReceiptViaBackend(photo.uri)) || {};
                      rawText = b.rawText || b.text || rawText || "";
                      parsed = {
                        amount: b.amount || b.total || null,
                        currency: b.currency || parsed?.currency || null,
                        date: b.date || parsed?.date || null,
                        seller:
                          b.seller || b.merchant || parsed?.seller || null,
                        description: b.description || b.seller || null,
                      };
                    } catch (e) {
                      if (Platform.OS === "ios") {
                        setModalOpen(true);
                        Alert.alert(
                          "Smart scan needs OCR",
                          "Add backend OCR endpoint /receipt/parse.",
                        );
                        return;
                      }
                    }
                  }
                  setModalOpen(true);
                  if (
                    !parsed ||
                    (!parsed.amount && !parsed.date && !parsed.seller)
                  ) {
                    Alert.alert(
                      "Could not auto-fill",
                      "Retake with good lighting and the TOTAL line visible.",
                    );
                    return;
                  }
                  applyParsedToForm(parsed, rawText);
                  Alert.alert(
                    "Smart scan complete",
                    "Filled amount + date + description. Review before saving.",
                  );
                } catch (e) {
                  setModalOpen(true);
                  Alert.alert(
                    "Scan error",
                    e.message || "Couldn't read this receipt.",
                  );
                } finally {
                  ocrBusyRef.current = false;
                }
              }}
            >
              <View style={[s.shutterInner, { backgroundColor: MINT }]} />
            </TouchableOpacity>
            <TouchableOpacity
              style={s.camIconBtn}
              onPress={() => {
                setScannerVisible(false);
                setIsScanning(false);
                setModalOpen(true);
              }}
            >
              <Text style={[s.camIconTxt, { color: VIOLET }]}>CLOSE</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {scanProcessing && (
        <View style={s.processingOverlay}>
          <ActivityIndicator size="large" color={VIOLET} />
          <Text style={[s.loadingMono, { marginTop: 10 }]}>
            READING RECEIPT…
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
}

/* ══════════════════════════════════════════════════════════
   STYLES — cyberpunk HUD, synced with DashboardScreen
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
    borderColor: "rgba(167,139,250,0.22)",
    backgroundColor: "rgba(167,139,250,0.04)",
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
    borderColor: "rgba(0,255,135,0.20)",
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
  upcomingBadge: {
    marginLeft: 4,
    minWidth: 20,
    height: 20,
    borderRadius: 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(167,139,250,0.18)",
    borderWidth: 1,
    borderColor: "rgba(167,139,250,0.28)",
  },
  upcomingBadgeTxt: { fontSize: 10, fontWeight: "800", color: VIOLET },

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
  catRow: { marginBottom: 8 },
  catRowTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  catName: { fontSize: 11, color: T_HI, flex: 1, marginRight: 4 },
  catAmount: { fontSize: 11, fontWeight: "700" },
  catBarTrack: {
    height: 5,
    borderRadius: 1,
    backgroundColor: "rgba(255,255,255,0.04)",
    overflow: "hidden",
  },
  catBarFill: { height: "100%", borderRadius: 1 },
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
    color: VIOLET,
  },
  rowAccPill: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: CARD_BD,
    borderRadius: 2,
    paddingHorizontal: 7,
    paddingVertical: 3,
    backgroundColor: "rgba(255,255,255,0.025)",
    marginBottom: 6,
  },
  rowAccTxt: { fontSize: 9, color: T_DIM, letterSpacing: 0.3 },
  rowDesc: { fontSize: 12, color: T_MID, lineHeight: 17, marginBottom: 3 },
  rowDate: { fontSize: 10, color: T_DIM, letterSpacing: 0.3 },
  rowTags: { fontSize: 10, color: MINT, marginTop: 4, letterSpacing: 0.5 },
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
  rowBtnTxt: { fontSize: 8, fontWeight: "800", letterSpacing: 1 },

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
    marginBottom: 14,
    marginTop: 4,
  },
  modalLabel: {
    fontSize: 8,
    fontWeight: "800",
    color: T_DIM,
    letterSpacing: 2,
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
  modalBtnTxt: { fontSize: 9, fontWeight: "800", letterSpacing: 1 },

  scanBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: "rgba(0,255,135,0.28)",
    backgroundColor: "rgba(255,255,255,0.025)",
  },
  scanBtnDot: { width: 5, height: 5, borderRadius: 999 },
  scanBtnTxt: { fontSize: 9, fontWeight: "800", letterSpacing: 1 },

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
    backgroundColor: "rgba(167,139,250,0.10)",
    borderWidth: 1,
    borderColor: "rgba(167,139,250,0.30)",
    position: "relative",
  },
  fabTxt: { fontSize: 9, fontWeight: "800", letterSpacing: 1 },
  fabAdd: {
    width: 54,
    height: 54,
    borderRadius: 2,
    backgroundColor: MINT,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  fabAddTxt: { fontSize: 26, lineHeight: 28, color: BG, fontWeight: "800" },

  camOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: BG,
  },
  camTopBar: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,255,135,0.12)",
  },
  camTopTxt: { fontSize: 9, fontWeight: "800", letterSpacing: 1.5 },
  camBody: { flex: 1, position: "relative" },
  camHudFrame: { borderWidth: 1, borderColor: "rgba(0,255,135,0.15)" },
  camBottomBar: {
    paddingHorizontal: 18,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "rgba(0,255,135,0.12)",
  },
  camIconBtn: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: CARD_BD,
    backgroundColor: "rgba(255,255,255,0.025)",
  },
  camIconTxt: { fontSize: 9, fontWeight: "800", letterSpacing: 1.5 },
  shutterOuter: {
    width: 60,
    height: 60,
    borderRadius: 2,
    borderWidth: 3,
    alignItems: "center",
    justifyContent: "center",
  },
  shutterInner: { width: 42, height: 42, borderRadius: 2 },

  processingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(3,5,8,0.78)",
  },
});
