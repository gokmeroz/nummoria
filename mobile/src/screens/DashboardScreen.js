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

// ✅ NEW: Radial menu FAB
import RadialMenuFab from "../components/RadialMenuFab";

const { width } = Dimensions.get("window");

const BG_DARK = "#020617";
const CARD_DARK = "#020819";
const BRAND_GREEN = "#16a34a";
const BRAND_GREEN_SOFT = "rgba(22,163,74,0.15)";
const TEXT_MUTED = "rgba(148,163,184,1)";
const TEXT_SOFT = "rgba(148,163,184,0.8)";

// ✅ FIX: asset is in mobile/assets (DashboardScreen is mobile/src/screens)
// Path: mobile/src/screens -> ../../assets
const seeItImg = require("../../assets/nummoria_logo.png");

// 🔥 Slides config, mirroring your web `slides` array
const slides = [
  {
    image: seeItImg,
    alt: "Finance background",
    title: "See it. Track it.",
    subtitle:
      "Real-time visibility into your cash flow, spending, and investments — all in one place. Stay compliant with your own rules and never miss a beat.",
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
    ctas: [{ label: "Open Dashboard", href: "/reports" }],
    dim: true,
  },
  {
    image:
      "https://images.unsplash.com/photo-1554224155-1696413565d3?w=1920&q=80&auto=format&fit=crop",
    alt: "Wallet & receipts",
    title: "Control your spending",
    subtitle: "Categorize, filter by date, and export with one click.",
    ctas: [{ label: "Go to Expenses", href: "/expenses" }],
    dim: true,
  },
  {
    image:
      "https://images.unsplash.com/photo-1517148815978-75f6acaaf32c?w=1920&q=80&auto=format&fit=crop",
    alt: "Stock market display",
    title: "Invest with clarity",
    subtitle: "Positions, P&L, and performance in one clean view.",
    ctas: [{ label: "View Investments", href: "/investments/performance" }],
    dim: true,
  },
  {
    image:
      "https://images.unsplash.com/photo-1550547660-d9450f859349?w=1920&q=80&auto=format&fit=crop",
    alt: "Hamburger meal display",
    title: "Want fries with that?",
    subtitle: "Check out our new AI based advicer if it is healthy for ya!.",
    ctas: [{ label: "AI Financial Mentor", href: "/ai/financial-helper" }],
    dim: true,
  },
];

// ---------- currency helpers ----------
function decimalsForCurrency(code) {
  const zero = new Set(["JPY", "KRW", "CLP", "VND"]);
  const three = new Set(["BHD", "IQD", "JOD", "KWD", "OMR", "TND"]);
  if (zero.has(code)) return 0;
  if (three.has(code)) return 3;
  return 2;
}
function minorToMajorNumber(minor, currency) {
  const d = decimalsForCurrency(currency);
  return minor / Math.pow(10, d);
}

