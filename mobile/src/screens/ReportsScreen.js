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
  Image,
} from "react-native";
import { Calendar } from "react-native-calendars";
import { useNavigation } from "@react-navigation/native";
import api from "../lib/api";
import logo from "../../assets/nummoria_logo.png";

/* ──────────────────────────────────────────────────────────
   THEME — synced with Dashboard / Expenses / Auth HUD
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
const DATE_LANG = "en-US";

/* legacy aliases if needed */
const main = MINT;
const secondary = CYAN;

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

function toISODate(d) {
  return d.toISOString().slice(0, 10);
}

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
      color: MINT,
      textColor: BG,
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
      color: MINT,
      textColor: BG,
    };
    cursor.setDate(cursor.getDate() + 1);
  }

  return marked;
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

/* ----------------------------- Small components ---------------------------- */
function Chip({ label, selected, onPress, small, accent = MINT }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={[
        styles.chip,
        small && styles.chipSmall,
        selected && [styles.chipSelected, { borderColor: `${accent}55` }],
      ]}
    >
      {selected && (
        <View style={[styles.chipDot, { backgroundColor: accent }]} />
      )}
      <Text
        numberOfLines={1}
        style={[
          styles.chipText,
          small && styles.chipTextSmall,
          selected && [styles.chipTextSelected, { color: accent }],
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function StatCard({ title, value, accent = MINT, sub }) {
  return (
    <View
      style={[
        styles.statCard,
        {
          borderColor: `${accent}30`,
          backgroundColor:
            accent === VIOLET
              ? "rgba(167,139,250,0.08)"
              : accent === CYAN
                ? "rgba(0,212,255,0.08)"
                : "rgba(0,255,135,0.08)",
        },
      ]}
    >
      <Brackets color={accent} size={9} thick={1.5} />
      <View style={[styles.statHairline, { backgroundColor: accent }]} />
      <Text style={[styles.statEyebrow, { color: accent }]}>{title}</Text>
      <Text style={[styles.statValue, { color: accent }]}>{value}</Text>
      {sub ? <Text style={styles.statSub}>{sub}</Text> : null}
    </View>
  );
}

function StatusCard({ title, body, accent = VIOLET }) {
  return (
    <View
      style={[
        styles.statusCard,
        {
          borderColor: `${accent}33`,
          backgroundColor:
            accent === VIOLET
              ? "rgba(167,139,250,0.08)"
              : "rgba(0,255,135,0.08)",
        },
      ]}
    >
      <Brackets color={accent} size={8} thick={1} />
      <Text style={[styles.statusTitle, { color: accent }]}>{title}</Text>
      <Text style={styles.statusBody}>{body}</Text>
    </View>
  );
}

/* =============================== Screen =============================== */
export default function ReportsScreen() {
  const navigation = useNavigation();

  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [accounts, setAccounts] = useState([]);

  const [loading, setLoading] = useState(true);
  const [initialDone, setInitialDone] = useState(false);
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");

  const [fStart, setFStart] = useState("");
  const [fEnd, setFEnd] = useState("");
  const [fType, setFType] = useState("ALL");
  const [fAccountId, setFAccountId] = useState("ALL");
  const [fCategoryId, setFCategoryId] = useState("ALL");
  const [fCurrency, setFCurrency] = useState("ALL");
  const [fMin, setFMin] = useState("");
  const [fMax, setFMax] = useState("");
  const [rangePreset, setRangePreset] = useState("ALL");

  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQ(q);
    }, 300);
    return () => clearTimeout(timer);
  }, [q]);

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
        e?.response?.data?.error || e.message || "Failed to load reports data",
      );
    } finally {
      setLoading(false);
      setInitialDone((prev) => (prev ? prev : true));
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

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
        response.data.message || "CSV imported successfully",
      );
      loadAll();
    } catch (err) {
      Alert.alert(
        "Error",
        err?.response?.data?.error || err.message || "Failed to import CSV",
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
        response.data.message || "PDF imported successfully",
      );
      loadAll();
    } catch (err) {
      Alert.alert(
        "Error",
        err?.response?.data?.error || err.message || "Failed to import PDF",
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

      const PrintModule = await import("expo-print");
      const { printToFileAsync } = PrintModule;

      const { uri } = await printToFileAsync({
        html,
        base64: false,
      });

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

  function renderRow({ item }) {
    const accName = accountsById.get(item.accountId)?.name || "—";
    const catName = categoriesById.get(item.categoryId)?.name || "—";
    const isIncome = item.type === "income";
    const sign = isIncome ? "+" : "-";
    const accent = isIncome ? MINT : VIOLET;

    return (
      <View style={styles.rowCard}>
        <Brackets color={accent} size={7} thick={1} />
        <View style={styles.rowTopLine}>
          <View style={[styles.rowCatPill, { borderColor: `${accent}44` }]}>
            <View style={[styles.rowCatDot, { backgroundColor: accent }]} />
            <Text
              style={[styles.rowCatTxt, { color: accent }]}
              numberOfLines={1}
            >
              {catName}
            </Text>
          </View>

          <View style={styles.rowTypeBadge}>
            <Text style={styles.rowTypeText}>{item.type}</Text>
          </View>

          <Text style={[styles.rowAmount, { color: accent }]}>
            {sign}
            {fmtMoneyUI(item.amountMinor, item.currency)}
          </Text>
        </View>

        <View style={styles.rowAccountPill}>
          <Text style={styles.rowAccountTxt}>{accName}</Text>
        </View>

        <Text style={styles.rowDescription} numberOfLines={2}>
          {item.description || "No description"}
        </Text>

        <Text style={styles.rowDate}>{fmtDate(item.date)}</Text>

        <ScanLine color={accent} style={{ marginTop: 10 }} />
      </View>
    );
  }

  function Header() {
    return (
      <View style={styles.headerCard}>
        <Brackets color={MINT} size={12} thick={1.5} />
        <View style={[styles.headerHairline, { backgroundColor: MINT }]} />

        <View style={styles.topBar}>
          <View style={styles.logoRow}>
            <View style={[styles.statusDot, { backgroundColor: MINT }]} />
            <Text style={styles.logoTxt}>REPORTS</Text>
            <View
              style={[
                styles.livePill,
                {
                  borderColor: "rgba(0,255,135,0.25)",
                  backgroundColor: "rgba(0,255,135,0.12)",
                },
              ]}
            >
              <Text style={[styles.livePillTxt, { color: MINT }]}>
                ANALYTICS MODULE
              </Text>
            </View>
          </View>

          <TouchableOpacity
            onPress={() => navigation.navigate("Dashboard")}
            activeOpacity={0.85}
            style={styles.homeBtn}
          >
            <Image source={logo} style={styles.homeBtnImg} />
            <Brackets color={MINT} size={7} thick={1} />
          </TouchableOpacity>
        </View>

        <Text style={styles.heroTitle}>Reports{"\n"}Command</Text>
        <Text style={styles.heroSub}>
          Review money flow, filter transactions, and import or export
          structured reports.
        </Text>

        <ScanLine color={MINT} style={{ marginTop: 12, marginBottom: 14 }} />

        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.ctrlPill, { borderColor: "rgba(0,255,135,0.25)" }]}
            onPress={loadAll}
            activeOpacity={0.8}
          >
            <View style={[styles.ctrlDot, { backgroundColor: MINT }]} />
            <Text style={[styles.ctrlTxt, { color: MINT }]}>REFRESH</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.ctrlPill, { borderColor: "rgba(0,212,255,0.25)" }]}
            onPress={() => setFiltersOpen(true)}
            activeOpacity={0.8}
          >
            <View style={[styles.ctrlDot, { backgroundColor: CYAN }]} />
            <Text style={[styles.ctrlTxt, { color: CYAN }]}>FILTERS</Text>
            {activeFilterCount > 0 && (
              <View style={styles.upcomingBadge}>
                <Text style={styles.upcomingBadgeTxt}>{activeFilterCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.importRow}>
          <TouchableOpacity
            style={[styles.ioBtn, { borderColor: "rgba(0,255,135,0.22)" }]}
            onPress={handleImportCsv}
            activeOpacity={0.8}
          >
            <Text style={[styles.ioBtnTxt, { color: MINT }]}>IMPORT CSV</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.ioBtn, { borderColor: "rgba(0,212,255,0.22)" }]}
            onPress={handleImportPdf}
            activeOpacity={0.8}
          >
            <Text style={[styles.ioBtnTxt, { color: CYAN }]}>IMPORT PDF</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.importRow}>
          <TouchableOpacity
            style={[styles.ioBtn, { borderColor: "rgba(167,139,250,0.22)" }]}
            onPress={handleDownloadCsv}
            activeOpacity={0.8}
          >
            <Text style={[styles.ioBtnTxt, { color: VIOLET }]}>EXPORT CSV</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.ioBtn, { borderColor: "rgba(0,255,135,0.22)" }]}
            onPress={handleDownloadPdf}
            activeOpacity={0.8}
          >
            <Text style={[styles.ioBtnTxt, { color: MINT }]}>EXPORT PDF</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.searchWrap}>
          <View style={[styles.searchDot, { backgroundColor: MINT }]} />
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Search description, notes, #tags, account, category"
            placeholderTextColor={T_DIM}
            style={styles.searchInput}
            returnKeyType="search"
            blurOnSubmit={false}
          />
        </View>
      </View>
    );
  }

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
            <Brackets color={CYAN} size={10} thick={1.5} />
            <View style={[styles.modalHairline, { backgroundColor: CYAN }]} />

            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>FILTER MATRIX</Text>
              <TouchableOpacity onPress={() => setFiltersOpen(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={{ paddingBottom: 12 }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.modalSection}>
                <Text style={styles.filterGroupLabel}>QUICK RANGE</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.chipScroll}
                >
                  <Chip
                    label="All time"
                    selected={localRangePreset === "ALL"}
                    onPress={() => applyLocalRangePreset("ALL")}
                    small
                    accent={CYAN}
                  />
                  <Chip
                    label="Last 7 days"
                    selected={localRangePreset === "7D"}
                    onPress={() => applyLocalRangePreset("7D")}
                    small
                    accent={CYAN}
                  />
                  <Chip
                    label="Last 30 days"
                    selected={localRangePreset === "30D"}
                    onPress={() => applyLocalRangePreset("30D")}
                    small
                    accent={CYAN}
                  />
                  <Chip
                    label="Last 90 days"
                    selected={localRangePreset === "90D"}
                    onPress={() => applyLocalRangePreset("90D")}
                    small
                    accent={CYAN}
                  />
                  <Chip
                    label="Year to date"
                    selected={localRangePreset === "YTD"}
                    onPress={() => applyLocalRangePreset("YTD")}
                    small
                    accent={CYAN}
                  />
                </ScrollView>
              </View>

              <View style={styles.modalSection}>
                <Text style={styles.filterGroupLabel}>DATE RANGE</Text>

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
                      backgroundColor: BG,
                      calendarBackground: BG,
                      textSectionTitleColor: T_MID,
                      monthTextColor: T_HI,
                      dayTextColor: T_HI,
                      todayTextColor: MINT,
                      arrowColor: MINT,
                      textDisabledColor: "rgba(226,232,240,0.25)",
                      selectedDayBackgroundColor: MINT,
                    }}
                  />
                </View>
              </View>

              <View style={styles.modalSection}>
                <Text style={styles.filterGroupLabel}>TYPE</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.chipScroll}
                >
                  <Chip
                    label="All"
                    selected={localType === "ALL"}
                    onPress={() => setLocalType("ALL")}
                    small
                    accent={MINT}
                  />
                  <Chip
                    label="Income"
                    selected={localType === "income"}
                    onPress={() => setLocalType("income")}
                    small
                    accent={MINT}
                  />
                  <Chip
                    label="Expense"
                    selected={localType === "expense"}
                    onPress={() => setLocalType("expense")}
                    small
                    accent={VIOLET}
                  />
                  <Chip
                    label="Investment"
                    selected={localType === "investment"}
                    onPress={() => setLocalType("investment")}
                    small
                    accent={CYAN}
                  />
                </ScrollView>
              </View>

              <View style={styles.modalSection}>
                <Text style={styles.filterGroupLabel}>ACCOUNT</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.chipScroll}
                >
                  <Chip
                    label="All accounts"
                    selected={localAccountId === "ALL"}
                    onPress={() => setLocalAccountId("ALL")}
                    small
                    accent={CYAN}
                  />
                  {accounts.map((a) => (
                    <Chip
                      key={a._id}
                      label={a.name}
                      selected={localAccountId === a._id}
                      onPress={() => setLocalAccountId(a._id)}
                      small
                      accent={MINT}
                    />
                  ))}
                </ScrollView>
              </View>

              <View style={styles.modalSection}>
                <Text style={styles.filterGroupLabel}>CATEGORY</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.chipScroll}
                >
                  <Chip
                    label="All categories"
                    selected={localCategoryId === "ALL"}
                    onPress={() => setLocalCategoryId("ALL")}
                    small
                    accent={CYAN}
                  />
                  {categories.map((c) => (
                    <Chip
                      key={c._id}
                      label={c.name}
                      selected={localCategoryId === c._id}
                      onPress={() => setLocalCategoryId(c._id)}
                      small
                      accent={VIOLET}
                    />
                  ))}
                </ScrollView>
              </View>

              <View style={styles.modalSection}>
                <Text style={styles.filterGroupLabel}>CURRENCY</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.chipScroll}
                >
                  {currencies.map((c) => (
                    <Chip
                      key={c}
                      label={c === "ALL" ? "All currencies" : c}
                      selected={localCurrency === c}
                      onPress={() => setLocalCurrency(c)}
                      small
                      accent={CYAN}
                    />
                  ))}
                </ScrollView>
              </View>

              <View style={styles.modalInputRow}>
                <View style={styles.modalInputCol}>
                  <Text style={styles.filterGroupLabel}>MIN AMOUNT</Text>
                  <TextInput
                    value={localMin}
                    onChangeText={setLocalMin}
                    placeholder="0"
                    keyboardType="numeric"
                    placeholderTextColor={T_DIM}
                    style={styles.filterInput}
                  />
                </View>
                <View style={styles.modalInputCol}>
                  <Text style={styles.filterGroupLabel}>MAX AMOUNT</Text>
                  <TextInput
                    value={localMax}
                    onChangeText={setLocalMax}
                    placeholder="No max"
                    keyboardType="numeric"
                    placeholderTextColor={T_DIM}
                    style={styles.filterInput}
                  />
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalBtnCancel}
                onPress={handleClear}
                activeOpacity={0.8}
              >
                <Text style={[styles.modalBtnTxt, { color: T_MID }]}>
                  CLEAR
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalBtnPrimary}
                onPress={handleApply}
                activeOpacity={0.8}
              >
                <Text style={styles.modalPrimaryTxt}>VIEW RESULTS</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  }

  if (!initialDone) {
    return (
      <SafeAreaView style={styles.loadingScreen}>
        <GridBG />
        <View style={styles.loadingInner}>
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
            <Brackets color={MINT} size={20} thick={2} />
            <ActivityIndicator size="large" color={MINT} />
          </View>
          <Text style={styles.loadingTitle}>REPORTS</Text>
          <Text style={styles.loadingMono}>Initialising analytics…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <GridBG />
      <FiltersSheet />

      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="always"
      >
        <Header />

        {!!err && (
          <StatusCard title="REPORTS ERROR" body={err} accent={VIOLET} />
        )}

        <View style={styles.sectionCard}>
          <Brackets color={MINT} size={10} thick={1} />
          <View style={[styles.sectionHairline, { backgroundColor: MINT }]} />
          <View style={styles.sectionHeaderRow}>
            <View>
              <Text style={styles.sectionEyebrow}>FLOW SNAPSHOT</Text>
              <Text style={styles.sectionTitle}>Totals / money flow</Text>
            </View>
          </View>

          {totalsByCurrency.length === 0 ? (
            <Text style={styles.emptyText}>
              No transactions match these filters.
            </Text>
          ) : (
            <View style={styles.statsWrap}>
              {totalsByCurrency.map((t) => {
                const netUp = t.netMinor >= 0;
                return (
                  <View key={t.currency} style={styles.statsCol}>
                    <StatCard
                      title={`${t.currency} · INCOME`}
                      value={fmtMoneyUI(t.incomeMinor, t.currency)}
                      accent={MINT}
                      sub="Tracked within current filter scope"
                    />
                    <StatCard
                      title={`${t.currency} · OUTFLOW`}
                      value={fmtMoneyUI(t.outMinor, t.currency)}
                      accent={VIOLET}
                      sub="Expense-side money movement"
                    />
                    <StatCard
                      title={`${t.currency} · NET`}
                      value={fmtMoneyUI(t.netMinor, t.currency)}
                      accent={netUp ? CYAN : VIOLET}
                      sub={
                        netUp
                          ? "Positive balance flow"
                          : "Negative balance flow"
                      }
                    />
                  </View>
                );
              })}
            </View>
          )}
        </View>

        <View style={styles.sectionCard}>
          <Brackets color={CYAN} size={10} thick={1} />
          <View style={[styles.sectionHairline, { backgroundColor: CYAN }]} />
          <View style={styles.sectionHeaderRow}>
            <View>
              <Text style={styles.sectionEyebrow}>SPENDING SHAPE</Text>
              <Text style={styles.sectionTitle}>
                Top spending categories
                {sankeyCurrency ? ` · ${sankeyCurrency}` : ""}
              </Text>
            </View>
          </View>

          {!sankeyCurrency && (
            <Text style={styles.sectionNote}>
              Pick a single currency in filters to inspect category
              concentration.
            </Text>
          )}

          {!sankeyCurrency || !topCategories.length ? (
            <Text style={styles.emptyText}>No flow to display.</Text>
          ) : (
            topCategories.map((c, i) => (
              <View key={c.catId} style={styles.catRow}>
                <View style={styles.catRowTop}>
                  <Text style={styles.catName}>{c.name}</Text>
                  <Text style={styles.catAmount}>
                    {fmtMoneyUI(c.minor, sankeyCurrency)}
                  </Text>
                </View>
                <View style={styles.catBarTrack}>
                  <View
                    style={[
                      styles.catBarFill,
                      { width: `${Math.max(8, 100 - i * 12)}%` },
                    ]}
                  />
                </View>
              </View>
            ))
          )}
        </View>

        <View style={styles.sectionCard}>
          <Brackets color={VIOLET} size={10} thick={1} />
          <View style={[styles.sectionHairline, { backgroundColor: VIOLET }]} />
          <View style={styles.sectionHeaderRow}>
            <View>
              <Text style={styles.sectionEyebrow}>TRANSACTION FEED</Text>
              <Text style={styles.sectionTitle}>
                All transactions{" "}
                <Text style={styles.sectionTitleSub}>
                  ({rows.length} result{rows.length === 1 ? "" : "s"})
                </Text>
              </Text>
            </View>
          </View>

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
          Tip: use Filters to narrow reports by date, type, account, category,
          currency, or amount band.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
    borderColor: "rgba(0,255,135,0.20)",
    backgroundColor: "rgba(0,255,135,0.04)",
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

  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
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
    backgroundColor: "rgba(0,212,255,0.18)",
    borderWidth: 1,
    borderColor: "rgba(0,212,255,0.28)",
  },
  upcomingBadgeTxt: { fontSize: 10, fontWeight: "800", color: CYAN },

  importRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 6,
  },
  ioBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 2,
    borderWidth: 1,
    backgroundColor: "rgba(255,255,255,0.025)",
    alignItems: "center",
    justifyContent: "center",
  },
  ioBtnTxt: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.1,
  },

  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: CARD_BD,
    borderRadius: 2,
    paddingHorizontal: 10,
    paddingVertical: 2,
    backgroundColor: "rgba(255,255,255,0.025)",
    marginTop: 12,
  },
  searchDot: {
    width: 5,
    height: 5,
    borderRadius: 999,
    marginRight: 8,
    opacity: 0.7,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: T_HI,
    paddingVertical: 10,
  },

  statusCard: {
    position: "relative",
    borderRadius: 4,
    borderWidth: 1,
    padding: 12,
    marginHorizontal: 12,
    marginBottom: 2,
    overflow: "hidden",
  },
  statusTitle: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.6,
    marginBottom: 6,
  },
  statusBody: {
    fontSize: 12,
    color: T_HI,
    lineHeight: 17,
  },

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
  sectionTitleSub: {
    fontSize: 14,
    fontWeight: "400",
    color: T_MID,
  },
  sectionNote: {
    marginTop: -4,
    marginBottom: 12,
    fontSize: 11,
    color: T_MID,
    lineHeight: 17,
  },

  statsWrap: { gap: 10 },
  statsCol: { gap: 10 },

  statCard: {
    position: "relative",
    borderRadius: 4,
    borderWidth: 1,
    padding: 16,
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
  statEyebrow: {
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 1.8,
    marginBottom: 8,
  },
  statValue: {
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: -0.6,
    marginBottom: 6,
  },
  statSub: {
    fontSize: 10,
    color: T_DIM,
    lineHeight: 15,
  },

  catRow: { marginTop: 8 },
  catRowTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
    gap: 8,
  },
  catName: { fontSize: 13, color: T_HI, flex: 1 },
  catAmount: { fontSize: 13, color: CYAN, fontWeight: "700" },
  catBarTrack: {
    height: 6,
    borderRadius: 1,
    backgroundColor: "rgba(255,255,255,0.04)",
    overflow: "hidden",
  },
  catBarFill: {
    height: "100%",
    borderRadius: 1,
    backgroundColor: CYAN,
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
  rowCatTxt: { fontSize: 9, fontWeight: "800", letterSpacing: 0.8 },
  rowTypeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: CARD_BD,
    backgroundColor: "rgba(255,255,255,0.025)",
  },
  rowTypeText: {
    fontSize: 8,
    color: T_DIM,
    fontWeight: "800",
    letterSpacing: 1.1,
    textTransform: "uppercase",
  },
  rowAmount: {
    marginLeft: "auto",
    fontSize: 14,
    fontWeight: "800",
  },
  rowAccountPill: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: CARD_BD,
    borderRadius: 2,
    paddingHorizontal: 7,
    paddingVertical: 3,
    backgroundColor: "rgba(255,255,255,0.025)",
    marginBottom: 6,
  },
  rowAccountTxt: { fontSize: 9, color: T_DIM, letterSpacing: 0.3 },
  rowDescription: {
    fontSize: 12,
    color: T_MID,
    lineHeight: 17,
    marginBottom: 3,
  },
  rowDate: { fontSize: 10, color: T_DIM, letterSpacing: 0.3 },

  emptyText: {
    paddingVertical: 12,
    fontSize: 12,
    color: T_DIM,
    textAlign: "center",
    letterSpacing: 0.5,
  },

  footerTip: {
    marginHorizontal: 16,
    marginBottom: 8,
    fontSize: 11,
    color: T_DIM,
    textAlign: "center",
  },

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

  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(3,5,8,0.92)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    maxHeight: "88%",
    backgroundColor: BG,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
    borderTopWidth: 1,
    borderColor: CARD_BD,
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
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: T_HI,
    letterSpacing: 2.2,
  },
  modalClose: {
    fontSize: 18,
    color: T_DIM,
  },
  modalScroll: { flexGrow: 0 },

  modalSection: { marginTop: 10 },
  filterGroupLabel: {
    fontSize: 8,
    fontWeight: "800",
    color: T_DIM,
    letterSpacing: 2,
    marginBottom: 6,
  },
  chipScroll: { paddingBottom: 6, paddingRight: 8 },

  dateRangePill: {
    marginTop: 4,
    marginBottom: 8,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: CARD_BD,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "rgba(255,255,255,0.025)",
  },
  dateRangeText: {
    fontSize: 13,
    color: T_HI,
    textAlign: "center",
  },
  calendarCard: {
    marginTop: 8,
    borderRadius: 4,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: CARD_BD,
    backgroundColor: BG,
  },

  modalInputRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
  },
  modalInputCol: { flex: 1 },
  filterInput: {
    borderWidth: 1,
    borderColor: CARD_BD,
    borderRadius: 2,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    backgroundColor: "rgba(255,255,255,0.025)",
    color: T_HI,
  },

  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
    marginTop: 10,
  },
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
    backgroundColor: CYAN,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 140,
  },
  modalBtnTxt: { fontSize: 9, fontWeight: "800", letterSpacing: 1 },
  modalPrimaryTxt: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1,
    color: BG,
  },
});
