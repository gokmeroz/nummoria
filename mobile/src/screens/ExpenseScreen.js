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
import TextRecognition from "@react-native-ml-kit/text-recognition";
import { useNavigation } from "@react-navigation/native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import api from "../lib/api";
import logo from "../../assets/nummoria_logo.png";

/* ─────────────────────────────────────────────────────────────
   CONSTANTS & THEME
───────────────────────────────────────────────────────────── */
const BG       = "#030508";
const MINT     = "#00ff87";
const CYAN     = "#00d4ff";
const VIOLET   = "#a78bfa";
const NEON_PALETTE = [MINT, CYAN, VIOLET, "#ff007c", "#facc15", "#ff7300"];
const CARD_BG  = "rgba(255,255,255,0.025)";
const CARD_BD  = "rgba(255,255,255,0.07)";
const T_HI     = "#e2e8f0";
const T_MID    = "rgba(226,232,240,0.55)";
const T_DIM    = "rgba(226,232,240,0.32)";
const DATE_LANG = "en-US";

const EXPENSE_CATEGORY_OPTIONS = [
  "Rent", "Housing Payments & Maintenance", "Debt Payments", "Transportation",
  "Health & Medical", "Utilities", "Groceries", "Dining Out", "Education",
  "Miscellaneous", "Entertainment", "Travel", "Gifts & Donations",
  "Personal Care", "Shopping", "Subscriptions", "Taxes", "Insurance",
  "Business Expenses", "Other Expense",
];

