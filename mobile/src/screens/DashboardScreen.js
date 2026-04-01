// mobile/src/screens/DashboardScreen.js
import React, { useEffect, useState } from "react";
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

const { width, height } = Dimensions.get("window");

/* ─────────────────────────────────────────────────────────────
   PALETTE  — synced with DashboardMenuFab
───────────────────────────────────────────────────────────── */
const BG = "#030508";
const MINT = "#00ff87";
const CYAN = "#00d4ff";
const VIOLET = "#a78bfa";
const CARD_BG = "rgba(255,255,255,0.025)";
const CARD_BD = "rgba(255,255,255,0.07)";
const T_HI = "#e2e8f0";
const T_MID = "rgba(226,232,240,0.55)";
const T_DIM = "rgba(226,232,240,0.32)";

const ACC = {
  expense: {
    color: VIOLET,
    glow: "rgba(167,139,250,0.10)",
    bd: "rgba(167,139,250,0.22)",
  },
  income: {
    color: MINT,
    glow: "rgba(0,255,135,0.08)",
    bd: "rgba(0,255,135,0.22)",
  },
  invest: {
    color: CYAN,
    glow: "rgba(0,212,255,0.09)",
    bd: "rgba(0,212,255,0.22)",
  },
};

/* ─────────────────────────────────────────────────────────────
   LOCAL ASSET
───────────────────────────────────────────────────────────── */
const seeItImg = require("../../assets/nummoria_logo.png");

/* ─────────────────────────────────────────────────────────────
   SLIDES
───────────────────────────────────────────────────────────── */
const slides = [
  {
    image: seeItImg,
    label: "SYSTEM OVERVIEW",
    title: "See it. Track it.",
    subtitle: "Real-time visibility into cash flow, spending, and investments.",
    ctas: [
      { label: "GET ADVICE", href: "/ai/financial-advice" },
      { label: "VIEW REPORTS", href: "/reports" },
    ],
  },
  {
    image:
      "https://images.unsplash.com/photo-1553729784-e91953dec042?w=1920&q=80&auto=format&fit=crop",
    label: "ANALYTICS ENGINE",
    title: "A clear picture — instantly",
    subtitle: "Track expenses, monitor income, keep an eye on investments.",
    ctas: [{ label: "OPEN DASHBOARD", href: "/reports" }],
  },
  {
    image:
      "https://images.unsplash.com/photo-1554224155-1696413565d3?w=1920&q=80&auto=format&fit=crop",
    label: "EXPENSE CONTROL",
    title: "Control your spending",
    subtitle: "Categorize, filter by date, and export with one tap.",
    ctas: [{ label: "GO TO EXPENSES", href: "/expenses" }],
  },
  {
    image:
      "https://images.unsplash.com/photo-1517148815978-75f6acaaf32c?w=1920&q=80&auto=format&fit=crop",
    label: "INVESTMENT MODULE",
    title: "Invest with clarity",
    subtitle: "Positions, P&L, and performance in one clean view.",
    ctas: [{ label: "VIEW INVESTMENTS", href: "/investments/performance" }],
  },
  {
    image:
      "https://images.unsplash.com/photo-1550547660-d9450f859349?w=1920&q=80&auto=format&fit=crop",
    label: "AI FINANCIAL MENTOR",
    title: "Want fries with that?",
    subtitle: "Let the AI mentor decode everyday spending tradeoffs.",
    ctas: [{ label: "AI FINANCIAL MENTOR", href: "/ai/financial-helper" }],
  },
];

