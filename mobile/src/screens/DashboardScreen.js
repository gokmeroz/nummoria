// mobile/src/screens/DashboardScreen.js
import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ImageBackground,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  StatusBar,
  Image,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation } from "@react-navigation/native";

import api from "../lib/api";
import DashboardMenuFab from "../components/DashboardMenuFab";

const { width } = Dimensions.get("window");

/* ──────────────────────────────────────────────────────────
   BRAND / THEME — aligned with web Dashboard.jsx
────────────────────────────────────────────────────────── */
const BG_DARK = "#070A07";
const CARD_BG = "rgba(255,255,255,0.03)";
const CARD_BORDER = "rgba(255,255,255,0.10)";
const TEXT_PRIMARY = "#f9fafb";
const TEXT_MUTED = "rgba(255,255,255,0.70)";
const TEXT_SOFT = "rgba(255,255,255,0.55)";
const MAIN = "#4f772d";
const SECONDARY = "#90a955";
const MINT = "#00ff87"; // DashboardMenuFab accent — used for glow dots
const CYAN = "#00d4ff";
const GREEN_GLOW = "rgba(19,226,67,0.10)";
const PINK_GLOW = "rgba(153,23,70,0.12)";
const EXPENSE = "#991746";
const INCOME = "#13e243";
const INVEST = "#90a955";

/* local asset */
const seeItImg = require("../../assets/nummoria_logo.png");

/* ──────────────────────────────────────────────────────────
   SLIDES  (mirrors Dashboard.jsx slides array)
────────────────────────────────────────────────────────── */
const slides = [
  {
    image: seeItImg,
    alt: "Finance background",
    title: "See it. Track it.",
    subtitle:
      "Real-time visibility into cash flow, spending, and investments — all in one place.",
    ctas: [
      { label: "GET ADVICE", href: "/ai/financial-advice" },
      { label: "VIEW REPORTS", href: "/reports" },
    ],
    dim: true,
  },
  {
    image:
      "https://images.unsplash.com/photo-1553729784-e91953dec042?w=1920&q=80&auto=format&fit=crop",
    alt: "Charts and analytics",
    title: "A clear picture of your money — instantly",
    subtitle: "Track expenses, monitor income, and keep an eye on investments.",
    ctas: [{ label: "OPEN DASHBOARD", href: "/reports" }],
    dim: true,
  },
  {
    image:
      "https://images.unsplash.com/photo-1554224155-1696413565d3?w=1920&q=80&auto=format&fit=crop",
    alt: "Wallet & receipts",
    title: "Control your spending",
    subtitle: "Categorize, filter by date, and export with one tap.",
    ctas: [{ label: "GO TO EXPENSES", href: "/expenses" }],
    dim: true,
  },
  {
    image:
      "https://images.unsplash.com/photo-1517148815978-75f6acaaf32c?w=1920&q=80&auto=format&fit=crop",
    alt: "Stock market display",
    title: "Invest with clarity",
    subtitle: "Positions, P&L, and performance in one clean view.",
    ctas: [{ label: "VIEW INVESTMENTS", href: "/investments/performance" }],
    dim: true,
  },
  {
    image:
      "https://images.unsplash.com/photo-1550547660-d9450f859349?w=1920&q=80&auto=format&fit=crop",
    alt: "Lifestyle choice",
    title: "Want fries with that?",
    subtitle:
      "Use the AI mentor to turn everyday spending into clearer financial tradeoffs.",
    ctas: [{ label: "AI FINANCIAL MENTOR", href: "/ai/financial-helper" }],
    dim: true,
  },
];

/* ──────────────────────────────────────────────────────────
   MONEY HELPERS
────────────────────────────────────────────────────────── */
function decimalsForCurrency(code) {
  const zero = new Set(["JPY", "KRW", "CLP", "VND"]);
  const three = new Set(["BHD", "IQD", "JOD", "KWD", "OMR", "TND"]);
  if (zero.has(code)) return 0;
  if (three.has(code)) return 3;
  return 2;
}
function minorToMajorNumber(minor, currency) {
  return minor / Math.pow(10, decimalsForCurrency(currency));
}
function formatCurrency(n, currency = "USD") {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(n || 0);
  } catch {
    return `$${Number(n || 0).toLocaleString()}`;
  }
}

