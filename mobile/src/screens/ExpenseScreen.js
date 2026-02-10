// mobile/src/screens/ExpensesScreen.js
/* eslint-disable no-unused-vars */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useRef, // ✅ for scrolling + scan guards
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
import TextRecognition from "@react-native-ml-kit/text-recognition"; // Android on-device OCR (in your current setup)
import { useNavigation } from "@react-navigation/native";
import { CameraView, useCameraPermissions } from "expo-camera";

// ✅ mobile axios instance (points to same backend as web)
import api from "../lib/api";
import logo from "../../assets/nummoria_logo.png";

const main = "#22c55e";
const secondary = "#4ade80";
const BG_DARK = "#020617";
const CARD_DARK = "#020819";
const BORDER_DARK = "#0f172a";
const TEXT_SOFT = "rgba(148,163,184,0.85)";
const TEXT_MUTED = "rgba(148,163,184,0.7)";
const TEXT_HEADING = "#e5e7eb";
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

  // 1) Try JSON
  try {
    const obj = JSON.parse(data);
    if (obj && typeof obj === "object") {
      amount = obj.amount ?? obj.total ?? obj.amt ?? amount;
      currency = obj.currency ?? obj.cur ?? currency;
      dateStr = obj.date ?? obj.txDate ?? dateStr;
      description = obj.description ?? obj.desc ?? description;
    }
  } catch {
    // not JSON
  }

  // 2) Fallback: first "xx.xx" number
  if (amount == null) {
    const match = data.match(/([0-9]+[.,][0-9]{2})/);
    if (match) amount = match[1];
  }

  // 3) Currency code
  if (!currency) {
    const curMatch = data.match(/\b(USD|EUR|TRY|GBP)\b/i);
    if (curMatch) currency = curMatch[1].toUpperCase();
  }

  // 4) Date
  if (!dateStr) {
    const iso = data.match(/(\d{4}-\d{2}-\d{2})/);
    const eu = data.match(/(\d{2}\.\d{2}\.\d{4})/);
    if (iso) {
      dateStr = iso[1];
    } else if (eu) {
      const raw = eu[1]; // DD.MM.YYYY
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
/**
 * NOTE: Receipts vary wildly. This is "best-effort" parsing:
 * - amount: tries explicit TOTAL patterns, else picks best-looking "total-ish" number
 * - currency: tries TRY/TL/USD/EUR/GBP symbols/codes
 * - date: tries ISO or EU formats
 * - seller: top header lines until a stop keyword
 */
function parseReceiptFromText(rawText) {
  if (!rawText) return null;

  const textRaw = String(rawText);
  const text = textRaw.replace(/\s+/g, " ").toUpperCase();

  // ----- 1) AMOUNT (TOTAL) -----
  const totalRegex =
    /(GENEL TOPLAM|TOPLAM|TOPLAM TUTAR|ÖDENECEK|ODENECEK|TOTAL|GRAND TOTAL|AMOUNT)[^\d]*([0-9]+[.,][0-9]{2})/;
  const totalMatch = text.match(totalRegex);

  let amount = null;
  if (totalMatch && totalMatch[2]) {
    amount = totalMatch[2].replace(",", ".");
  } else {
    // Collect candidate money patterns
    const allMoney = [...text.matchAll(/([0-9]{1,6}[.,][0-9]{2})/g)].map(
      (m) => m[1],
    );
    if (allMoney.length) {
      // Heuristic: prefer the largest numeric value among candidates (often total is largest)
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

  // ----- 2) CURRENCY -----
  let currency = null;
  // TRY/TL
  if (/\b(TRY|TL|₺)\b/.test(text)) currency = "TRY";
  // USD
  else if (/\b(USD|\$)\b/.test(text)) currency = "USD";
  // EUR
  else if (/\b(EUR|€)\b/.test(text)) currency = "EUR";
  // GBP
  else if (/\b(GBP|£)\b/.test(text)) currency = "GBP";

  // ----- 3) DATE -----
  let dateStr = null;
  const iso = text.match(/(\d{4}[-/.]\d{2}[-/.]\d{2})/);
  const eu = text.match(/(\d{2}[-/.]\d{2}[-/.]\d{4})/);

  if (iso) {
    dateStr = iso[1].replace(/\./g, "-").replace(/\//g, "-");
  } else if (eu) {
    const [dd, mm, yyyy] = eu[1].split(/[./-]/);
    dateStr = `${yyyy}-${mm}-${dd}`;
  }

  // ----- 4) SELLER / MERCHANT -----
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
    // prevent extremely long garbage seller
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

  // Merchant/keyword → "semantic" category name targets (we map to whatever names you have)
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

  // fallback: if you have a generic "Other" category
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
      activeOpacity={0.8}
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

/* =============================== Screen =============================== */

export default function ExpensesScreen({ route }) {
  const navigation = useNavigation();

  // ✅ ScrollView ref
  const scrollRef = useRef(null);

  const accountId = route?.params?.accountId;

  // --- data ---
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [accounts, setAccounts] = useState([]);

  // ✅ AUTO ADD state
  const [autoOpen, setAutoOpen] = useState(false);
  const [autoText, setAutoText] = useState("");
  const [autoAccountId, setAutoAccountId] = useState("");
  const [autoLoading, setAutoLoading] = useState(false);

  // --- ui ---
  const [loading, setLoading] = useState(true);
  const [initialDone, setInitialDone] = useState(false);
  const [err, setErr] = useState("");

  // --- filters ---
  const [q, setQ] = useState("");
  const [fAccountId, setFAccountId] = useState("ALL");
  const [fCategoryId, setFCategoryId] = useState("ALL");
  const [fCurrency, setFCurrency] = useState("ALL");
  const [sortKey, setSortKey] = useState("date_desc");
  const [showUpcoming, setShowUpcoming] = useState(false);
  const [datePreset, setDatePreset] = useState("ALL");

  // --- modal state (create / edit) ---
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

  // --- QR / camera state (expo-camera) ---
  const [scannerVisible, setScannerVisible] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState("back");
  const [flash, setFlash] = useState("off");
  const scannedOnceRef = useRef(false);
  const cameraRef = useRef(null);

  // ✅ NEW: to avoid double OCR taps
  const ocrBusyRef = useRef(false);

  /* ---------------------------- Lookups ---------------------------- */
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
        .filter((t) => t.type === "expense")
        .map((t) => t.currency || "USD"),
    );
    return ["ALL", ...Array.from(s)];
  }, [transactions]);

  /* ----------------------------- Data load ----------------------------- */
  const loadAll = useCallback(async () => {
    try {
      setLoading(true);
      setErr("");

      console.log("[Expenses] fetching data...");
      const t0 = Date.now();
      const [txRes, catRes, accRes] = await Promise.all([
        api.get("/transactions", { params: { type: "expense" } }),
        api.get("/categories"),
        api.get("/accounts"),
      ]);
      console.log("[Expenses] data loaded in", Date.now() - t0, "ms");

      const cats = (catRes.data || []).filter(
        (c) => c.kind === "expense" && !c.isDeleted,
      );

      setCategories(cats);
      setTransactions(txRes.data || []);
      setAccounts((accRes.data || []).filter((a) => !a.isDeleted));
    } catch (e) {
      console.log("[Expenses] error", e.message);
      setErr(e?.response?.data?.error || e.message || "Failed to load data");
    } finally {
      setLoading(false);
      setInitialDone((prev) => (prev ? prev : true));
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  /* ------------------------ Shared date-filter logic ------------------------ */
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

  /* ----------------------------- Filtering ----------------------------- */
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();

    const filtered = transactions.filter((t) => {
      if ((t.type || "") !== "expense") return false;

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

  /* ------------------------------ Totals ------------------------------ */
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

  /* --------------------------- Upcoming (planned) -------------------------- */
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

    // future rows actually in DB
    for (const t of transactions) {
      if (t.type !== "expense") continue;
      const dt = new Date(t.date);
      if (dt > today) {
        map.set(keyOf(t), { ...t, __kind: "actual" });
      }
    }

    // virtual rows coming from nextDate
    for (const t of transactions) {
      if (t.type !== "expense" || !t.nextDate) continue;
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

  /* ------------------------------- Insights (KPIs) ------------------------------- */
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

  /* ---------------------- Insights: charts data ---------------------- */
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

  /* ------------------------------- CRUD TX ------------------------------- */
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
        } catch {
          // ignore
        }
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

  /* ---------------------- Scan helpers ---------------------- */

  // ✅ NEW: if you have/plan a backend OCR endpoint, this works on BOTH iOS + Android.
  // Endpoint expectation: POST /receipt/parse (multipart) -> { amount, currency, date, seller, description, categoryName? }
  async function parseReceiptViaBackend(photoUri) {
    const fd = new FormData();
    fd.append("file", {
      uri: photoUri,
      name: `receipt_${Date.now()}.jpg`,
      type: "image/jpeg",
    });

    const res = await api.post("/receipt/parse", fd, {
      headers: { "Content-Type": "multipart/form-data" },
      timeout: 30000,
    });

    return res?.data || null;
  }

  function applyParsedToForm(parsed, rawTextForCategory) {
    // currency fallback: picked account currency if available
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
        parsed?.description ||
        parsed?.seller ||
        prev.description ||
        prev.description,
      categoryId:
        inferredCategoryId || prev.categoryId || categories[0]?._id || "",
    }));
  }

  /* ---------------------- QR scanner handlers (expo-camera) ---------------------- */
  const openScanner = useCallback(async () => {
    console.log("[Expenses] Scan receipt QR pressed");

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

      // close modal while camera is active
      setModalOpen(false);

      scannedOnceRef.current = false;
      setIsScanning(true);
      setScannerVisible(true);
    } catch (e) {
      console.log("[Expenses] openScanner error", e);
      Alert.alert("Error", e.message || "Failed to open scanner");
    }
  }, [permission, requestPermission]);

  const handleBarCodeScanned = useCallback(
    ({ type, data }) => {
      if (scannedOnceRef.current) return;
      scannedOnceRef.current = true;

      const text = String(data || "");
      console.log("[Expenses] code scanned:", { type, data: text });

      setIsScanning(false);
      setScannerVisible(false);

      // ✅ IMPORTANT: Your CODE128 is basically always an ID.
      // It will NOT contain total/date/category. So we attach it to description and instruct Smart Scan.
      const isLikelyIdOnly = type === "code128" && /^[0-9]{10,30}$/.test(text);

      if (isLikelyIdOnly) {
        setForm((prev) => ({
          ...prev,
          description: prev.description?.trim()
            ? `${prev.description} (Receipt ID: ${text})`
            : `Receipt ID: ${text}`,
        }));

        setModalOpen(true);

        Alert.alert(
          "Barcode scanned (ID only)",
          "This barcode contains only a receipt/transaction ID. For amount + date + category, use “Smart scan (photo)” and capture the whole receipt.",
        );
        return;
      }

      // Try structured QR payloads
      const parsed = parseReceiptFromQR(text);

      if (!parsed) {
        setModalOpen(true);
        Alert.alert(
          "Scanned",
          "This code doesn’t include total/date/currency in a parsable format. Use “Smart scan (photo)” for full auto-fill.",
        );
        return;
      }

      setForm((prev) => ({
        ...prev,
        amount: parsed.amount ?? prev.amount,
        currency: parsed.currency ?? prev.currency,
        date: parsed.date ?? prev.date,
        description: parsed.description ?? prev.description,
      }));

      setModalOpen(true);

      Alert.alert(
        "Receipt scanned",
        "I pre-filled what was available in the QR payload. Review and save.",
      );
    },
    [setForm, setModalOpen],
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
      setIsScanning(false); // ✅ OCR mode (shutter), not barcode scanning
    } catch (e) {
      Alert.alert("Error", e.message || "Failed to open camera.");
    }
  }, [permission, requestPermission]);

  /* ------------------------------- Row item ------------------------------- */
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
          <View style={styles.rowAccountBadge}>
            <Text style={styles.rowAccountText}>{accName}</Text>
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

  /* ----------------------------- Expense Modal ----------------------------- */
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
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.modalTitle}>
                {editing ? "Edit expense" : "New expense"}
              </Text>

              {/* Account chips */}
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

              {/* Amount + currency */}
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
                <View style={{ width: 90 }}>
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

              {/* Scan receipt */}
              <View style={styles.modalField}>
                <TouchableOpacity
                  style={styles.scanBtn}
                  onPress={openScanner}
                  activeOpacity={0.85}
                >
                  <Text style={styles.scanBtnText}>
                    Scan receipt QR / barcode (ID)
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.scanBtn, { marginTop: 8 }]}
                  onPress={openOcrScanner}
                  activeOpacity={0.85}
                >
                  <Text style={styles.scanBtnText}>
                    Smart scan (photo) → auto-fill
                  </Text>
                </TouchableOpacity>

                <Text style={styles.modalHint}>
                  Barcode/QR usually contains only an ID. Smart scan reads the
                  whole receipt to extract total + date + merchant and infers a
                  category.
                </Text>
              </View>

              {/* Date + next date */}
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
                  <Text style={styles.modalLabel}>Next date (optional)</Text>
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

              {/* Category chips */}
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

              {/* Description */}
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

              {/* Tags */}
              <View style={styles.modalField}>
                <Text style={styles.modalLabel}>Tags (comma separated)</Text>
                <TextInput
                  value={form.tagsCsv}
                  onChangeText={(v) => setForm((f) => ({ ...f, tagsCsv: v }))}
                  placeholder="groceries, rent"
                  placeholderTextColor={TEXT_MUTED}
                  style={styles.modalInput}
                />
                <Text style={styles.modalHint}>
                  Example: groceries, dinner, weekend
                </Text>
              </View>

              {/* Actions */}
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

  /* ------------------------------ Header & Filters ------------------------------ */
  function Header() {
    return (
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <View>
            <Text style={styles.headerEyebrow}>Spending overview</Text>
            <Text style={styles.headerTitle}>Expenses</Text>
          </View>

          <View style={styles.headerTopRight}>
            <TouchableOpacity
              onPress={() => navigation.navigate("Dashboard")}
              activeOpacity={0.85}
              style={styles.headerLogoBtn}
            >
              <Image source={logo} style={styles.headerLogoImg} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.headerUpcomingBtn}
              onPress={() => setShowUpcoming((v) => !v)}
            >
              <Text style={styles.headerUpcomingText}>Upcoming</Text>
              <View style={styles.headerUpcomingBadge}>
                <Text style={styles.headerUpcomingBadgeText}>
                  {upcoming.length}
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.headerIconBtn}
              onPress={loadAll}
              activeOpacity={0.8}
            >
              <Text style={styles.headerIconPlus}>↻</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.searchContainer}>
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

        <View style={styles.filterRow}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterChipRow}
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
            contentContainerStyle={styles.filterChipRow}
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
        </View>

        <View style={styles.sortRow}>
          <Text style={styles.sortLabel}>Sorting:</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.sortChipRow}
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
        </View>

        <View style={styles.totalsRow}>
          {totals.map(({ cur, major }) => (
            <Text key={cur} style={styles.totalsText}>
              Total {cur}: {major}
            </Text>
          ))}
        </View>

        <View style={styles.headerActionButtons}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.dateFilterChipRow}
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
          <TouchableOpacity
            style={styles.refreshBtn}
            onPress={loadAll}
            activeOpacity={0.8}
          >
            <Text style={styles.refreshBtnText}>Refresh</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  /* ------------------------------ Upcoming panel ------------------------------ */
  function UpcomingPanel() {
    if (!showUpcoming) return null;

    return (
      <View style={styles.upcomingCard}>
        <View style={styles.upcomingHeader}>
          <Text style={styles.upcomingTitle}>
            Upcoming expenses ({upcoming.length})
          </Text>
          <TouchableOpacity onPress={() => setShowUpcoming(false)}>
            <Text style={styles.upcomingClose}>Close</Text>
          </TouchableOpacity>
        </View>

        {upcoming.length === 0 ? (
          <Text style={styles.upcomingEmpty}>
            Nothing upcoming within your filters.
          </Text>
        ) : (
          upcoming.map((u) => {
            const catName =
              categories.find((c) => c._id === u.categoryId)?.name || "—";
            const accName = accountsById.get(u.accountId)?.name || "—";
            const badge =
              u.__kind === "virtual" ? (
                <Text style={styles.badgePlanned}>Planned (not added)</Text>
              ) : (
                <Text style={styles.badgeInDb}>In database</Text>
              );

            return (
              <View key={u._id} style={styles.upcomingItem}>
                <View style={{ flex: 1 }}>
                  <View style={styles.rowTitleLine}>
                    <Text style={styles.rowCategory}>{catName}</Text>
                    {badge}
                  </View>
                  <View style={styles.rowAccountBadge}>
                    <Text style={styles.rowAccountText}>{accName}</Text>
                  </View>
                  <Text style={styles.rowDescription} numberOfLines={2}>
                    {u.description || "No description"}
                  </Text>
                  <Text style={styles.rowDate}>
                    Scheduled: {fmtDateUTC(u.date)}
                  </Text>
                </View>
                <View style={styles.upcomingRight}>
                  <Text style={styles.rowAmount}>
                    -{minorToMajor(u.amountMinor, u.currency)} {u.currency}
                  </Text>
                  <View style={styles.upcomingActions}>
                    {u.__kind === "virtual" ? (
                      <>
                        <TouchableOpacity
                          style={[styles.rowBtn, styles.rowBtnPrimaryBg]}
                          onPress={() => addVirtual(u)}
                        >
                          <Text style={[styles.rowBtnText, { color: "#fff" }]}>
                            Add
                          </Text>
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

  /* ------------------------------ Insights card ------------------------------ */
  function Insights() {
    const effectiveCur =
      (fCurrency !== "ALL" ? fCurrency : rows[0]?.currency) || "—";

    return (
      <View style={styles.insightsCard}>
        <View style={styles.insightsHeader}>
          <View>
            <Text style={styles.insightsEyebrow}>Spending KPIs</Text>
            <Text style={styles.insightsTitle}>Insights</Text>
          </View>
          <Text style={styles.insightsCurrency}>{effectiveCur}</Text>
        </View>
        {noteMixedCurrency && (
          <Text style={styles.insightsNote}>
            KPIs are calculated in {statsCurrency}. Pick a currency above to
            switch.
          </Text>
        )}

        <View style={styles.insightsKpiRow}>
          <View style={styles.insightsKpi}>
            <Text style={styles.insightsKpiLabel}>Last Month</Text>
            <Text style={styles.insightsKpiValue}>
              {fmtMoney(kpis.last, statsCurrency)}
            </Text>
          </View>
          <View style={styles.insightsKpi}>
            <Text style={styles.insightsKpiLabel}>This Month</Text>
            <Text style={styles.insightsKpiValue}>
              {fmtMoney(kpis.this, statsCurrency)}
            </Text>
          </View>
          <View style={styles.insightsKpi}>
            <Text style={styles.insightsKpiLabel}>Yearly Avg</Text>
            <Text style={styles.insightsKpiValue}>
              {fmtMoney(kpis.yearlyAvg, statsCurrency)}
            </Text>
          </View>
        </View>

        <View style={styles.chartsRow}>
          <View style={styles.chartCol}>
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

          <View style={styles.chartCol}>
            <Text style={styles.chartTitle}>Last 7 days</Text>
            {!dailySeries.points.length || dailySeries.max <= 0 ? (
              <Text style={styles.chartEmpty}>No recent data.</Text>
            ) : (
              <View style={styles.sparklineRow}>
                {dailySeries.points.map((p) => {
                  const ratio = dailySeries.max ? p.value / dailySeries.max : 0;
                  const height = 8 + ratio * 32;
                  return (
                    <View key={p.label} style={styles.sparkCol}>
                      <View style={styles.sparkBarTrack}>
                        <View
                          style={[
                            styles.sparkBarFill,
                            { height, marginTop: 40 - height },
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
        </View>
      </View>
    );
  }

  /* ------------------------------ Loading state ------------------------------ */
  if (!initialDone) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <View style={styles.loadingSpinnerOuter}>
          <ActivityIndicator size="large" color={main} />
        </View>
        <Text style={styles.loadingTitle}>Nummoria</Text>
        <Text style={styles.loadingSubtitle}>Loading your expenses...</Text>
      </SafeAreaView>
    );
  }

  /* ------------------------------ Main render ------------------------------ */
  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView
        ref={scrollRef}
        style={styles.content}
        contentContainerStyle={{ paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Header />
        <UpcomingPanel />
        {err ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{err}</Text>
          </View>
        ) : null}

        <Insights />

        <View style={styles.listCard}>
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

      {/* ✅ FAB stack (Auto + Add) */}
      <View style={styles.fabContainer}>
        <TouchableOpacity style={styles.fabAuto} onPress={openAutoAdd}>
          <Text style={styles.fabAutoText}>Auto</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.fab} onPress={openCreate}>
          <Text style={styles.fabPlus}>＋</Text>
        </TouchableOpacity>
      </View>

      {/* ✅ Auto Add Modal */}
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

      {/* FULL-SCREEN CAMERA OVERLAY */}
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
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
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

            {/* ✅ OCR SHUTTER (Smart scan) */}
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={async () => {
                if (ocrBusyRef.current) return;
                ocrBusyRef.current = true;

                try {
                  if (!cameraRef.current) return;

                  const photo = await cameraRef.current.takePictureAsync({
                    base64: false,
                    quality: 0.85,
                  });

                  // close camera overlay while we process
                  setScannerVisible(false);

                  // 1) Try on-device OCR (Android in your current setup)
                  let rawText = "";
                  let parsed = null;

                  const canUseOnDeviceOcr = Platform.OS !== "ios";

                  if (canUseOnDeviceOcr) {
                    try {
                      const result = await TextRecognition.recognize(photo.uri);
                      rawText = result?.text || "";
                      parsed = parseReceiptFromText(rawText);
                      console.log("[Expenses] OCR text (device):", rawText);
                    } catch (e) {
                      console.log(
                        "[Expenses] on-device OCR failed:",
                        e?.message,
                      );
                    }
                  }

                  // 2) If on-device failed OR parsed missing key fields → fallback to backend OCR (works for iOS too)
                  const missingCritical =
                    !parsed?.amount || !parsed?.date || !parsed?.seller;

                  if (!parsed || missingCritical) {
                    try {
                      const backendParsed = await parseReceiptViaBackend(
                        photo.uri,
                      );

                      // backend may already return parsed fields; normalize
                      // accept both shapes: {amount,currency,date,seller,description,rawText} or nested
                      const b = backendParsed || {};
                      const normalized = {
                        amount: b.amount || b.total || null,
                        currency: b.currency || null,
                        date: b.date || null,
                        seller: b.seller || b.merchant || null,
                        description: b.description || null,
                      };

                      // If backend gives rawText too, use it for category inference
                      rawText = b.rawText || b.text || rawText || "";

                      // only replace if backend has something
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
                      // If iOS and no backend endpoint, explain clearly
                      if (Platform.OS === "ios") {
                        setModalOpen(true);
                        Alert.alert(
                          "Smart scan needs OCR",
                          "On iOS, your current app can’t run ML Kit OCR locally. To auto-fill amount/date/category, add backend OCR endpoint /receipt/parse OR move to a custom dev client with ML Kit linked.",
                        );
                        return;
                      }
                      // Android fallback failed too
                      console.log("[Expenses] backend OCR failed:", e?.message);
                    }
                  }

                  // reopen modal
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

                  // ✅ Apply to form INCLUDING category inference
                  applyParsedToForm(parsed, rawText);

                  Alert.alert(
                    "Smart scan complete",
                    "Filled amount + date + description and inferred a category. Please review before saving.",
                  );
                } catch (e) {
                  console.log("[Expenses] OCR error", e);
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
              style={styles.fullCamShutterOuter}
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

  /* Header */
  header: {
    marginTop: 12,
    marginHorizontal: 16,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: BORDER_DARK,
    backgroundColor: CARD_DARK,
  },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  headerTopRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerEyebrow: {
    fontSize: 12,
    color: TEXT_MUTED,
    marginBottom: 2,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: TEXT_HEADING,
  },

  headerUpcomingBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BORDER_DARK,
    backgroundColor: "#020617",
  },
  headerUpcomingText: {
    fontSize: 13,
    fontWeight: "500",
    color: TEXT_HEADING,
  },
  headerUpcomingBadge: {
    marginLeft: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: "rgba(22,163,74,0.12)",
    borderWidth: 1,
    borderColor: "rgba(34,197,94,0.6)",
  },
  headerUpcomingBadgeText: {
    fontSize: 11,
    color: "#bbf7d0",
    fontWeight: "600",
  },
  headerIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER_DARK,
    backgroundColor: "#020617",
    alignItems: "center",
    justifyContent: "center",
  },
  headerIconPlus: {
    fontSize: 18,
    fontWeight: "800",
    color: "#bbf7d0",
    includeFontPadding: false,
  },

  searchContainer: {
    marginTop: 8,
    marginBottom: 10,
  },
  searchInput: {
    borderWidth: 1,
    borderColor: BORDER_DARK,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    backgroundColor: "#020617",
    color: TEXT_HEADING,
  },

  chipScroll: {
    paddingVertical: 6,
    paddingRight: 8,
  },
  filterRow: {
    marginTop: 6,
  },
  filterChipRow: {
    paddingVertical: 4,
    paddingRight: 8,
  },

  sortRow: {
    marginTop: 4,
    flexDirection: "row",
    alignItems: "center",
  },
  sortLabel: {
    fontSize: 12,
    color: TEXT_MUTED,
    marginRight: 6,
  },
  sortChipRow: {
    paddingVertical: 4,
    paddingRight: 8,
  },

  totalsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 6,
  },
  totalsText: {
    fontSize: 12,
    fontWeight: "600",
    color: TEXT_SOFT,
  },

  headerActionButtons: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  dateFilterChipRow: {
    paddingVertical: 4,
    paddingRight: 8,
  },
  refreshBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BORDER_DARK,
    backgroundColor: "#020617",
  },
  refreshBtnText: {
    fontSize: 12,
    color: TEXT_SOFT,
    fontWeight: "600",
  },

  /* Chips */
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BORDER_DARK,
    backgroundColor: "#020617",
    marginRight: 6,
  },
  chipSmall: {
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  chipSelected: {
    borderColor: main,
    backgroundColor: "#022c22",
  },
  chipText: {
    fontSize: 13,
    color: TEXT_SOFT,
  },
  chipTextSmall: {
    fontSize: 12,
  },
  chipTextSelected: {
    color: "#bbf7d0",
    fontWeight: "600",
  },

  /* Upcoming */
  upcomingCard: {
    marginHorizontal: 16,
    marginTop: 12,
    padding: 12,
    borderRadius: 16,
    backgroundColor: CARD_DARK,
    borderWidth: 1,
    borderColor: BORDER_DARK,
  },
  upcomingHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  upcomingTitle: {
    fontWeight: "600",
    fontSize: 14,
    color: TEXT_HEADING,
  },
  upcomingClose: {
    fontSize: 12,
    color: TEXT_MUTED,
    textDecorationLine: "underline",
  },
  upcomingEmpty: {
    fontSize: 13,
    color: TEXT_MUTED,
    marginTop: 4,
  },
  upcomingItem: {
    flexDirection: "row",
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: BORDER_DARK,
  },
  upcomingRight: {
    marginLeft: 12,
    alignItems: "flex-end",
  },
  upcomingActions: {
    marginTop: 4,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-end",
    gap: 4,
  },

  badgePlanned: {
    fontSize: 11,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(34,197,94,0.6)",
    color: "#bbf7d0",
  },
  badgeInDb: {
    fontSize: 11,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BORDER_DARK,
    color: TEXT_MUTED,
  },

  /* Insights */
  insightsCard: {
    marginHorizontal: 16,
    marginTop: 12,
    padding: 14,
    borderRadius: 20,
    backgroundColor: CARD_DARK,
    borderWidth: 1,
    borderColor: BORDER_DARK,
  },
  insightsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  insightsEyebrow: {
    fontSize: 12,
    color: TEXT_MUTED,
  },
  insightsTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: TEXT_HEADING,
    marginTop: 2,
  },
  insightsCurrency: {
    fontSize: 11,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BORDER_DARK,
    color: TEXT_MUTED,
  },
  insightsNote: {
    marginTop: 6,
    fontSize: 11,
    color: TEXT_MUTED,
  },
  insightsKpiRow: {
    flexDirection: "row",
    marginTop: 10,
    gap: 8,
  },
  insightsKpi: {
    flex: 1,
    padding: 10,
    borderRadius: 12,
    backgroundColor: "#020617",
    borderWidth: 1,
    borderColor: BORDER_DARK,
  },
  insightsKpiLabel: {
    fontSize: 11,
    color: TEXT_MUTED,
    marginBottom: 4,
  },
  insightsKpiValue: {
    fontSize: 16,
    fontWeight: "700",
    color: TEXT_HEADING,
  },

  chartsRow: {
    flexDirection: "row",
    marginTop: 14,
    gap: 10,
  },
  chartCol: {
    flex: 1,
  },
  chartTitle: {
    fontSize: 12,
    color: TEXT_MUTED,
    marginBottom: 6,
  },
  chartEmpty: {
    fontSize: 11,
    color: TEXT_MUTED,
  },

  catRow: {
    marginBottom: 6,
  },
  catRowTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 2,
  },
  catName: {
    fontSize: 12,
    color: TEXT_SOFT,
    flex: 1,
    marginRight: 4,
  },
  catAmount: {
    fontSize: 12,
    color: "#bbf7d0",
  },
  catBarTrack: {
    height: 6,
    borderRadius: 999,
    backgroundColor: "#020617",
    overflow: "hidden",
  },
  catBarFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "rgba(34,197,94,0.9)",
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
    height: 40,
    borderRadius: 999,
    backgroundColor: "#020617",
    overflow: "hidden",
    justifyContent: "flex-end",
  },
  sparkBarFill: {
    width: "100%",
    borderRadius: 999,
    backgroundColor: "rgba(34,197,94,0.9)",
  },
  sparkLabel: {
    marginTop: 2,
    fontSize: 8,
    color: TEXT_MUTED,
  },

  /* List */
  listCard: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 16,
    borderRadius: 20,
    backgroundColor: CARD_DARK,
    borderWidth: 1,
    borderColor: BORDER_DARK,
  },
  emptyText: {
    padding: 16,
    fontSize: 13,
    color: TEXT_MUTED,
    textAlign: "center",
  },

  rowContainer: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER_DARK,
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
    marginBottom: 4,
  },
  rowCategory: {
    fontSize: 14,
    fontWeight: "600",
    color: TEXT_HEADING,
  },
  badgeUpcoming: {
    fontSize: 11,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(34,197,94,0.6)",
    color: "#bbf7d0",
  },
  rowAccountBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BORDER_DARK,
    marginBottom: 2,
    backgroundColor: "#020617",
  },
  rowAccountText: {
    fontSize: 11,
    color: TEXT_MUTED,
  },
  rowDescription: {
    fontSize: 13,
    color: TEXT_SOFT,
    marginTop: 2,
  },
  rowDate: {
    fontSize: 11,
    color: TEXT_MUTED,
    marginTop: 2,
  },
  rowTags: {
    fontSize: 12,
    color: secondary,
    marginTop: 2,
  },

  rowRight: {
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  rowAmount: {
    fontSize: 14,
    fontWeight: "700",
    color: "#bbf7d0",
  },
  rowActions: {
    marginTop: 6,
    flexDirection: "row",
    gap: 4,
  },
  rowBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER_DARK,
    backgroundColor: "#020617",
  },
  rowBtnText: {
    fontSize: 12,
    color: TEXT_SOFT,
  },
  rowBtnDanger: {
    borderColor: "#7f1d1d",
  },
  rowBtnDangerText: {
    color: "#fecaca",
  },
  rowBtnPrimaryBg: {
    backgroundColor: main,
    borderColor: main,
  },

  /* Modal */
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.9)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  modalCard: {
    width: "100%",
    maxHeight: "90%",
    borderRadius: 20,
    padding: 16,
    backgroundColor: BG_DARK,
    borderWidth: 1,
    borderColor: BORDER_DARK,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: TEXT_HEADING,
    marginBottom: 8,
  },
  modalField: {
    marginTop: 8,
  },
  modalLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: TEXT_SOFT,
    marginBottom: 4,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: BORDER_DARK,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    backgroundColor: "#020617",
    color: TEXT_HEADING,
  },
  modalHint: {
    marginTop: 4,
    fontSize: 11,
    color: TEXT_MUTED,
  },
  modalRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 16,
    gap: 8,
  },
  modalBtn: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
  },
  modalBtnSecondary: {
    borderWidth: 1,
    borderColor: BORDER_DARK,
    backgroundColor: "#020617",
  },
  modalBtnSecondaryText: {
    fontSize: 13,
    color: TEXT_SOFT,
    fontWeight: "500",
  },
  modalBtnPrimary: {
    backgroundColor: main,
  },
  modalBtnPrimaryText: {
    fontSize: 13,
    color: "#022c22",
    fontWeight: "600",
  },

  scanBtn: {
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(34,197,94,0.5)",
    backgroundColor: "#020617",
    alignItems: "center",
  },
  scanBtnText: {
    color: "#bbf7d0",
    fontWeight: "700",
    fontSize: 13,
  },

  /* Error */
  errorBox: {
    marginHorizontal: 16,
    marginTop: 12,
    padding: 10,
    borderRadius: 12,
    backgroundColor: "rgba(127,29,29,0.2)",
    borderWidth: 1,
    borderColor: "#7f1d1d",
  },
  errorText: {
    fontSize: 13,
    color: "#fecaca",
  },

  /* Loading */
  loadingContainer: {
    flex: 1,
    backgroundColor: BG_DARK,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingSpinnerOuter: {
    marginBottom: 12,
  },
  loadingTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: main,
    marginBottom: 4,
  },
  loadingSubtitle: {
    fontSize: 13,
    color: TEXT_MUTED,
  },

  /* FAB stack */
  fabContainer: {
    position: "absolute",
    right: 16,
    bottom: 24,
    alignItems: "flex-end",
    gap: 10,
  },
  fabAuto: {
    width: 52,
    height: 52,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#020617",
    borderWidth: 2,
    borderColor: "rgba(34,197,94,0.65)",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  fabAutoText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#bbf7d0",
  },
  fab: {
    width: 52,
    height: 52,
    borderRadius: 999,
    backgroundColor: main,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  fabPlus: {
    fontSize: 30,
    lineHeight: 30,
    color: "white",
  },

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
    marginRight: 10,
  },
  headerLogoImg: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },

  /* Full camera overlay UI (minimal) */
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
});
