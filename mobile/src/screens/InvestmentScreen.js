/* eslint-disable no-unused-vars */
/* eslint-disable no-empty */
// mobile/src/screens/InvestmentScreen.js
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Image,
  KeyboardAvoidingView, // ✅ NEW: for Auto modal
  Platform, // ✅ NEW: for Auto modal
} from "react-native";
import api from "../lib/api";
import logo from "../../assets/nummoria_logo.png";
import AsyncStorage from "@react-native-async-storage/async-storage";

const main = "#4f772d";
const secondary = "#90a955";
const BG_DARK = "#050816";
const CARD_BG = "#111827";
const BORDER_DARK = "#1f2937";
const TEXT_MUTED = "#9ca3af";
const TEXT_SOFT = "#e5e7eb";
const CHIP_BG = "#111827";
const CHIP_BORDER = "#374151";
const BADGE_BG = "#0f172a";
const BADGE_BORDER = "#1f2937";

const DATE_LANG = "en-US";

// ✅ Favorites persistence
const FAVORITES_KEY = "@nummoria:favoritesSymbols";
const FAV_YELLOW = "#fbbf24";

/* ----------------------------- Money helpers -------------------------------- */
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
  return (Number(minor || 0) / Math.pow(10, decimals)).toFixed(decimals);
}
function fmtMoney(minor, cur = "USD") {
  return new Intl.NumberFormat(DATE_LANG, {
    style: "currency",
    currency: cur || "USD",
  }).format(
    Number(minor || 0) / Math.pow(10, decimalsForCurrency(cur || "USD")) || 0
  );
}

/* ----------------------------- Date helpers -------------------------------- */
function fmtDate(dateLike) {
  const d = new Date(dateLike);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString(DATE_LANG, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

/* ---------------------------- Tiny Toast System ---------------------------- */
function useToasts() {
  const [toasts, setToasts] = useState([]);
  const push = useCallback((t) => {
    const id = Math.random().toString(36).slice(2);
    const toast = { id, type: t.type || "info", msg: t.msg || String(t) };
    setToasts((prev) => [...prev, toast]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((x) => x.id !== id));
    }, 3500);
  }, []);
  const remove = useCallback((id) => {
    setToasts((prev) => prev.filter((x) => x.id !== id));
  }, []);
  return { toasts, push, remove };
}

function Toasts({ toasts, onClose }) {
  const color = (type) => {
    switch (type) {
      case "success":
        return { borderColor: "#6ee7b7", backgroundColor: "#022c22" };
      case "error":
        return { borderColor: "#fecaca", backgroundColor: "#450a0a" };
      case "warning":
        return { borderColor: "#facc15", backgroundColor: "#422006" };
      default:
        return { borderColor: "#4b5563", backgroundColor: "#020617" };
    }
  };
  if (!toasts.length) return null;
  return (
    <View style={styles.toastContainer}>
      {toasts.map((t) => {
        const c = color(t.type);
        return (
          <View
            key={t.id}
            style={[
              styles.toast,
              {
                borderColor: c.borderColor,
                backgroundColor: c.backgroundColor,
              },
            ]}
          >
            <Text style={styles.toastType}>{t.type}</Text>
            <Text style={styles.toastMsg}>{t.msg}</Text>
            <TouchableOpacity onPress={() => onClose(t.id)}>
              <Text style={styles.toastClose}>×</Text>
            </TouchableOpacity>
          </View>
        );
      })}
    </View>
  );
}

/* -------------------------- Promise-based Confirm -------------------------- */
function useConfirm() {
  const [state, setState] = useState({
    open: false,
    message: "",
    resolve: null,
  });

  const ask = useCallback((message) => {
    return new Promise((resolve) => {
      setState({ open: true, message, resolve });
    });
  }, []);

  const onCancel = () => {
    state.resolve?.(false);
    setState((s) => ({ ...s, open: false, resolve: null }));
  };
  const onOk = () => {
    state.resolve?.(true);
    setState((s) => ({ ...s, open: false, resolve: null }));
  };

  const Dialog = () =>
    !state.open ? null : (
      <View style={styles.confirmBackdrop}>
        <View style={styles.confirmCard}>
          <Text style={styles.confirmTitle}>Please confirm</Text>
          <Text style={styles.confirmText}>{state.message}</Text>
          <View style={styles.confirmRow}>
            <TouchableOpacity onPress={onCancel} style={styles.confirmBtn}>
              <Text style={styles.confirmBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onOk}
              style={[styles.confirmBtn, { backgroundColor: main }]}
            >
              <Text style={[styles.confirmBtnText, { color: "white" }]}>
                Confirm
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );

  return { ask, ConfirmDialog: Dialog };
}

