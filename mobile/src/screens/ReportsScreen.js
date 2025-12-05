// mobile/src/screens/ReportsScreen.js
/* eslint-disable no-unused-vars */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import api from "../lib/api";

const main = "#22c55e";
const secondary = "#4ade80";
const BG_DARK = "#020617";
const CARD_DARK = "#020819";
const BORDER_DARK = "#0f172a";
const TEXT_SOFT = "rgba(148,163,184,0.85)";
const TEXT_MUTED = "rgba(148,163,184,0.7)";
const TEXT_HEADING = "#e5e7eb";
const DATE_LANG = "en-US";

/* ------------------------------ Money helpers ------------------------------ */
function decimalsForCurrency(code) {
  const zero = new Set(["JPY", "KRW", "CLP", "VND"]);
  const three = new Set(["BHD", "IQD", "JOD", "KWD", "OMR", "TND"]);
  if (zero.has(code)) return 0;
  if (three.has(code)) return 3;
  return 2;
}
function minorToMajor(minor, currency = "USD") {
  const d = decimalsForCurrency(currency || "USD");
  return Number(Number(minor || 0) / Math.pow(10, d));
}
const fmtMoneyUI = (minor, cur = "USD") =>
  new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: cur || "USD",
  }).format(minorToMajor(minor, cur));

