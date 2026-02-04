// mobile/src/screens/ScanReceiptScreen.js
/* eslint-disable no-unused-vars */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Image,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import TextRecognition from "@react-native-ml-kit/text-recognition";
import api from "../lib/api";
import logo from "../../assets/nummoria_logo.png";

const main = "#22c55e";
const BG_DARK = "#020617";
const CARD_DARK = "#020819";
const BORDER_DARK = "#0f172a";
const TEXT_SOFT = "rgba(148,163,184,0.85)";
const TEXT_MUTED = "rgba(148,163,184,0.7)";
const TEXT_HEADING = "#e5e7eb";

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
  const n = Number(String(amountStr || "").replace(",", "."));
  if (Number.isNaN(n)) return NaN;
  return Math.round(n * Math.pow(10, decimals));
}
function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

/* ---------------------- Receipt parse (basic) ---------------------- */
function parseReceiptFromText(rawText) {
  if (!rawText) return null;

  const text = rawText.replace(/\s+/g, " ").toUpperCase();

  // TOTAL
  const totalRegex = /(GENEL TOPLAM|TOPLAM|TOTAL)[^\d]*([0-9]+[.,][0-9]{2})/;
  const totalMatch = text.match(totalRegex);

  let amount = null;
  if (totalMatch && totalMatch[2]) {
    amount = totalMatch[2].replace(",", ".");
  } else {
    const allMoney = [...text.matchAll(/([0-9]+[.,][0-9]{2})/g)];
    if (allMoney.length)
      amount = allMoney[allMoney.length - 1][1].replace(",", ".");
  }

  // Currency
  let currency = null;
  const curMatch = text.match(/\b(USD|EUR|TRY|TL|GBP)\b/);
  if (curMatch) currency = curMatch[1] === "TL" ? "TRY" : curMatch[1];

  // Date
  let dateStr = null;
  const iso = text.match(/(\d{4}[-/.]\d{2}[-/.]\d{2})/);
  const eu = text.match(/(\d{2}[-/.]\d{2}[-/.]\d{4})/);
  if (iso) {
    dateStr = iso[1].replace(/\./g, "-").replace(/\//g, "-");
  } else if (eu) {
    const [dd, mm, yyyy] = eu[1].split(/[./-]/);
    dateStr = `${yyyy}-${mm}-${dd}`;
  }

  // Description guess (header lines)
  let description = null;
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length) {
    const stopIdx = lines.findIndex((l) =>
      /TARİH|TARIH|DATE|FİŞ NO|FIS NO|RECEIPT|KASA|POS/i.test(l),
    );
    const headerLines =
      stopIdx > 0 ? lines.slice(0, stopIdx) : lines.slice(0, 2);
    description = headerLines.join(" ").trim();
  }

  if (!amount && !dateStr && !description) return null;

  return {
    amount: amount || null,
    currency: currency || null,
    date: dateStr || null,
    description: description || null,
  };
}

/* ----------------------------- UI Chip ----------------------------- */
function Chip({ label, selected, onPress }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.chip, selected && styles.chipSelected]}
      activeOpacity={0.85}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

