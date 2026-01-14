// mobile/src/screens/IncomeScreen.js
/* eslint-disable no-unused-vars */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef, // ✅ NEW: for scrolling + Auto FAB behavior
  useState,
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

import { useNavigation } from "@react-navigation/native";

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
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0, 23, 59, 59, 999)
  );
}
function addMonthsUTC(dateLike, n) {
  const d = new Date(dateLike);
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, d.getUTCDate())
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

function startOfYearUTC(dateLike) {
  const d = new Date(dateLike);
  return startOfUTC(new Date(Date.UTC(d.getUTCFullYear(), 0, 1)));
}
function endOfYearUTC(dateLike) {
  const d = new Date(dateLike);
  return new Date(Date.UTC(d.getUTCFullYear(), 11, 31, 23, 59, 59, 999));
}

function dateMatchesPreset(dateStr, preset) {
  if (preset === "ALL") return true;
  const d = startOfUTC(new Date(dateStr));
  const today = startOfUTC(new Date());

  if (preset === "THIS_MONTH") {
    const s = startOfMonthUTC(today);
    const e = endOfMonthUTC(today);
    return d >= s && d <= e;
  }

  if (preset === "LAST_30") {
    const thirtyAgo = new Date(today);
    thirtyAgo.setUTCDate(thirtyAgo.getUTCDate() - 29); // inclusive 30 days
    return d >= thirtyAgo && d <= today;
  }

  if (preset === "THIS_YEAR") {
    const s = startOfYearUTC(today);
    const e = endOfYearUTC(today);
    return d >= s && d <= e;
  }

  return true;
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

export default function IncomeScreen({ route }) {
  const navigation = useNavigation(); // ✅ FIX

  // ✅ NEW: ScrollView ref (Auto button opens Upcoming + scrolls to top)
  const scrollRef = useRef(null);

  // optional: coming from Home, e.g. "show this account"
  const accountId = route?.params?.accountId;

  // --- data ---
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [accounts, setAccounts] = useState([]);
  // ✅ AUTO ADD state (match InvestmentScreen)
  const [autoOpen, setAutoOpen] = useState(false);
  const [autoText, setAutoText] = useState("");
  const [autoAccountId, setAutoAccountId] = useState("");
  const [autoLoading, setAutoLoading] = useState(false);

  // --- ui ---
  const [loading, setLoading] = useState(true);
  const [initialDone, setInitialDone] = useState(false); // only for first full-screen loader
  const [err, setErr] = useState("");

  // --- filters ---
  const [q, setQ] = useState("");
  const [fAccountId, setFAccountId] = useState("ALL");
  const [fCategoryId, setFCategoryId] = useState("ALL");
  const [fCurrency, setFCurrency] = useState("ALL");
  const [sortKey, setSortKey] = useState("date_desc");
  const [showUpcoming, setShowUpcoming] = useState(false);
  const [fDatePreset, setFDatePreset] = useState("ALL"); // ✅ date filter

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
        .filter((t) => t.type === "income")
        .map((t) => t.currency || "USD")
    );
    return ["ALL", ...Array.from(s)];
  }, [transactions]);

  /* ----------------------------- Data load ----------------------------- */
  const loadAll = useCallback(async () => {
    try {
      setLoading(true);
      setErr("");

      console.log("[Income] fetching data...");
      const t0 = Date.now();
      const [txRes, catRes, accRes] = await Promise.all([
        api.get("/transactions", { params: { type: "income" } }),
        api.get("/categories"),
        api.get("/accounts"),
      ]);
      console.log("[Income] data loaded in", Date.now() - t0, "ms");

      const cats = (catRes.data || []).filter(
        (c) => c.kind === "income" && !c.isDeleted
      );

      setCategories(cats);
      setTransactions(txRes.data || []);
      setAccounts((accRes.data || []).filter((a) => !a.isDeleted));
    } catch (e) {
      console.log("[Income] error", e.message);
      setErr(e?.response?.data?.error || e.message || "Failed to load data");
    } finally {
      setLoading(false);
      setInitialDone((prev) => (prev ? prev : true)); // after first load, never show full loader again
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  /* ----------------------------- Filtering ----------------------------- */
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();

    const filtered = transactions.filter((t) => {
      if ((t.type || "") !== "income") return false;

      if (fAccountId !== "ALL" && String(t.accountId) !== String(fAccountId))
        return false;
      if (fCategoryId !== "ALL" && String(t.categoryId) !== String(fCategoryId))
        return false;

      const cur = t.currency || "USD";
      if (fCurrency !== "ALL" && cur !== fCurrency) return false;

      // ✅ date filter
      if (!dateMatchesPreset(t.date, fDatePreset)) return false;

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
    fDatePreset,
    categoriesById,
    accountsById,
    sortKey,
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
        decimalsForCurrency(cur)
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
      if (t.type !== "income") continue;
      const dt = new Date(t.date);
      if (dt > today) {
        if (!dateMatchesPreset(t.date, fDatePreset)) continue; // ✅ respect date filter
        map.set(keyOf(t), { ...t, __kind: "actual" });
      }
    }

    // virtual rows coming from nextDate
    for (const t of transactions) {
      if (t.type !== "income" || !t.nextDate) continue;
      const nd = new Date(t.nextDate);
      if (nd <= today) continue;
      if (!dateMatchesPreset(nd.toISOString(), fDatePreset)) continue; // ✅ respect date filter

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
    fDatePreset,
    categoriesById,
    accountsById,
  ]);

  /* ------------------------------- Insights (KPIs) ------------------------------- */
  const { statsCurrency, kpis, noteMixedCurrency } = useMemo(() => {
    const chosen = fCurrency !== "ALL" ? fCurrency : rows[0]?.currency || "USD";
    const filteredByCur = rows.filter((r) =>
      chosen ? r.currency === chosen : true
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

  const incomeByCategory = useMemo(() => {
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
  // ✅ AUTO ADD open (match InvestmentScreen)
  const openAutoAdd = useCallback(() => {
    setAutoAccountId(accountId || defaultAccountId || "");
    setAutoText("");
    setAutoOpen(true);
  }, [accountId, defaultAccountId]);

  // ✅ AUTO ADD submit (match InvestmentScreen)
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
        "Type what you want to add (natural language)."
      );
      return;
    }

    try {
      setAutoLoading(true);

      // same endpoint used by InvestmentScreen
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
    Alert.alert("Delete income?", "This action can’t be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await api.delete(`/transactions/${tx._id}`);
            setTransactions((prev) =>
              prev.filter((t) => String(t._id) !== String(tx._id))
            );
          } catch (e) {
            Alert.alert(
              "Error",
              e?.response?.data?.error || e.message || "Error deleting"
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
        type: "income",
        amountMinor: v.amountMinor,
        currency: v.currency,
        date: new Date(v.date).toISOString(),
        description: v.description || null,
        tags: v.tags || [],
      });

      // clear parent nextDate locally so it stops generating virtual rows
      if (v.__kind === "virtual" && v.__parentId) {
        try {
          const { data: parentUpdated } = await api.put(
            `/transactions/${v.__parentId}`,
            { nextDate: null }
          );
          setTransactions((prev) =>
            prev.map((t) =>
              String(t._id) === String(parentUpdated._id) ? parentUpdated : t
            )
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
        e?.response?.data?.error || e.message || "Add failed"
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
          prev.map((t) => (String(t._id) === String(data._id) ? data : t))
        );
      } catch (e) {
        Alert.alert(
          "Error",
          e?.response?.data?.error || e.message || "Delete failed"
        );
      }
    } else {
      await softDelete(item);
    }
  }

  // ✅ NEW: Auto button behavior (match Investments “Auto” chip-FAB)
  // ✅ Upcoming quick-open (previously openAuto)
  const openUpcomingAuto = useCallback(() => {
    setShowUpcoming(true);
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    });
  }, []);

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
            +{minorToMajor(item.amountMinor, item.currency)} {item.currency}
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

  /* ----------------------------- Income Modal ----------------------------- */
  const IncomeModal = useCallback(() => {
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
        type: "income",
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
            payload
          );
          setTransactions((prev) =>
            prev.map((t) => (String(t._id) === String(data._id) ? data : t))
          );
        }
        setModalOpen(false);
      } catch (e) {
        Alert.alert("Error", e?.response?.data?.error || e.message || "Error");
      }
    };

    const defaultAccId = form.accountId || accountId || accounts[0]?._id || "";

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
                {editing ? "Edit income" : "New income"}
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
                  placeholder="salary, freelance"
                  placeholderTextColor={TEXT_MUTED}
                  style={styles.modalInput}
                />
                <Text style={styles.modalHint}>
                  Example: salary, bonus, freelance
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
  }, [modalOpen, form, editing, accounts, categories, accountId]);

  /* ------------------------------ Header & Filters ------------------------------ */
  function Header() {
    return (
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <View>
            <Text style={styles.headerEyebrow}>Income overview</Text>
            <Text style={styles.headerTitle}>Income</Text>
          </View>
          <View style={styles.headerTopRight}>
            {/* ✅ NEW: Clickable Nummoria logo → Dashboard */}
            <TouchableOpacity
              onPress={() => navigation.navigate("Dashboard")} // ✅ NEW: change route name if needed
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

        {/* Search */}
        <View style={styles.searchContainer}>
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Search description, account, category, or #tags"
            placeholderTextColor={TEXT_MUTED}
            style={styles.searchInput}
          />
        </View>

        {/* Category chips */}
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

        {/* Account + currency filter row */}
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

        {/* Date filters */}
        <View style={styles.dateRow}>
          <Text style={styles.sortLabel}>Date:</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.sortChipRow}
            keyboardShouldPersistTaps="handled"
          >
            <Chip
              label="All time"
              selected={fDatePreset === "ALL"}
              onPress={() => setFDatePreset("ALL")}
              small
            />
            <Chip
              label="This month"
              selected={fDatePreset === "THIS_MONTH"}
              onPress={() => setFDatePreset("THIS_MONTH")}
              small
            />
            <Chip
              label="Last 30 days"
              selected={fDatePreset === "LAST_30"}
              onPress={() => setFDatePreset("LAST_30")}
              small
            />
            <Chip
              label="This year"
              selected={fDatePreset === "THIS_YEAR"}
              onPress={() => setFDatePreset("THIS_YEAR")}
              small
            />
          </ScrollView>
        </View>

        {/* Sorting row */}
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

        {/* Totals */}
        <View style={styles.totalsRow}>
          {totals.map(({ cur, major }) => (
            <Text key={cur} style={styles.totalsText}>
              Total income {cur}: {major}
            </Text>
          ))}
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
            Upcoming income ({upcoming.length})
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
                    +{minorToMajor(u.amountMinor, u.currency)} {u.currency}
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
            <Text style={styles.insightsEyebrow}>Income KPIs</Text>
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

        {/* KPI row */}
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

        {/* Charts */}
        <View style={styles.chartsRow}>
          {/* Category breakdown */}
          <View style={styles.chartCol}>
            <Text style={styles.chartTitle}>By category</Text>
            {!incomeByCategory.length ? (
              <Text style={styles.chartEmpty}>No data yet.</Text>
            ) : (
              incomeByCategory.map((c) => (
                <View key={c.catId} style={styles.catRow}>
                  <View style={styles.catRowTop}>
                    <Text style={styles.catName} numberOfLines={1}>
                      {c.catName}
                    </Text>
                    <Text style={styles.catAmount}>
                      {fmtMoney(
                        c.major *
                          Math.pow(10, decimalsForCurrency(statsCurrency)),
                        statsCurrency
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

          {/* Last 7 days */}
          <View style={styles.chartCol}>
            <Text style={styles.chartTitle}>Last 7 days</Text>
            {!dailySeries.points.length || dailySeries.max <= 0 ? (
              <Text style={styles.chartEmpty}>No recent data.</Text>
            ) : (
              <View style={styles.sparklineRow}>
                {dailySeries.points.map((p) => {
                  const ratio = dailySeries.max ? p.value / dailySeries.max : 0;
                  const height = 8 + ratio * 32; // 8–40
                  return (
                    <View key={p.label} style={styles.sparkCol}>
                      <View style={[styles.sparkBarTrack]}>
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
        <Text style={styles.loadingSubtitle}>Loading your income...</Text>
      </SafeAreaView>
    );
  }

  /* ------------------------------ Main render ------------------------------ */
  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView
        ref={scrollRef} // ✅ NEW
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
              No income found. Add your first one or adjust filters.
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
      {/* ✅ Auto Add Modal (match InvestmentScreen UX) */}
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
              <Text style={styles.modalTitle}>Auto add income</Text>

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
                  placeholder="e.g. salary 2500 usd today, category salary"
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

              {/* Optional: keep your old behavior accessible */}
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

      {IncomeModal()}
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

  dateRow: {
    marginTop: 4,
    flexDirection: "row",
    alignItems: "center",
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
    color: "#bbf7d0", // green-ish for income
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
  modalScrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingVertical: 40,
    paddingHorizontal: 16,
  },

  /* FAB stack */
  fabContainer: {
    position: "absolute",
    right: 16,
    bottom: 24,
    alignItems: "flex-end",
    gap: 10,
  },

  // ✅ NEW: Auto mini-FAB (matches Investments “Auto”)
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

  // ✅ NEW: Header logo button (tap to go Dashboard)
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
});