function fmtDate(dateLike) {
  const d = new Date(dateLike);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(DATE_LANG, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

// helper to format YYYY-MM-DD for quick ranges
function toISODate(d) {
  return d.toISOString().slice(0, 10);
}

/* ----------------------------- Small components ---------------------------- */
function Chip({ label, selected, onPress, small }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={[
        styles.chip,
        small && styles.chipSmall,
        selected && styles.chipSelected,
      ]}
    >
      <Text
        numberOfLines={1}
        style={[
          styles.chipText,
          small && styles.chipTextSmall,
          selected && styles.chipTextSelected,
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

/* =============================== Screen =============================== */

export default function ReportsScreen() {
  // data
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [accounts, setAccounts] = useState([]);

  // ui
  const [loading, setLoading] = useState(true);
  const [initialDone, setInitialDone] = useState(false);
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");

  // filters
  const [fStart, setFStart] = useState(""); // YYYY-MM-DD text
  const [fEnd, setFEnd] = useState("");
  const [fType, setFType] = useState("ALL");
  const [fAccountId, setFAccountId] = useState("ALL");
  const [fCategoryId, setFCategoryId] = useState("ALL");
  const [fCurrency, setFCurrency] = useState("ALL");
  const [fMin, setFMin] = useState(""); // text
  const [fMax, setFMax] = useState("");

  // quick-range preset (for UI only)
  const [rangePreset, setRangePreset] = useState("ALL");

  /* ----------------------------- Debounce search ----------------------------- */
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQ(q);
    }, 300);
    return () => clearTimeout(timer);
  }, [q]);

  /* ----------------------------- Load data ----------------------------- */
  const loadAll = useCallback(async () => {
    try {
      setLoading(true);
      setErr("");

      const [txRes, catRes, accRes] = await Promise.all([
        api.get("/transactions"),
        api.get("/categories"),
        api.get("/accounts"),
      ]);

      setTransactions(Array.isArray(txRes.data) ? txRes.data : []);
      setCategories(Array.isArray(catRes.data) ? catRes.data : []);
      setAccounts((accRes.data || []).filter((a) => !a?.isDeleted));
    } catch (e) {
      setErr(
        e?.response?.data?.error || e.message || "Failed to load reports data"
      );
    } finally {
      setLoading(false);
      setInitialDone((prev) => (prev ? prev : true));
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  /* --------------------------- Lookups/helpers --------------------------- */
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

  const currencies = useMemo(() => {
    const s = new Set(transactions.map((t) => t.currency || "USD"));
    return ["ALL", ...Array.from(s)];
  }, [transactions]);

  /* --------------------------- Quick range logic --------------------------- */
  const applyRangePreset = useCallback(
    (preset) => {
      setRangePreset(preset);
      const now = new Date();
      const todayStr = toISODate(now);

      if (preset === "ALL") {
        setFStart("");
        setFEnd("");
        return;
      }

      if (preset === "7D" || preset === "30D" || preset === "90D") {
        const days = preset === "7D" ? 7 : preset === "30D" ? 30 : 90;
        const start = new Date(now);
        start.setDate(start.getDate() - days);
        const startStr = toISODate(start);
        setFStart(startStr);
        setFEnd(todayStr);
        return;
      }

      if (preset === "YTD") {
        const start = new Date(now.getFullYear(), 0, 1);
        const startStr = toISODate(start);
        setFStart(startStr);
        setFEnd(todayStr);
      }
    },
    [setFStart, setFEnd]
  );

  /* ------------------------------- Filtering ------------------------------- */
  const rows = useMemo(() => {
    // only use date filter when it's in full YYYY-MM-DD format
    let start = null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(fStart)) {
      start = new Date(`${fStart}T00:00:00`);
    }

    let end = null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(fEnd)) {
      end = new Date(`${fEnd}T23:59:59.999`);
    }

    let minNum = null;
    if (fMin.trim() !== "" && !Number.isNaN(Number(fMin))) {
      minNum = Number(fMin);
    }

    let maxNum = null;
    if (fMax.trim() !== "" && !Number.isNaN(Number(fMax))) {
      maxNum = Number(fMax);
    }

    const needle = debouncedQ.trim().toLowerCase();

    const filtered = transactions.filter((t) => {
      if (fType !== "ALL" && (t.type || "").toLowerCase() !== fType)
        return false;
      if (fAccountId !== "ALL" && t.accountId !== fAccountId) return false;
      if (fCategoryId !== "ALL" && t.categoryId !== fCategoryId) return false;

      const cur = t.currency || "USD";
      if (fCurrency !== "ALL" && cur !== fCurrency) return false;

      const dt = new Date(t.date);
      if (start && dt < start) return false;
      if (end && dt > end) return false;

      const major = minorToMajor(t.amountMinor, cur); // signed
      if (minNum !== null && major < minNum) return false;
      if (maxNum !== null && major > maxNum) return false;

      if (needle) {
        const cat = categoriesById.get(t.categoryId)?.name || "";
        const acc = accountsById.get(t.accountId)?.name || "";
        const hay = `${t.description || ""} ${t.notes || ""} ${
          t.type || ""
        } ${cat} ${acc} ${(t.tags || []).join(" ")}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });

    filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
    return filtered;
  }, [
    transactions,
    debouncedQ,
    fStart,
    fEnd,
    fType,
    fAccountId,
    fCategoryId,
    fCurrency,
    fMin,
    fMax,
    categoriesById,
    accountsById,
  ]);

  /* ------------------------------ Totals / flow ------------------------------ */
  const totalsByCurrency = useMemo(() => {
    const map = new Map();
    for (const t of rows) {
      const cur = t.currency || "USD";
      const bucket = map.get(cur) || { incomeMinor: 0, outMinor: 0 };
      if (t.type === "income") bucket.incomeMinor += Number(t.amountMinor || 0);
      else bucket.outMinor += Number(t.amountMinor || 0);
      map.set(cur, bucket);
    }
    return [...map.entries()].map(([currency, v]) => {
      const netMinor = v.incomeMinor - v.outMinor;
      return {
        currency,
        incomeMinor: v.incomeMinor,
        outMinor: v.outMinor,
        netMinor,
      };
    });
  }, [rows]);

  // "Sankey-like" top expense categories for selected currency
  const sankeyCurrency = fCurrency !== "ALL" ? fCurrency : null;
  const topCategories = useMemo(() => {
    if (!sankeyCurrency) return [];
    const map = new Map();

    for (const t of rows) {
      if ((t.currency || "USD") !== sankeyCurrency) continue;
      if (t.type !== "expense") continue;
      const catId = t.categoryId || "UNCAT";
      map.set(catId, (map.get(catId) || 0) + Number(t.amountMinor || 0));
    }

    const arr = [...map.entries()].map(([catId, minor]) => ({
      catId,
      name: categoriesById.get(catId)?.name || "Other",
      minor,
    }));
    arr.sort((a, b) => b.minor - a.minor);
    return arr.slice(0, 6);
  }, [rows, sankeyCurrency, categoriesById]);

  /* ------------------------------ Import / Export ------------------------------ */
  // keep it dumb & web-only for now (no mobile deps)
  function alertWebOnly(featureLabel) {
    Alert.alert(
      featureLabel,
      "Right now, this is available on the Nummoria web app Reports page. Use the desktop/browser version to import or download full PDF/CSV reports."
    );
  }

  function handleImportCsv() {
    alertWebOnly("Import CSV");
  }

  function handleImportPdf() {
    alertWebOnly("Import PDF");
  }

  function handleDownloadCsv() {
    alertWebOnly("Download CSV");
  }

  function handleDownloadPdf() {
    alertWebOnly("Download PDF");
  }

  /* ------------------------------ Row render ------------------------------ */
  function renderRow({ item }) {
    const accName = accountsById.get(item.accountId)?.name || "—";
    const catName = categoriesById.get(item.categoryId)?.name || "—";
    const isIncome = item.type === "income";
    const sign = isIncome ? "+" : "-";

    return (
      <View style={styles.rowContainer}>
        <View style={styles.rowLeft}>
          <View style={styles.rowTitleLine}>
            <Text style={styles.rowCategory}>{catName}</Text>
            <View style={styles.rowTypeBadge}>
              <Text style={styles.rowTypeText}>{item.type}</Text>
            </View>
          </View>
          <View style={styles.rowAccountBadge}>
            <Text style={styles.rowAccountText}>{accName}</Text>
          </View>
          <Text style={styles.rowDescription} numberOfLines={2}>
            {item.description || "No description"}
          </Text>
          <Text style={styles.rowDate}>{fmtDate(item.date)}</Text>
        </View>
        <View style={styles.rowRight}>
          <Text style={[styles.rowAmount, !isIncome && { color: "#fecaca" }]}>
            {sign}
            {fmtMoneyUI(item.amountMinor, item.currency)}
          </Text>
        </View>
      </View>
    );
  }

  /* ------------------------------ Header / Filters ------------------------------ */
  function Header() {
    return (
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <View>
            <Text style={styles.headerEyebrow}>Reports</Text>
            <Text style={styles.headerTitle}>Money Flow</Text>
          </View>
          <TouchableOpacity
            style={styles.headerIconBtn}
            onPress={loadAll}
            activeOpacity={0.85}
          >
            <Text style={styles.headerIconPlus}>↻</Text>
          </TouchableOpacity>
        </View>

        {/* Import / Export buttons */}
        <View style={styles.ieRow}>
          <TouchableOpacity
            style={[styles.ieBtn, styles.ieBtnOutline]}
            onPress={handleImportCsv}
          >
            <Text style={styles.ieBtnText}>Import CSV</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.ieBtn, styles.ieBtnSolid]}
            onPress={handleImportPdf}
          >
            <Text style={styles.ieBtnTextSolid}>Import PDF</Text>
          </TouchableOpacity>
        </View>
        <View style={[styles.ieRow, { marginTop: 6 }]}>
          <TouchableOpacity
            style={[styles.ieBtn, styles.ieBtnOutline]}
            onPress={handleDownloadCsv}
          >
            <Text style={styles.ieBtnText}>Download CSV</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.ieBtn, styles.ieBtnSolid]}
            onPress={handleDownloadPdf}
          >
            <Text style={styles.ieBtnTextSolid}>Download PDF</Text>
          </TouchableOpacity>
        </View>

        {/* search */}
        <View style={styles.searchContainer}>
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Search description, notes, #tags, account, category"
            placeholderTextColor={TEXT_MUTED}
            style={styles.searchInput}
            returnKeyType="search"
            blurOnSubmit={false}
          />
        </View>

        {/* quick ranges */}
        <View style={styles.sectionRow}>
          <Text style={styles.sectionLabel}>Quick range:</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}
            keyboardShouldPersistTaps="handled"
          >
            <Chip
              label="All time"
              selected={rangePreset === "ALL"}
              onPress={() => applyRangePreset("ALL")}
              small
            />
            <Chip
              label="Last 7 days"
              selected={rangePreset === "7D"}
              onPress={() => applyRangePreset("7D")}
              small
            />
            <Chip
              label="Last 30 days"
              selected={rangePreset === "30D"}
              onPress={() => applyRangePreset("30D")}
              small
            />
            <Chip
              label="Last 90 days"
              selected={rangePreset === "90D"}
              onPress={() => applyRangePreset("90D")}
              small
            />
            <Chip
              label="Year to date"
              selected={rangePreset === "YTD"}
              onPress={() => applyRangePreset("YTD")}
              small
            />
          </ScrollView>
        </View>

        {/* type filter */}
        <View style={styles.sectionRow}>
          <Text style={styles.sectionLabel}>Type:</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}
            keyboardShouldPersistTaps="handled"
          >
            <Chip
              label="All"
              selected={fType === "ALL"}
              onPress={() => setFType("ALL")}
              small
            />
            <Chip
              label="Income"
              selected={fType === "income"}
              onPress={() => setFType("income")}
              small
            />
            <Chip
              label="Expense"
              selected={fType === "expense"}
              onPress={() => setFType("expense")}
              small
            />
            <Chip
              label="Investment"
              selected={fType === "investment"}
              onPress={() => setFType("investment")}
              small
            />
          </ScrollView>
        </View>

        {/* account + category */}
        <View style={styles.sectionRowColumn}>
          <Text style={styles.sectionLabel}>Accounts:</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}
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

          <Text style={[styles.sectionLabel, { marginTop: 6 }]}>
            Categories:
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}
            keyboardShouldPersistTaps="handled"
          >
            <Chip
              label="All categories"
              selected={fCategoryId === "ALL"}
              onPress={() => setFCategoryId("ALL")}
              small
            />
            {categories.map((c) => (
              <Chip
                key={c._id}
                label={c.name}
                selected={fCategoryId === c._id}
                onPress={() => setFCategoryId(c._id)}
                small
              />
            ))}
          </ScrollView>
        </View>

        {/* currency */}
        <View style={styles.sectionRow}>
          <Text style={styles.sectionLabel}>Currency:</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}
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

        {/* date + amount filters (simple inputs) */}
        <View style={styles.filtersGrid}>
          <View style={styles.filtersCol}>
            <Text style={styles.sectionLabel}>Start date (YYYY-MM-DD)</Text>
            <TextInput
              value={fStart}
              onChangeText={(val) => {
                setRangePreset("CUSTOM");
                setFStart(val);
              }}
              placeholder="2025-01-01"
              placeholderTextColor={TEXT_MUTED}
              keyboardType="numbers-and-punctuation"
              maxLength={10}
              autoCorrect={false}
              autoCapitalize="none"
              style={styles.filterInput}
            />
          </View>
          <View style={styles.filtersCol}>
            <Text style={styles.sectionLabel}>End date (YYYY-MM-DD)</Text>
            <TextInput
              value={fEnd}
              onChangeText={(val) => {
                setRangePreset("CUSTOM");
                setFEnd(val);
              }}
              placeholder="2025-12-31"
              placeholderTextColor={TEXT_MUTED}
              keyboardType="numbers-and-punctuation"
              maxLength={10}
              autoCorrect={false}
              autoCapitalize="none"
              style={styles.filterInput}
            />
          </View>
        </View>

        <View style={styles.filtersGrid}>
          <View style={styles.filtersCol}>
            <Text style={styles.sectionLabel}>Min amount</Text>
            <TextInput
              value={fMin}
              onChangeText={setFMin}
              placeholder="0"
              keyboardType="numeric"
              placeholderTextColor={TEXT_MUTED}
              style={styles.filterInput}
            />
          </View>
          <View style={styles.filtersCol}>
            <Text style={styles.sectionLabel}>Max amount</Text>
            <TextInput
              value={fMax}
              onChangeText={setFMax}
              placeholder="No max"
              keyboardType="numeric"
              placeholderTextColor={TEXT_MUTED}
              style={styles.filterInput}
            />
          </View>
        </View>

        <TouchableOpacity
          style={styles.resetBtn}
          onPress={() => {
            setFStart("");
            setFEnd("");
            setFType("ALL");
            setFAccountId("ALL");
            setFCategoryId("ALL");
            setFCurrency("ALL");
            setFMin("");
            setFMax("");
            setRangePreset("ALL");
          }}
        >
          <Text style={styles.resetBtnText}>Reset filters</Text>
        </TouchableOpacity>
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
        <Text style={styles.loadingSubtitle}>Loading your reports…</Text>
      </SafeAreaView>
    );
  }

  /* ------------------------------ Main render ------------------------------ */
  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="always"
      >
        <Header />

        {err ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{err}</Text>
          </View>
        ) : null}

        {/* Totals */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Totals / Money Flow</Text>
          {totalsByCurrency.length === 0 ? (
            <Text style={styles.emptyText}>
              No transactions match these filters.
            </Text>
          ) : (
            <View style={styles.totalsGrid}>
              {totalsByCurrency.map((t) => {
                const netUp = t.netMinor >= 0;
                return (
                  <View key={t.currency} style={styles.totalCard}>
                    <Text style={styles.totalCur}>{t.currency}</Text>
                    <Text style={styles.totalLine}>
                      Income:{" "}
                      <Text style={styles.totalValue}>
                        {fmtMoneyUI(t.incomeMinor, t.currency)}
                      </Text>
                    </Text>
                    <Text style={styles.totalLine}>
                      Outflow:{" "}
                      <Text style={styles.totalValue}>
                        {fmtMoneyUI(t.outMinor, t.currency)}
                      </Text>
                    </Text>
                    <Text
                      style={[
                        styles.totalNet,
                        netUp ? styles.totalNetUp : styles.totalNetDown,
                      ]}
                    >
                      Net: {fmtMoneyUI(t.netMinor, t.currency)}
                    </Text>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* Category breakdown (Sankey-style summary) */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>
              Top spending categories
              {sankeyCurrency ? ` · ${sankeyCurrency}` : ""}
            </Text>
            {!sankeyCurrency && (
              <Text style={styles.cardHint}>
                Pick a single currency above to see details.
              </Text>
            )}
          </View>

          {!sankeyCurrency || !topCategories.length ? (
            <Text style={styles.emptyText}>No flow to display.</Text>
          ) : (
            topCategories.map((c) => (
              <View key={c.catId} style={styles.catRow}>
                <View style={styles.catRowTop}>
                  <Text style={styles.catName}>{c.name}</Text>
                  <Text style={styles.catAmount}>
                    {fmtMoneyUI(c.minor, sankeyCurrency)}
                  </Text>
                </View>
                <View style={styles.catBarTrack}>
                  <View style={styles.catBarFill} />
                </View>
              </View>
            ))
          )}
        </View>

        {/* Transactions list */}
        <View style={styles.listCard}>
          <Text style={styles.cardTitle}>
            All Transactions{" "}
            <Text style={styles.cardSubtitle}>
              ({rows.length} result{rows.length === 1 ? "" : "s"})
            </Text>
          </Text>
          {rows.length === 0 ? (
            <Text style={styles.emptyText}>No transactions found.</Text>
          ) : (
            <FlatList
              data={rows}
              keyExtractor={(item) => String(item._id)}
              renderItem={renderRow}
              scrollEnabled={false}
            />
          )}
        </View>

        <Text style={styles.footerTip}>
          Tip: Type dates as YYYY-MM-DD and amounts as plain numbers — filters
          only apply when values are complete and valid.
        </Text>
      </ScrollView>
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
  },

  ieRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
  },
  ieBtn: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  ieBtnOutline: {
    borderColor: BORDER_DARK,
    backgroundColor: "#020617",
  },
  ieBtnSolid: {
    borderColor: main,
    backgroundColor: "#022c22",
  },
  ieBtnText: {
    fontSize: 12,
    color: TEXT_SOFT,
  },
  ieBtnTextSolid: {
    fontSize: 12,
    color: "#bbf7d0",
    fontWeight: "600",
  },

  searchContainer: {
    marginTop: 10,
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

  sectionRow: {
    marginTop: 4,
  },
  sectionRowColumn: {
    marginTop: 6,
  },
  sectionLabel: {
    fontSize: 12,
    color: TEXT_MUTED,
    marginBottom: 4,
  },
  chipRow: {
    paddingVertical: 4,
    paddingRight: 8,
  },

  filtersGrid: {
    flexDirection: "row",
    gap: 8,
    marginTop: 6,
  },
  filtersCol: {
    flex: 1,
  },
  filterInput: {
    borderWidth: 1,
    borderColor: BORDER_DARK,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 13,
    backgroundColor: "#020617",
    color: TEXT_HEADING,
  },

  resetBtn: {
    marginTop: 8,
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BORDER_DARK,
    backgroundColor: "#020617",
  },
  resetBtnText: {
    fontSize: 12,
    color: TEXT_SOFT,
  },

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

  card: {
    marginHorizontal: 16,
    marginTop: 12,
    padding: 14,
    borderRadius: 20,
    backgroundColor: CARD_DARK,
    borderWidth: 1,
    borderColor: BORDER_DARK,
  },
  cardHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    gap: 8,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: TEXT_HEADING,
  },
  cardSubtitle: {
    fontSize: 13,
    fontWeight: "400",
    color: TEXT_MUTED,
  },
  cardHint: {
    fontSize: 11,
    color: TEXT_MUTED,
  },

  totalsGrid: {
    marginTop: 8,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  totalCard: {
    flexBasis: "48%",
    padding: 10,
    borderRadius: 12,
    backgroundColor: "#020617",
    borderWidth: 1,
    borderColor: BORDER_DARK,
  },
  totalCur: {
    fontSize: 13,
    fontWeight: "600",
    color: TEXT_HEADING,
    marginBottom: 4,
  },
  totalLine: {
    fontSize: 12,
    color: TEXT_MUTED,
  },
  totalValue: {
    color: TEXT_SOFT,
    fontWeight: "600",
  },
  totalNet: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: "700",
  },
  totalNetUp: {
    color: "#22c55e",
  },
  totalNetDown: {
    color: "#fecaca",
  },

  catRow: {
    marginTop: 8,
  },
  catRowTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 2,
  },
  catName: {
    fontSize: 13,
    color: TEXT_SOFT,
    flex: 1,
    marginRight: 4,
  },
  catAmount: {
    fontSize: 13,
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

  listCard: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 16,
    padding: 14,
    borderRadius: 20,
    backgroundColor: CARD_DARK,
    borderWidth: 1,
    borderColor: BORDER_DARK,
  },

  rowContainer: {
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: BORDER_DARK,
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
  rowTypeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BORDER_DARK,
    backgroundColor: "#020617",
  },
  rowTypeText: {
    fontSize: 11,
    color: TEXT_MUTED,
    textTransform: "capitalize",
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
  rowRight: {
    alignItems: "flex-end",
    justifyContent: "center",
  },
  rowAmount: {
    fontSize: 14,
    fontWeight: "700",
    color: "#bbf7d0",
  },

  emptyText: {
    paddingTop: 6,
    fontSize: 13,
    color: TEXT_MUTED,
  },

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

  footerTip: {
    marginHorizontal: 16,
    marginBottom: 8,
    fontSize: 11,
    color: TEXT_MUTED,
    textAlign: "center",
  },

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
});
