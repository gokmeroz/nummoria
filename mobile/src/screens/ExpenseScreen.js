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
   THEME — aligned with DashboardScreen.js
────────────────────────────────────────────────────────── */
const BG_DARK = "#070A07";
const CARD_BG = "rgba(255,255,255,0.03)";
const CARD_BORDER = "rgba(255,255,255,0.10)";
const TEXT_PRIMARY = "#f9fafb";
const TEXT_MUTED = "rgba(255,255,255,0.70)";
const TEXT_SOFT = "rgba(255,255,255,0.55)";
const MAIN = "#4f772d";
const SECONDARY = "#90a955";
const GREEN = "#13e243";
const EXPENSE = "#991746";
const GREEN_GLOW = "rgba(19,226,67,0.10)";
const PINK_GLOW = "rgba(153,23,70,0.12)";
const CARD_INNER = "rgba(255,255,255,0.04)";
const DATE_LANG = "en-US";

/* --------------------------- Date helpers --------------------------- */
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

/* --------------------------- Money helpers --------------------------- */
function decimalsForCurrency(code) {
  const zero = new Set(["JPY", "KRW", "CLP", "VND"]);
  const three = new Set(["BHD", "IQD", "JOD", "KWD", "OMR", "TND"]);
  if (zero.has(code)) return 0;
  if (three.has(code)) return 3;
  return 2;
}
function majorToMinor(amountStr, currency) {
  const decimals = decimalsForCurrency(currency);
  const n = Number(String(amountStr).replace(",", "."));
  if (Number.isNaN(n)) return NaN;
  return Math.round(n * Math.pow(10, decimals));
}
function minorToMajor(minor, currency) {
  const decimals = decimalsForCurrency(currency);
  return (minor / Math.pow(10, decimals)).toFixed(decimals);
}
const fmtMoney = (minor, cur = "USD") =>
  new Intl.NumberFormat(DATE_LANG, {
    style: "currency",
    currency: cur || "USD",
  }).format((minor || 0) / Math.pow(10, decimalsForCurrency(cur || "USD")));