const FREQ_OPTIONS = [
  { label: "None",    value: "" },
  { label: "Daily",   value: "daily" },
  { label: "Weekly",  value: "weekly" },
  { label: "Monthly", value: "monthly" },
  { label: "Yearly",  value: "yearly" },
];

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
function fmtDateUTC(dateLike) {
  return new Date(dateLike).toLocaleDateString(DATE_LANG, {
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
  return (minor / Math.pow(10, dec)).toFixed(dec);
}
const fmtMoney = (minor, cur = "USD") =>
  new Intl.NumberFormat(DATE_LANG, {
    style: "currency",
    currency: cur || "USD",
  }).format((minor || 0) / Math.pow(10, decimalsForCurrency(cur || "USD")));

/* ─────────────────────────────────────────────────────────────
   RECEIPT HELPERS
───────────────────────────────────────────────────────────── */
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
    const iso = data.match(/(\d{4}-\d{2}-\d{2})/),
      eu = data.match(/(\d{2}\.\d{2}\.\d{4})/);
    if (iso) dateStr = iso[1];
    else if (eu) {
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
  const textRaw = String(rawText),
    text = textRaw.replace(/\s+/g, " ").toUpperCase();
  const totalRegex =
    /(GENEL TOPLAM|TOPLAM|TOPLAM TUTAR|ÖDENECEK|ODENECEK|TOTAL|GRAND TOTAL|AMOUNT)[^\d]*([0-9]+[.,][0-9]{2})/;
  const totalMatch = text.match(totalRegex);
  let amount = null;
  if (totalMatch?.[2]) {
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
  const iso = text.match(/(\d{4}[-/.]\d{2}[-/.]\d{2})/),
    eu = text.match(/(\d{2}[-/.]\d{2}[-/.]\d{4})/);
  if (iso) dateStr = iso[1].replace(/\./g, "-").replace(/\//g, "-");
  else if (eu) {
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

/* ─────────────────────────────────────────────────────────────
   CATEGORY INFERENCE
───────────────────────────────────────────────────────────── */
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

/* ─────────────────────────────────────────────────────────────
   HUD PRIMITIVES & COMPONENTS
───────────────────────────────────────────────────────────── */
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
  accent = "violet",
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
  }[accent] || {
    col: VIOLET,
    from: "rgba(167,139,250,0.08)",
    to: "rgba(167,139,250,0.01)",
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

function PulseButton({ onPress, color = MINT, icon }) {
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

function Chip({ label, selected, onPress, small, accent = MINT }) {
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
  const color = { violet: VIOLET, cyan: CYAN, mint: MINT }[accent] || CYAN;
  const bd = {
    violet: "rgba(167,139,250,0.22)",
    cyan: "rgba(0,212,255,0.22)",
    mint: "rgba(0,255,135,0.22)",
  }[accent];
  const bg = {
    violet: "rgba(167,139,250,0.04)",
    cyan: "rgba(0,212,255,0.04)",
    mint: "rgba(0,255,135,0.04)",
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
    return <Text style={s.chartEmpty}>No data for this month.</Text>;
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
                      backgroundColor: VIOLET,
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

function DistributionList({ data, currency }) {
  if (!data || data.length === 0) {
    return <Text style={s.chartEmpty}>No distribution data.</Text>;
  }
  const total = data.reduce((a, d) => a + d.minor, 0) || 1;
  return (
    <View>
      <View style={s.distTotalRow}>
        <Text style={s.distTotalLabel}>TOTAL</Text>
        <Text style={[s.distTotalValue, { color: CYAN }]}>
          {fmtMoney(total, currency)}
        </Text>
      </View>
      <ScanLine color={CYAN} style={{ marginBottom: 10 }} />
      {data.map((item, i) => {
        const color = NEON_PALETTE[i % NEON_PALETTE.length];
        const pct = Math.round((item.minor / total) * 100);
        return (
          <View key={i} style={s.distRow}>
            <View style={[s.distColorBar, { backgroundColor: color }]} />
            <View style={s.distContent}>
              <View style={s.distTopRow}>
                <Text style={s.distName} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={[s.distPct, { color }]}>{pct}%</Text>
                <Text style={[s.distAmount, { color }]} numberOfLines={1}>
                  {fmtMoney(item.minor, currency)}
                </Text>
              </View>
              <View style={s.distBarTrack}>
                <View
                  style={[
                    s.distBarFill,
                    { width: `${Math.max(pct, 2)}%`, backgroundColor: color },
                  ]}
                />
              </View>
            </View>
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
        selected && { borderColor: accent, backgroundColor: `${accent}15` }
      ]}
    >
      {selected && <View style={[s.cNodeGlow, { backgroundColor: accent }]} />}
      <Text style={[s.cNodeTxt, selected && { color: accent, fontWeight: "800" }]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function FilterDataRow({ label, val, set, opts, accent }) {
  return (
    <View style={s.cRowWrap}>
      <Text style={s.cRowLabel}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.cRowScroll} keyboardShouldPersistTaps="handled">
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
export default function ExpensesScreen({ route }) {
  const navigation = useNavigation();
  const scrollRef = useRef(null);
  const accountId = route?.params?.accountId;

  /* ── data ── */
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [accounts, setAccounts] = useState([]);
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

  /* ── ui state ── */
  const [showUpcoming, setShowUpcoming] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [newCatName, setNewCatName] = useState("");

  /* ── per-section currency pickers ── */
  const [kpiCurrency, setKpiCurrency] = useState("");
  const [barCurrency, setBarCurrency] = useState("");
  const [distCurrency, setDistCurrency] = useState("");

  /* ── expense modal ── */
  const [modalOpen, setModalOpen] = useState(false);
  const [editingData, setEditingData] = useState(null);
  const [form, setForm] = useState({
    amount: "",
    currency: "USD",
    date: new Date().toISOString().slice(0, 10),
    frequency: "",
    endDate: "",
    categoryId: "",
    description: "",
    tagsCsv: "",
    accountId: "",
  });

  /* ── auto-add modal ── */
  const [autoOpen, setAutoOpen] = useState(false);
  const [autoText, setAutoText] = useState("");
  const [autoAccountId, setAutoAccountId] = useState("");
  const [autoLoading, setAutoLoading] = useState(false);

  /* ── scanner ── */
  const [scannerVisible, setScannerVisible] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanProcessing, setScanProcessing] = useState(false);
  const [facing, setFacing] = useState("back");
  const [flash, setFlash] = useState("off");
  const [permission, requestPermission] = useCameraPermissions();
  const scannedOnceRef = useRef(false);
  const cameraRef = useRef(null);
  const ocrBusyRef = useRef(false);

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
      if (t.type === "expense" && !t.isDeleted && t.tags) {
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
  };

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

      if (fTag !== "ALL") {
        const lowerTags = (t.tags || []).map((x) => x.toLowerCase());
        if (!lowerTags.includes(fTag)) return false;
      }

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

      // Custom Date Check
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
          `${t.description || ""} ${t.notes || ""} ${categoriesById.get(t.categoryId)?.name || ""} ${accountsById.get(t.accountId)?.name || ""} ${(t.tags || []).join(" ")}`.toLowerCase();
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
  const currentDistCurrency = distCurrencies.includes(distCurrency)
    ? distCurrency
    : distCurrencies[0] || "USD";

  /* ─────────────────────────────────────────────────────────
     TOTALS
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

  /* ─────────────────────────────────────────────────────────
     UPCOMING — 12-month horizon
  ───────────────────────────────────────────────────────── */
  const upcoming = useMemo(() => {
    const today = startOfUTC(new Date());
    const horizon = addMonthsUTC(today, 12);
    const keyOf = (t, vDate) =>
      [
        t.accountId,
        t.categoryId,
        t.type,
        t.amountMinor,
        t.currency,
        vDate.toISOString(),
      ].join("|");
    const map = new Map();

    for (const t of transactions) {
      if (t.type !== "expense") continue;
      const txDate = new Date(t.date);

      if (txDate > today) map.set(keyOf(t, txDate), { ...t, __kind: "actual" });

      if (t.frequency) {
        let nextVDate = new Date(t.date);
        const eDate = t.endDate ? new Date(t.endDate) : new Date("2099-01-01");

        const advance = (d) => {
          const nd = new Date(d);
          if (t.frequency === "daily") nd.setUTCDate(nd.getUTCDate() + 1);
          else if (t.frequency === "weekly") nd.setUTCDate(nd.getUTCDate() + 7);
          else if (t.frequency === "monthly")
            nd.setUTCMonth(nd.getUTCMonth() + 1);
          else if (t.frequency === "yearly")
            nd.setUTCFullYear(nd.getUTCFullYear() + 1);
          return nd;
        };

        nextVDate = advance(nextVDate);
        while (nextVDate <= today) nextVDate = advance(nextVDate);

        while (nextVDate <= horizon && nextVDate <= eDate) {
          const v = {
            ...t,
            _id: `virtual-${t._id}-${nextVDate.getTime()}`,
            date: nextVDate.toISOString(),
            __kind: "virtual",
            __parentId: t._id,
          };
          map.set(keyOf(v, nextVDate), v);
          nextVDate = advance(nextVDate);
        }
      }
    }
    return Array.from(map.values()).sort(
      (a, b) => new Date(a.date) - new Date(b.date),
    );
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
    const monthsPassed = now.getUTCMonth() + 1;
    let yearMinor = 0;
    for (let m = 0; m < monthsPassed; m++) {
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
        yearlyAvg: monthsPassed ? Math.round(yearMinor / monthsPassed) : 0,
      },
      noteMixed: fCurrency === "ALL",
    };
  }, [rows, currentKpiCurrency, fCurrency]);

  /* ─────────────────────────────────────────────────────────
     BAR CHART DATA & DISTRIBUTION
  ───────────────────────────────────────────────────────── */
  const barChartData = useMemo(() => {
    const now = new Date(),
      thisStart = startOfMonthUTC(now),
      thisEnd = endOfMonthUTC(now);
    const curRows = rows.filter(
      (r) =>
        (r.currency || "USD") === currentBarCurrency &&
        new Date(r.date) >= thisStart &&
        new Date(r.date) <= thisEnd,
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

  const distributionData = useMemo(() => {
    const curRows = rows.filter(
      (r) => (r.currency || "USD") === currentDistCurrency,
    );
    const pieMap = new Map();
    for (const t of curRows)
      pieMap.set(
        t.categoryId || "—",
        (pieMap.get(t.categoryId || "—") || 0) + Number(t.amountMinor || 0),
      );
    const total = Array.from(pieMap.values()).reduce((a, b) => a + b, 0) || 1;
    return Array.from(pieMap.entries())
      .map(([cid, minor]) => ({
        name: categoriesById.get(cid)?.name || "—",
        minor,
        pct: minor / total,
      }))
      .sort((a, b) => b.minor - a.minor);
  }, [rows, currentDistCurrency, categoriesById]);

  /* ─────────────────────────────────────────────────────────
     ACTIONS
  ───────────────────────────────────────────────────────── */
  function openCreate() {
    const aId = accountId || accounts[0]?._id || "";
    const cur = accounts.find((a) => a._id === aId)?.currency || "USD";
    setEditingData(null);
    setForm({
      amount: "",
      currency: cur,
      date: new Date().toISOString().slice(0, 10),
      frequency: "",
      endDate: "",
      categoryId: categories[0]?._id || "",
      description: "",
      tagsCsv: "",
      accountId: aId,
    });
    setModalOpen(true);
  }

  function openEdit(tx) {
    setEditingData(tx);
    setForm({
      amount: minorToMajor(tx.amountMinor, tx.currency),
      currency: tx.currency,
      date: new Date(tx.date).toISOString().slice(0, 10),
      frequency: tx.frequency || "",
      endDate: tx.endDate
        ? new Date(tx.endDate).toISOString().slice(0, 10)
        : "",
      categoryId: tx.categoryId || "",
      description: tx.description || "",
      tagsCsv: (tx.tags || []).join(", "),
      accountId: tx.accountId || accountId || accounts[0]?._id || "",
    });
    setModalOpen(true);
  }

  async function softDelete(tx) {
    Alert.alert("Delete expense?", "This action cannot be undone.", [
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
              e?.response?.data?.error || e.message || "Delete failed",
            );
          }
        },
      },
    ]);
  }

  const handleSeedCategories = async () => {
    Alert.alert("Seed Categories", "Add all standard expense categories?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Seed",
        onPress: async () => {
          try {
            const existingNames = new Set(categories.map((c) => c.name));
            for (const name of EXPENSE_CATEGORY_OPTIONS) {
              if (!existingNames.has(name))
                await api.post("/categories", { name, kind: "expense" });
            }
            loadAll();
          } catch (e) {
            Alert.alert(
              "Error",
              e?.response?.data?.error || "Error seeding categories",
            );
          }
        },
      },
    ]);
  };

  const handleCreateCategory = async () => {
    if (!newCatName.trim()) return;
    try {
      await api.post("/categories", {
        name: newCatName.trim(),
        kind: "expense",
      });
      setNewCatName("");
      loadAll();
    } catch (e) {
      Alert.alert(
        "Error",
        e?.response?.data?.error || "Error creating category",
      );
    }
  };

  /* ── auto-add ── */
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

  /* ── scanner helpers ── */
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

  /* ─────────────────────────────────────────────────────────
     RENDER HELPERS
  ───────────────────────────────────────────────────────── */
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
        {item.frequency && (
          <View
            style={[
              s.badge,
              {
                alignSelf: "flex-start",
                marginTop: 6,
                borderColor: `rgba(0,212,255,0.2)`,
                backgroundColor: `rgba(0,212,255,0.05)`,
              },
            ]}
          >
            <Text style={[s.badgeTxt, { color: CYAN }]}>
              {item.frequency.toUpperCase()}
            </Text>
          </View>
        )}
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
      <HoloCard accent="cyan" containerStyle={{ marginBottom: 0 }}>
        <View style={s.topBar}>
          <View style={s.logoRow}>
            <View style={[s.statusDot, { backgroundColor: CYAN }]} />
            <Text style={s.logoTxt}>EXPENSE LEDGER</Text>
          </View>
          <TouchableOpacity
            onPress={() => navigation.navigate("Dashboard")}
            activeOpacity={0.8}
            style={[s.homeBtn, { borderColor: "rgba(0,212,255,0.20)" }]}
          >
            <Image source={logo} style={s.homeBtnImg} />
            <Brackets color={CYAN} size={7} thick={1} />
          </TouchableOpacity>
        </View>

        <Text style={s.heroTitle}>Expense{"\n"}Control</Text>
        <Text style={s.heroSub}>
          Review spending, spot patterns, and keep your outflow decision-ready.
        </Text>
        <ScanLine color={CYAN} style={{ marginTop: 12, marginBottom: 14 }} />

        <View style={s.controlsRow}>
          <TouchableOpacity
            style={[
              s.ctrlPill,
              {
                borderColor: showFilters ? `${MINT}55` : `${CYAN}33`,
                backgroundColor: showFilters ? `${MINT}15` : "transparent",
                flex: 1,
              },
            ]}
            onPress={() => setShowFilters(!showFilters)}
            activeOpacity={0.75}
          >
            <View
              style={[
                s.ctrlDot,
                { backgroundColor: showFilters ? MINT : CYAN },
              ]}
            />
            <Text style={[s.ctrlTxt, { color: showFilters ? MINT : CYAN }]}>
              {showFilters ? "SYS_RDY" : "FILTER"}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.ctrlPill, { borderColor: `${VIOLET}33` }]}
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
            style={[s.ctrlPill, { borderColor: `${MINT}22` }]}
            onPress={loadAll}
            activeOpacity={0.75}
          >
            <View style={[s.ctrlDot, { backgroundColor: MINT }]} />
            <Text style={[s.ctrlTxt, { color: MINT }]}>REFRESH</Text>
          </TouchableOpacity>
        </View>

        <View style={s.cyberLinkBox}>
          <ScanLine
            color={CYAN}
            style={{
              position: "absolute",
              top: -1,
              left: 10,
              right: 10,
              opacity: 0.3,
            }}
          />
          <View style={s.cyberSearchRow}>
            <View style={[s.cyberBlinker, { backgroundColor: CYAN }]} />
            <TextInput
              value={q}
              onChangeText={setQ}
              placeholder="INPUT_QUERY..."
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
              <Brackets color={MINT} size={6} thick={1} />

              <FilterDataRow
                label="NODE"
                val={fAccountId}
                set={setFAccountId}
                accent={CYAN}
                opts={[
                  { _id: "ALL", label: "ALL_ACCS" },
                  ...accounts.map((a) => ({ _id: a._id, label: a.name })),
                ]}
              />
              <FilterDataRow
                label="TYPE"
                val={fCategoryId}
                set={setFCategoryId}
                accent={VIOLET}
                opts={[
                  { _id: "ALL", label: "ALL_CATS" },
                  ...categories.map((c) => ({ _id: c._id, label: c.name })),
                ]}
              />

              {/* TAGS FILTER - Extracted Dynamically */}
              {allTags.length > 0 && (
                <FilterDataRow
                  label="TAGS"
                  val={fTag}
                  set={setFTag}
                  accent={MINT}
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
                accent={CYAN}
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
                accent={VIOLET}
                opts={[
                  { _id: "ALL", label: "INF_LOOP" },
                  { _id: "THIS_MONTH", label: "CUR_CYC" },
                  { _id: "LAST_MONTH", label: "PRV_CYC" },
                  { _id: "LAST_90", label: "-90_CYC" },
                ]}
              />
              <FilterDataRow
                label="SORT"
                val={sortKey}
                set={setSortKey}
                accent={MINT}
                opts={[
                  { _id: "date_desc", label: "LATEST" },
                  { _id: "date_asc", label: "OLDEST" },
                  { _id: "amount_desc", label: "MAX_VOL" },
                  { _id: "amount_asc", label: "MIN_VOL" },
                ]}
              />

              {/* AMOUNT RANGE FILTER */}
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

              {/* DATE RANGE FILTER */}
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

              {/* CLEAR FILTERS */}
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
        title={`Scheduled Flow (${upcoming.length})`}
        subtitle="Upcoming and planned expenses"
        accent="violet"
      >
        {upcoming.length === 0 ? (
          <Text style={s.emptyText}>
            Nothing upcoming within current filters.
          </Text>
        ) : (
          upcoming.slice(0, 20).map((u) => {
            const catName = categoriesById.get(u.categoryId)?.name || "—";
            const isVirtual = u.__kind === "virtual";
            const ac = isVirtual ? MINT : CYAN;
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
                        {catName}
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
                  </View>
                </View>
              </View>
            );
          })
        )}
        {upcoming.length > 20 && (
          <Text style={[s.emptyText, { marginTop: 8 }]}>
            + {upcoming.length - 20} more…
          </Text>
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

  function ExpenseModal() {
    if (!modalOpen) return null;
    const submit = async () => {
      const cur = (form.currency || "USD").toString().toUpperCase();
      const pickedAccId = form.accountId || accountId || accounts[0]?._id || "";
      const amountMinor = majorToMinor(form.amount, cur);
      if (Number.isNaN(amountMinor)) {
        Alert.alert("Invalid amount", "Enter a valid number.");
        return;
      }
      if (!form.categoryId) {
        Alert.alert("Missing category", "Pick a category.");
        return;
      }
      if (!pickedAccId) {
        Alert.alert("Missing account", "Pick an account.");
        return;
      }

      const payload = {
        accountId: pickedAccId,
        categoryId: form.categoryId,
        type: "expense",
        amountMinor,
        currency: cur,
        date: new Date(form.date || new Date()).toISOString(),
        description: (form.description || "").trim() || null,
        tags: (form.tagsCsv || "")
          .split(",")
          .map((x) => x.trim())
          .filter((x) => x.length > 0),
      };
      if (form.frequency) {
        payload.frequency = form.frequency;
        if ((form.endDate || "").trim())
          payload.endDate = new Date(form.endDate).toISOString();
      }
      try {
        if (!editingData) {
          const { data } = await api.post("/transactions", payload);
          const created = Array.isArray(data?.created) ? data.created : [data];
          setTransactions((prev) => [...created, ...prev]);
        } else {
          const { data } = await api.put(
            `/transactions/${editingData._id}`,
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
              <Text style={[s.modalTitle, { color: VIOLET }]}>
                {editingData ? "EDIT EXPENSE" : "NEW EXPENSE"}
              </Text>
              <ScanLine color={VIOLET} style={{ marginBottom: 16 }} />

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
                <View style={{ width: 80 }}>
                  <Text style={s.modalLabel}>CCY</Text>
                  <TextInput
                    value={form.currency}
                    editable={false}
                    style={[s.modalInput, { opacity: 0.5 }]}
                  />
                </View>
              </View>

              <View style={{ marginVertical: 10, gap: 8 }}>
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
                  style={[s.scanBtn, { borderColor: `${CYAN}44` }]}
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
              </View>

              <Text style={s.modalLabel}>FREQUENCY (OPTIONAL)</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                style={{ marginBottom: 10 }}
              >
                {FREQ_OPTIONS.map((opt) => (
                  <Chip
                    key={opt.value}
                    label={opt.label}
                    accent={CYAN}
                    selected={form.frequency === opt.value}
                    onPress={() =>
                      setForm((f) => ({
                        ...f,
                        frequency: opt.value,
                        endDate: opt.value ? f.endDate : "",
                      }))
                    }
                  />
                ))}
              </ScrollView>

              {form.frequency ? (
                <>
                  <Text style={s.modalLabel}>END DATE (OPTIONAL)</Text>
                  <TextInput
                    value={form.endDate}
                    onChangeText={(v) => setForm((f) => ({ ...f, endDate: v }))}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={T_DIM}
                    style={[s.modalInput, { marginBottom: 10 }]}
                  />
                </>
              ) : null}

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
                placeholder="Optional memo"
                placeholderTextColor={T_DIM}
                style={[s.modalInput, { marginBottom: 10 }]}
              />

              <Text style={s.modalLabel}>TAGS (COMMA-SEPARATED)</Text>
              <TextInput
                value={form.tagsCsv}
                onChangeText={(v) => setForm((f) => ({ ...f, tagsCsv: v }))}
                placeholder="groceries, dinner"
                placeholderTextColor={T_DIM}
                style={s.modalInput}
              />
              <Text style={s.modalHint}>e.g. groceries, dinner, weekend</Text>

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
                    {editingData ? "SAVE" : "ADD"}
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    );
  }

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
          accent="cyan"
          right={
            <CurrencyPill
              currencies={distCurrencies}
              value={currentKpiCurrency}
              onChange={setKpiCurrency}
              accent={CYAN}
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
              accent="violet"
            />
            <MetricCard
              label="Yearly Avg"
              value={fmtMoney(insights.kpis.yearlyAvg, insights.statsCurrency)}
              accent="mint"
            />
          </View>
          <View style={s.totalWrap}>
            {totals.map(({ cur, major }) => (
              <View
                key={cur}
                style={[s.totalPill, { borderColor: `rgba(0,212,255,0.22)` }]}
              >
                <View style={[s.ctrlDot, { backgroundColor: CYAN }]} />
                <Text style={[s.totalPillTxt, { color: CYAN }]}>
                  Total {cur}: <Text style={{ color: "#ffffff" }}>{major}</Text>
                </Text>
              </View>
            ))}
          </View>
        </HoloCard>

        <HoloCard
          title="By Category"
          subtitle="Current Month"
          accent="violet"
          right={
            <CurrencyPill
              currencies={distCurrencies}
              value={currentBarCurrency}
              onChange={setBarCurrency}
              accent={VIOLET}
            />
          }
        >
          <BarChart data={barChartData} currency={currentBarCurrency} />
        </HoloCard>

        <HoloCard
          title="Distribution"
          accent="mint"
          right={
            <CurrencyPill
              currencies={distCurrencies}
              value={currentDistCurrency}
              onChange={setDistCurrency}
              accent={MINT}
            />
          }
        >
          <DistributionList
            data={distributionData}
            currency={currentDistCurrency}
          />
        </HoloCard>

        <HoloCard
          title="Transaction Feed"
          subtitle={`${rows.length} records in view`}
          accent="mint"
        >
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
        </HoloCard>

        <HoloCard
          title="Category Config"
          subtitle="Manage expense categories"
          accent="cyan"
        >
          <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
            <TextInput
              value={newCatName}
              onChangeText={setNewCatName}
              placeholder="NEW CATEGORY NAME"
              placeholderTextColor={"rgba(226,232,240,0.40)"}
              style={[s.modalInput, { flex: 1, fontSize: 11 }]}
            />
            <TouchableOpacity
              style={[
                s.rowBtnEdit,
                {
                  borderColor: `rgba(0,212,255,0.44)`,
                  justifyContent: "center",
                },
              ]}
              onPress={handleCreateCategory}
              activeOpacity={0.75}
            >
              <Text style={[s.rowBtnTxt, { color: CYAN }]}>ADD</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={[
              s.ctrlPill,
              {
                borderColor: "rgba(255,255,255,0.1)",
                width: "100%",
                justifyContent: "center",
                marginBottom: 12,
              },
            ]}
            onPress={handleSeedCategories}
            activeOpacity={0.75}
          >
            <Text style={[s.ctrlTxt, { color: "rgba(226,232,240,0.70)" }]}>
              SEED STANDARD CATEGORIES
            </Text>
          </TouchableOpacity>
          <Text style={[s.filterGroupLabel, { marginBottom: 8 }]}>
            EXISTING CATEGORIES
          </Text>
          {categories.length === 0 ? (
            <Text style={s.emptyText}>None yet.</Text>
          ) : (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              {categories.map((c) => (
                <View
                  key={c._id}
                  style={[s.badge, { borderColor: "rgba(255,255,255,0.1)" }]}
                >
                  <Text
                    style={[s.badgeTxt, { color: "rgba(226,232,240,0.70)" }]}
                  >
                    {c.name}
                  </Text>
                </View>
              ))}
            </View>
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
          <Brackets color={VIOLET} size={8} thick={1} />
          <Text style={[s.fabSecondaryTxt, { color: VIOLET }]}>AUTO</Text>
        </TouchableOpacity>

        <PulseButton onPress={openCreate} color={MINT} icon="+" />
      </View>

      {/* EXPENSE MODAL */}
      <ExpenseModal />

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
                AUTO ADD EXPENSE
              </Text>
              <Text style={s.modalHint}>
                Parse a short sentence into a transaction.
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
              <Text style={s.modalLabel}>TEXT</Text>
              <TextInput
                value={autoText}
                onChangeText={setAutoText}
                placeholder="e.g. paid 280 TRY coffee"
                placeholderTextColor={T_DIM}
                style={[s.modalInput, { minHeight: 80 }]}
                multiline
              />
              <Text style={s.modalHint}>
                Examples: "paid 280 TRY coffee", "uber 180"
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

      {/* CAMERA OVERLAY */}
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

  /* section card / HoloCard */
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

  /* metric card */
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

  /* currency pill */
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

  /* header */
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
  searchInput: { flex: 1, fontSize: 12, color: T_HI, paddingVertical: 10 },
  filterGroupLabel: {
    fontSize: 8,
    fontWeight: "800",
    color: T_DIM,
    letterSpacing: 2,
    marginBottom: 4,
    marginTop: 6,
    textTransform: "uppercase",
  },
  chipScroll: { paddingBottom: 6, paddingRight: 8 },

  /* chip */
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

  /* bar chart */
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
    backgroundColor: "rgba(167,139,250,0.06)",
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

  /* distribution */
  distTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  distTotalLabel: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 2,
    color: T_DIM,
    textTransform: "uppercase",
  },
  distTotalValue: { fontSize: 18, fontWeight: "800" },
  distRow: {
    flexDirection: "row",
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
    overflow: "hidden",
  },
  distColorBar: { width: 3, minHeight: 48 },
  distContent: { flex: 1, paddingVertical: 8, paddingHorizontal: 10 },
  distTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  distName: {
    flex: 1,
    fontSize: 11,
    fontWeight: "700",
    color: T_HI,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  distPct: { fontSize: 10, fontWeight: "800", width: 32, textAlign: "right" },
  distAmount: {
    fontSize: 11,
    fontWeight: "800",
    width: 80,
    textAlign: "right",
  },
  distBarTrack: {
    height: 4,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 1,
    overflow: "hidden",
  },
  distBarFill: { height: "100%", borderRadius: 1 },

  /* timeline/upcoming */
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
  },
  flowAccent: { position: "absolute", left: 0, top: 0, bottom: 0, width: 2 },
  flowCat: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
  },

  /* row card */
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
  rowBtnTxt: {
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
  },

  /* totals */
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
  chartEmpty: {
    fontSize: 11,
    color: T_DIM,
    textAlign: "center",
    paddingVertical: 20,
  },

  /* error */
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

  /* modal */
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
  scanBtnTxt: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
  },

  /* NEW PULSE BUTTON / FABs STYLES */
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
    shadowColor: MINT,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 8,
  },
  fabIcon: {
    fontSize: 30,
    color: BG,
    fontWeight: "300",
    marginTop: -4,
  },
  fabSecondary: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(167,139,250,0.1)",
    borderWidth: 1,
    borderColor: "rgba(167,139,250,0.4)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: VIOLET,
    shadowOpacity: 0.4,
    shadowRadius: 5,
  },
  fabSecondaryTxt: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1,
    marginTop: 2,
  },

  /* camera */
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
  camTopTxt: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
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
  camIconTxt: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
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

  /* 2086 DATALINK UI STYLES */
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
  cyberBlinker: {
    width: 4,
    height: 12,
    marginRight: 10,
    opacity: 0.8,
  },
  cyberSearchInput: {
    flex: 1,
    color: T_HI,
    fontSize: 12,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    paddingVertical: 4,
  },
  cyberFilterToggle: {
    borderWidth: 1,
    borderColor: CARD_BD,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 2,
    marginLeft: 8,
    backgroundColor: "rgba(255,255,255,0.02)",
  },
  cyberToggleTxt: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.5,
  },
  cyberReadoutRow: {
    paddingHorizontal: 12,
    paddingBottom: 10,
  },
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
    backgroundColor: "rgba(0,212,255,0.02)",
    position: "relative",
    gap: 12,
  },
  cRowWrap: {
    flexDirection: "row",
    alignItems: "center",
  },
  cRowLabel: {
    width: 42,
    fontSize: 9,
    fontWeight: "800",
    color: T_DIM,
    letterSpacing: 1,
  },
  cRowScroll: {
    flex: 1,
  },
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
  cNodeGlow: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 2,
  },
  cNodeTxt: {
    fontSize: 9,
    color: T_DIM,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  resetBtn: {
    alignSelf: "flex-end",
    marginTop: 6,
    paddingVertical: 4,
  },
  resetBtnTxt: {
    fontSize: 9,
    fontWeight: "800",
    color: "rgba(255, 115, 0, 0.8)",
    letterSpacing: 1,
  },
});