export default function ScanReceiptScreen() {
  const navigation = useNavigation();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [accounts, setAccounts] = useState([]);
  const [categories, setCategories] = useState([]);

  const [receiptUri, setReceiptUri] = useState("");
  const [ocrText, setOcrText] = useState("");

  const [sheetOpen, setSheetOpen] = useState(false);
  const [confidence, setConfidence] = useState("High");
  const [posting, setPosting] = useState(false);

  // ✅ unified draft state (supports expense/income/investment)
  const [draft, setDraft] = useState({
    type: "expense", // "expense" | "income" | "investment"
    categoryId: "",
    accountId: "",
    currency: "USD",

    amount: "", // expense/income amount OR investment total cost
    date: todayISO(),
    nextDate: "",

    description: "", // replaces merchant/notes

    // ✅ investment-only fields
    assetSymbol: "",
    units: "",

    tagsText: "", // comma-separated
  });

  const defaultAccountId = accounts[0]?._id || "";
  const defaultCurrency = accounts[0]?.currency || "USD";

  const expenseCategories = useMemo(
    () => categories.filter((c) => c.kind === "expense" && !c.isDeleted),
    [categories],
  );

  const incomeCategories = useMemo(
    () => categories.filter((c) => c.kind === "income" && !c.isDeleted),
    [categories],
  );

  // If you don't have investment categories yet, you can either:
  // 1) Reuse expense categories, OR
  // 2) Filter c.kind === "investment" once you add it.
  const investmentCategories = useMemo(() => {
    const inv = categories.filter(
      (c) => c.kind === "investment" && !c.isDeleted,
    );
    if (inv.length) return inv;
    return expenseCategories; // fallback
  }, [categories, expenseCategories]);

  const categoriesForType = useMemo(() => {
    if (draft.type === "income") return incomeCategories;
    if (draft.type === "investment") return investmentCategories;
    return expenseCategories;
  }, [draft.type, expenseCategories, incomeCategories, investmentCategories]);

  /* ----------------------------- Load data ----------------------------- */
  const loadAll = useCallback(async () => {
    try {
      setLoading(true);
      setErr("");

      const [accRes, catRes] = await Promise.all([
        api.get("/accounts"),
        api.get("/categories"),
      ]);

      const accs = (accRes.data || []).filter((a) => !a.isDeleted);
      const cats = (catRes.data || []).filter((c) => !c.isDeleted);

      setAccounts(accs);
      setCategories(cats);

      const accId = accs[0]?._id || "";
      const cur = accs[0]?.currency || "USD";

      const firstExpenseCat =
        cats.find((c) => c.kind === "expense" && !c.isDeleted)?._id || "";

      setDraft((d) => ({
        ...d,
        accountId: d.accountId || accId,
        currency: d.currency || cur,
        categoryId: d.categoryId || firstExpenseCat,
      }));
    } catch (e) {
      setErr(e?.response?.data?.error || e.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  /* ----------------------------- Pick receipt ----------------------------- */
  const pickReceipt = useCallback(async () => {
    try {
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 1,
      });

      if (res.canceled) return;

      const uri = res.assets?.[0]?.uri;
      if (!uri) return;

      setReceiptUri(uri);
      setOcrText("");
      setConfidence("High");
      setSheetOpen(false);

      if (Platform.OS !== "ios") {
        const result = await TextRecognition.recognize(uri);
        const text = result?.text || "";
        setOcrText(text);

        const parsed = parseReceiptFromText(text);

        setDraft((d) => {
          const next = { ...d };

          if (parsed?.amount) next.amount = parsed.amount;
          if (parsed?.currency) next.currency = parsed.currency;
          if (parsed?.date) next.date = parsed.date;
          if (parsed?.description) next.description = parsed.description;

          if (!next.categoryId) {
            next.categoryId =
              categories.find((c) => c.kind === "expense" && !c.isDeleted)
                ?._id || "";
          }
          if (!next.accountId) next.accountId = defaultAccountId;

          return next;
        });

        const looksGood = !!(parsed?.amount && parsed?.date);
        setConfidence(looksGood ? "High" : "Medium");
      } else {
        setConfidence("Medium");
      }

      setSheetOpen(true);
    } catch (e) {
      Alert.alert("Error", e.message || "Failed to pick/scan receipt");
    }
  }, [categories, defaultAccountId]);

  /* ----------------------------- Save to DB ----------------------------- */
  const saveToDatabase = useCallback(async () => {
    const accId = draft.accountId || defaultAccountId;
    if (!accId) {
      Alert.alert("Missing account", "Create/select an account first.");
      return;
    }

    const cur = String(
      draft.currency || defaultCurrency || "USD",
    ).toUpperCase();

    // tags
    const tags = String(draft.tagsText || "")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    if (!draft.categoryId) {
      Alert.alert("Missing category", "Pick a category.");
      return;
    }

    // common dates
    const dateISO = new Date(draft.date || todayISO()).toISOString();
    const nextDateISO = draft.nextDate
      ? new Date(draft.nextDate).toISOString()
      : null;

    if (draft.type === "investment") {
      const totalCostMinor = majorToMinor(draft.amount, cur);
      if (Number.isNaN(totalCostMinor)) {
        Alert.alert("Invalid total cost", "Please enter a valid total cost.");
        return;
      }

      if (!String(draft.assetSymbol || "").trim()) {
        Alert.alert(
          "Missing symbol",
          "Enter an asset symbol (e.g. AAPL, BTC-USD, VOO).",
        );
        return;
      }

      const unitsNum = Number(String(draft.units || "").replace(",", "."));
      if (!draft.units || Number.isNaN(unitsNum)) {
        Alert.alert(
          "Invalid units",
          "Please enter a valid units amount (e.g. 2.5).",
        );
        return;
      }

      const payload = {
        accountId: accId,
        categoryId: draft.categoryId,
        totalCostMinor,
        currency: cur,
        assetSymbol: String(draft.assetSymbol).trim().toUpperCase(),
        units: unitsNum,
        date: dateISO,
        nextDate: nextDateISO,
        description: (draft.description || "").trim() || null,
        tags,
      };

      try {
        setPosting(true);
        await api.post("/investments", payload);

        setSheetOpen(false);
        setReceiptUri("");
        setOcrText("");
        Alert.alert("Saved", "Investment added to your database.");
      } catch (e) {
        Alert.alert(
          "Error",
          e?.response?.data?.error || e.message || "Save failed",
        );
      } finally {
        setPosting(false);
      }

      return;
    }

    // expense / income
    const amountMinor = majorToMinor(draft.amount, cur);
    if (Number.isNaN(amountMinor)) {
      Alert.alert("Invalid amount", "Please enter a valid amount.");
      return;
    }

    const payload = {
      accountId: accId,
      categoryId: draft.categoryId,
      type: draft.type, // "expense" | "income"
      amountMinor,
      currency: cur,
      date: dateISO,
      description: (draft.description || "").trim() || null,
      notes: null,
      tags: tags.length ? tags : ["receipt-scan"],
    };

    try {
      setPosting(true);
      await api.post("/transactions", payload);

      setSheetOpen(false);
      setReceiptUri("");
      setOcrText("");
      Alert.alert("Saved", "Transaction added to your database.");
    } catch (e) {
      Alert.alert(
        "Error",
        e?.response?.data?.error || e.message || "Save failed",
      );
    } finally {
      setPosting(false);
    }
  }, [draft, defaultAccountId, defaultCurrency]);

  /* ----------------------------- UI ----------------------------- */
  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={main} />
        <Text style={styles.loadingTitle}>Scan Receipt</Text>
        <Text style={styles.loadingSubtitle}>
          Loading accounts & categories…
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: 28 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerCard}>
          <TouchableOpacity
            onPress={() => navigation.navigate("Dashboard")}
            activeOpacity={0.85}
            style={styles.headerLogoBtn}
          >
            <Image source={logo} style={styles.headerLogoImg} />
          </TouchableOpacity>

          <Text style={styles.headerEyebrow}>Quick add</Text>
          <Text style={styles.headerTitle}>Scan Receipt</Text>
          <Text style={styles.headerSubtitle}>
            Pick a photo → we draft the record → you confirm.
          </Text>

          <View style={styles.privacyPill}>
            <Text style={styles.privacyText}>
              🔒 We won’t store receipt photos (process → delete).
            </Text>
          </View>
        </View>

        {err ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{err}</Text>
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Receipt</Text>

          {receiptUri ? (
            <View style={styles.receiptSelected}>
              <Text style={styles.receiptSelectedText}>
                ✅ Receipt image selected
              </Text>
              <Text style={styles.receiptSelectedSub} numberOfLines={1}>
                {receiptUri}
              </Text>

              <View style={{ marginTop: 10 }}>
                <Image
                  source={{ uri: receiptUri }}
                  style={styles.receiptPreview}
                />
              </View>
            </View>
          ) : (
            <Text style={styles.cardHint}>
              Choose a receipt photo to draft a record. (OCR is best on Android
              in your current setup.)
            </Text>
          )}

          <View style={{ marginTop: 12 }}>
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={pickReceipt}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryBtnText}>
                {receiptUri ? "Pick another receipt" : "Pick receipt photo"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Tips for better scans</Text>
          <Text style={styles.tip}>• Ensure “TOTAL” and date are visible.</Text>
          <Text style={styles.tip}>• Avoid glare; keep receipt flat.</Text>
          <Text style={styles.tip}>
            • If confidence is low, confirm key fields.
          </Text>
        </View>
      </ScrollView>

      {/* -------------------- Bottom sheet: Transaction detected -------------------- */}
      <Modal
        visible={sheetOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setSheetOpen(false)}
      >
        <View style={styles.sheetBackdrop}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Transaction detected</Text>

            <View style={styles.sheetRow}>
              <Text style={styles.sheetLabel}>Confidence</Text>
              <View style={styles.confPill}>
                <Text style={styles.confText}>{confidence}</Text>
              </View>
            </View>

            {/* Type */}
            <View style={{ marginTop: 10 }}>
              <Text style={styles.fieldLabel}>Type</Text>
              <View style={{ flexDirection: "row", gap: 8, marginTop: 6 }}>
                <Chip
                  label="Expense"
                  selected={draft.type === "expense"}
                  onPress={() =>
                    setDraft((d) => ({
                      ...d,
                      type: "expense",
                      categoryId:
                        categories.find(
                          (c) => c.kind === "expense" && !c.isDeleted,
                        )?._id || d.categoryId,
                    }))
                  }
                />
                <Chip
                  label="Income"
                  selected={draft.type === "income"}
                  onPress={() =>
                    setDraft((d) => ({
                      ...d,
                      type: "income",
                      categoryId:
                        categories.find(
                          (c) => c.kind === "income" && !c.isDeleted,
                        )?._id || d.categoryId,
                    }))
                  }
                />
                <Chip
                  label="Investment"
                  selected={draft.type === "investment"}
                  onPress={() =>
                    setDraft((d) => ({
                      ...d,
                      type: "investment",
                      categoryId:
                        categories.find(
                          (c) => c.kind === "investment" && !c.isDeleted,
                        )?._id ||
                        d.categoryId ||
                        categories.find(
                          (c) => c.kind === "expense" && !c.isDeleted,
                        )?._id ||
                        "",
                    }))
                  }
                />
              </View>
            </View>

            {/* Account */}
            <View style={{ marginTop: 12 }}>
              <Text style={styles.fieldLabel}>Account</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginTop: 6 }}
              >
                {accounts.map((a) => (
                  <Chip
                    key={a._id}
                    label={`${a.name}${a.currency ? ` · ${a.currency}` : ""}`}
                    selected={draft.accountId === a._id}
                    onPress={() =>
                      setDraft((d) => ({
                        ...d,
                        accountId: a._id,
                        currency: a.currency || d.currency,
                      }))
                    }
                  />
                ))}
              </ScrollView>
            </View>

            {/* Category */}
            <View style={{ marginTop: 12 }}>
              <Text style={styles.fieldLabel}>Category</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginTop: 6 }}
              >
                {categoriesForType.map((c) => (
                  <Chip
                    key={c._id}
                    label={c.name}
                    selected={draft.categoryId === c._id}
                    onPress={() =>
                      setDraft((d) => ({ ...d, categoryId: c._id }))
                    }
                  />
                ))}
              </ScrollView>
            </View>

            {/* Fields */}
            {draft.type === "investment" ? (
              <View style={styles.grid}>
                <View style={styles.gridCell}>
                  <Text style={styles.fieldLabel}>Total Cost</Text>
                  <TextInput
                    value={draft.amount}
                    onChangeText={(v) => setDraft((d) => ({ ...d, amount: v }))}
                    placeholder="e.g., 1500.00"
                    placeholderTextColor={TEXT_MUTED}
                    keyboardType="numeric"
                    style={styles.input}
                  />
                </View>

                <View style={styles.gridCell}>
                  <Text style={styles.fieldLabel}>Currency</Text>
                  <TextInput
                    value={draft.currency}
                    onChangeText={(v) =>
                      setDraft((d) => ({ ...d, currency: v.toUpperCase() }))
                    }
                    placeholder="USD"
                    placeholderTextColor={TEXT_MUTED}
                    autoCapitalize="characters"
                    style={styles.input}
                  />
                </View>

                {/* ✅ MISSING FIELDS FIXED */}
                <View style={styles.gridCell}>
                  <Text style={styles.fieldLabel}>Asset Symbol</Text>
                  <TextInput
                    value={draft.assetSymbol}
                    onChangeText={(v) =>
                      setDraft((d) => ({ ...d, assetSymbol: v }))
                    }
                    placeholder="AAPL, BTC-USD, VOO"
                    placeholderTextColor={TEXT_MUTED}
                    autoCapitalize="characters"
                    style={styles.input}
                  />
                </View>

                <View style={styles.gridCell}>
                  <Text style={styles.fieldLabel}>Units</Text>
                  <TextInput
                    value={draft.units}
                    onChangeText={(v) => setDraft((d) => ({ ...d, units: v }))}
                    placeholder="e.g., 2.5"
                    placeholderTextColor={TEXT_MUTED}
                    keyboardType="numeric"
                    style={styles.input}
                  />
                </View>

                <View style={{ width: "100%" }}>
                  <Text style={styles.fieldLabel}>Date</Text>
                  <TextInput
                    value={draft.date}
                    onChangeText={(v) => setDraft((d) => ({ ...d, date: v }))}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={TEXT_MUTED}
                    style={styles.input}
                  />
                </View>

                <View style={{ width: "100%" }}>
                  <Text style={styles.fieldLabel}>Next date (optional)</Text>
                  <TextInput
                    value={draft.nextDate}
                    onChangeText={(v) =>
                      setDraft((d) => ({ ...d, nextDate: v }))
                    }
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={TEXT_MUTED}
                    style={styles.input}
                  />
                </View>

                <View style={{ width: "100%" }}>
                  <Text style={styles.fieldLabel}>Description</Text>
                  <TextInput
                    value={draft.description}
                    onChangeText={(v) =>
                      setDraft((d) => ({ ...d, description: v }))
                    }
                    placeholder="Optional memo"
                    placeholderTextColor={TEXT_MUTED}
                    style={styles.input}
                  />
                </View>

                <View style={{ width: "100%" }}>
                  <Text style={styles.fieldLabel}>Tags (comma-separated)</Text>
                  <TextInput
                    value={draft.tagsText}
                    onChangeText={(v) =>
                      setDraft((d) => ({ ...d, tagsText: v }))
                    }
                    placeholder="long-term, dividend"
                    placeholderTextColor={TEXT_MUTED}
                    style={styles.input}
                  />
                </View>
              </View>
            ) : (
              <View style={styles.grid}>
                <View style={styles.gridCell}>
                  <Text style={styles.fieldLabel}>Description</Text>
                  <TextInput
                    value={draft.description}
                    onChangeText={(v) =>
                      setDraft((d) => ({ ...d, description: v }))
                    }
                    placeholder="Optional description"
                    placeholderTextColor={TEXT_MUTED}
                    style={styles.input}
                  />
                </View>

                <View style={styles.gridCell}>
                  <Text style={styles.fieldLabel}>Amount</Text>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <TextInput
                      value={draft.amount}
                      onChangeText={(v) =>
                        setDraft((d) => ({ ...d, amount: v }))
                      }
                      placeholder="0.00"
                      placeholderTextColor={TEXT_MUTED}
                      keyboardType="numeric"
                      style={[styles.input, { flex: 1 }]}
                    />
                    <TextInput
                      value={draft.currency}
                      onChangeText={(v) =>
                        setDraft((d) => ({ ...d, currency: v.toUpperCase() }))
                      }
                      placeholder="USD"
                      placeholderTextColor={TEXT_MUTED}
                      autoCapitalize="characters"
                      style={[styles.input, { width: 90 }]}
                    />
                  </View>
                </View>

                <View style={styles.gridCell}>
                  <Text style={styles.fieldLabel}>Date</Text>
                  <TextInput
                    value={draft.date}
                    onChangeText={(v) => setDraft((d) => ({ ...d, date: v }))}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={TEXT_MUTED}
                    style={styles.input}
                  />
                </View>

                <View style={styles.gridCell}>
                  <Text style={styles.fieldLabel}>Preview</Text>
                  <Text style={styles.previewText}>
                    {draft.type === "expense" ? "-" : "+"}
                    {draft.amount || "0.00"} {draft.currency || "USD"}
                  </Text>
                  <Text style={styles.previewSub}>
                    {draft.categoryId
                      ? categories.find((c) => c._id === draft.categoryId)
                          ?.name || "—"
                      : "Pick category"}
                  </Text>
                </View>

                <View style={{ width: "100%" }}>
                  <Text style={styles.fieldLabel}>Tags (comma-separated)</Text>
                  <TextInput
                    value={draft.tagsText}
                    onChangeText={(v) =>
                      setDraft((d) => ({ ...d, tagsText: v }))
                    }
                    placeholder="groceries, rent"
                    placeholderTextColor={TEXT_MUTED}
                    style={styles.input}
                  />
                </View>
              </View>
            )}

            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={[styles.btn, styles.btnDanger]}
                onPress={() => {
                  setSheetOpen(false);
                  setReceiptUri("");
                  setOcrText("");
                }}
                activeOpacity={0.85}
                disabled={posting}
              >
                <Text style={styles.btnDangerText}>Discard</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.btn, styles.btnGhost]}
                onPress={() =>
                  Alert.alert(
                    "Edit",
                    "You can edit fields directly in this sheet.",
                  )
                }
                activeOpacity={0.85}
                disabled={posting}
              >
                <Text style={styles.btnGhostText}>Edit</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.btn,
                  styles.btnPrimary,
                  posting && { opacity: 0.75 },
                ]}
                onPress={saveToDatabase}
                activeOpacity={0.85}
                disabled={posting}
              >
                <Text style={styles.btnPrimaryText}>
                  {posting ? "Adding…" : "Add"}
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.sheetFootnote}>
              Later we’ll ensure receipt images are not stored, only the
              finalized record you approve.
            </Text>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