/* --------------------- Receipt QR parse helper --------------------- */
function parseReceiptFromQR(data) {
  if (!data || typeof data !== "string") return null;

  let amount;
  let currency;
  let dateStr;
  let description;

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
    const match = data.match(/([0-9]+[.,][0-9]{2})/);
    if (match) amount = match[1];
  }

  if (!currency) {
    const curMatch = data.match(/\b(USD|EUR|TRY|GBP)\b/i);
    if (curMatch) currency = curMatch[1].toUpperCase();
  }

  if (!dateStr) {
    const iso = data.match(/(\d{4}-\d{2}-\d{2})/);
    const eu = data.match(/(\d{2}\.\d{2}\.\d{4})/);
    if (iso) {
      dateStr = iso[1];
    } else if (eu) {
      const raw = eu[1];
      const [dd, mm, yyyy] = raw.split(".");
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

/* --------------------- Receipt OCR text parse helper --------------------- */
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
        .map((s) => ({
          s,
          n: Number(s.replace(",", ".")),
        }))
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

/* --------------------- Category inference (local rules) --------------------- */
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

/* ----------------------------- UI Primitives ----------------------------- */
function Chip({ label, selected, onPress, small }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        styles.chip,
        small && styles.chipSmall,
        selected && styles.chipSelected,
      ]}
      activeOpacity={0.85}
    >
      <Text
        style={[
          styles.chipText,
          small && styles.chipTextSmall,
          selected && styles.chipTextSelected,
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function StatCard({
  title,
  value,
  accent = "expense",
  chipText = "THIS MONTH",
}) {
  const accentMap = {
    expense: {
      glow: "rgba(153,23,70,0.20)",
      dot: EXPENSE,
      chipBg: "rgba(153,23,70,0.15)",
      chipBorder: "rgba(153,23,70,0.32)",
      valueColor: SECONDARY,
    },
    neutral: {
      glow: "rgba(144,169,85,0.15)",
      dot: SECONDARY,
      chipBg: "rgba(255,255,255,0.05)",
      chipBorder: "rgba(255,255,255,0.12)",
      valueColor: SECONDARY,
    },
    green: {
      glow: "rgba(19,226,67,0.16)",
      dot: GREEN,
      chipBg: "rgba(19,226,67,0.14)",
      chipBorder: "rgba(19,226,67,0.32)",
      valueColor: SECONDARY,
    },
  };

  const a = accentMap[accent] || accentMap.neutral;

  return (
    <View style={styles.statCard}>
      <View style={[styles.statGlow, { backgroundColor: a.glow }]} />
      <View style={styles.statHairline} />

      <View style={styles.statTopRow}>
        <View style={{ flex: 1, paddingRight: 10 }}>
          <Text style={styles.statLabel}>{title}</Text>
          <Text style={[styles.statValue, { color: a.valueColor }]}>
            {value}
          </Text>
        </View>

        <View
          style={[
            styles.statChip,
            {
              backgroundColor: a.chipBg,
              borderColor: a.chipBorder,
            },
          ]}
        >
          <View style={[styles.statChipDot, { backgroundColor: a.dot }]} />
          <Text style={styles.statChipText}>{chipText}</Text>
        </View>
      </View>

      <View style={styles.statBottomRow}>
        <View style={styles.statHintRow}>
          <View style={styles.statHintDot} />
          <Text style={styles.statHint}>Updated from filters</Text>
        </View>
      </View>
    </View>
  );
}

/* =============================== Screen =============================== */

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

      const cats = (catRes.data || []).filter(
        (c) => c.kind === "expense" && !c.isDeleted,
      );

      const accs = (accRes.data || []).filter((a) => !a.isDeleted);

      const txs = (txRes.data || []).filter(
        (t) => t.type === "expense" && !t.isDeleted,
      );

      setCategories(cats);
      setAccounts(accs);
      setTransactions(txs);
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

    if (preset === "THIS_MONTH") {
      const s = startOfMonthUTC(today);
      const e = endOfMonthUTC(today);
      return txDate >= s && txDate <= e;
    }

    if (preset === "LAST_MONTH") {
      const lastMonthRef = addMonthsUTC(today, -1);
      const s = startOfMonthUTC(lastMonthRef);
      const e = endOfMonthUTC(lastMonthRef);
      return txDate >= s && txDate <= e;
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
      if ((t.type || "") !== "expense") return false;
      if (t.isDeleted) return false;

      if (fAccountId !== "ALL" && String(t.accountId) !== String(fAccountId))
        return false;
      if (fCategoryId !== "ALL" && String(t.categoryId) !== String(fCategoryId))
        return false;

      const cur = t.currency || "USD";
      if (fCurrency !== "ALL" && cur !== fCurrency) return false;

      if (!passesDateFilter(t.date, datePreset)) return false;

      if (needle) {
        const cat = categoriesById.get(t.categoryId)?.name || "";
        const acc = accountsById.get(t.accountId)?.name || "";
        const hay = `${t.description || ""} ${t.notes || ""} ${cat} ${acc} ${(
          t.tags || []
        ).join(" ")}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }

      return true;
    });

    filtered.sort((a, b) => {
      switch (sortKey) {
        case "date_asc":
          return new Date(a.date) - new Date(b.date);
        case "amount_desc": {
          const aMaj =
            Number(a.amountMinor || 0) /
            Math.pow(10, decimalsForCurrency(a.currency || "USD"));
          const bMaj =
            Number(b.amountMinor || 0) /
            Math.pow(10, decimalsForCurrency(b.currency || "USD"));
          return bMaj - aMaj;
        }
        case "amount_asc": {
          const aMaj =
            Number(a.amountMinor || 0) /
            Math.pow(10, decimalsForCurrency(a.currency || "USD"));
          const bMaj =
            Number(b.amountMinor || 0) /
            Math.pow(10, decimalsForCurrency(b.currency || "USD"));
          return aMaj - bMaj;
        }
        case "date_desc":
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
      if (t.type !== "expense") continue;
      if (t.isDeleted) continue;
      const dt = new Date(t.date);
      if (dt > today) {
        map.set(keyOf(t), { ...t, __kind: "actual" });
      }
    }

    for (const t of transactions) {
      if (t.type !== "expense" || !t.nextDate) continue;
      if (t.isDeleted) continue;
      const nd = new Date(t.nextDate);
      if (nd <= today) continue;

      const v = {
        ...t,
        _id: `virtual-${t._id}`,
        date: nd.toISOString(),
        __kind: "virtual",
        __parentId: t._id,
      };
      const k = keyOf(v);
      if (!map.has(k)) map.set(k, v);
    }

    const needle = q.trim().toLowerCase();

    const arr = Array.from(map.values()).filter((t) => {
      if (fAccountId !== "ALL" && String(t.accountId) !== String(fAccountId))
        return false;
      if (fCategoryId !== "ALL" && String(t.categoryId) !== String(fCategoryId))
        return false;
      const cur = t.currency || "USD";
      if (fCurrency !== "ALL" && cur !== fCurrency) return false;

      if (!passesDateFilter(t.date, datePreset)) return false;

      if (needle) {
        const cat = categoriesById.get(t.categoryId)?.name || "";
        const acc = accountsById.get(t.accountId)?.name || "";
        const hay = `${t.description || ""} ${t.notes || ""} ${cat} ${acc} ${(
          t.tags || []
        ).join(" ")}`.toLowerCase();
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
    const filteredByCur = rows.filter((r) =>
      chosen ? r.currency === chosen : true,
    );

    const now = new Date();
    const thisStart = startOfMonthUTC(now);
    const thisEnd = endOfMonthUTC(now);
    const lastStart = startOfMonthUTC(addMonthsUTC(now, -1));
    const lastEnd = endOfMonthUTC(addMonthsUTC(now, -1));

    const minorSum = (arr) =>
      arr.reduce((acc, t) => acc + Number(t.amountMinor || 0), 0);

    const within = (arr, s, e) =>
      arr.filter((t) => {
        const d = new Date(t.date);
        return d >= s && d <= e;
      });

    const thisMonth = within(filteredByCur, thisStart, thisEnd);
    const lastMonth = within(filteredByCur, lastStart, lastEnd);

    const monthsPassed = now.getUTCMonth() + 1;
    let yearMinor = 0;
    for (let m = 0; m < monthsPassed; m++) {
      const s = startOfMonthUTC(new Date(Date.UTC(now.getUTCFullYear(), m, 1)));
      const e = endOfMonthUTC(new Date(Date.UTC(now.getUTCFullYear(), m, 1)));
      yearMinor += minorSum(within(filteredByCur, s, e));
    }

    const k = {
      last: minorSum(lastMonth),
      this: minorSum(thisMonth),
      yearlyAvg: monthsPassed ? Math.round(yearMinor / monthsPassed) : 0,
    };

    return {
      statsCurrency: chosen,
      kpis: k,
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

    const totalMinor = entries.reduce((acc, [, s]) => acc + s, 0);
    entries.sort((a, b) => b[1] - a[1]);

    return entries.slice(0, 5).map(([catId, sum]) => {
      const catName = categoriesById.get(catId)?.name || "Other";
      const major =
        sum / Math.pow(10, decimalsForCurrency(statsCurrency || "USD"));
      const pct = totalMinor ? Math.round((sum / totalMinor) * 100) : 0;
      return { catId, catName, major, pct };
    });
  }, [rows, statsCurrency, categoriesById]);

  const dailySeries = useMemo(() => {
    const today = startOfUTC(new Date());
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setUTCDate(d.getUTCDate() - i);
      const key = d.toISOString().slice(0, 10);
      days.push({ key, date: d });
    }

    const sums = new Map();
    for (const t of rows) {
      if (t.currency !== statsCurrency) continue;
      const d = startOfUTC(new Date(t.date));
      const key = d.toISOString().slice(0, 10);
      sums.set(key, (sums.get(key) || 0) + Number(t.amountMinor || 0));
    }

    const points = days.map((d) => {
      const minor = sums.get(d.key) || 0;
      const major =
        minor / Math.pow(10, decimalsForCurrency(statsCurrency || "USD"));
      return {
        label: d.date.toLocaleDateString(DATE_LANG, {
          month: "2-digit",
          day: "2-digit",
        }),
        value: major,
      };
    });

    const max = points.reduce((m, p) => Math.max(m, p.value), 0);
    return { points, max };
  }, [rows, statsCurrency]);

  const openAutoAdd = useCallback(() => {
    setAutoAccountId(accountId || defaultAccountId || "");
    setAutoText("");
    setAutoOpen(true);
  }, [accountId, defaultAccountId]);

  const submitAuto = useCallback(async () => {
    const text = String(autoText || "").trim();
    const accId = autoAccountId || accountId || defaultAccountId;

    if (!accId) {
      Alert.alert("Missing account", "Pick an account for auto add.");
      return;
    }
    if (!text) {
      Alert.alert(
        "Missing text",
        "Type what you want to add (natural language).",
      );
      return;
    }

    try {
      setAutoLoading(true);
      await api.post("/auto/transactions/text", {
        accountId: accId,
        text,
      });

      setAutoOpen(false);
      setAutoText("");
      setAutoAccountId("");

      await loadAll();
    } catch (e) {
      const msg = e?.response?.data?.error || e.message || "Auto add failed.";
      Alert.alert("Auto add failed", msg);
    } finally {
      setAutoLoading(false);
    }
  }, [autoText, autoAccountId, accountId, defaultAccountId, loadAll]);

  function openCreate() {
    const defaultAccId = accountId || accounts[0]?._id || "";
    const defaultCur =
      accounts.find((a) => a._id === defaultAccId)?.currency || "USD";

    setEditing(null);
    setForm({
      amount: "",
      currency: defaultCur,
      date: new Date().toISOString().slice(0, 10),
      nextDate: "",
      categoryId: categories[0]?._id || "",
      description: "",
      tagsCsv: "",
      accountId: defaultAccId,
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
          const { data: parentUpdated } = await api.put(
            `/transactions/${v.__parentId}`,
            { nextDate: null },
          );
          setTransactions((prev) =>
            prev.map((t) =>
              String(t._id) === String(parentUpdated._id) ? parentUpdated : t,
            ),
          );
        } catch {}
      }

      const createdArr = Array.isArray(data?.created) ? data.created : [data];
      setTransactions((prev) => [...createdArr, ...prev]);
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
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    });
  }, []);

  async function parseReceiptViaBackend(photoUri) {
    const fd = new FormData();
    fd.append("file", {
      uri: photoUri,
      name: `receipt_${Date.now()}.jpg`,
      type: "image/jpeg",
    });

    const res = await api.post("/receipt/parse", fd, {
      timeout: 30000,
    });

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
      let rawText = "";
      let parsed = null;

      const canUseOnDeviceOcr = Platform.OS !== "ios";

      if (canUseOnDeviceOcr) {
        try {
          const result = await TextRecognition.recognize(photoUri);
          rawText = result?.text || "";
          parsed = parseReceiptFromText(rawText);
        } catch {}
      }

      const missingCritical =
        !parsed?.amount || !parsed?.date || !parsed?.seller;

      if (!parsed || missingCritical) {
        const backendParsed = await parseReceiptViaBackend(photoUri);

        const b = backendParsed || {};
        const normalized = {
          amount: b.amount || b.total || null,
          currency: b.currency || null,
          date: b.date || null,
          seller: b.seller || b.merchant || null,
          description: b.description || null,
        };

        rawText = b.rawText || b.text || rawText || "";

        parsed = {
          amount: normalized.amount || parsed?.amount || null,
          currency: normalized.currency || parsed?.currency || null,
          date: normalized.date || parsed?.date || null,
          seller: normalized.seller || parsed?.seller || null,
          description: normalized.description || parsed?.seller || null,
        };
      }

      if (!parsed || (!parsed.amount && !parsed.date && !parsed.seller)) {
        return { ok: false, parsed: null, rawText: "" };
      }

      applyParsedToForm(parsed, rawText);

      if (receiptId) {
        setForm((prev) => ({
          ...prev,
          description: prev.description?.trim()
            ? `${prev.description} (Receipt ID: ${receiptId})`
            : `Receipt ID: ${receiptId}`,
        }));
      }

      return { ok: true, parsed, rawText };
    },
    [accountId, accounts, categories, form.accountId, form.currency],
  );

  const openScanner = useCallback(async () => {
    try {
      const ensurePerm = async () => {
        if (!permission) {
          const res = await requestPermission();
          return !!res?.granted;
        }
        if (!permission.granted) {
          const res = await requestPermission();
          return !!res?.granted;
        }
        return true;
      };

      const ok = await ensurePerm();
      if (!ok) {
        Alert.alert(
          "Camera permission needed",
          "Enable camera access to scan receipt QR codes in your device settings.",
        );
        return;
      }

      setModalOpen(false);
      scannedOnceRef.current = false;
      setIsScanning(true);
      setScannerVisible(true);
    } catch (e) {
      Alert.alert("Error", e.message || "Failed to open scanner");
    }
  }, [permission, requestPermission]);

  const handleBarCodeScanned = useCallback(
    async ({ type, data }) => {
      if (scannedOnceRef.current) return;
      scannedOnceRef.current = true;

      const text = String(data || "");
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

        const isLikelyIdOnly =
          type === "code128" && /^[0-9]{10,30}$/.test(text);
        const receiptId = isLikelyIdOnly ? text : null;

        const { ok } = await runSmartScanFromPhoto(photo.uri, { receiptId });

        if (!ok) {
          Alert.alert(
            "Could not auto-fill",
            "I couldn’t confidently detect total/date/merchant. Retake with the full receipt visible, good lighting, and the TOTAL line included.",
          );
          return;
        }

        Alert.alert(
          "Receipt captured",
          "Auto-filled amount + date + description and inferred a category. Review and save.",
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
    try {
      const ensurePerm = async () => {
        if (!permission) {
          const res = await requestPermission();
          return !!res?.granted;
        }
        if (!permission.granted) {
          const res = await requestPermission();
          return !!res?.granted;
        }
        return true;
      };

      const ok = await ensurePerm();
      if (!ok) {
        Alert.alert(
          "Camera permission needed",
          "Enable camera access to scan receipts.",
        );
        return;
      }

      setModalOpen(false);
      setScannerVisible(true);
      setIsScanning(false);
    } catch (e) {
      Alert.alert("Error", e.message || "Failed to open camera.");
    }
  }, [permission, requestPermission]);

  function renderRow({ item }) {
    const catName =
      categories.find((c) => c._id === item.categoryId)?.name || "—";
    const accName = accountsById.get(item.accountId)?.name || "—";
    const isFuture = new Date(item.date) > startOfUTC(new Date());

    return (
      <View style={styles.rowContainer}>
        <View style={styles.rowLeft}>
          <View style={styles.rowTitleLine}>
            <Text style={styles.rowCategory}>{catName}</Text>
            {isFuture && <Text style={styles.badgeUpcoming}>Upcoming</Text>}
          </View>

          <View style={styles.rowMetaWrap}>
            <View style={styles.rowMetaPill}>
              <Text style={styles.rowMetaPillText}>{accName}</Text>
            </View>
          </View>

          <Text style={styles.rowDescription} numberOfLines={2}>
            {item.description || "No description"}
          </Text>
          <Text style={styles.rowDate}>{fmtDateUTC(item.date)}</Text>

          {item.tags?.length ? (
            <Text style={styles.rowTags}>#{item.tags.join("  #")}</Text>
          ) : null}
        </View>

        <View style={styles.rowRight}>
          <Text style={styles.rowAmount}>
            -{minorToMajor(item.amountMinor, item.currency)} {item.currency}
          </Text>

          <View style={styles.rowActions}>
            <TouchableOpacity
              style={styles.rowBtn}
              onPress={() => openEdit(item)}
            >
              <Text style={styles.rowBtnText}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.rowBtn, styles.rowBtnDanger]}
              onPress={() => softDelete(item)}
            >
              <Text style={[styles.rowBtnText, styles.rowBtnDangerText]}>
                Delete
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

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
        accountId: pickedAccountIdRaw,
      } = form;

      const cur = (currency || "USD").toString().toUpperCase();
      const pickedAccountId =
        pickedAccountIdRaw || accountId || accounts[0]?._id || "";

      const amountMinor = majorToMinor(amount, cur);
      if (Number.isNaN(amountMinor)) {
        Alert.alert("Invalid amount", "Please enter a valid number.");
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
          .map((s) => s.trim())
          .filter((s) => s.length > 0),
      };

      if ((nextDate || "").trim()) {
        payload.nextDate = new Date(nextDate).toISOString();
      }

      try {
        if (!editing) {
          const { data } = await api.post("/transactions", payload);
          const createdArr = Array.isArray(data?.created)
            ? data.created
            : [data];
          setTransactions((prev) => [...createdArr, ...prev]);
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
          style={styles.modalBackdrop}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={styles.modalCard}>
            <View style={styles.modalHairline} />
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.modalTitle}>
                {editing ? "Edit expense" : "New expense"}
              </Text>

              <View style={styles.modalField}>
                <Text style={styles.modalLabel}>Account</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                >
                  {accounts.map((a) => (
                    <TouchableOpacity
                      key={a._id}
                      onPress={() =>
                        setForm((f) => ({
                          ...f,
                          accountId: a._id,
                          currency: a.currency || f.currency,
                        }))
                      }
                      style={[
                        styles.chip,
                        form.accountId === a._id && styles.chipSelected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          form.accountId === a._id && styles.chipTextSelected,
                        ]}
                      >
                        {a.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              <View style={styles.modalRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalLabel}>Amount</Text>
                  <TextInput
                    value={form.amount}
                    onChangeText={(v) => setForm((f) => ({ ...f, amount: v }))}
                    keyboardType="numeric"
                    placeholder="0.00"
                    placeholderTextColor={TEXT_MUTED}
                    style={styles.modalInput}
                  />
                </View>
                <View style={{ width: 95 }}>
                  <Text style={styles.modalLabel}>Currency</Text>
                  <TextInput
                    value={form.currency}
                    onChangeText={(v) =>
                      setForm((f) => ({ ...f, currency: v.toUpperCase() }))
                    }
                    autoCapitalize="characters"
                    placeholder="USD"
                    placeholderTextColor={TEXT_MUTED}
                    style={styles.modalInput}
                  />
                </View>
              </View>

              <View style={styles.modalField}>
                <TouchableOpacity
                  style={styles.scanBtn}
                  onPress={openScanner}
                  activeOpacity={0.85}
                >
                  <Text style={styles.scanBtnText}>
                    Scan receipt QR / barcode
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.scanBtn, { marginTop: 8 }]}
                  onPress={openOcrScanner}
                  activeOpacity={0.85}
                >
                  <Text style={styles.scanBtnText}>
                    Smart scan photo → auto-fill
                  </Text>
                </TouchableOpacity>

                <Text style={styles.modalHint}>
                  Use smart scan to extract total, date, merchant, and infer a
                  category.
                </Text>
              </View>

              <View style={styles.modalRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalLabel}>Date</Text>
                  <TextInput
                    value={form.date}
                    onChangeText={(v) => setForm((f) => ({ ...f, date: v }))}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={TEXT_MUTED}
                    style={styles.modalInput}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalLabel}>Next date</Text>
                  <TextInput
                    value={form.nextDate}
                    onChangeText={(v) =>
                      setForm((f) => ({ ...f, nextDate: v }))
                    }
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={TEXT_MUTED}
                    style={styles.modalInput}
                  />
                </View>
              </View>

              <View style={styles.modalField}>
                <Text style={styles.modalLabel}>Category</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                >
                  {categories.map((c) => (
                    <TouchableOpacity
                      key={c._id}
                      onPress={() =>
                        setForm((f) => ({ ...f, categoryId: c._id }))
                      }
                      style={[
                        styles.chip,
                        form.categoryId === c._id && styles.chipSelected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          form.categoryId === c._id && styles.chipTextSelected,
                        ]}
                      >
                        {c.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              <View style={styles.modalField}>
                <Text style={styles.modalLabel}>Description</Text>
                <TextInput
                  value={form.description}
                  onChangeText={(v) =>
                    setForm((f) => ({ ...f, description: v }))
                  }
                  placeholder="Optional description"
                  placeholderTextColor={TEXT_MUTED}
                  style={styles.modalInput}
                />
              </View>

              <View style={styles.modalField}>
                <Text style={styles.modalLabel}>Tags</Text>
                <TextInput
                  value={form.tagsCsv}
                  onChangeText={(v) => setForm((f) => ({ ...f, tagsCsv: v }))}
                  placeholder="groceries, dinner"
                  placeholderTextColor={TEXT_MUTED}
                  style={styles.modalInput}
                />
                <Text style={styles.modalHint}>
                  Example: groceries, dinner, weekend
                </Text>
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.modalBtn, styles.modalBtnSecondary]}
                  onPress={() => setModalOpen(false)}
                >
                  <Text style={styles.modalBtnSecondaryText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalBtn, styles.modalBtnPrimary]}
                  onPress={submit}
                >
                  <Text style={styles.modalBtnPrimaryText}>
                    {editing ? "Save" : "Add"}
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

  function Header() {
    return (
      <View style={styles.headerCard}>
        <View style={styles.cardGlowGreen} />
        <View style={styles.cardGlowPink} />
        <View style={styles.cardHairline} />

        <View style={styles.topBar}>
          <View>
            <Text style={styles.logoText}>Nummoria AI</Text>
          </View>

          <TouchableOpacity
            onPress={() => navigation.navigate("Dashboard")}
            activeOpacity={0.85}
            style={styles.headerLogoBtn}
          >
            <Image source={logo} style={styles.headerLogoImg} />
          </TouchableOpacity>
        </View>

        <View style={styles.greetingBlock}>
          <Text style={styles.heroTitle}>Expenses</Text>
          <Text style={styles.heroSubtitle}>
            Review spending, spot patterns, and keep your outflow
            decision-ready.
          </Text>
        </View>

        <View style={styles.livePill}>
          <View style={styles.livePillDot} />
          <Text style={styles.livePillText}>SPENDING OVERVIEW</Text>
        </View>

        <View style={styles.headerControlsRow}>
          <TouchableOpacity
            style={styles.headerActionPill}
            onPress={() => setShowUpcoming((v) => !v)}
            activeOpacity={0.85}
          >
            <Text style={styles.headerActionPillText}>Upcoming</Text>
            <View style={styles.headerActionBadge}>
              <Text style={styles.headerActionBadgeText}>
                {upcoming.length}
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.headerGhostBtn}
            onPress={loadAll}
            activeOpacity={0.85}
          >
            <Text style={styles.headerGhostBtnText}>Refresh</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.searchWrap}>
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Search description, account, category or #tags"
            placeholderTextColor={TEXT_MUTED}
            style={styles.searchInput}
          />
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipScroll}
          keyboardShouldPersistTaps="handled"
        >
          <Chip
            label="All categories"
            selected={fCategoryId === "ALL"}
            onPress={() => setFCategoryId("ALL")}
          />
          {categories.map((c) => (
            <Chip
              key={c._id}
              label={c.name}
              selected={fCategoryId === c._id}
              onPress={() => setFCategoryId(c._id)}
            />
          ))}
        </ScrollView>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipScrollSmall}
          keyboardShouldPersistTaps="handled"
        >
          <Chip
            label="All accounts"
            selected={fAccountId === "ALL"}
            onPress={() => setFAccountId("ALL")}
            small
          />
          {accounts.map((a) => (
            <Chip
              key={a._id}
              label={a.name}
              selected={fAccountId === a._id}
              onPress={() => setFAccountId(a._id)}
              small
            />
          ))}
        </ScrollView>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipScrollSmall}
          keyboardShouldPersistTaps="handled"
        >
          {currencies.map((c) => (
            <Chip
              key={c}
              label={c === "ALL" ? "All currencies" : c}
              selected={fCurrency === c}
              onPress={() => setFCurrency(c)}
              small
            />
          ))}
        </ScrollView>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipScrollSmall}
          keyboardShouldPersistTaps="handled"
        >
          <Chip
            label="Newest"
            selected={sortKey === "date_desc"}
            onPress={() => setSortKey("date_desc")}
            small
          />
          <Chip
            label="Oldest"
            selected={sortKey === "date_asc"}
            onPress={() => setSortKey("date_asc")}
            small
          />
          <Chip
            label="Amount ↓"
            selected={sortKey === "amount_desc"}
            onPress={() => setSortKey("amount_desc")}
            small
          />
          <Chip
            label="Amount ↑"
            selected={sortKey === "amount_asc"}
            onPress={() => setSortKey("amount_asc")}
            small
          />
        </ScrollView>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipScrollSmall}
          keyboardShouldPersistTaps="handled"
        >
          <Chip
            label="All time"
            selected={datePreset === "ALL"}
            onPress={() => setDatePreset("ALL")}
            small
          />
          <Chip
            label="This month"
            selected={datePreset === "THIS_MONTH"}
            onPress={() => setDatePreset("THIS_MONTH")}
            small
          />
          <Chip
            label="Last month"
            selected={datePreset === "LAST_MONTH"}
            onPress={() => setDatePreset("LAST_MONTH")}
            small
          />
          <Chip
            label="Last 90 days"
            selected={datePreset === "LAST_90"}
            onPress={() => setDatePreset("LAST_90")}
            small
          />
        </ScrollView>
      </View>
    );
  }

  function UpcomingPanel() {
    if (!showUpcoming) return null;

    return (
      <View style={styles.sectionCard}>
        <View style={styles.sectionHairline} />
        <View style={styles.sectionHeaderRow}>
          <View>
            <Text style={styles.sectionEyebrow}>Scheduled flow</Text>
            <Text style={styles.sectionTitle}>Upcoming expenses</Text>
          </View>
          <TouchableOpacity onPress={() => setShowUpcoming(false)}>
            <Text style={styles.sectionClose}>Close</Text>
          </TouchableOpacity>
        </View>

        {upcoming.length === 0 ? (
          <Text style={styles.emptyText}>
            Nothing upcoming within your current filters.
          </Text>
        ) : (
          upcoming.map((u) => {
            const catName =
              categories.find((c) => c._id === u.categoryId)?.name || "—";
            const accName = accountsById.get(u.accountId)?.name || "—";
            const badge =
              u.__kind === "virtual" ? (
                <Text style={styles.badgePlanned}>Planned</Text>
              ) : (
                <Text style={styles.badgeInDb}>In database</Text>
              );

            return (
              <View key={u._id} style={styles.rowContainer}>
                <View style={styles.rowLeft}>
                  <View style={styles.rowTitleLine}>
                    <Text style={styles.rowCategory}>{catName}</Text>
                    {badge}
                  </View>
                  <View style={styles.rowMetaWrap}>
                    <View style={styles.rowMetaPill}>
                      <Text style={styles.rowMetaPillText}>{accName}</Text>
                    </View>
                  </View>
                  <Text style={styles.rowDescription} numberOfLines={2}>
                    {u.description || "No description"}
                  </Text>
                  <Text style={styles.rowDate}>
                    Scheduled: {fmtDateUTC(u.date)}
                  </Text>
                </View>

                <View style={styles.rowRight}>
                  <Text style={styles.rowAmount}>
                    -{minorToMajor(u.amountMinor, u.currency)} {u.currency}
                  </Text>

                  <View style={styles.rowActionsWrap}>
                    {u.__kind === "virtual" ? (
                      <>
                        <TouchableOpacity
                          style={[styles.rowBtn, styles.rowBtnPrimary]}
                          onPress={() => addVirtual(u)}
                        >
                          <Text style={styles.rowBtnPrimaryTextSmall}>Add</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.rowBtn}
                          onPress={() => openCreateSeed(u)}
                        >
                          <Text style={styles.rowBtnText}>Edit</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.rowBtn, styles.rowBtnDanger]}
                          onPress={() => deleteUpcoming(u)}
                        >
                          <Text
                            style={[styles.rowBtnText, styles.rowBtnDangerText]}
                          >
                            Delete
                          </Text>
                        </TouchableOpacity>
                      </>
                    ) : (
                      <>
                        <TouchableOpacity
                          style={styles.rowBtn}
                          onPress={() => openEdit(u)}
                        >
                          <Text style={styles.rowBtnText}>Edit</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.rowBtn, styles.rowBtnDanger]}
                          onPress={() => deleteUpcoming(u)}
                        >
                          <Text
                            style={[styles.rowBtnText, styles.rowBtnDangerText]}
                          >
                            Delete
                          </Text>
                        </TouchableOpacity>
                      </>
                    )}
                  </View>
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
      <View style={styles.sectionCard}>
        <View style={styles.sectionHairline} />

        <View style={styles.sectionHeaderRow}>
          <View>
            <Text style={styles.sectionEyebrow}>Spending KPIs</Text>
            <Text style={styles.sectionTitle}>Insights</Text>
          </View>
          <View style={styles.currencyPill}>
            <Text style={styles.currencyPillText}>{effectiveCur}</Text>
          </View>
        </View>

        {noteMixedCurrency && (
          <Text style={styles.sectionNote}>
            KPIs are calculated in {statsCurrency}. Pick a currency above to
            switch.
          </Text>
        )}

        <View style={styles.statsGrid}>
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

        <View style={styles.chartBlock}>
          <Text style={styles.chartTitle}>By category</Text>
          {!spendingByCategory.length ? (
            <Text style={styles.chartEmpty}>No data yet.</Text>
          ) : (
            spendingByCategory.map((c) => (
              <View key={c.catId} style={styles.catRow}>
                <View style={styles.catRowTop}>
                  <Text style={styles.catName} numberOfLines={1}>
                    {c.catName}
                  </Text>
                  <Text style={styles.catAmount}>
                    {fmtMoney(
                      c.major *
                        Math.pow(10, decimalsForCurrency(statsCurrency)),
                      statsCurrency,
                    )}
                  </Text>
                </View>
                <View style={styles.catBarTrack}>
                  <View
                    style={[
                      styles.catBarFill,
                      { width: `${Math.max(6, c.pct)}%` },
                    ]}
                  />
                </View>
              </View>
            ))
          )}
        </View>

        <View style={styles.chartBlock}>
          <Text style={styles.chartTitle}>Last 7 days</Text>
          {!dailySeries.points.length || dailySeries.max <= 0 ? (
            <Text style={styles.chartEmpty}>No recent data.</Text>
          ) : (
            <View style={styles.sparklineRow}>
              {dailySeries.points.map((p) => {
                const ratio = dailySeries.max ? p.value / dailySeries.max : 0;
                const height = 8 + ratio * 34;
                return (
                  <View key={p.label} style={styles.sparkCol}>
                    <View style={styles.sparkBarTrack}>
                      <View
                        style={[
                          styles.sparkBarFill,
                          { height, marginTop: 42 - height },
                        ]}
                      />
                    </View>
                    <Text style={styles.sparkLabel}>{p.label}</Text>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        <View style={styles.totalWrap}>
          {totals.map(({ cur, major }) => (
            <View key={cur} style={styles.totalPill}>
              <Text style={styles.totalPillText}>
                Total {cur}: {major}
              </Text>
            </View>
          ))}
        </View>
      </View>
    );
  }

  if (!initialDone) {
    return (
      <SafeAreaView style={styles.loadingScreen}>
        <View style={styles.loadingGlow} />
        <ActivityIndicator size="large" color={SECONDARY} />
        <Text style={styles.loadingTitle}>Nummoria</Text>
        <Text style={styles.loadingSubtitle}>Loading your expenses...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View pointerEvents="none" style={styles.bgLayer}>
        <View style={styles.bgGlowGreen} />
        <View style={styles.bgGlowPink} />
        <View style={styles.bgGlowBottom} />
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.content}
        contentContainerStyle={{ paddingBottom: 132 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Header />
        <UpcomingPanel />

        {!!err && (
          <View style={styles.errorCard}>
            <View style={styles.errorIconWrap}>
              <Text style={styles.errorIconText}>!</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.errorTitle}>Something didn't load</Text>
              <Text style={styles.errorBody}>{err}</Text>
            </View>
          </View>
        )}

        <Insights />

        <View style={styles.sectionCard}>
          <View style={styles.sectionHairline} />
          <View style={styles.sectionHeaderRow}>
            <View>
              <Text style={styles.sectionEyebrow}>Transaction feed</Text>
              <Text style={styles.sectionTitle}>Expense history</Text>
            </View>
          </View>

          {rows.length === 0 ? (
            <Text style={styles.emptyText}>
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

      <View style={styles.fabContainer}>
        <TouchableOpacity style={styles.fabAuto} onPress={openAutoAdd}>
          <Text style={styles.fabAutoText}>Auto</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.fab} onPress={openCreate}>
          <Text style={styles.fabPlus}>＋</Text>
        </TouchableOpacity>
      </View>

      <Modal
        visible={autoOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setAutoOpen(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalBackdrop}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={styles.modalCard}>
            <View style={styles.modalHairline} />
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.modalTitle}>Auto add expense</Text>

              <Text style={styles.modalLabel}>Account</Text>
              {accounts.length === 0 ? (
                <Text style={styles.modalHint}>
                  No active accounts found. Create one first.
                </Text>
              ) : (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                >
                  {accounts.map((a) => (
                    <TouchableOpacity
                      key={a._id}
                      onPress={() => setAutoAccountId(a._id)}
                      style={[
                        styles.chip,
                        autoAccountId === a._id && styles.chipSelected,
                      ]}
                      activeOpacity={0.85}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          autoAccountId === a._id && styles.chipTextSelected,
                        ]}
                      >
                        {a.name} · {a.currency}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}

              <View style={{ marginTop: 10 }}>
                <Text style={styles.modalLabel}>Text</Text>
                <TextInput
                  value={autoText}
                  onChangeText={setAutoText}
                  placeholder="e.g. groceries 45 usd today, category groceries"
                  placeholderTextColor={TEXT_MUTED}
                  style={[styles.modalInput, { minHeight: 90 }]}
                  multiline
                />
                <Text style={styles.modalHint}>
                  Tip: include amount + currency + category + date if possible.
                </Text>
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  onPress={() => setAutoOpen(false)}
                  style={[styles.modalBtn, styles.modalBtnSecondary]}
                >
                  <Text style={styles.modalBtnSecondaryText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={submitAuto}
                  style={[
                    styles.modalBtn,
                    styles.modalBtnPrimary,
                    autoLoading && { opacity: 0.75 },
                  ]}
                  disabled={autoLoading}
                >
                  <Text style={styles.modalBtnPrimaryText}>
                    {autoLoading ? "Parsing…" : "Create"}
                  </Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                onPress={() => {
                  setAutoOpen(false);
                  openUpcomingAuto();
                }}
                style={{ marginTop: 10, alignSelf: "flex-start" }}
              >
                <Text
                  style={[
                    styles.modalHint,
                    { textDecorationLine: "underline" },
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

      {scannerVisible && (
        <View style={styles.fullCamOverlay}>
          <SafeAreaView style={styles.fullCamTopSafe}>
            <View style={styles.fullCamTopBar}>
              <TouchableOpacity
                onPress={() => {
                  setScannerVisible(false);
                  setIsScanning(false);
                  setModalOpen(true);
                }}
              >
                <Text style={styles.fullCamTopText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>

          <View style={styles.fullCamBody}>
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
            <View style={styles.fullCamFrameOverlay} pointerEvents="none" />
          </View>

          <View style={styles.fullCamBottomBar}>
            <View style={styles.fullCamLeftCluster}>
              <TouchableOpacity
                style={styles.fullCamBottomIconBtn}
                activeOpacity={0.7}
                onPress={() => {
                  setScannerVisible(false);
                  setIsScanning(false);
                  setModalOpen(true);
                }}
              >
                <Text style={styles.fullCamCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.fullCamBottomIconBtn}
                activeOpacity={0.7}
                onPress={() =>
                  setFlash((prev) => (prev === "off" ? "torch" : "off"))
                }
              >
                <Text style={styles.fullCamBottomIconText}>
                  {flash === "off" ? "⚡︎" : "⚡︎A"}
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              activeOpacity={0.7}
              disabled={isScanning}
              onPress={async () => {
                if (isScanning) return;
                if (ocrBusyRef.current) return;
                ocrBusyRef.current = true;

                try {
                  if (!cameraRef.current) return;

                  const photo = await cameraRef.current.takePictureAsync({
                    base64: false,
                    quality: 0.85,
                  });

                  setScannerVisible(false);

                  let rawText = "";
                  let parsed = null;

                  const canUseOnDeviceOcr = Platform.OS !== "ios";

                  if (canUseOnDeviceOcr) {
                    try {
                      const result = await TextRecognition.recognize(photo.uri);
                      rawText = result?.text || "";
                      parsed = parseReceiptFromText(rawText);
                    } catch {}
                  }

                  const missingCritical =
                    !parsed?.amount || !parsed?.date || !parsed?.seller;

                  if (!parsed || missingCritical) {
                    try {
                      const backendParsed = await parseReceiptViaBackend(
                        photo.uri,
                      );

                      const b = backendParsed || {};
                      const normalized = {
                        amount: b.amount || b.total || null,
                        currency: b.currency || null,
                        date: b.date || null,
                        seller: b.seller || b.merchant || null,
                        description: b.description || null,
                      };

                      rawText = b.rawText || b.text || rawText || "";

                      parsed = {
                        amount: normalized.amount || parsed?.amount || null,
                        currency:
                          normalized.currency || parsed?.currency || null,
                        date: normalized.date || parsed?.date || null,
                        seller: normalized.seller || parsed?.seller || null,
                        description:
                          normalized.description || parsed?.seller || null,
                      };
                    } catch (e) {
                      if (Platform.OS === "ios") {
                        setModalOpen(true);
                        Alert.alert(
                          "Smart scan needs OCR",
                          "On iOS, your current app can’t run ML Kit OCR locally. To auto-fill amount/date/category, add backend OCR endpoint /receipt/parse OR move to a custom dev client with ML Kit linked.",
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
                      "I couldn’t confidently detect total/date/merchant. Try retaking the photo with the full receipt visible, good lighting, and the TOTAL line included.",
                    );
                    return;
                  }

                  applyParsedToForm(parsed, rawText);

                  Alert.alert(
                    "Smart scan complete",
                    "Filled amount + date + description and inferred a category. Please review before saving.",
                  );
                } catch (e) {
                  setModalOpen(true);
                  Alert.alert(
                    "Scan error",
                    e.message ||
                      "I couldn't read this receipt. Try retaking the photo.",
                  );
                } finally {
                  ocrBusyRef.current = false;
                }
              }}
              style={[
                styles.fullCamShutterOuter,
                isScanning && { opacity: 0.35 },
              ]}
            >
              <View
                style={[
                  styles.fullCamShutterInner,
                  styles.fullCamShutterInnerActive,
                ]}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.fullCamBottomIconBtn}
              activeOpacity={0.7}
              onPress={() =>
                setFacing((prev) => (prev === "back" ? "front" : "back"))
              }
            >
              <Text style={styles.fullCamBottomIconText}>⟲</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {scanProcessing && (
        <View style={styles.processingOverlay}>
          <ActivityIndicator size="large" color={SECONDARY} />
          <Text style={styles.processingText}>Reading receipt…</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

/* =============================== Styles =============================== */

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: BG_DARK,
  },
  content: {
    flex: 1,
  },

  bgLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  bgGlowGreen: {
    position: "absolute",
    top: -30,
    left: -20,
    width: 240,
    height: 240,
    borderRadius: 999,
    backgroundColor: GREEN_GLOW,
  },
  bgGlowPink: {
    position: "absolute",
    top: 10,
    right: -20,
    width: 200,
    height: 200,
    borderRadius: 999,
    backgroundColor: PINK_GLOW,
  },
  bgGlowBottom: {
    position: "absolute",
    bottom: -40,
    left: 90,
    width: 260,
    height: 260,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.04)",
  },

  headerCard: {
    marginTop: 12,
    marginHorizontal: 16,
    padding: 16,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    backgroundColor: CARD_BG,
    overflow: "hidden",
  },
  cardGlowGreen: {
    position: "absolute",
    top: -36,
    left: -18,
    width: 180,
    height: 180,
    borderRadius: 999,
    backgroundColor: "rgba(19,226,67,0.08)",
  },
  cardGlowPink: {
    position: "absolute",
    top: -22,
    right: -22,
    width: 140,
    height: 140,
    borderRadius: 999,
    backgroundColor: "rgba(153,23,70,0.10)",
  },
  cardHairline: {
    position: "absolute",
    top: 0,
    left: "15%",
    right: "15%",
    height: 1,
    backgroundColor: "rgba(255,255,255,0.18)",
    opacity: 0.65,
    borderRadius: 999,
  },

  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  logoText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#e5e7eb",
    letterSpacing: 0.2,
  },
  headerLogoBtn: {
    width: 40,
    height: 40,
    borderRadius: 999,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: CARD_BORDER,
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerLogoImg: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },

  greetingBlock: {
    marginBottom: 14,
  },
  heroTitle: {
    fontSize: 28,
    lineHeight: 32,
    fontWeight: "800",
    color: TEXT_PRIMARY,
    letterSpacing: -0.55,
  },
  heroSubtitle: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 20,
    color: TEXT_MUTED,
    maxWidth: "95%",
  },

  livePill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: CARD_BORDER,
    marginBottom: 14,
  },
  livePillDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: SECONDARY,
  },
  livePillText: {
    fontSize: 11,
    color: TEXT_MUTED,
    fontWeight: "700",
    letterSpacing: 0.8,
  },

  headerControlsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  headerActionPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: CARD_BORDER,
  },
  headerActionPillText: {
    fontSize: 13,
    fontWeight: "600",
    color: TEXT_PRIMARY,
  },
  headerActionBadge: {
    marginLeft: 8,
    minWidth: 24,
    height: 24,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(153,23,70,0.16)",
    borderWidth: 1,
    borderColor: "rgba(153,23,70,0.32)",
  },
  headerActionBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#f3f4f6",
  },
  headerGhostBtn: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: CARD_BORDER,
  },
  headerGhostBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: TEXT_PRIMARY,
  },

  searchWrap: {
    marginBottom: 8,
  },
  searchInput: {
    borderWidth: 1,
    borderColor: CARD_BORDER,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    backgroundColor: CARD_INNER,
    color: TEXT_PRIMARY,
  },

  chipScroll: {
    paddingTop: 4,
    paddingBottom: 8,
    paddingRight: 8,
  },
  chipScrollSmall: {
    paddingTop: 4,
    paddingBottom: 6,
    paddingRight: 8,
  },

  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    backgroundColor: "rgba(255,255,255,0.04)",
    marginRight: 6,
  },
  chipSmall: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  chipSelected: {
    borderColor: "rgba(144,169,85,0.40)",
    backgroundColor: "rgba(144,169,85,0.14)",
  },
  chipText: {
    fontSize: 13,
    color: TEXT_MUTED,
  },
  chipTextSmall: {
    fontSize: 12,
  },
  chipTextSelected: {
    color: "#f3f4f6",
    fontWeight: "600",
  },

  sectionCard: {
    marginHorizontal: 16,
    marginTop: 14,
    padding: 16,
    borderRadius: 26,
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    overflow: "hidden",
  },
  sectionHairline: {
    position: "absolute",
    top: 0,
    left: "15%",
    right: "15%",
    height: 1,
    backgroundColor: "rgba(255,255,255,0.16)",
    opacity: 0.6,
    borderRadius: 999,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  sectionEyebrow: {
    fontSize: 12,
    color: TEXT_MUTED,
    marginBottom: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: TEXT_PRIMARY,
    letterSpacing: -0.3,
  },
  sectionClose: {
    fontSize: 12,
    color: TEXT_MUTED,
    textDecorationLine: "underline",
  },
  sectionNote: {
    marginTop: -4,
    marginBottom: 12,
    fontSize: 12,
    color: TEXT_MUTED,
    lineHeight: 18,
  },

  currencyPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: CARD_BORDER,
  },
  currencyPillText: {
    fontSize: 11,
    fontWeight: "700",
    color: TEXT_MUTED,
  },

  statsGrid: {
    marginBottom: 10,
  },
  statCard: {
    position: "relative",
    overflow: "hidden",
    borderRadius: 22,
    padding: 16,
    marginBottom: 10,
    backgroundColor: "rgba(255,255,255,0.035)",
    borderWidth: 1,
    borderColor: CARD_BORDER,
  },
  statGlow: {
    position: "absolute",
    top: -36,
    right: -24,
    width: 140,
    height: 140,
    borderRadius: 999,
  },
  statHairline: {
    position: "absolute",
    top: 0,
    left: "15%",
    right: "15%",
    height: 1,
    backgroundColor: "rgba(255,255,255,0.16)",
    opacity: 0.65,
    borderRadius: 999,
  },
  statTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
    marginTop: 2,
  },
  statLabel: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1,
    color: TEXT_SOFT,
  },
  statValue: {
    marginTop: 8,
    fontSize: 28,
    fontWeight: "700",
    letterSpacing: -0.7,
  },
  statChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
  },
  statChipDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
  },
  statChipText: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
    color: "#f3f4f6",
  },
  statBottomRow: {
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
  },
  statHintRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  statHintDot: {
    width: 4,
    height: 4,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.38)",
  },
  statHint: {
    fontSize: 12,
    color: TEXT_SOFT,
  },

  chartBlock: {
    marginTop: 12,
    padding: 12,
    borderRadius: 18,
    backgroundColor: CARD_INNER,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  chartTitle: {
    fontSize: 13,
    color: TEXT_MUTED,
    marginBottom: 10,
    fontWeight: "600",
  },
  chartEmpty: {
    fontSize: 12,
    color: TEXT_MUTED,
  },
  catRow: {
    marginBottom: 8,
  },
  catRowTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  catName: {
    fontSize: 12,
    color: TEXT_PRIMARY,
    flex: 1,
    marginRight: 4,
  },
  catAmount: {
    fontSize: 12,
    color: "#d1fae5",
  },
  catBarTrack: {
    height: 7,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.05)",
    overflow: "hidden",
  },
  catBarFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "rgba(144,169,85,0.95)",
  },

  sparklineRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginTop: 2,
  },
  sparkCol: {
    alignItems: "center",
    flex: 1,
  },
  sparkBarTrack: {
    width: 10,
    height: 42,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.05)",
    overflow: "hidden",
    justifyContent: "flex-end",
  },
  sparkBarFill: {
    width: "100%",
    borderRadius: 999,
    backgroundColor: "rgba(144,169,85,0.95)",
  },
  sparkLabel: {
    marginTop: 4,
    fontSize: 8,
    color: TEXT_MUTED,
  },

  totalWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 14,
  },
  totalPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: CARD_BORDER,
  },
  totalPillText: {
    fontSize: 12,
    color: TEXT_PRIMARY,
    fontWeight: "600",
  },

  rowContainer: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  rowLeft: {
    flex: 1,
    minWidth: 0,
  },
  rowTitleLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 5,
    flexWrap: "wrap",
  },
  rowCategory: {
    fontSize: 14,
    fontWeight: "600",
    color: TEXT_PRIMARY,
  },
  badgeUpcoming: {
    fontSize: 11,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(153,23,70,0.32)",
    color: "#f3f4f6",
    backgroundColor: "rgba(153,23,70,0.14)",
  },
  badgePlanned: {
    fontSize: 11,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(144,169,85,0.30)",
    color: "#f3f4f6",
    backgroundColor: "rgba(144,169,85,0.12)",
  },
  badgeInDb: {
    fontSize: 11,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    color: TEXT_MUTED,
    backgroundColor: "rgba(255,255,255,0.04)",
  },

  rowMetaWrap: {
    marginBottom: 4,
  },
  rowMetaPill: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  rowMetaPillText: {
    fontSize: 11,
    color: TEXT_MUTED,
  },

  rowDescription: {
    fontSize: 13,
    color: TEXT_SOFT,
    marginTop: 2,
    lineHeight: 18,
  },
  rowDate: {
    fontSize: 11,
    color: TEXT_MUTED,
    marginTop: 4,
  },
  rowTags: {
    fontSize: 12,
    color: SECONDARY,
    marginTop: 4,
  },

  rowRight: {
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  rowAmount: {
    fontSize: 14,
    fontWeight: "700",
    color: "#f3f4f6",
  },
  rowActions: {
    marginTop: 8,
    flexDirection: "row",
    gap: 6,
  },
  rowActionsWrap: {
    marginTop: 8,
    flexDirection: "row",
    gap: 6,
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },
  rowBtn: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  rowBtnText: {
    fontSize: 12,
    color: TEXT_PRIMARY,
  },
  rowBtnDanger: {
    borderColor: "rgba(153,23,70,0.34)",
    backgroundColor: "rgba(153,23,70,0.10)",
  },
  rowBtnDangerText: {
    color: "#fecaca",
  },
  rowBtnPrimary: {
    backgroundColor: SECONDARY,
    borderColor: SECONDARY,
  },
  rowBtnPrimaryTextSmall: {
    fontSize: 12,
    color: "#0b1110",
    fontWeight: "700",
  },

  emptyText: {
    paddingVertical: 10,
    fontSize: 13,
    color: TEXT_MUTED,
    textAlign: "center",
  },

  errorCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    borderRadius: 22,
    padding: 14,
    marginHorizontal: 16,
    marginTop: 14,
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: "rgba(153,23,70,0.28)",
  },
  errorIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "rgba(153,23,70,0.20)",
    borderWidth: 1,
    borderColor: "rgba(153,23,70,0.32)",
    alignItems: "center",
    justifyContent: "center",
  },
  errorIconText: {
    fontSize: 16,
    color: "#f87171",
  },
  errorTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: TEXT_PRIMARY,
    marginBottom: 4,
  },
  errorBody: {
    fontSize: 13,
    color: TEXT_MUTED,
    lineHeight: 18,
  },

  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(7,10,7,0.88)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  modalCard: {
    width: "100%",
    maxHeight: "90%",
    borderRadius: 24,
    padding: 16,
    backgroundColor: BG_DARK,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    overflow: "hidden",
  },
  modalHairline: {
    position: "absolute",
    top: 0,
    left: "15%",
    right: "15%",
    height: 1,
    backgroundColor: "rgba(255,255,255,0.16)",
    opacity: 0.65,
    borderRadius: 999,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: TEXT_PRIMARY,
    marginBottom: 8,
  },
  modalField: {
    marginTop: 10,
  },
  modalLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: TEXT_SOFT,
    marginBottom: 6,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: CARD_BORDER,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    backgroundColor: CARD_INNER,
    color: TEXT_PRIMARY,
  },
  modalHint: {
    marginTop: 5,
    fontSize: 11,
    color: TEXT_MUTED,
    lineHeight: 16,
  },
  modalRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 18,
    gap: 8,
  },
  modalBtn: {
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 999,
  },
  modalBtnSecondary: {
    borderWidth: 1,
    borderColor: CARD_BORDER,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  modalBtnSecondaryText: {
    fontSize: 13,
    color: TEXT_PRIMARY,
    fontWeight: "500",
  },
  modalBtnPrimary: {
    backgroundColor: SECONDARY,
  },
  modalBtnPrimaryText: {
    fontSize: 13,
    color: "#0b1110",
    fontWeight: "700",
  },

  scanBtn: {
    paddingVertical: 11,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(144,169,85,0.32)",
    backgroundColor: "rgba(255,255,255,0.04)",
    alignItems: "center",
  },
  scanBtnText: {
    color: "#f3f4f6",
    fontWeight: "700",
    fontSize: 13,
  },

  loadingScreen: {
    flex: 1,
    backgroundColor: BG_DARK,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingGlow: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 999,
    backgroundColor: "rgba(19,226,67,0.08)",
  },
  loadingTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: TEXT_PRIMARY,
    marginTop: 14,
    marginBottom: 4,
  },
  loadingSubtitle: {
    fontSize: 13,
    color: TEXT_MUTED,
  },

  fabContainer: {
    position: "absolute",
    right: 16,
    bottom: 24,
    alignItems: "flex-end",
    gap: 10,
  },
  fabAuto: {
    width: 54,
    height: 54,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(144,169,85,0.30)",
  },
  fabAutoText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#f3f4f6",
  },
  fab: {
    width: 58,
    height: 58,
    borderRadius: 999,
    backgroundColor: SECONDARY,
    alignItems: "center",
    justifyContent: "center",
  },
  fabPlus: {
    fontSize: 30,
    lineHeight: 30,
    color: "#0b1110",
    fontWeight: "700",
  },

  fullCamOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000",
  },
  fullCamTopSafe: {
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  fullCamTopBar: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  fullCamTopText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
  },
  fullCamBody: {
    flex: 1,
    position: "relative",
  },
  fullCamFrameOverlay: {
    position: "absolute",
    left: 24,
    right: 24,
    top: "20%",
    bottom: "20%",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.35)",
    borderRadius: 18,
  },
  fullCamBottomBar: {
    paddingHorizontal: 18,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  fullCamLeftCluster: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  fullCamBottomIconBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    backgroundColor: "rgba(0,0,0,0.25)",
  },
  fullCamBottomIconText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  fullCamCancelText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },
  fullCamShutterOuter: {
    width: 68,
    height: 68,
    borderRadius: 999,
    borderWidth: 4,
    borderColor: "rgba(255,255,255,0.8)",
    alignItems: "center",
    justifyContent: "center",
  },
  fullCamShutterInner: {
    width: 48,
    height: 48,
    borderRadius: 999,
  },
  fullCamShutterInnerActive: {
    backgroundColor: "rgba(255,255,255,0.92)",
  },

  processingOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  processingText: {
    color: "#fff",
    marginTop: 10,
    fontWeight: "700",
  },
});
