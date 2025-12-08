// mobile/src/screens/ReportsScreen.js
/* eslint-disable no-unused-vars */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Calendar } from "react-native-calendars";

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

/* ------- Build marked dates for calendar "period" (start–end range) ------- */
function buildMarkedDates(startStr, endStr) {
  if (!startStr && !endStr) return {};

  let start = startStr;
  let end = endStr;

  if (start && end && start > end) {
    const tmp = start;
    start = end;
    end = tmp;
  }

  const marked = {};

  if (start && !end) {
    marked[start] = {
      startingDay: true,
      endingDay: true,
      color: main,
      textColor: "#0f172a",
    };
    return marked;
  }

  if (!start || !end) return {};

  const cursor = new Date(start);
  const endDate = new Date(end);

  while (cursor <= endDate) {
    const key = toISODate(cursor);
    marked[key] = {
      startingDay: key === start,
      endingDay: key === end,
      color: main,
      textColor: "#0f172a",
    };
    cursor.setDate(cursor.getDate() + 1);
  }

  return marked;
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

  // APPLIED filters (these control the actual filtering)
  const [fStart, setFStart] = useState("");
  const [fEnd, setFEnd] = useState("");
  const [fType, setFType] = useState("ALL");
  const [fAccountId, setFAccountId] = useState("ALL");
  const [fCategoryId, setFCategoryId] = useState("ALL");
  const [fCurrency, setFCurrency] = useState("ALL");
  const [fMin, setFMin] = useState("");
  const [fMax, setFMax] = useState("");
  const [rangePreset, setRangePreset] = useState("ALL");

  // filters sheet
  const [filtersOpen, setFiltersOpen] = useState(false);

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

  /* --------------------------- Reset filters --------------------------- */
  const resetAllFilters = useCallback(() => {
    setFStart("");
    setFEnd("");
    setFType("ALL");
    setFAccountId("ALL");
    setFCategoryId("ALL");
    setFCurrency("ALL");
    setFMin("");
    setFMax("");
    setRangePreset("ALL");
  }, []);

  const activeFilterCount = useMemo(() => {
    let c = 0;
    if (rangePreset !== "ALL" || fStart || fEnd) c++;
    if (fType !== "ALL") c++;
    if (fAccountId !== "ALL") c++;
    if (fCategoryId !== "ALL") c++;
    if (fCurrency !== "ALL") c++;
    if (fMin.trim() !== "" || fMax.trim() !== "") c++;
    return c;
  }, [
    rangePreset,
    fStart,
    fEnd,
    fType,
    fAccountId,
    fCategoryId,
    fCurrency,
    fMin,
    fMax,
  ]);

  /* ------------------------------- Filtering ------------------------------- */
  const rows = useMemo(() => {
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

      const major = minorToMajor(t.amountMinor, cur);
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
  const handleImportCsv = async () => {
    try {
      const DocumentPicker = await import("expo-document-picker");
      const result = await DocumentPicker.getDocumentAsync({
        type: "text/csv",
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const formData = new FormData();
      formData.append("file", {
        uri: result.assets[0].uri,
        type: "text/csv",
        name: result.assets[0].name || "transactions.csv",
      });

      setLoading(true);
      const response = await api.post("/ingest/csv", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      Alert.alert(
        "Success",
        response.data.message || "CSV imported successfully"
      );
      loadAll();
    } catch (err) {
      Alert.alert(
        "Error",
        err?.response?.data?.error || err.message || "Failed to import CSV"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleImportPdf = async () => {
    try {
      const DocumentPicker = await import("expo-document-picker");
      const result = await DocumentPicker.getDocumentAsync({
        type: "application/pdf",
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const formData = new FormData();
      formData.append("file", {
        uri: result.assets[0].uri,
        type: "application/pdf",
        name: result.assets[0].name || "transactions.pdf",
      });

      setLoading(true);
      const response = await api.post("/ingest/pdf", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      Alert.alert(
        "Success",
        response.data.message || "PDF imported successfully"
      );
      loadAll();
    } catch (err) {
      Alert.alert(
        "Error",
        err?.response?.data?.error || err.message || "Failed to import PDF"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadCsv = async () => {
    try {
      if (rows.length === 0) {
        Alert.alert("No Data", "No transactions to export");
        return;
      }

      setLoading(true);

      const headers = [
        "Date",
        "Type",
        "Category",
        "Account",
        "Description",
        "Amount",
        "Currency",
        "Notes",
      ];
      const csvLines = [headers.join(",")];

      rows.forEach((tx) => {
        const cat = categoriesById.get(tx.categoryId)?.name || "";
        const acc = accountsById.get(tx.accountId)?.name || "";
        const amount = minorToMajor(tx.amountMinor, tx.currency);
        const line = [
          fmtDate(tx.date),
          tx.type || "",
          `"${cat.replace(/"/g, '""')}"`,
          `"${acc.replace(/"/g, '""')}"`,
          `"${(tx.description || "").replace(/"/g, '""')}"`,
          amount,
          tx.currency || "USD",
          `"${(tx.notes || "").replace(/"/g, '""')}"`,
        ].join(",");
        csvLines.push(line);
      });

      const csvContent = csvLines.join("\n");

      // ✅ proper dynamic imports
      const FSModule = await import("expo-file-system");
      const SharingModule = await import("expo-sharing");

      const FileSystem = FSModule.default || FSModule;
      const Sharing = SharingModule.default || SharingModule;

      const fileName = `nummoria_report_${new Date()
        .toISOString()
        .slice(0, 10)}.csv`;
      const fileUri = `${FileSystem.documentDirectory}${fileName}`;

      await FileSystem.writeAsStringAsync(fileUri, csvContent, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: "text/csv",
          dialogTitle: "Save CSV Report",
          UTI: "public.comma-separated-values-text",
        });
        Alert.alert("Success", "CSV report ready to save");
      } else {
        Alert.alert("Success", `Report saved as ${fileName}`);
      }
    } catch (err) {
      Alert.alert("Error", err.message || "Failed to download CSV");
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPdf = async () => {
    try {
      if (rows.length === 0) {
        Alert.alert("No Data", "No transactions to export");
        return;
      }

      setLoading(true);

      // 1) Build simple HTML table for the PDF
      const tableRowsHtml = rows
        .map((tx) => {
          const cat = categoriesById.get(tx.categoryId)?.name || "";
          const acc = accountsById.get(tx.accountId)?.name || "";
          const amount = minorToMajor(tx.amountMinor, tx.currency);
          return `
          <tr>
            <td>${fmtDate(tx.date)}</td>
            <td>${tx.type || ""}</td>
            <td>${cat}</td>
            <td>${acc}</td>
            <td>${(tx.description || "").replace(/</g, "&lt;")}</td>
            <td style="text-align:right;">${amount}</td>
            <td>${tx.currency || "USD"}</td>
            <td>${(tx.notes || "").replace(/</g, "&lt;")}</td>
          </tr>
        `;
        })
        .join("");

      const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Nummoria Report</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
              font-size: 12px;
              color: #0f172a;
              padding: 24px;
            }
            h1 {
              font-size: 18px;
              margin-bottom: 4px;
            }
            p {
              margin: 0 0 12px 0;
              color: #6b7280;
            }
            table {
              width: 100%;
              border-collapse: collapse;
            }
            th, td {
              border: 1px solid #e5e7eb;
              padding: 4px 6px;
            }
            th {
              background-color: #f3f4f6;
              text-align: left;
            }
            tr:nth-child(even) td {
              background-color: #fafafa;
            }
          </style>
        </head>
        <body>
          <h1>Nummoria – Transactions Report</h1>
          <p>Generated on ${new Date().toLocaleString()}</p>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Category</th>
                <th>Account</th>
                <th>Description</th>
                <th>Amount</th>
                <th>Currency</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              ${tableRowsHtml}
            </tbody>
          </table>
        </body>
      </html>
    `;

      // 2) Use expo-print to create a PDF file from this HTML
      const PrintModule = await import("expo-print");
      const { printToFileAsync } = PrintModule;

      const { uri } = await printToFileAsync({
        html,
        base64: false,
      });

      // 3) Share / save the PDF using expo-sharing
      const SharingModule = await import("expo-sharing");
      const Sharing = SharingModule.default || SharingModule;

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: "application/pdf",
          dialogTitle: "Save PDF Report",
          UTI: "com.adobe.pdf",
        });
        Alert.alert("Success", "PDF report ready to save");
      } else {
        Alert.alert("Success", "PDF report generated");
      }
    } catch (err) {
      console.error("PDF export error:", err);
      Alert.alert("Error", err.message || "Failed to download PDF");
    } finally {
      setLoading(false);
    }
  };

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

  /* ------------------------------ Header / top ------------------------------ */
  function Header() {
    return (
      <View style={styles.header}>
        <View className="header-top" style={styles.headerTopRow}>
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

        <View style={styles.headerFilterRow}>
          <TouchableOpacity
            style={styles.filterPill}
            onPress={() => setFiltersOpen(true)}
            activeOpacity={0.9}
          >
            <Text style={styles.filterPillIcon}>☰</Text>
            <Text style={styles.filterPillText}>Filters</Text>
            {activeFilterCount > 0 && (
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  /* ------------------------------ Filters sheet ------------------------------ */
  function FiltersSheet() {
    const [localStart, setLocalStart] = useState("");
    const [localEnd, setLocalEnd] = useState("");
    const [localType, setLocalType] = useState("ALL");
    const [localAccountId, setLocalAccountId] = useState("ALL");
    const [localCategoryId, setLocalCategoryId] = useState("ALL");
    const [localCurrency, setLocalCurrency] = useState("ALL");
    const [localMin, setLocalMin] = useState("");
    const [localMax, setLocalMax] = useState("");
    const [localRangePreset, setLocalRangePreset] = useState("ALL");

    useEffect(() => {
      if (filtersOpen) {
        setLocalStart(fStart);
        setLocalEnd(fEnd);
        setLocalType(fType);
        setLocalAccountId(fAccountId);
        setLocalCategoryId(fCategoryId);
        setLocalCurrency(fCurrency);
        setLocalMin(fMin);
        setLocalMax(fMax);
        setLocalRangePreset(rangePreset);
      }
    }, [filtersOpen]);

    const markedDates = buildMarkedDates(localStart, localEnd);

    const handleCalendarPress = (dateStr) => {
      setLocalRangePreset("CUSTOM");

      if (!localStart || (localStart && localEnd)) {
        setLocalStart(dateStr);
        setLocalEnd("");
        return;
      }

      if (!localEnd) {
        if (dateStr < localStart) {
          setLocalEnd(localStart);
          setLocalStart(dateStr);
        } else {
          setLocalEnd(dateStr);
        }
      }
    };

    const applyLocalRangePreset = (preset) => {
      setLocalRangePreset(preset);
      const now = new Date();
      const todayStr = toISODate(now);

      if (preset === "ALL") {
        setLocalStart("");
        setLocalEnd("");
        return;
      }

      if (preset === "7D" || preset === "30D" || preset === "90D") {
        const days = preset === "7D" ? 7 : preset === "30D" ? 30 : 90;
        const start = new Date(now);
        start.setDate(start.getDate() - days);
        const startStr = toISODate(start);
        setLocalStart(startStr);
        setLocalEnd(todayStr);
        return;
      }

      if (preset === "YTD") {
        const start = new Date(now.getFullYear(), 0, 1);
        const startStr = toISODate(start);
        setLocalStart(startStr);
        setLocalEnd(todayStr);
      }
    };

    const handleClear = () => {
      setLocalStart("");
      setLocalEnd("");
      setLocalType("ALL");
      setLocalAccountId("ALL");
      setLocalCategoryId("ALL");
      setLocalCurrency("ALL");
      setLocalMin("");
      setLocalMax("");
      setLocalRangePreset("ALL");

      resetAllFilters();
      setFiltersOpen(false);
    };

    const handleApply = () => {
      setFStart(localStart);
      setFEnd(localEnd);
      setFType(localType);
      setFAccountId(localAccountId);
      setFCategoryId(localCategoryId);
      setFCurrency(localCurrency);
      setFMin(localMin);
      setFMax(localMax);
      setRangePreset(localRangePreset);
      setFiltersOpen(false);
    };

    return (
      <Modal
        visible={filtersOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setFiltersOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filters</Text>
              <TouchableOpacity
                onPress={() => setFiltersOpen(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={{ paddingBottom: 12 }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.sectionRow}>
                <Text style={styles.sectionLabel}>Quick range</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.chipRow}
                >
                  <Chip
                    label="All time"
                    selected={localRangePreset === "ALL"}
                    onPress={() => applyLocalRangePreset("ALL")}
                    small
                  />
                  <Chip
                    label="Last 7 days"
                    selected={localRangePreset === "7D"}
                    onPress={() => applyLocalRangePreset("7D")}
                    small
                  />
                  <Chip
                    label="Last 30 days"
                    selected={localRangePreset === "30D"}
                    onPress={() => applyLocalRangePreset("30D")}
                    small
                  />
                  <Chip
                    label="Last 90 days"
                    selected={localRangePreset === "90D"}
                    onPress={() => applyLocalRangePreset("90D")}
                    small
                  />
                  <Chip
                    label="Year to date"
                    selected={localRangePreset === "YTD"}
                    onPress={() => applyLocalRangePreset("YTD")}
                    small
                  />
                </ScrollView>
              </View>

              <View style={styles.modalSection}>
                <Text style={styles.sectionLabel}>Date range</Text>

                <View style={styles.dateRangePill}>
                  <Text style={styles.dateRangeText}>
                    {localStart && localEnd
                      ? `${fmtDate(localStart)} - ${fmtDate(localEnd)}`
                      : localStart
                      ? `${fmtDate(localStart)} - Select end date`
                      : "Select dates"}
                  </Text>
                </View>

                <View style={styles.calendarCard}>
                  <Calendar
                    markingType="period"
                    onDayPress={(day) => handleCalendarPress(day.dateString)}
                    markedDates={markedDates}
                    maxDate={toISODate(new Date())}
                    theme={{
                      backgroundColor: CARD_DARK,
                      calendarBackground: CARD_DARK,
                      textSectionTitleColor: TEXT_MUTED,
                      monthTextColor: TEXT_HEADING,
                      dayTextColor: TEXT_SOFT,
                      todayTextColor: main,
                      arrowColor: main,
                      textDisabledColor: "rgba(148,163,184,0.35)",
                    }}
                  />
                </View>
              </View>

              <View style={styles.sectionRow}>
                <Text style={styles.sectionLabel}>Type</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.chipRow}
                >
                  <Chip
                    label="All"
                    selected={localType === "ALL"}
                    onPress={() => setLocalType("ALL")}
                    small
                  />
                  <Chip
                    label="Income"
                    selected={localType === "income"}
                    onPress={() => setLocalType("income")}
                    small
                  />
                  <Chip
                    label="Expense"
                    selected={localType === "expense"}
                    onPress={() => setLocalType("expense")}
                    small
                  />
                  <Chip
                    label="Investment"
                    selected={localType === "investment"}
                    onPress={() => setLocalType("investment")}
                    small
                  />
                </ScrollView>
              </View>

              <View style={styles.sectionRowColumn}>
                <Text style={styles.sectionLabel}>Accounts</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.chipRow}
                >
                  <Chip
                    label="All accounts"
                    selected={localAccountId === "ALL"}
                    onPress={() => setLocalAccountId("ALL")}
                    small
                  />
                  {accounts.map((a) => (
                    <Chip
                      key={a._id}
                      label={a.name}
                      selected={localAccountId === a._id}
                      onPress={() => setLocalAccountId(a._id)}
                      small
                    />
                  ))}
                </ScrollView>

                <Text style={[styles.sectionLabel, { marginTop: 6 }]}>
                  Categories
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.chipRow}
                >
                  <Chip
                    label="All categories"
                    selected={localCategoryId === "ALL"}
                    onPress={() => setLocalCategoryId("ALL")}
                    small
                  />
                  {categories.map((c) => (
                    <Chip
                      key={c._id}
                      label={c.name}
                      selected={localCategoryId === c._id}
                      onPress={() => setLocalCategoryId(c._id)}
                      small
                    />
                  ))}
                </ScrollView>
              </View>

              <View style={styles.sectionRow}>
                <Text style={styles.sectionLabel}>Currency</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.chipRow}
                >
                  {currencies.map((c) => (
                    <Chip
                      key={c}
                      label={c === "ALL" ? "All currencies" : c}
                      selected={localCurrency === c}
                      onPress={() => setLocalCurrency(c)}
                      small
                    />
                  ))}
                </ScrollView>
              </View>

              <View style={styles.filtersGrid}>
                <View style={styles.filtersCol}>
                  <Text style={styles.sectionLabel}>Min amount</Text>
                  <TextInput
                    value={localMin}
                    onChangeText={setLocalMin}
                    placeholder="0"
                    keyboardType="numeric"
                    placeholderTextColor={TEXT_MUTED}
                    style={styles.filterInput}
                  />
                </View>
                <View style={styles.filtersCol}>
                  <Text style={styles.sectionLabel}>Max amount</Text>
                  <TextInput
                    value={localMax}
                    onChangeText={setLocalMax}
                    placeholder="No max"
                    keyboardType="numeric"
                    placeholderTextColor={TEXT_MUTED}
                    style={styles.filterInput}
                  />
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnOutline]}
                onPress={handleClear}
              >
                <Text style={styles.modalBtnOutlineText}>Clear</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnSolid]}
                onPress={handleApply}
              >
                <Text style={styles.modalBtnSolidText}>View results</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
      <FiltersSheet />

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

        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>
              Top spending categories
              {sankeyCurrency ? ` · ${sankeyCurrency}` : ""}
            </Text>
            {!sankeyCurrency && (
              <Text style={styles.cardHint}>
                Pick a single currency in filters to see details.
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
          Tip: Tap the Filters button to narrow reports by date range, type,
          accounts, categories, currency, and amount.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

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
    marginBottom: 6,
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
  headerFilterRow: {
    marginTop: 8,
    alignItems: "flex-start",
  },
  filterPill: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#020617",
    borderWidth: 1,
    borderColor: BORDER_DARK,
  },
  filterPillIcon: {
    fontSize: 14,
    color: TEXT_SOFT,
    marginRight: 6,
  },
  filterPillText: {
    fontSize: 13,
    color: TEXT_HEADING,
    fontWeight: "500",
  },
  filterBadge: {
    marginLeft: 8,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: main,
    alignItems: "center",
    justifyContent: "center",
  },
  filterBadgeText: {
    fontSize: 11,
    color: "#022c22",
    fontWeight: "700",
  },
  sectionRow: {
    marginTop: 8,
  },
  sectionRowColumn: {
    marginTop: 10,
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
    marginTop: 10,
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.7)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    maxHeight: "85%",
    backgroundColor: BG_DARK,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 8,
    borderTopWidth: 1,
    borderColor: BORDER_DARK,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: TEXT_HEADING,
  },
  modalClose: {
    fontSize: 18,
    color: TEXT_MUTED,
  },
  modalScroll: {
    flexGrow: 0,
  },
  modalSection: {
    marginTop: 10,
  },
  dateRangePill: {
    marginTop: 4,
    marginBottom: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER_DARK,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#020617",
  },
  dateRangeText: {
    fontSize: 14,
    color: TEXT_HEADING,
    textAlign: "center",
  },
  calendarCard: {
    marginTop: 8,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: BORDER_DARK,
    backgroundColor: CARD_DARK,
  },
  modalActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  modalBtnOutline: {
    borderWidth: 1,
    borderColor: BORDER_DARK,
    backgroundColor: "#020617",
  },
  modalBtnSolid: {
    borderWidth: 1,
    borderColor: main,
    backgroundColor: main,
  },
  modalBtnOutlineText: {
    fontSize: 13,
    color: TEXT_SOFT,
    fontWeight: "500",
  },
  modalBtnSolidText: {
    fontSize: 13,
    color: "#022c22",
    fontWeight: "700",
  },
});