/* --------------------------------- Chip ----------------------------------- */
function Chip({ label, selected, onPress }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        styles.chip,
        selected && { backgroundColor: main, borderColor: secondary },
      ]}
      activeOpacity={0.85}
    >
      <Text style={[styles.chipText, selected && { color: "white" }]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

/* --------------------------------- Row ------------------------------------ */
function InvestmentRow({
  item,
  onEdit,
  onDelete,
  categoryName,
  accountName,
  canFavorite,
  isFavorite,
  onToggleFavorite,
}) {
  const symbol = (item.assetSymbol || "").toUpperCase();
  const units = item.units ?? null;
  const dateLabel = fmtDate(item.date);

  return (
    <View style={styles.rowContainer}>
      <View style={styles.rowLeft}>
        <View style={styles.rowTitleRow}>
          <Text style={styles.rowTitle}>
            {symbol ? `${symbol} • ${categoryName}` : categoryName}
          </Text>

          {canFavorite && symbol ? (
            <TouchableOpacity
              onPress={() => onToggleFavorite(symbol)}
              activeOpacity={0.8}
              style={styles.starBtn}
            >
              <Text
                style={[
                  styles.starIcon,
                  isFavorite && {
                    color: FAV_YELLOW,
                    textShadowColor: "rgba(0,0,0,0.35)",
                  },
                ]}
              >
                {isFavorite ? "★" : "☆"}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={styles.rowSubRow}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{accountName}</Text>
          </View>
          {units ? <Text style={styles.rowUnits}>{units} units</Text> : null}
        </View>

        <Text style={styles.rowDescription}>
          {item.description || "No description"}
        </Text>

        <View style={styles.rowBottomRow}>
          <Text style={styles.rowDate}>{dateLabel}</Text>
          {item.tags?.length ? (
            <Text style={styles.rowTags}>#{item.tags.join("  #")}</Text>
          ) : null}
        </View>
      </View>

      <View style={styles.rowRight}>
        <Text style={styles.rowAmount}>
          -{minorToMajor(item.amountMinor, item.currency)} {item.currency}
        </Text>
        <View style={styles.rowActions}>
          <TouchableOpacity
            onPress={() => onEdit(item)}
            style={styles.rowBtnOutline}
          >
            <Text style={styles.rowBtnOutlineText}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => onDelete(item)}
            style={styles.rowBtnDanger}
          >
            <Text style={styles.rowBtnDangerText}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

/* --------------------------------- Modal ---------------------------------- */
function InvestmentModal({
  visible,
  onClose,
  onSaved,
  editing,
  accounts,
  categories,
  defaultAccountId,
  pushToast,
}) {
  const isEditing = !!editing;

  const formDefaults = useMemo(() => {
    if (!editing) {
      const acc = accounts.find((a) => a._id === defaultAccountId);
      return {
        accountId: defaultAccountId,
        currency: acc?.currency || "USD",
        amount: "",
        date: new Date().toISOString().slice(0, 10),
        nextDate: "",
        categoryId: categories[0]?._id || "",
        assetSymbol: "",
        units: "",
        description: "",
        tagsCsv: "",
      };
    }
    return {
      accountId: editing.accountId || defaultAccountId,
      currency: editing.currency || "USD",
      amount: minorToMajor(editing.amountMinor, editing.currency),
      date: new Date(editing.date).toISOString().slice(0, 10),
      nextDate: editing.nextDate
        ? new Date(editing.nextDate).toISOString().slice(0, 10)
        : "",
      categoryId: editing.categoryId || categories[0]?._id || "",
      assetSymbol: (editing.assetSymbol || "").toUpperCase(),
      units: editing.units != null ? String(editing.units) : "",
      description: editing.description || "",
      tagsCsv: (editing.tags || []).join(", "),
    };
  }, [editing, accounts, categories, defaultAccountId]);

  const [accountId, setAccountId] = useState(formDefaults.accountId);
  const [currency, setCurrency] = useState(formDefaults.currency);
  const [amount, setAmount] = useState(formDefaults.amount);
  const [date, setDate] = useState(formDefaults.date);
  const [nextDate, setNextDate] = useState(formDefaults.nextDate);
  const [categoryId, setCategoryId] = useState(formDefaults.categoryId);
  const [assetSymbol, setAssetSymbol] = useState(formDefaults.assetSymbol);
  const [units, setUnits] = useState(formDefaults.units);
  const [description, setDescription] = useState(formDefaults.description);
  const [tagsCsv, setTagsCsv] = useState(formDefaults.tagsCsv);

  useEffect(() => {
    setAccountId(formDefaults.accountId);
    setCurrency(formDefaults.currency);
    setAmount(formDefaults.amount);
    setDate(formDefaults.date);
    setNextDate(formDefaults.nextDate);
    setCategoryId(formDefaults.categoryId);
    setAssetSymbol(formDefaults.assetSymbol);
    setUnits(formDefaults.units);
    setDescription(formDefaults.description);
    setTagsCsv(formDefaults.tagsCsv);
  }, [formDefaults]);

  const handleSubmit = async () => {
    const amountMinor = majorToMinor(amount, currency.toUpperCase());
    if (Number.isNaN(amountMinor)) {
      pushToast({ type: "warning", msg: "Invalid amount." });
      return;
    }
    if (!categoryId) {
      pushToast({ type: "warning", msg: "Pick a category." });
      return;
    }
    if (!accountId) {
      pushToast({ type: "warning", msg: "Pick an account." });
      return;
    }

    const rawSymbol = (assetSymbol || "").toUpperCase().trim();
    const rawUnitsStr = (units || "").trim();
    const rawUnits = rawUnitsStr === "" ? NaN : Number(rawUnitsStr);
    const desc = (description || "").trim();
    const category = categories.find((c) => c._id === categoryId);

    const isStockOrCrypto =
      !!category &&
      (category.name === "Stock Market" ||
        category.name === "Crypto Currency Exchange");

    if (isStockOrCrypto) {
      if (!rawSymbol) {
        pushToast({
          type: "warning",
          msg: "Asset symbol is required for this category.",
        });
        return;
      }
      if (!(Number.isFinite(rawUnits) && rawUnits > 0)) {
        pushToast({
          type: "warning",
          msg: "Units must be a positive number for this category.",
        });
        return;
      }
    }

    const payload = {
      accountId,
      categoryId,
      type: "investment",
      amountMinor,
      currency: currency.toUpperCase(),
      date: new Date(date).toISOString(),
      description: desc || null,
      tags: (tagsCsv || "")
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length > 0),
    };

    if (isStockOrCrypto || rawSymbol) payload.assetSymbol = rawSymbol;
    if (isStockOrCrypto || (Number.isFinite(rawUnits) && rawUnits > 0))
      payload.units = Number(rawUnits);
    if (nextDate) payload.nextDate = new Date(nextDate).toISOString();

    try {
      let saved;
      if (isEditing) {
        const { data } = await api.put(`/transactions/${editing._id}`, payload);
        saved = data;
      } else {
        const { data } = await api.post("/transactions", payload);
        saved = Array.isArray(data?.created) ? data.created[0] : data;
      }
      pushToast({
        type: "success",
        msg: isEditing ? "Investment updated." : "Investment added.",
      });
      onSaved(saved);
      onClose();
    } catch (e) {
      pushToast({
        type: "error",
        msg: e?.response?.data?.error || e.message || "Error saving.",
      });
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>
            {isEditing ? "Edit Investment" : "New Investment"}
          </Text>

          {/* Account */}
          <View style={styles.modalField}>
            <Text style={styles.modalLabel}>Account</Text>
            {accounts.length === 0 ? (
              <View style={styles.modalSelect}>
                <Text style={styles.modalSelectHint}>
                  No active accounts found. Add one from web.
                </Text>
              </View>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filterChipRow}
              >
                {accounts.map((a) => (
                  <Chip
                    key={a._id}
                    label={`${a.name} · ${a.currency}`}
                    selected={accountId === a._id}
                    onPress={() => {
                      setAccountId(a._id);
                      if (!editing) setCurrency(a.currency || "USD");
                    }}
                  />
                ))}
              </ScrollView>
            )}
          </View>

          {/* Total Cost + Currency */}
          <View style={styles.modalRow}>
            <View style={[styles.modalField, { flex: 1 }]}>
              <Text style={styles.modalLabel}>Total Cost</Text>
              <TextInput
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
                placeholder="e.g., 1500.00"
                placeholderTextColor={TEXT_MUTED}
                style={styles.modalInput}
              />
            </View>
            <View style={[styles.modalField, { width: 90 }]}>
              <Text style={styles.modalLabel}>Currency</Text>
              <TextInput
                value={currency}
                editable={false}
                maxLength={3}
                style={[styles.modalInput, { opacity: 0.8 }]}
              />
            </View>
          </View>

          {/* Symbol + Units */}
          <View style={styles.modalRow}>
            <View style={[styles.modalField, { flex: 1 }]}>
              <Text style={styles.modalLabel}>Asset Symbol</Text>
              <TextInput
                value={assetSymbol}
                onChangeText={(txt) => setAssetSymbol(txt.toUpperCase())}
                placeholder="AAPL, BTC-USD, VOO"
                placeholderTextColor={TEXT_MUTED}
                autoCapitalize="characters"
                style={styles.modalInput}
              />
            </View>
            <View style={[styles.modalField, { width: 110 }]}>
              <Text style={styles.modalLabel}>Units</Text>
              <TextInput
                value={units}
                onChangeText={setUnits}
                keyboardType="decimal-pad"
                placeholder="e.g., 2.5"
                placeholderTextColor={TEXT_MUTED}
                style={styles.modalInput}
              />
            </View>
          </View>

          {/* Dates */}
          <View style={styles.modalField}>
            <Text style={styles.modalLabel}>Date</Text>
            <TextInput
              value={date}
              onChangeText={setDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={TEXT_MUTED}
              style={styles.modalInput}
            />
          </View>

          <View style={styles.modalField}>
            <Text style={styles.modalLabel}>Next date (optional)</Text>
            <TextInput
              value={nextDate}
              onChangeText={setNextDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={TEXT_MUTED}
              style={styles.modalInput}
            />
            <Text style={styles.modalHelp}>
              If set, this shows up as a planned upcoming investment.
            </Text>
          </View>

          {/* Category */}
          <View style={styles.modalField}>
            <Text style={styles.modalLabel}>Category</Text>
            {categories.length === 0 ? (
              <View style={styles.modalSelect}>
                <Text style={styles.modalSelectHint}>
                  No investment categories found. Add on web.
                </Text>
              </View>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filterChipRow}
              >
                {categories.map((c) => (
                  <Chip
                    key={c._id}
                    label={c.name}
                    selected={categoryId === c._id}
                    onPress={() => setCategoryId(c._id)}
                  />
                ))}
              </ScrollView>
            )}
          </View>

          {/* Description */}
          <View style={styles.modalField}>
            <Text style={styles.modalLabel}>Description</Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Optional memo"
              placeholderTextColor={TEXT_MUTED}
              style={styles.modalInput}
            />
          </View>

          {/* Tags */}
          <View style={styles.modalField}>
            <Text style={styles.modalLabel}>Tags (comma-separated)</Text>
            <TextInput
              value={tagsCsv}
              onChangeText={setTagsCsv}
              placeholder="long-term, dividend"
              placeholderTextColor={TEXT_MUTED}
              style={styles.modalInput}
            />
          </View>

          <View style={styles.modalActions}>
            <TouchableOpacity onPress={onClose} style={styles.modalBtnGhost}>
              <Text style={styles.modalBtnGhostText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSubmit}
              style={styles.modalBtnPrimary}
            >
              <Text style={styles.modalBtnPrimaryText}>
                {isEditing ? "Save" : "Add"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

/* ---------------------------------- Screen ---------------------------------- */
export default function InvestmentScreen({ navigation }) {
  const { toasts, push, remove } = useToasts();
  const { ask, ConfirmDialog } = useConfirm();

  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [favoriteSymbols, setFavoriteSymbols] = useState(new Set());

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // filters
  const [q, setQ] = useState("");
  const [fAccountId, setFAccountId] = useState("ALL");
  const [fCategoryId, setFCategoryId] = useState("ALL");
  const [fCurrency, setFCurrency] = useState("ALL");
  const [fMin, setFMin] = useState("");
  const [fMax, setFMax] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  // ✅ AUTO ADD state
  const [autoOpen, setAutoOpen] = useState(false);
  const [autoText, setAutoText] = useState("");
  const [autoAccountId, setAutoAccountId] = useState("");
  const [autoLoading, setAutoLoading] = useState(false);

  const defaultAccountId = accounts[0]?._id || "";

  const currencies = useMemo(() => {
    const s = new Set(
      transactions
        .filter((t) => t.type === "investment")
        .map((t) => t.currency || "USD")
    );
    return ["ALL", ...Array.from(s)];
  }, [transactions]);

  const categoriesFiltered = useMemo(
    () => categories.filter((c) => c.kind === "investment" && !c.isDeleted),
    [categories]
  );

  const categoriesById = useMemo(() => {
    const m = new Map();
    for (const c of categoriesFiltered) m.set(c._id, c);
    return m;
  }, [categoriesFiltered]);

  const accountsById = useMemo(() => {
    const m = new Map();
    for (const a of accounts) m.set(a._id, a);
    return m;
  }, [accounts]);

  const isStockOrCryptoCategoryName = (name) =>
    name === "Stock Market" || name === "Crypto Currency Exchange";

  const loadAll = useCallback(async () => {
    try {
      setLoading(true);
      setErr("");
      const [txRes, catRes, accRes] = await Promise.all([
        api.get("/transactions", { params: { type: "investment" } }),
        api.get("/categories"),
        api.get("/accounts"),
      ]);
      setTransactions(txRes.data || []);
      setCategories(catRes.data || []);
      setAccounts((accRes.data || []).filter((a) => !a.isDeleted));
    } catch (e) {
      const msg = e?.response?.data?.error || e.message || "Failed to load.";
      setErr(msg);
      push({ type: "error", msg });
    } finally {
      setLoading(false);
    }
  }, [push]);

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
              .trim()
          )
          .filter(Boolean);
        setFavoriteSymbols(new Set(cleaned));
      } catch {
        setFavoriteSymbols(new Set());
      }
    })();
  }, []);

  const toggleFavorite = useCallback(
    async (symbol) => {
      const s = String(symbol || "")
        .toUpperCase()
        .trim();
      if (!s) return;

      setFavoriteSymbols((prev) => {
        const next = new Set(prev);
        if (next.has(s)) {
          next.delete(s);
          push({ type: "info", msg: `Removed ${s} from favorites.` });
        } else {
          next.add(s);
          push({ type: "success", msg: `Added ${s} to favorites.` });
        }

        AsyncStorage.setItem(
          FAVORITES_KEY,
          JSON.stringify(Array.from(next))
        ).catch(() => {});

        return next;
      });
    },
    [push]
  );

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const minNum = fMin !== "" ? Number(fMin) : null;
    const maxNum = fMax !== "" ? Number(fMax) : null;

    const filtered = transactions.filter((t) => {
      if ((t.type || "") !== "investment") return false;
      if (fAccountId !== "ALL" && String(t.accountId) !== String(fAccountId))
        return false;
      if (fCategoryId !== "ALL" && String(t.categoryId) !== String(fCategoryId))
        return false;

      const cur = t.currency || "USD";
      if (fCurrency !== "ALL" && cur !== fCurrency) return false;

      const major =
        Number(t.amountMinor || 0) / Math.pow(10, decimalsForCurrency(cur));
      if (minNum !== null && major < minNum) return false;
      if (maxNum !== null && major > maxNum) return false;

      if (needle) {
        const cat = categoriesById.get(t.categoryId)?.name || "";
        const acc = accountsById.get(t.accountId)?.name || "";
        const hay = `${t.description || ""} ${t.notes || ""} ${cat} ${acc} ${
          (t.tags || []).join(" ") || ""
        } ${(t.assetSymbol || "").toUpperCase()}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }

      return true;
    });

    filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
    return filtered;
  }, [
    transactions,
    q,
    fAccountId,
    fCategoryId,
    fCurrency,
    fMin,
    fMax,
    categoriesById,
    accountsById,
  ]);

  const totalsByCurrency = useMemo(() => {
    const m = {};
    for (const t of rows) {
      const cur = t.currency || "USD";
      m[cur] = (m[cur] || 0) + Number(t.amountMinor || 0);
    }
    return Object.entries(m).map(([cur, minor]) => ({ cur, minor }));
  }, [rows]);

  const openCreate = () => {
    setEditing(null);
    setModalOpen(true);
  };

  const openEdit = (tx) => {
    setEditing(tx);
    setModalOpen(true);
  };

  const handleSaved = async () => {
    await loadAll();
  };

  const handleDelete = async (tx) => {
    const ok = await ask("Delete this investment?");
    if (!ok) return;
    try {
      await api.delete(`/transactions/${tx._id}`);
      push({ type: "success", msg: "Investment deleted." });
      await loadAll();
    } catch (e) {
      push({
        type: "error",
        msg: e?.response?.data?.error || e.message || "Delete failed.",
      });
    }
  };

  // ✅ AUTO ADD submit
  const submitAuto = async () => {
    const text = String(autoText || "").trim();
    const accId = autoAccountId || defaultAccountId;

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

      const { data } = await api.post("/auto/transactions/text", {
        accountId: accId,
        text,
      });

      push({
        type: "success",
        msg: data?.created ? "Auto added." : "Parsed. Draft may be created.",
      });

      setAutoOpen(false);
      setAutoText("");
      setAutoAccountId("");
      await loadAll();
    } catch (e) {
      const msg = e?.response?.data?.error || e.message || "Auto add failed.";
      push({ type: "error", msg });
      Alert.alert("Auto add failed", msg);
    } finally {
      setAutoLoading(false);
    }
  };

  const openAuto = () => {
    setAutoAccountId(defaultAccountId || "");
    setAutoText("");
    setAutoOpen(true);
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.screen, { justifyContent: "center" }]}>
        <View style={styles.loadingBox} />
        <View style={styles.loadingBrand}>
          <View style={styles.loadingLogoWrap}>
            <View style={styles.loadingLogoBorder}>
              <View style={styles.loadingLogoInner}>
                <Text style={styles.loadingLogoText}>N</Text>
              </View>
            </View>
          </View>
          <Text style={styles.loadingTitle}>Nummoria</Text>
        </View>
        <Text style={styles.loadingSubtitle}>Loading your investments...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* HEADER */}
        <View style={styles.header}>
          <View style={{ flex: 1, paddingRight: 10 }}>
            <Text style={styles.headerTitle}>Investments</Text>
            <Text style={styles.headerSubtitle}>
              Track your buys and long-term moves.
            </Text>
          </View>

          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <TouchableOpacity
              onPress={() => navigation.navigate("Dashboard")}
              activeOpacity={0.85}
              style={styles.headerLogoBtn}
            >
              <Image source={logo} style={styles.headerLogoImg} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() =>
                navigation.navigate("InvestmentPerformance", {
                  favorites: Array.from(favoriteSymbols),
                })
              }
              style={[styles.headerRefreshBtn, { marginRight: 8 }]}
            >
              <Text
                style={[
                  styles.headerRefreshText,
                  { color: secondary, fontWeight: "600" },
                ]}
              >
                View market
              </Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={loadAll} style={styles.headerRefreshBtn}>
              <Text style={styles.headerRefreshText}>Refresh</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* TOTALS */}
        <View style={styles.totalsRow}>
          {totalsByCurrency.map(({ cur, minor }) => (
            <View key={cur} style={styles.totalCard}>
              <Text style={styles.totalLabel}>Total {cur}</Text>
              <Text style={styles.totalValue}>{fmtMoney(minor, cur)}</Text>
            </View>
          ))}
        </View>

        {/* SEARCH */}
        <View style={styles.searchRow}>
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Search symbol, description, tags, account, category"
            placeholderTextColor={TEXT_MUTED}
            style={styles.searchInput}
          />
        </View>

        {/* CATEGORY CHIPS */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
        >
          <Chip
            label="All categories"
            selected={fCategoryId === "ALL"}
            onPress={() => setFCategoryId("ALL")}
          />
          {categoriesFiltered.map((c) => (
            <Chip
              key={c._id}
              label={c.name}
              selected={fCategoryId === c._id}
              onPress={() => setFCategoryId(c._id)}
            />
          ))}
        </ScrollView>

        {/* FILTERS */}
        <View style={styles.filtersCard}>
          {/* Account */}
          <View style={styles.filterField}>
            <Text style={styles.filterLabel}>Account</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterChipRow}
            >
              <Chip
                label="All"
                selected={fAccountId === "ALL"}
                onPress={() => setFAccountId("ALL")}
              />
              {accounts.map((a) => (
                <Chip
                  key={a._id}
                  label={`${a.name} · ${a.currency}`}
                  selected={fAccountId === a._id}
                  onPress={() => setFAccountId(a._id)}
                />
              ))}
            </ScrollView>
          </View>

          {/* Currency */}
          <View style={styles.filterField}>
            <Text style={styles.filterLabel}>Currency</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterChipRow}
            >
              {currencies.map((cur) => (
                <Chip
                  key={cur}
                  label={cur === "ALL" ? "All" : cur}
                  selected={fCurrency === cur}
                  onPress={() => setFCurrency(cur)}
                />
              ))}
            </ScrollView>
          </View>

          {/* Min / Max */}
          <View style={styles.filterRow}>
            <View style={[styles.filterField, { flex: 1 }]}>
              <Text style={styles.filterLabel}>Min amount</Text>
              <TextInput
                value={fMin}
                onChangeText={setFMin}
                keyboardType="decimal-pad"
                placeholder="e.g., 100"
                placeholderTextColor={TEXT_MUTED}
                style={styles.filterInput}
              />
            </View>
            <View style={{ width: 12 }} />
            <View style={[styles.filterField, { flex: 1 }]}>
              <Text style={styles.filterLabel}>Max amount</Text>
              <TextInput
                value={fMax}
                onChangeText={setFMax}
                keyboardType="decimal-pad"
                placeholder="e.g., 5000"
                placeholderTextColor={TEXT_MUTED}
                style={styles.filterInput}
              />
            </View>
          </View>

          <View style={styles.filterButtonsRow}>
            <TouchableOpacity
              onPress={() => {
                setFAccountId("ALL");
                setFCategoryId("ALL");
                setFCurrency("ALL");
                setFMin("");
                setFMax("");
              }}
              style={styles.filterClearBtn}
            >
              <Text style={styles.filterClearText}>Clear</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* LIST */}
        <View style={styles.listCard}>
          {err ? (
            <Text style={styles.errorText}>{err}</Text>
          ) : rows.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No investments yet</Text>
              <Text style={styles.emptySubtitle}>
                Add your first investment or adjust filters.
              </Text>
            </View>
          ) : (
            rows.map((item) => {
              const catName = categoriesById.get(item.categoryId)?.name || "—";
              const accName = accountsById.get(item.accountId)?.name || "—";
              const symbol = (item.assetSymbol || "").toUpperCase().trim();

              const canFavorite = isStockOrCryptoCategoryName(catName);
              const isFavorite = symbol ? favoriteSymbols.has(symbol) : false;

              return (
                <InvestmentRow
                  key={item._id}
                  item={item}
                  onEdit={openEdit}
                  onDelete={handleDelete}
                  categoryName={catName}
                  accountName={accName}
                  canFavorite={canFavorite}
                  isFavorite={isFavorite}
                  onToggleFavorite={toggleFavorite}
                />
              );
            })
          )}
        </View>
      </ScrollView>

      {/* ✅ FAB STACK: Auto + Add */}
      <View style={styles.fabStack}>
        <TouchableOpacity
          style={[styles.fab, styles.fabAuto]}
          onPress={openAuto}
          activeOpacity={0.9}
        >
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
              <Text style={styles.modalTitle}>Auto add investment</Text>

              <Text style={styles.modalLabel}>Account</Text>
              {accounts.length === 0 ? (
                <Text style={styles.modalHelp}>
                  No active accounts found. Create one first.
                </Text>
              ) : (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.filterChipRow}
                  keyboardShouldPersistTaps="handled"
                >
                  {accounts.map((a) => (
                    <Chip
                      key={a._id}
                      label={`${a.name} · ${a.currency}`}
                      selected={autoAccountId === a._id}
                      onPress={() => setAutoAccountId(a._id)}
                    />
                  ))}
                </ScrollView>
              )}

              <View style={{ marginTop: 10 }}>
                <Text style={styles.modalLabel}>Text</Text>
                <TextInput
                  value={autoText}
                  onChangeText={setAutoText}
                  placeholder="e.g. bought 2 AAPL for 380 usd"
                  placeholderTextColor={TEXT_MUTED}
                  style={[styles.modalInput, { minHeight: 80 }]}
                  multiline
                />
                <Text style={styles.modalHelp}>
                  Tip: include symbol + units + total cost + currency.
                </Text>
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  onPress={() => setAutoOpen(false)}
                  style={styles.modalBtnGhost}
                >
                  <Text style={styles.modalBtnGhostText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={submitAuto}
                  style={[
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
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <InvestmentModal
        visible={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={handleSaved}
        editing={editing}
        accounts={accounts}
        categories={categoriesFiltered}
        defaultAccountId={defaultAccountId}
        pushToast={push}
      />

      <Toasts toasts={toasts} onClose={remove} />
      <ConfirmDialog />
    </SafeAreaView>
  );
}

/* --------------------------------- Styles --------------------------------- */
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG_DARK },
  scroll: { padding: 16, paddingBottom: 140 },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  headerTitle: { fontSize: 22, fontWeight: "700", color: "white" },
  headerSubtitle: { fontSize: 13, color: TEXT_MUTED, marginTop: 4 },
  headerRefreshBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BORDER_DARK,
    backgroundColor: "#020617",
  },
  headerRefreshText: { color: TEXT_SOFT, fontSize: 12, fontWeight: "500" },

  totalsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  totalCard: {
    flexGrow: 1,
    minWidth: 110,
    padding: 10,
    borderRadius: 12,
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: BORDER_DARK,
  },
  totalLabel: { fontSize: 11, color: TEXT_MUTED, marginBottom: 4 },
  totalValue: { fontSize: 16, fontWeight: "700", color: "#e5e7eb" },

  searchRow: { marginBottom: 8 },
  searchInput: {
    borderWidth: 1,
    borderColor: BORDER_DARK,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    color: "white",
    backgroundColor: "#020617",
    fontSize: 13,
  },

  chipRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: CHIP_BORDER,
    backgroundColor: CHIP_BG,
  },
  chipText: { fontSize: 12, color: TEXT_SOFT, fontWeight: "500" },

  filtersCard: {
    marginTop: 4,
    marginBottom: 16,
    padding: 12,
    borderRadius: 16,
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: BORDER_DARK,
  },
  filterField: { marginBottom: 10 },
  filterLabel: { fontSize: 11, color: TEXT_MUTED, marginBottom: 4 },
  filterChipRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  filterRow: { flexDirection: "row", alignItems: "flex-start", marginTop: 4 },
  filterInput: {
    borderWidth: 1,
    borderColor: BORDER_DARK,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#020617",
    color: "white",
    fontSize: 13,
  },
  filterButtonsRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 4,
  },
  filterClearBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BORDER_DARK,
  },
  filterClearText: { fontSize: 12, color: TEXT_MUTED },

  listCard: {
    borderRadius: 16,
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: BORDER_DARK,
    overflow: "hidden",
  },
  errorText: { color: "#fecaca", padding: 12, fontSize: 13 },
  emptyState: {
    paddingVertical: 24,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  emptyTitle: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  emptySubtitle: { color: TEXT_MUTED, fontSize: 13, textAlign: "center" },

  rowContainer: {
    flexDirection: "row",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: BORDER_DARK,
  },
  rowLeft: { flex: 1, paddingRight: 8 },
  rowRight: { alignItems: "flex-end", justifyContent: "space-between" },
  rowTitleRow: { flexDirection: "row", alignItems: "center", marginBottom: 4 },
  rowTitle: { color: "white", fontSize: 14, fontWeight: "600" },
  rowSubRow: { flexDirection: "row", alignItems: "center", marginBottom: 4 },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BADGE_BORDER,
    backgroundColor: BADGE_BG,
  },
  badgeText: { fontSize: 10, color: TEXT_SOFT },
  rowUnits: { marginLeft: 8, fontSize: 11, color: TEXT_MUTED },
  rowDescription: { fontSize: 12, color: TEXT_SOFT },
  rowBottomRow: { marginTop: 4 },
  rowDate: { fontSize: 11, color: TEXT_MUTED },
  rowTags: { marginTop: 2, fontSize: 11, color: secondary },
  rowAmount: { fontSize: 14, fontWeight: "700", color: "#f97316" },
  rowActions: { flexDirection: "row", marginTop: 6 },
  rowBtnOutline: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BORDER_DARK,
    marginRight: 6,
  },
  rowBtnOutlineText: { fontSize: 11, color: TEXT_SOFT },
  rowBtnDanger: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#b91c1c",
  },
  rowBtnDangerText: { fontSize: 11, color: "#fecaca" },

  // ✅ FAB STACK
  fabStack: {
    position: "absolute",
    right: 16,
    bottom: 24,
    gap: 10,
    alignItems: "flex-end",
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
  fabPlus: { fontSize: 30, lineHeight: 30, color: "white" },

  fabAuto: {
    width: 52,
    height: 40,
    borderRadius: 999,
    backgroundColor: "#020617",
    borderWidth: 1,
    borderColor: main,
    alignItems: "center",
    justifyContent: "center",
  },
  fabAutoText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#d9f99d",
  },

  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.85)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  modalCard: {
    width: "100%",
    maxHeight: "88%",
    borderRadius: 20,
    backgroundColor: "#020617",
    borderWidth: 1,
    borderColor: BORDER_DARK,
    padding: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "white",
    marginBottom: 8,
  },
  modalField: { marginTop: 10 },
  modalLabel: { fontSize: 12, color: TEXT_MUTED, marginBottom: 4 },
  modalInput: {
    borderWidth: 1,
    borderColor: BORDER_DARK,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: "white",
    backgroundColor: "#020617",
    fontSize: 13,
  },
  modalRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginTop: 6,
  },
  modalSelect: {
    borderWidth: 1,
    borderColor: BORDER_DARK,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: "#020617",
  },
  modalSelectHint: { fontSize: 11, color: TEXT_MUTED },
  modalHelp: { marginTop: 4, fontSize: 11, color: TEXT_MUTED },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 16,
    gap: 8,
  },
  modalBtnGhost: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BORDER_DARK,
  },
  modalBtnGhostText: { fontSize: 13, color: TEXT_MUTED },
  modalBtnPrimary: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: main,
  },
  modalBtnPrimaryText: { fontSize: 13, fontWeight: "600", color: "white" },

  toastContainer: { position: "absolute", right: 12, bottom: 88, width: "78%" },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  toastType: {
    fontSize: 11,
    fontWeight: "600",
    marginRight: 6,
    color: TEXT_SOFT,
    textTransform: "capitalize",
  },
  toastMsg: { flex: 1, fontSize: 12, color: TEXT_SOFT },
  toastClose: { fontSize: 16, color: TEXT_MUTED, paddingHorizontal: 4 },

  confirmBackdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(15,23,42,0.85)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  confirmCard: {
    width: "100%",
    borderRadius: 18,
    backgroundColor: "#020617",
    borderWidth: 1,
    borderColor: BORDER_DARK,
    padding: 16,
  },
  confirmTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "white",
    marginBottom: 4,
  },
  confirmText: { fontSize: 13, color: TEXT_MUTED, marginBottom: 12 },
  confirmRow: { flexDirection: "row", justifyContent: "flex-end", gap: 8 },
  confirmBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BORDER_DARK,
  },
  confirmBtnText: { fontSize: 13, color: TEXT_SOFT },

  loadingBox: {
    width: 56,
    height: 56,
    borderRadius: 999,
    borderWidth: 3,
    borderColor: "#1e293b",
    borderTopColor: main,
    marginBottom: 10,
    alignSelf: "center",
  },
  loadingBrand: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4,
  },
  loadingLogoWrap: { marginRight: 8 },
  loadingLogoBorder: {
    width: 32,
    height: 32,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#1f2937",
    alignItems: "center",
    justifyContent: "center",
  },
  loadingLogoInner: {
    width: 26,
    height: 26,
    borderRadius: 999,
    backgroundColor: main,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingLogoText: { color: "white", fontWeight: "700", fontSize: 16 },
  loadingTitle: { fontSize: 20, fontWeight: "700", color: "white" },
  loadingSubtitle: { fontSize: 13, color: TEXT_MUTED, textAlign: "center" },

  // Header logo
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
  headerLogoImg: { width: "100%", height: "100%", resizeMode: "cover" },

  // Favorite star
  starBtn: {
    marginLeft: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BORDER_DARK,
    backgroundColor: "#020617",
  },
  starIcon: { fontSize: 18, lineHeight: 18, color: TEXT_MUTED },
});