function formatMoney(n, prefix = "$") {
  if (typeof n !== "number" || Number.isNaN(n)) return `${prefix}0`;
  return `${prefix}${Number(n).toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

// 🔗 Map web-style hrefs → React Navigation route names
function hrefToRouteName(href) {
  if (!href) return null;

  switch (href) {
    case "/ai/financial-advice":
    case "/ai/financial-helper":
      return "Financial Helper";

    case "/reports":
    case "Reports":
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

export default function DashboardScreen() {
  const navigation = useNavigation();

  const [name, setName] = useState("");
  const [avatarUri, setAvatarUri] = useState(null);
  const [summary, setSummary] = useState({
    expenses: 0,
    income: 0,
    investments: 0,
  });
  const [loading, setLoading] = useState(true);

  const radialItems = useMemo(
    () => [
      {
        key: "reports",
        icon: "📄",
        title: "Reports",
        onPress: () => navigation.navigate("Reports"),
      },
      {
        key: "investments",
        icon: "📈",
        title: "Investments",
        onPress: () => navigation.navigate("Investments"),
      },
      {
        key: "income",
        icon: "💰",
        title: "Income",
        onPress: () => navigation.navigate("Income"),
      },
      {
        key: "expenses",
        icon: "💸",
        title: "Expenses",
        onPress: () => navigation.navigate("Expenses"),
      },
      {
        key: "aiMentor",
        icon: "🤖",
        title: "AI Helper",
        onPress: () => navigation.navigate("Financial Helper"),
      },
    ],
    [navigation]
  );

  useEffect(() => {
    async function init() {
      try {
        setLoading(true);

        // 🔑 token + default header for shared api
        const token = await AsyncStorage.getItem("token");
        if (token) {
          api.defaults.headers.Authorization = `Bearer ${token}`;
        }

        // name from AsyncStorage (fallback)
        const storedName = (await AsyncStorage.getItem("userName")) || "";
        setName(storedName);

        // ── fetch /me to get baseCurrency, name & avatar ──
        const meResp = await api.get("/me");
        const rawMe = meResp?.data || {};
        const me = rawMe.user || rawMe || {};
        const baseCurrency = me.baseCurrency || "USD";

        if (me.name && !storedName) {
          setName(me.name);
          await AsyncStorage.setItem("userName", me.name);
        }

        // avatar: backend first, then local cache
        const backendAvatar = me.avatarUrl || me.profilePicture || null;

        // ✅ NEW: debug logs so device tells you what's wrong
        console.log("Dashboard /me baseURL:", api.defaults.baseURL);
        console.log("Dashboard /me backendAvatar:", backendAvatar);

        if (backendAvatar) {
          const baseURL = api.defaults.baseURL || "";
          const origin = baseURL.replace(/\/api\/?$/, ""); // strips trailing /api

          // Normalize backend path if it accidentally contains /api prefix
          const normalizedAvatar =
            typeof backendAvatar === "string"
              ? backendAvatar.replace(/^\/api\//, "/")
              : backendAvatar;

          const full =
            normalizedAvatar.startsWith("http") ||
            normalizedAvatar.startsWith("file")
              ? normalizedAvatar
              : `${origin}${
                  normalizedAvatar.startsWith("/") ? "" : "/"
                }${normalizedAvatar}`;

          console.log("Dashboard /me final avatarUri:", full);
          setAvatarUri(full);
        } else {
          const storedAvatar = await AsyncStorage.getItem("userAvatarUri");
          if (storedAvatar) setAvatarUri(storedAvatar);
        }

        // ── fetch /transactions ──
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
          999
        );

        let expMinor = 0;
        let incMinor = 0;
        let invMinor = 0;

        for (const t of tx) {
          if (t.currency !== baseCurrency) continue;
          const d = new Date(t.date);
          if (d < start || d > end) continue;

          if (t.type === "expense") expMinor += t.amountMinor || 0;
          else if (t.type === "income") incMinor += t.amountMinor || 0;
          else if (t.type === "investment") invMinor += t.amountMinor || 0;
        }

        setSummary({
          expenses: minorToMajorNumber(expMinor, baseCurrency),
          income: minorToMajorNumber(incMinor, baseCurrency),
          investments: minorToMajorNumber(invMinor, baseCurrency),
        });
      } catch (e) {
        console.warn("Dashboard init failed:", e);
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
    const routeName = hrefToRouteName(cta?.href);
    if (!routeName) {
      console.warn("No route mapped for CTA href:", cta?.href);
      return;
    }
    navigation.navigate(routeName);
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topBar}>
          <Text style={styles.logoText}>Nummoria AI</Text>
          <TouchableOpacity
            style={styles.userBadge}
            activeOpacity={0.8}
            onPress={() => navigation.navigate("User")}
          >
            {avatarUri ? (
              <Image
                source={{ uri: avatarUri }}
                style={styles.userAvatar}
                // ✅ NEW: log why it fails on device (localhost, 404, ATS, etc.)
                onError={(e) =>
                  console.warn("Avatar failed to load:", {
                    avatarUri,
                    error: e?.nativeEvent,
                  })
                }
              />
            ) : (
              <Text style={styles.userInitial}>
                {(name || "You").charAt(0).toUpperCase()}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Greeting */}
        <View style={styles.greetingBlock}>
          <Text style={styles.greetingTitle}>
            {greeting}
            {name ? `, ${name.split(" ")[0]}` : ""} 👋
          </Text>
          <Text style={styles.greetingSubtitle}>
            Here's a clear picture of your money today.
          </Text>
        </View>

        {/* Hero carousel */}
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          style={styles.heroCarousel}
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
              <View style={styles.heroContent}>
                <Text style={styles.heroLabel}>{slide.alt}</Text>
                <Text style={styles.heroTitle}>{slide.title}</Text>
                <Text style={styles.heroText}>{slide.subtitle}</Text>

                <View style={styles.heroCtasRow}>
                  {slide.ctas?.map((cta, cIdx) => {
                    const primary = cIdx === 0;
                    return (
                      <TouchableOpacity
                        key={cta.label}
                        style={
                          primary ? styles.heroButton : styles.heroButtonOutline
                        }
                        onPress={() => handleCtaPress(cta)}
                        activeOpacity={0.8}
                      >
                        <Text
                          style={
                            primary
                              ? styles.heroButtonText
                              : styles.heroButtonOutlineText
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

        {/* Summary section */}
        <View style={styles.sectionHeaderRow}>
          <View>
            <Text style={styles.sectionTitle}>
              A clear picture of your money
            </Text>
            <Text style={styles.sectionSubtitle}>
              This month's snapshot across expenses, income, and investments.
            </Text>
          </View>
        </View>

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="small" color={BRAND_GREEN} />
            <Text style={styles.loadingText}>Loading your numbers…</Text>
          </View>
        ) : (
          <View style={styles.summaryGrid}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>This Month's Expenses</Text>
              <Text style={[styles.summaryValue, styles.expenseValue]}>
                {formatMoney(summary.expenses, "$")}
              </Text>
              <Text style={styles.summaryHint}>
                Keep an eye on lifestyle creep.
              </Text>
            </View>

            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>This Month's Income</Text>
              <Text style={[styles.summaryValue, styles.incomeValue]}>
                {formatMoney(summary.income, "$")}
              </Text>
              <Text style={styles.summaryHint}>
                Aim for a positive savings rate every month.
              </Text>
            </View>

            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Invested Balance</Text>
              <Text style={[styles.summaryValue, styles.investValue]}>
                {formatMoney(summary.investments, "$")}
              </Text>
              <Text style={styles.summaryHint}>
                Long-term money working quietly in the background.
              </Text>
            </View>
          </View>
        )}

        {/* Quick actions */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Quick actions</Text>
        </View>

        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.actionChip}
            onPress={() => navigation.navigate("Expenses")}
          >
            <Text style={styles.actionChipLabel}>Add expense</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionChip}
            onPress={() => navigation.navigate("Income")}
          >
            <Text style={styles.actionChipLabel}>Add income</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionChip}
            onPress={() => navigation.navigate("Financial Helper")}
          >
            <Text style={styles.actionChipLabel}>Open AI Mentor</Text>
          </TouchableOpacity>
        </View>

        {/* AI helper card */}
        <View style={styles.aiCard}>
          <Text style={styles.aiTitle}>Ask Nummoria's AI mentor</Text>
          <Text style={styles.aiText}>
            "Can I afford this?", "How much should I invest this month?", or
            "What happens if I move to NYC in 3 years?" – ask it in plain
            language.
          </Text>
          <TouchableOpacity
            style={styles.aiButton}
            onPress={() => navigation.navigate("Financial Helper")}
          >
            <Text style={styles.aiButtonText}>Chat with AI</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footerSpace} />
      </ScrollView>

      {/* ✅ NEW VERSION: Bottom-right radial navigation menu */}
      <RadialMenuFab items={radialItems} placement="bottom-right" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG_DARK,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 40,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
    marginTop: 8,
  },
  logoText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#e5e7eb",
  },
  userBadge: {
    width: 40,
    height: 40,
    borderRadius: 999,
    backgroundColor: BRAND_GREEN_SOFT,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    zIndex: 10,
  },
  userAvatar: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  userInitial: {
    fontSize: 16,
    fontWeight: "700",
    color: BRAND_GREEN,
  },
  greetingBlock: {
    marginBottom: 12,
  },
  greetingTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#f9fafb",
  },
  greetingSubtitle: {
    marginTop: 4,
    fontSize: 13,
    color: TEXT_SOFT,
  },
  heroCarousel: {
    marginTop: 8,
    marginBottom: 20,
  },
  heroSlide: {
    height: 190,
    borderRadius: 24,
    overflow: "hidden",
    marginRight: 12,
  },
  heroImage: {
    resizeMode: "cover",
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15,23,42,0.55)",
  },
  heroContent: {
    flex: 1,
    padding: 18,
    justifyContent: "flex-end",
  },
  heroLabel: {
    fontSize: 11,
    color: BRAND_GREEN,
    fontWeight: "600",
    marginBottom: 4,
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#f9fafb",
    marginBottom: 4,
  },
  heroText: {
    fontSize: 13,
    color: "#e5e7eb",
    marginBottom: 10,
  },
  heroCtasRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  heroButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: BRAND_GREEN,
  },
  heroButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#022c22",
  },
  heroButtonOutline: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BRAND_GREEN,
    backgroundColor: "rgba(15,23,42,0.7)",
  },
  heroButtonOutlineText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#e5e7eb",
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#f9fafb",
  },
  sectionSubtitle: {
    marginTop: 2,
    fontSize: 12,
    color: TEXT_SOFT,
  },
  loadingBox: {
    marginTop: 12,
    marginBottom: 8,
    borderRadius: 18,
    padding: 14,
    backgroundColor: CARD_DARK,
    borderWidth: 1,
    borderColor: "rgba(15,23,42,1)",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  loadingText: {
    fontSize: 13,
    color: TEXT_SOFT,
  },
  summaryGrid: {
    marginTop: 8,
    marginBottom: 18,
  },
  summaryCard: {
    borderRadius: 18,
    padding: 14,
    marginBottom: 10,
    backgroundColor: CARD_DARK,
    borderWidth: 1,
    borderColor: "rgba(15,23,42,1)",
  },
  summaryLabel: {
    fontSize: 12,
    color: TEXT_SOFT,
  },
  summaryValue: {
    marginTop: 6,
    fontSize: 20,
    fontWeight: "800",
  },
  expenseValue: {
    color: "#f97373",
  },
  incomeValue: {
    color: BRAND_GREEN,
  },
  investValue: {
    color: "#38bdf8",
  },
  summaryHint: {
    marginTop: 4,
    fontSize: 11,
    color: TEXT_MUTED,
  },
  actionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 18,
  },
  actionChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: CARD_DARK,
    borderWidth: 1,
    borderColor: "rgba(31,41,55,1)",
  },
  actionChipLabel: {
    fontSize: 13,
    color: "#e5e7eb",
    fontWeight: "500",
  },
  aiCard: {
    borderRadius: 22,
    padding: 16,
    backgroundColor: CARD_DARK,
    borderWidth: 1,
    borderColor: BRAND_GREEN_SOFT,
  },
  aiTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#f9fafb",
    marginBottom: 4,
  },
  aiText: {
    fontSize: 13,
    color: TEXT_SOFT,
    marginBottom: 10,
  },
  aiButton: {
    alignSelf: "flex-start",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: BRAND_GREEN,
  },
  aiButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#022c22",
  },
  footerSpace: {
    height: 20,
  },
});