/* ──────────────────────────────────────────────────────────
   ROUTE MAPPING
────────────────────────────────────────────────────────── */
function hrefToRouteName(href) {
  switch (href) {
    case "/ai/financial-advice":
    case "/ai/financial-helper":
      return "Financial Helper";
    case "/reports":
      return "Reports";
    case "/expenses":
      return "Expenses";
    case "/income":
      return "Income";
    case "/investments":
      return "Investments";
    case "/investments/performance":
      return "InvestmentPerformance";
    default:
      return null;
  }
}

/* ──────────────────────────────────────────────────────────
   SCREEN
────────────────────────────────────────────────────────── */
export default function DashboardScreen() {
  const navigation = useNavigation();

  const [name, setName] = useState("");
  const [avatarUri, setAvatarUri] = useState(null);
  const [baseCurrency, setBaseCurrency] = useState("USD");
  const [summary, setSummary] = useState({
    expenses: 0,
    income: 0,
    investments: 0,
  });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  /* ── Data fetch ── */
  useEffect(() => {
    async function init() {
      try {
        setLoading(true);
        setLoadError("");

        const token = await AsyncStorage.getItem("token");
        if (token) api.defaults.headers.Authorization = `Bearer ${token}`;

        const storedName = (await AsyncStorage.getItem("userName")) || "";
        setName(storedName);

        const meResp = await api.get("/me");
        const rawMe = meResp?.data || {};
        const me = rawMe.user || rawMe || {};
        const detectedBaseCurrency = me.baseCurrency || "USD";
        setBaseCurrency(detectedBaseCurrency);

        if (me.name && !storedName) {
          setName(me.name);
          await AsyncStorage.setItem("userName", me.name);
        }

        const backendAvatar = me.avatarUrl || me.profilePicture || null;
        if (backendAvatar) {
          const baseURL = api.defaults.baseURL || "";
          const origin = baseURL.replace(/\/api\/?$/, "");
          const norm =
            typeof backendAvatar === "string"
              ? backendAvatar.replace(/^\/api\//, "/")
              : backendAvatar;
          const full =
            norm.startsWith("http") || norm.startsWith("file")
              ? norm
              : `${origin}${norm.startsWith("/") ? "" : "/"}${norm}`;
          setAvatarUri(full);
        } else {
          const stored = await AsyncStorage.getItem("userAvatarUri");
          if (stored) setAvatarUri(stored);
        }

        const txResp = await api.get("/transactions");
        const tx = Array.isArray(txResp.data) ? txResp.data : [];

        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        const end = new Date(
          now.getFullYear(),
          now.getMonth() + 1,
          0,
          23,
          59,
          59,
          999,
        );

        let expMinor = 0,
          incMinor = 0,
          invMinor = 0;
        for (const t of tx) {
          if (t.currency !== detectedBaseCurrency) continue;
          const d = new Date(t.date);
          if (d < start || d > end) continue;
          if (t.type === "expense") expMinor += t.amountMinor || 0;
          else if (t.type === "income") incMinor += t.amountMinor || 0;
          else if (t.type === "investment") invMinor += t.amountMinor || 0;
        }

        setSummary({
          expenses: minorToMajorNumber(expMinor, detectedBaseCurrency),
          income: minorToMajorNumber(incMinor, detectedBaseCurrency),
          investments: minorToMajorNumber(invMinor, detectedBaseCurrency),
        });
      } catch (e) {
        console.warn("Dashboard init failed:", e);
        setLoadError(
          e?.response?.data?.error ||
            e.message ||
            "Failed to load dashboard data.",
        );
        setSummary({ expenses: 0, income: 0, investments: 0 });
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  })();

  const handleCtaPress = (cta) => {
    const route = hrefToRouteName(cta?.href);
    if (route) navigation.navigate(route);
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />

      {/* ── Layered background glows — mirrors Dashboard.jsx radial-gradient ── */}
      <View pointerEvents="none" style={styles.bgLayer}>
        <View style={styles.bgGlowGreen} />
        <View style={styles.bgGlowPink} />
        <View style={styles.bgGlowBottom} />
        {/* subtle grid overlay */}
        <View style={styles.gridOverlay} />
        {/* vertical vignette */}
        <View style={styles.vignette} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── TOP BAR ── */}
        <View style={styles.topBar}>
          <Text style={styles.logoText}>Nummoria AI</Text>
          <TouchableOpacity
            style={styles.userBadge}
            activeOpacity={0.85}
            onPress={() => navigation.navigate("User")}
          >
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.userAvatar} />
            ) : (
              <Text style={styles.userInitial}>
                {(name || "You").charAt(0).toUpperCase()}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* ── GREETING ── */}
        <View style={styles.greetingBlock}>
          <Text style={styles.greetingTitle}>
            {greeting}
            {name ? `, ${name.split(" ")[0]}` : ""}
          </Text>
          <Text style={styles.greetingSubtitle}>
            Here's a clear picture of your money today.
          </Text>
        </View>

        {/* ── HERO CAROUSEL ── */}
        <View style={styles.heroWrap}>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            style={styles.heroCarousel}
            decelerationRate="fast"
            snapToInterval={width - 32 + 12}
            snapToAlignment="start"
          >
            {slides.map((slide, idx) => (
              <ImageBackground
                key={idx}
                source={
                  typeof slide.image === "string"
                    ? { uri: slide.image }
                    : slide.image
                }
                style={[styles.heroSlide, { width: width - 32 }]}
                imageStyle={styles.heroImage}
              >
                {slide.dim && <View style={styles.heroOverlay} />}
                <View style={styles.heroBottomFade} />
                <View style={styles.heroContent}>
                  <View style={styles.heroLabelPill}>
                    <View style={styles.heroLabelDot} />
                    <Text style={styles.heroLabel}>{slide.alt}</Text>
                  </View>
                  <Text style={styles.heroTitle}>{slide.title}</Text>
                  <Text style={styles.heroText}>{slide.subtitle}</Text>
                  <View style={styles.heroCtasRow}>
                    {slide.ctas?.map((cta, cIdx) => {
                      const primary = cIdx === 0;
                      return (
                        <TouchableOpacity
                          key={cta.label}
                          style={
                            primary ? styles.heroButton : styles.heroButtonGhost
                          }
                          onPress={() => handleCtaPress(cta)}
                          activeOpacity={0.85}
                        >
                          <Text
                            style={
                              primary
                                ? styles.heroButtonText
                                : styles.heroButtonGhostText
                            }
                          >
                            {cta.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              </ImageBackground>
            ))}
          </ScrollView>
        </View>

        {/* ── INTRO / SNAPSHOT — mirrors Dashboard.jsx centre section ── */}
        <View style={styles.centerIntro}>
          <View style={styles.livePill}>
            <View style={styles.livePillDot} />
            <Text style={styles.livePillText}>LIVE MONTHLY SNAPSHOT</Text>
          </View>
          <Text style={styles.snapshotTitle}>
            A clear picture of your money — instantly
          </Text>
          <Text style={styles.snapshotSubtitle}>
            From students to growing teams: track expenses, monitor income, and
            keep an eye on investments. Export, share, and stay in control.
          </Text>
        </View>

        {/* ── STATS — mirrors Dashboard.jsx StatCard grid ── */}
        {loading ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator size="small" color={SECONDARY} />
            <Text style={styles.loadingText}>Loading your numbers…</Text>
          </View>
        ) : (
          <View style={styles.statsGrid}>
            <StatCard
              title="This Month's Expenses"
              value={formatCurrency(summary.expenses, baseCurrency)}
              accent="expense"
            />
            <StatCard
              title="This Month's Income"
              value={formatCurrency(summary.income, baseCurrency)}
              accent="income"
            />
            <StatCard
              title="Invested Balance"
              value={formatCurrency(summary.investments, baseCurrency)}
              accent="invest"
            />
          </View>
        )}

        {/* ── ERROR BLOCK — mirrors Dashboard.jsx error panel ── */}
        {!!loadError && (
          <View style={styles.errorCard}>
            <View style={styles.errorIconWrap}>
              <Text style={styles.errorIconText}>!</Text>
            </View>
            <View style={styles.errorTextWrap}>
              <Text style={styles.errorTitle}>Something didn't load</Text>
              <Text style={styles.errorBody}>{loadError}</Text>
            </View>
          </View>
        )}

        {/* ── QUICK ACTIONS ── */}
        <View style={styles.sectionBlock}>
          <Text style={styles.sectionTitle}>Quick actions</Text>
          <Text style={styles.sectionSubtitle}>
            Fast access to your most used flows.
          </Text>
          <View style={styles.actionsRow}>
            <ActionChip
              label="Add expense"
              onPress={() => navigation.navigate("Expenses")}
            />
            <ActionChip
              label="Add income"
              onPress={() => navigation.navigate("Income")}
            />
            <ActionChip
              label="Open AI Mentor"
              onPress={() => navigation.navigate("Financial Helper")}
            />
          </View>
        </View>

        {/* ── AI CARD ── */}
        <View style={styles.aiCard}>
          <View style={styles.aiGlow} />
          <View style={styles.aiHairline} />
          <Text style={styles.aiTitle}>Ask Nummoria's AI mentor</Text>
          <Text style={styles.aiText}>
            "Can I afford this?", "How much should I invest this month?", or
            "What happens if I move somewhere new in 3 years?" — ask in plain
            language.
          </Text>
          <TouchableOpacity
            style={styles.aiButton}
            onPress={() => navigation.navigate("Financial Helper")}
            activeOpacity={0.85}
          >
            <Text style={styles.aiButtonText}>Chat with AI</Text>
          </TouchableOpacity>
        </View>

        {/* extra bottom clearance for the floating tab bar */}
        <View style={styles.footerSpace} />
      </ScrollView>

      {/*
        DashboardMenuFab now owns its own ITEMS list internally —
        no `items` prop needed. Just mount it.
      */}
      <DashboardMenuFab />
    </View>
  );
}

/* ──────────────────────────────────────────────────────────
   STAT CARD
   Matches web Dashboard.jsx StatCard:
   • gradient value text (approximated with SECONDARY colour on mobile)
   • ambient glow top-right
   • top hairline linear-gradient (simulated with a thin View)
   • chip pill with coloured dot
   • "Hovered" hint row at bottom
────────────────────────────────────────────────────────── */
function StatCard({ title, value, accent = "invest" }) {
  const accentMap = {
    expense: {
      glow: "rgba(153,23,70,0.20)",
      dot: EXPENSE,
      chipBg: "rgba(153,23,70,0.15)",
      chipBorder: "rgba(153,23,70,0.32)",
      chipText: "rgba(255,255,255,0.80)",
      valueColor: SECONDARY,
      hairlineL: "rgba(153,23,70,0.00)",
      hairlineM: "rgba(153,23,70,0.40)",
    },
    income: {
      glow: "rgba(19,226,67,0.16)",
      dot: INCOME,
      chipBg: "rgba(19,226,67,0.14)",
      chipBorder: "rgba(19,226,67,0.32)",
      chipText: "rgba(255,255,255,0.80)",
      valueColor: SECONDARY,
      hairlineL: "rgba(19,226,67,0.00)",
      hairlineM: "rgba(19,226,67,0.40)",
    },
    invest: {
      glow: "rgba(144,169,85,0.16)",
      dot: INVEST,
      chipBg: "rgba(255,255,255,0.05)",
      chipBorder: "rgba(255,255,255,0.12)",
      chipText: "rgba(255,255,255,0.80)",
      valueColor: SECONDARY,
      hairlineL: "rgba(255,255,255,0.00)",
      hairlineM: "rgba(255,255,255,0.18)",
    },
  };

  const a = accentMap[accent] || accentMap.invest;

  return (
    <View style={styles.statCard}>
      {/* ambient glow — top-right, always visible on mobile (no hover) */}
      <View style={[styles.statGlow, { backgroundColor: a.glow }]} />

      {/* top hairline: simulates web's linear-gradient(to right, transparent, white/18, transparent) */}
      <View style={[styles.statHairline, { backgroundColor: a.hairlineM }]} />

      {/* ── top row: label + value (left) | chip (right) ── */}
      <View style={styles.statTopRow}>
        <View style={{ flex: 1, paddingRight: 10 }}>
          <Text style={styles.statLabel}>{title}</Text>
          {/* value uses SECONDARY to approximate web's gradient text */}
          <Text style={[styles.statValue, { color: a.valueColor }]}>
            {value}
          </Text>
        </View>

        <View
          style={[
            styles.statChip,
            { backgroundColor: a.chipBg, borderColor: a.chipBorder },
          ]}
        >
          <View style={[styles.statChipDot, { backgroundColor: a.dot }]} />
          <Text style={[styles.statChipText, { color: a.chipText }]}>
            THIS MONTH
          </Text>
        </View>
      </View>

      {/* ── bottom row: hint ── */}
      <View style={styles.statBottomRow}>
        <View style={styles.statHintRow}>
          <View style={styles.statHintDot} />
          <Text style={styles.statHint}>Updated from transactions</Text>
        </View>
      </View>
    </View>
  );
}

/* ──────────────────────────────────────────────────────────
   ACTION CHIP
────────────────────────────────────────────────────────── */
function ActionChip({ label, onPress }) {
  return (
    <TouchableOpacity
      style={styles.actionChip}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <Text style={styles.actionChipLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

/* ──────────────────────────────────────────────────────────
   STYLES
────────────────────────────────────────────────────────── */
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG_DARK,
  },

  /* ── background layers ── */
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
    left: width * 0.2,
    width: 260,
    height: 260,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  gridOverlay: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.04,
    backgroundColor: "transparent",
  },
  /* top-to-bottom vignette — mirrors Dashboard.jsx bg-gradient-to-b */
  vignette: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "transparent",
    // React Native can't do a proper gradient without expo-linear-gradient;
    // keep it lightweight — the glow orbs provide the atmosphere already.
  },

  /* ── scroll ── */
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 52,
    paddingBottom: 42,
  },

  /* ── top bar ── */
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  logoText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#e5e7eb",
    letterSpacing: 0.2,
  },
  userBadge: {
    width: 42,
    height: 42,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: CARD_BORDER,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  userAvatar: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  userInitial: {
    fontSize: 16,
    fontWeight: "700",
    color: SECONDARY,
  },

  /* ── greeting ── */
  greetingBlock: { marginBottom: 14 },
  greetingTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: TEXT_PRIMARY,
    letterSpacing: -0.4,
  },
  greetingSubtitle: {
    marginTop: 5,
    fontSize: 13,
    color: TEXT_MUTED,
  },

  /* ── hero carousel ── */
  heroWrap: { marginBottom: 24 },
  heroCarousel: { overflow: "visible" },
  heroSlide: {
    height: 250,
    borderRadius: 28,
    overflow: "hidden",
    marginRight: 12,
    backgroundColor: "#0b1110",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  heroImage: { resizeMode: "cover" },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.34)",
  },
  heroBottomFade: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 110,
    backgroundColor: "rgba(7,10,7,0.36)",
  },
  heroContent: {
    flex: 1,
    justifyContent: "flex-end",
    padding: 18,
  },
  heroLabelPill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 10,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  heroLabelDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    backgroundColor: SECONDARY,
  },
  heroLabel: { fontSize: 11, color: "#f3f4f6", fontWeight: "600" },
  heroTitle: {
    fontSize: 24,
    lineHeight: 28,
    fontWeight: "800",
    color: "#ffffff",
    marginBottom: 6,
    letterSpacing: -0.5,
  },
  heroText: {
    fontSize: 13,
    lineHeight: 18,
    color: "rgba(255,255,255,0.86)",
    marginBottom: 12,
    maxWidth: "95%",
  },
  heroCtasRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  heroButton: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: SECONDARY,
  },
  heroButtonText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0b1110",
    letterSpacing: 0.2,
  },
  heroButtonGhost: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  heroButtonGhostText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#f3f4f6",
    letterSpacing: 0.2,
  },

  /* ── intro / snapshot ── */
  centerIntro: {
    alignItems: "center",
    marginBottom: 18,
    paddingHorizontal: 8,
  },
  livePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: CARD_BORDER,
    marginBottom: 12,
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
  snapshotTitle: {
    fontSize: 23,
    lineHeight: 28,
    fontWeight: "800",
    color: TEXT_PRIMARY,
    textAlign: "center",
    letterSpacing: -0.45,
  },
  snapshotSubtitle: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    color: TEXT_MUTED,
    textAlign: "center",
    maxWidth: 340,
  },

  /* ── loading ── */
  loadingCard: {
    marginTop: 4,
    marginBottom: 20,
    borderRadius: 22,
    padding: 16,
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  loadingText: { fontSize: 13, color: TEXT_MUTED },

  /* ── stats grid ── */
  statsGrid: { marginTop: 4, marginBottom: 20 },

  /* stat card */
  statCard: {
    position: "relative",
    overflow: "hidden",
    borderRadius: 24,
    padding: 20,
    marginBottom: 12,
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: CARD_BORDER,
  },
  statGlow: {
    position: "absolute",
    top: -36,
    right: -24,
    width: 150,
    height: 150,
    borderRadius: 999,
  },
  /* hairline simulates web's linear-gradient(to right, transparent, rgba(255,255,255,0.18), transparent) */
  statHairline: {
    position: "absolute",
    top: 0,
    left: "15%",
    right: "15%",
    height: 1,
    opacity: 0.7,
    borderRadius: 999,
  },
  statTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
    marginTop: 4,
  },
  statLabel: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1,
    color: TEXT_SOFT,
  },
  statValue: {
    marginTop: 8,
    fontSize: 32,
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
  statChipDot: { width: 7, height: 7, borderRadius: 999 },
  statChipText: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  statBottomRow: {
    marginTop: 16,
    paddingTop: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
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
  statHint: { fontSize: 12, color: TEXT_SOFT },

  /* ── error card ── */
  errorCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    borderRadius: 22,
    padding: 14,
    marginBottom: 20,
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
  errorIconText: { fontSize: 16, color: "#f87171" },
  errorTextWrap: { flex: 1 },
  errorTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: TEXT_PRIMARY,
    marginBottom: 4,
  },
  errorBody: { fontSize: 13, color: TEXT_MUTED, lineHeight: 18 },

  /* ── quick actions ── */
  sectionBlock: { marginBottom: 18 },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: TEXT_PRIMARY,
    marginBottom: 4,
  },
  sectionSubtitle: { fontSize: 13, color: TEXT_MUTED, marginBottom: 12 },
  actionsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  actionChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: CARD_BORDER,
  },
  actionChipLabel: { fontSize: 13, color: "#f3f4f6", fontWeight: "600" },

  /* ── AI card ── */
  aiCard: {
    position: "relative",
    overflow: "hidden",
    borderRadius: 24,
    padding: 20,
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: "rgba(144,169,85,0.20)",
  },
  aiGlow: {
    position: "absolute",
    top: -20,
    right: -10,
    width: 160,
    height: 160,
    borderRadius: 999,
    backgroundColor: "rgba(144,169,85,0.12)",
  },
  aiHairline: {
    position: "absolute",
    top: 0,
    left: "15%",
    right: "15%",
    height: 1,
    backgroundColor: "rgba(144,169,85,0.45)",
    opacity: 0.7,
    borderRadius: 999,
  },
  aiTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: TEXT_PRIMARY,
    marginBottom: 6,
  },
  aiText: {
    fontSize: 13,
    lineHeight: 19,
    color: TEXT_MUTED,
    marginBottom: 16,
  },
  aiButton: {
    alignSelf: "flex-start",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: SECONDARY,
  },
  aiButtonText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0b1110",
  },

  /* extra bottom padding so content isn't hidden behind the floating tab bar */
  footerSpace: { height: 100 },
});