/* =============================== Styles =============================== */
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG_DARK },
  content: { flex: 1 },

  loadingContainer: {
    flex: 1,
    backgroundColor: BG_DARK,
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
  },
  loadingTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: TEXT_HEADING,
    marginTop: 8,
  },
  loadingSubtitle: { fontSize: 12, color: TEXT_MUTED },

  headerCard: {
    marginTop: 12,
    marginHorizontal: 16,
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: BORDER_DARK,
    backgroundColor: CARD_DARK,
  },
  headerLogoBtn: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 44,
    height: 44,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(2, 8, 25, 0.6)",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.22)",
  },
  headerLogoImg: {
    width: 28,
    height: 28,
    resizeMode: "contain",
    opacity: 0.95,
  },

  headerEyebrow: { fontSize: 12, color: TEXT_MUTED },
  headerTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: TEXT_HEADING,
    marginTop: 6,
  },
  headerSubtitle: { fontSize: 13, color: TEXT_SOFT, marginTop: 6 },

  privacyPill: {
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(34,197,94,0.45)",
    backgroundColor: "rgba(2,44,34,0.35)",
  },
  privacyText: { color: "#bbf7d0", fontSize: 13, fontWeight: "700" },

  card: {
    marginTop: 12,
    marginHorizontal: 16,
    padding: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: BORDER_DARK,
    backgroundColor: CARD_DARK,
  },
  cardTitle: { fontSize: 16, fontWeight: "800", color: TEXT_HEADING },
  cardHint: { marginTop: 8, fontSize: 12, color: TEXT_MUTED, lineHeight: 18 },

  receiptSelected: {
    marginTop: 10,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(34,197,94,0.35)",
    backgroundColor: "rgba(2,44,34,0.22)",
  },
  receiptSelectedText: { fontSize: 14, fontWeight: "800", color: "#bbf7d0" },
  receiptSelectedSub: { marginTop: 6, fontSize: 11, color: TEXT_MUTED },

  receiptPreview: {
    width: "100%",
    height: 180,
    borderRadius: 14,
    backgroundColor: "#020617",
  },

  primaryBtn: {
    height: 46,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: main,
  },
  primaryBtnText: { color: "#022c22", fontWeight: "900", fontSize: 14 },

  tip: { marginTop: 8, color: TEXT_MUTED, fontSize: 12, lineHeight: 18 },

  errorBox: {
    marginHorizontal: 16,
    marginTop: 12,
    padding: 10,
    borderRadius: 12,
    backgroundColor: "rgba(127,29,29,0.2)",
    borderWidth: 1,
    borderColor: "#7f1d1d",
  },
  errorText: { fontSize: 13, color: "#fecaca" },

  sheetBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.82)",
    justifyContent: "flex-end",
  },
  sheet: {
    padding: 16,
    paddingTop: 18,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    backgroundColor: BG_DARK,
    borderWidth: 1,
    borderColor: BORDER_DARK,
  },
  sheetTitle: { fontSize: 22, fontWeight: "900", color: TEXT_HEADING },
  sheetRow: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sheetLabel: { fontSize: 12, color: TEXT_MUTED, fontWeight: "700" },
  confPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(34,197,94,0.55)",
    backgroundColor: "rgba(2,44,34,0.25)",
  },
  confText: { color: "#bbf7d0", fontWeight: "900" },

  fieldLabel: { fontSize: 12, color: TEXT_SOFT, fontWeight: "800" },
  input: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: BORDER_DARK,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#020617",
    color: TEXT_HEADING,
    fontSize: 14,
  },

  grid: {
    marginTop: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  gridCell: {
    width: "48%",
  },

  previewText: {
    marginTop: 8,
    fontSize: 18,
    fontWeight: "900",
    color: "#bbf7d0",
  },
  previewSub: { marginTop: 2, fontSize: 12, color: TEXT_MUTED },

  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BORDER_DARK,
    backgroundColor: "#020617",
    marginRight: 8,
    marginBottom: 6,
  },
  chipSelected: { borderColor: main, backgroundColor: "#022c22" },
  chipText: { color: TEXT_SOFT, fontWeight: "700", fontSize: 12 },
  chipTextSelected: { color: "#bbf7d0" },

  actionsRow: {
    marginTop: 16,
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between",
    alignItems: "center",
  },
  btn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  btnDanger: {
    borderColor: "#7f1d1d",
    backgroundColor: "rgba(127,29,29,0.15)",
  },
  btnDangerText: { color: "#fecaca", fontWeight: "900", fontSize: 14 },

  btnGhost: {
    borderColor: BORDER_DARK,
    backgroundColor: "#020617",
  },
  btnGhostText: { color: TEXT_SOFT, fontWeight: "900", fontSize: 14 },

  btnPrimary: {
    borderColor: main,
    backgroundColor: main,
  },
  btnPrimaryText: { color: "#022c22", fontWeight: "900", fontSize: 15 },

  sheetFootnote: {
    marginTop: 10,
    fontSize: 11,
    color: TEXT_MUTED,
    lineHeight: 16,
  },
});