/* ─────────────────────────────────────────────────────────────
   MONEY HELPERS
───────────────────────────────────────────────────────────── */
function decimals(code) {
  if (["JPY", "KRW", "CLP", "VND"].includes(code)) return 0;
  if (["BHD", "IQD", "JOD", "KWD", "OMR", "TND"].includes(code)) return 3;
  return 2;
}
function minorToMajor(minor, currency) {
  return minor / Math.pow(10, decimals(currency));
}
function fmtCurrency(n, currency = "USD") {
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

/* ─────────────────────────────────────────────────────────────
   ROUTE MAP
───────────────────────────────────────────────────────────── */
function routeFor(href) {
  const map = {
    "/ai/financial-advice": "Financial Helper",
    "/ai/financial-helper": "Financial Helper",
    "/reports": "Reports",
    "/expenses": "Expenses",
    "/income": "Income",
    "/investments": "Investments",
    "/investments/performance": "InvestmentPerformance",
  };
  return map[href] || null;
}

/* ─────────────────────────────────────────────────────────────
   CORNER BRACKET DECORATOR
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
            },
            d,
          ]}
        />
      ))}
    </>
  );
}

/* ─────────────────────────────────────────────────────────────
   SCAN LINE DIVIDER
───────────────────────────────────────────────────────────── */
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

/* ─────────────────────────────────────────────────────────────
   BACKGROUND GRID  — replaces the blobby glows entirely
───────────────────────────────────────────────────────────── */
function GridBG() {
  const COLS = 10;
  const ROWS = 22;
  const cw = width / COLS;
  const rh = height / ROWS;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {/* horizontal grid lines */}
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
      {/* vertical grid lines */}
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
      {/* top neon stripe */}
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
      {/* mid accent line */}
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
      {/* bottom accent */}
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

/* ─────────────────────────────────────────────────────────────
   STAT CARD
───────────────────────────────────────────────────────────── */
function StatCard({ title, value, accent = "invest" }) {
  const a = ACC[accent] || ACC.invest;
  return (
    <View style={[sc.card, { borderColor: a.bd, backgroundColor: a.glow }]}>
      <Brackets color={a.color} size={10} thick={1.5} />
      <View style={[sc.hairline, { backgroundColor: a.color }]} />

      <View style={[sc.badge, { borderColor: a.bd }]}>
        <View style={[sc.badgeDot, { backgroundColor: a.color }]} />
        <Text style={[sc.badgeTxt, { color: a.color }]}>THIS MONTH</Text>
      </View>

      <Text style={sc.label}>{title}</Text>
      <Text style={[sc.value, { color: a.color }]}>{value}</Text>

      <ScanLine color={a.color} style={{ marginTop: 14 }} />
      <Text style={sc.hint}>Updated from transactions</Text>
    </View>
  );
}
const sc = StyleSheet.create({
  card: {
    position: "relative",
    borderRadius: 4,
    borderWidth: 1,
    padding: 18,
    marginBottom: 10,
    overflow: "hidden",
  },
  hairline: {
    position: "absolute",
    top: 0,
    left: "10%",
    right: "10%",
    height: 1.5,
    opacity: 0.65,
  },
  badge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 2,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginBottom: 12,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  badgeDot: { width: 5, height: 5, borderRadius: 999 },
  badgeTxt: { fontSize: 9, fontWeight: "800", letterSpacing: 1.4 },
  label: {
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 1.2,
    color: T_DIM,
    marginBottom: 6,
  },
  value: {
    fontSize: 34,
    fontWeight: "700",
    letterSpacing: -1,
  },
  hint: { fontSize: 10, color: T_DIM, marginTop: 6, letterSpacing: 0.3 },
});

/* ─────────────────────────────────────────────────────────────
   ACTION CHIP
───────────────────────────────────────────────────────────── */
function ActionChip({ label, accent = CYAN, onPress }) {
  return (
    <TouchableOpacity
      style={[cp.root, { borderColor: accent + "44" }]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <View style={[cp.dot, { backgroundColor: accent }]} />
      <Text style={[cp.label, { color: accent }]}>{label}</Text>
    </TouchableOpacity>
  );
}
const cp = StyleSheet.create({
  root: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 2,
    borderWidth: 1,
    backgroundColor: "rgba(255,255,255,0.025)",
  },
  dot: { width: 5, height: 5, borderRadius: 999 },
  label: { fontSize: 12, fontWeight: "700", letterSpacing: 0.4 },
});

/* ─────────────────────────────────────────────────────────────
   SCREEN
───────────────────────────────────────────────────────────── */
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
        const bc = me.baseCurrency || "USD";
        setBaseCurrency(bc);

        if (me.name && !storedName) {
          setName(me.name);
          await AsyncStorage.setItem("userName", me.name);
        }

        const backendAvatar = me.avatarUrl || me.profilePicture || null;
        if (backendAvatar) {
          const origin = (api.defaults.baseURL || "").replace(/\/api\/?$/, "");
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

        const { data } = await api.get("/transactions");
        const tx = Array.isArray(data) ? data : [];
        const now = new Date();
        const s0 = new Date(now.getFullYear(), now.getMonth(), 1);
        const s1 = new Date(
          now.getFullYear(),
          now.getMonth() + 1,
          0,
          23,
          59,
          59,
          999,
        );

        let expM = 0,
          incM = 0,
          invM = 0;
        for (const t of tx) {
          if (t.currency !== bc) continue;
          const d = new Date(t.date);
          if (d < s0 || d > s1) continue;
          if (t.type === "expense") expM += t.amountMinor || 0;
          else if (t.type === "income") incM += t.amountMinor || 0;
          else if (t.type === "investment") invM += t.amountMinor || 0;
        }

        setSummary({
          expenses: minorToMajor(expM, bc),
          income: minorToMajor(incM, bc),
          investments: minorToMajor(invM, bc),
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
    if (h < 12) return "GOOD MORNING";
    if (h < 18) return "GOOD AFTERNOON";
    return "GOOD EVENING";
  })();

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={BG} />

      {/* ── Geometric grid — no blobs ── */}
      <GridBG />

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
      >
        {/* ── TOP BAR ── */}
        <View style={s.topBar}>
          <View style={s.logoRow}>
            <View style={[s.statusDot, { backgroundColor: MINT }]} />
            <Text style={s.logoText}>NUMMORIA</Text>
            <View style={s.livePill}>
              <Text style={s.livePillTxt}>LIVE</Text>
            </View>
          </View>

          <TouchableOpacity
            style={s.avatarBtn}
            onPress={() => navigation.navigate("User")}
            activeOpacity={0.8}
          >
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={s.avatarImg} />
            ) : (
              <Text style={s.avatarInitial}>
                {(name || "Y").charAt(0).toUpperCase()}
              </Text>
            )}
            <Brackets color={MINT} size={8} thick={1} />
          </TouchableOpacity>
        </View>

        {/* ── GREETING ── */}
        <View style={s.greetBlock}>
          <Text style={s.greetLabel}>{greeting}</Text>
          <Text style={s.greetName}>
            {name ? name.split(" ")[0] : "Operator"}
          </Text>
          <ScanLine color={CYAN} style={{ marginTop: 10 }} />
        </View>

        {/* ── HERO CAROUSEL ── */}
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          style={{ marginBottom: 28 }}
          decelerationRate="fast"
          snapToInterval={width - 32 + 10}
          snapToAlignment="start"
        >
          {slides.map((slide, idx) => (
            <View key={idx} style={{ width: width - 32, marginRight: 10 }}>
              <ImageBackground
                source={
                  typeof slide.image === "string"
                    ? { uri: slide.image }
                    : slide.image
                }
                style={s.heroImg}
                imageStyle={{ resizeMode: "cover" }}
              >
                <View style={s.heroScrim} />
                {/* horizontal scan pulse at 60% height */}
                <View style={[s.heroScan, { top: "60%" }]} />
                {/* thin neon bottom border */}
                <View style={[s.heroBorderBottom, { backgroundColor: MINT }]} />

                <View style={s.heroContent}>
                  <View style={s.heroModulePill}>
                    <View
                      style={[s.heroModuleDot, { backgroundColor: MINT }]}
                    />
                    <Text style={[s.heroModuleTxt, { color: MINT }]}>
                      {slide.label}
                    </Text>
                  </View>
                  <Text style={s.heroTitle}>{slide.title}</Text>
                  <Text style={s.heroSubtitle}>{slide.subtitle}</Text>
                  <View
                    style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}
                  >
                    {slide.ctas.map((cta, ci) => (
                      <TouchableOpacity
                        key={ci}
                        style={ci === 0 ? s.ctaPrimary : s.ctaGhost}
                        onPress={() => {
                          const r = routeFor(cta.href);
                          if (r) navigation.navigate(r);
                        }}
                        activeOpacity={0.8}
                      >
                        <Text
                          style={ci === 0 ? s.ctaPrimaryTxt : s.ctaGhostTxt}
                        >
                          {cta.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <Brackets color={MINT} size={14} thick={1.5} />
              </ImageBackground>
            </View>
          ))}
        </ScrollView>

        {/* ── SECTION HEADER ── */}
        <View style={s.sectionRow}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View style={[s.sectionDot, { backgroundColor: MINT }]} />
            <Text style={s.sectionLabel}>LIVE MONTHLY SNAPSHOT</Text>
          </View>
          <Text style={s.sectionMeta}>
            {new Date()
              .toLocaleString("default", { month: "short" })
              .toUpperCase()}{" "}
            {new Date().getFullYear()}
          </Text>
        </View>

        <Text style={s.snapshotH}>
          A clear picture of your money — instantly
        </Text>
        <Text style={s.snapshotP}>
          Track expenses, monitor income, and keep an eye on investments.
        </Text>

        {/* ── STATS ── */}
        {loading ? (
          <View style={s.loadRow}>
            <ActivityIndicator size="small" color={MINT} />
            <Text style={s.loadTxt}>Fetching financial data…</Text>
          </View>
        ) : (
          <View style={{ marginBottom: 20 }}>
            <StatCard
              title="This Month's Expenses"
              value={fmtCurrency(summary.expenses, baseCurrency)}
              accent="expense"
            />
            <StatCard
              title="This Month's Income"
              value={fmtCurrency(summary.income, baseCurrency)}
              accent="income"
            />
            <StatCard
              title="Invested Balance"
              value={fmtCurrency(summary.investments, baseCurrency)}
              accent="invest"
            />
          </View>
        )}

        {/* ── ERROR ── */}
        {!!loadError && (
          <View style={s.errorCard}>
            <Brackets color={VIOLET} size={8} thick={1} />
            <View style={s.errorIcon}>
              <Text style={[s.errorIconTxt, { color: VIOLET }]}>!</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.errorTitle}>Something didn't load</Text>
              <Text style={s.errorBody}>{loadError}</Text>
            </View>
          </View>
        )}

        {/* ── QUICK ACTIONS ── */}
        <View style={{ marginBottom: 20 }}>
          <View style={s.sectionRow}>
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
            >
              <View style={[s.sectionDot, { backgroundColor: CYAN }]} />
              <Text style={s.sectionLabel}>QUICK ACTIONS</Text>
            </View>
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <ActionChip
              label="Add expense"
              accent={VIOLET}
              onPress={() => navigation.navigate("Expenses")}
            />
            <ActionChip
              label="Add income"
              accent={MINT}
              onPress={() => navigation.navigate("Income")}
            />
            <ActionChip
              label="AI Mentor"
              accent={CYAN}
              onPress={() => navigation.navigate("Financial Helper")}
            />
          </View>
        </View>

        {/* ── AI CARD ── */}
        <View style={s.aiCard}>
          <Brackets color={CYAN} size={12} thick={1.5} />
          <View style={[s.aiHairline, { backgroundColor: CYAN }]} />

          <View style={{ flexDirection: "row", padding: 20, gap: 14 }}>
            {/* vertical left stripe */}
            <View style={[s.aiStripe, { backgroundColor: CYAN }]} />

            <View style={{ flex: 1 }}>
              <Text style={[s.aiOverline, { color: CYAN }]}>
                AI FINANCIAL MENTOR
              </Text>
              <Text style={s.aiTitle}>Ask Nummoria's{"\n"}AI mentor</Text>
              <Text style={s.aiBody}>
                "Can I afford this?", "How much should I invest?", or "What
                happens if I move in 3 years?" — ask in plain language.
              </Text>
              <TouchableOpacity
                style={[s.aiBtn, { backgroundColor: CYAN }]}
                onPress={() => navigation.navigate("Financial Helper")}
                activeOpacity={0.8}
              >
                <Text style={s.aiBtnTxt}>INITIATE CHAT</Text>
                <View style={[s.aiBtnDot, { backgroundColor: BG }]} />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View style={{ height: 110 }} />
      </ScrollView>

      {/* DashboardMenuFab owns its ITEMS list internally — no props needed */}
      <DashboardMenuFab />
    </View>
  );
}

/* ─────────────────────────────────────────────────────────────
   STYLES
───────────────────────────────────────────────────────────── */
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 54, paddingBottom: 36 },

  /* top bar */
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  logoRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  statusDot: { width: 6, height: 6, borderRadius: 999 },
  logoText: { fontSize: 15, fontWeight: "800", color: T_HI, letterSpacing: 3 },
  livePill: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 2,
    backgroundColor: "rgba(0,255,135,0.12)",
    borderWidth: 1,
    borderColor: "rgba(0,255,135,0.25)",
  },
  livePillTxt: {
    fontSize: 8,
    fontWeight: "800",
    color: MINT,
    letterSpacing: 1.5,
  },

  avatarBtn: {
    width: 40,
    height: 40,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(0,255,135,0.20)",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    position: "relative",
  },
  avatarImg: { width: "100%", height: "100%", resizeMode: "cover" },
  avatarInitial: { fontSize: 16, fontWeight: "700", color: MINT },

  /* greeting */
  greetBlock: { marginBottom: 24 },
  greetLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: MINT,
    letterSpacing: 3,
    marginBottom: 4,
  },
  greetName: {
    fontSize: 30,
    fontWeight: "800",
    color: T_HI,
    letterSpacing: -0.5,
  },

  /* hero */
  heroImg: {
    height: 242,
    borderRadius: 4,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(0,255,135,0.15)",
    position: "relative",
    justifyContent: "flex-end",
  },
  heroScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(3,5,8,0.55)",
  },
  heroScan: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: MINT,
    opacity: 0.12,
  },
  heroBorderBottom: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 1.5,
    opacity: 0.4,
  },
  heroContent: { padding: 16 },
  heroModulePill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 9,
    paddingVertical: 5,
    marginBottom: 10,
    borderRadius: 2,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderWidth: 1,
    borderColor: "rgba(0,255,135,0.22)",
  },
  heroModuleDot: { width: 5, height: 5, borderRadius: 999 },
  heroModuleTxt: { fontSize: 9, fontWeight: "800", letterSpacing: 1.5 },
  heroTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#fff",
    marginBottom: 5,
    letterSpacing: -0.4,
    lineHeight: 26,
  },
  heroSubtitle: {
    fontSize: 12,
    color: "rgba(255,255,255,0.72)",
    lineHeight: 17,
    marginBottom: 12,
    maxWidth: "90%",
  },
  ctaPrimary: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 2,
    backgroundColor: MINT,
  },
  ctaPrimaryTxt: {
    fontSize: 10,
    fontWeight: "800",
    color: BG,
    letterSpacing: 1,
  },
  ctaGhost: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  ctaGhostTxt: {
    fontSize: 10,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: 1,
  },

  /* section header */
  sectionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  sectionDot: { width: 5, height: 5, borderRadius: 999 },
  sectionLabel: {
    fontSize: 9,
    fontWeight: "800",
    color: T_DIM,
    letterSpacing: 2,
  },
  sectionMeta: {
    fontSize: 9,
    fontWeight: "700",
    color: T_DIM,
    letterSpacing: 1.5,
  },
  snapshotH: {
    fontSize: 22,
    fontWeight: "800",
    color: T_HI,
    letterSpacing: -0.4,
    marginBottom: 6,
  },
  snapshotP: { fontSize: 13, color: T_MID, lineHeight: 18, marginBottom: 20 },

  /* loading */
  loadRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 16,
    marginBottom: 16,
    borderRadius: 4,
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: CARD_BD,
  },
  loadTxt: { fontSize: 12, color: T_DIM, letterSpacing: 0.5 },

  /* error */
  errorCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    borderRadius: 4,
    padding: 14,
    marginBottom: 20,
    backgroundColor: "rgba(167,139,250,0.06)",
    borderWidth: 1,
    borderColor: "rgba(167,139,250,0.22)",
    position: "relative",
    overflow: "hidden",
  },
  errorIcon: {
    width: 36,
    height: 36,
    borderRadius: 2,
    backgroundColor: "rgba(167,139,250,0.18)",
    borderWidth: 1,
    borderColor: "rgba(167,139,250,0.30)",
    alignItems: "center",
    justifyContent: "center",
  },
  errorIconTxt: { fontSize: 16, fontWeight: "800" },
  errorTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: T_HI,
    marginBottom: 3,
    letterSpacing: 0.3,
  },
  errorBody: { fontSize: 12, color: T_MID, lineHeight: 17 },

  /* AI card */
  aiCard: {
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "rgba(0,212,255,0.22)",
    backgroundColor: "rgba(0,212,255,0.04)",
    overflow: "hidden",
    position: "relative",
  },
  aiHairline: {
    position: "absolute",
    top: 0,
    left: "10%",
    right: "10%",
    height: 1.5,
    opacity: 0.6,
  },
  aiStripe: { width: 2, borderRadius: 999, opacity: 0.7, alignSelf: "stretch" },
  aiOverline: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 2,
    marginBottom: 6,
  },
  aiTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: T_HI,
    letterSpacing: -0.3,
    lineHeight: 24,
    marginBottom: 10,
  },
  aiBody: { fontSize: 12, color: T_MID, lineHeight: 18, marginBottom: 16 },
  aiBtn: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 2,
  },
  aiBtnTxt: { fontSize: 10, fontWeight: "800", color: BG, letterSpacing: 1.2 },
  aiBtnDot: { width: 5, height: 5, borderRadius: 999 },
});
