// mobile/src/screens/DashboardScreen.js
import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  Image,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import api from "../lib/api";
import DashboardMenuFab from "../components/DashboardMenuFab";
import TutorialOverlay, {
  shouldShowTutorial,
} from "../components/TutorialOverlay";
import { useTheme } from "../theme/ThemeContext";
import logo from "../../assets/nummoria_logo.png";

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
function fmtCurrencyShort(n, currency = "USD") {
  const abs = Math.abs(n || 0);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 10_000) return `${Math.round(n / 1_000)}K`;
  return fmtCurrency(n, currency);
}

/* ─────────────────────────────────────────────────────────────
   SCREEN
───────────────────────────────────────────────────────────── */
export default function DashboardScreen() {
  const navigation = useNavigation();
  const { colors, isDark, mode } = useTheme();
  const s = useMemo(() => makeStyles(colors, isDark), [colors, isDark]);

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
  const [showTutorial, setShowTutorial] = useState(false);

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
            "Couldn't load your data right now.",
        );
        setSummary({ expenses: 0, income: 0, investments: 0 });
      } finally {
        setLoading(false);
      }

      const show = await shouldShowTutorial();
      if (show) setShowTutorial(true);
    }
    init();
  }, []);

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 5) return "Good night";
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  }, []);

  const firstName = (name || "").split(" ")[0] || "there";
  const monthLabel = new Date().toLocaleString("default", {
    month: "long",
  });

  const net = (summary.income || 0) - (summary.expenses || 0);
  const total = (summary.income || 0) + (summary.expenses || 0);
  const incomePct =
    total > 0 ? Math.max(4, Math.round((summary.income / total) * 100)) : 50;
  const expensePct = total > 0 ? 100 - incomePct : 50;

  return (
    <View style={s.root}>
      <StatusBar
        barStyle={isDark ? "light-content" : "dark-content"}
        backgroundColor={colors.bg}
      />

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Top bar */}
        <View style={s.topBar}>
          <View style={s.brandRow}>
            <Image source={logo} style={s.brandLogo} />
            <Text style={s.brandTxt}>Nummoria</Text>
          </View>

          <TouchableOpacity
            style={s.avatarBtn}
            onPress={() => navigation.navigate("User")}
            activeOpacity={0.85}
          >
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={s.avatarImg} />
            ) : (
              <Text style={s.avatarInitial}>
                {(firstName || "Y").charAt(0).toUpperCase()}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Greeting */}
        <View style={s.greetBlock}>
          <Text style={s.greetSub}>
            {greeting}
            {firstName !== "there" ? "," : ""}
          </Text>
          <Text style={s.greetName}>{firstName} 👋</Text>
        </View>

        {/* HERO: Net balance card */}
        <LinearGradient
          colors={
            net >= 0
              ? [colors.mintSoft, colors.skySoft]
              : [colors.roseSoft, colors.peachSoft]
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={s.heroCard}
        >
          <View style={s.heroHeader}>
            <Text style={s.heroLabel}>Net this month · {monthLabel}</Text>
            <View
              style={[
                s.netBadge,
                {
                  backgroundColor:
                    net >= 0 ? colors.mintSoft : colors.roseSoft,
                  borderColor:
                    net >= 0 ? colors.mintBorder : colors.roseBorder,
                },
              ]}
            >
              <Feather
                name={net >= 0 ? "trending-up" : "trending-down"}
                size={11}
                color={net >= 0 ? colors.mint : colors.rose}
              />
              <Text
                style={[
                  s.netBadgeTxt,
                  { color: net >= 0 ? colors.mint : colors.rose },
                ]}
              >
                {net >= 0 ? "Positive" : "Negative"}
              </Text>
            </View>
          </View>

          {loading ? (
            <View style={{ paddingVertical: 28 }}>
              <ActivityIndicator color={colors.mint} />
            </View>
          ) : (
            <>
              <Text
                style={[
                  s.heroValue,
                  { color: net >= 0 ? colors.mint : colors.rose },
                ]}
              >
                {net >= 0 ? "" : "-"}
                {fmtCurrency(Math.abs(net), baseCurrency)}
              </Text>

              {/* Visual split bar */}
              <View style={s.barTrack}>
                <View
                  style={[
                    s.barIncome,
                    {
                      width: `${incomePct}%`,
                      backgroundColor: colors.mint,
                    },
                  ]}
                />
                <View
                  style={[
                    s.barExpense,
                    {
                      width: `${expensePct}%`,
                      backgroundColor: colors.rose,
                    },
                  ]}
                />
              </View>

              <View style={s.barLegend}>
                <View style={s.legendItem}>
                  <View
                    style={[s.legendDot, { backgroundColor: colors.mint }]}
                  />
                  <Text style={s.legendLabel}>In</Text>
                  <Text style={s.legendValue}>
                    {fmtCurrency(summary.income, baseCurrency)}
                  </Text>
                </View>
                <View style={s.legendItem}>
                  <View
                    style={[s.legendDot, { backgroundColor: colors.rose }]}
                  />
                  <Text style={s.legendLabel}>Out</Text>
                  <Text style={s.legendValue}>
                    {fmtCurrency(summary.expenses, baseCurrency)}
                  </Text>
                </View>
              </View>
            </>
          )}
        </LinearGradient>

        {/* Mini stat row */}
        <View style={s.statsRow}>
          <StatTile
            colors={colors}
            isDark={isDark}
            icon="arrow-down-right"
            iconColor={colors.rose}
            label="Spent"
            value={fmtCurrencyShort(summary.expenses, baseCurrency)}
            loading={loading}
            onPress={() => navigation.navigate("Expenses")}
          />
          <StatTile
            colors={colors}
            isDark={isDark}
            icon="arrow-up-right"
            iconColor={colors.mint}
            label="Earned"
            value={fmtCurrencyShort(summary.income, baseCurrency)}
            loading={loading}
            onPress={() => navigation.navigate("Income")}
          />
          <StatTile
            colors={colors}
            isDark={isDark}
            icon="bar-chart-2"
            iconColor={colors.lilac}
            label="Invested"
            value={fmtCurrencyShort(summary.investments, baseCurrency)}
            loading={loading}
            onPress={() => navigation.navigate("Investments")}
          />
        </View>

        {/* Error */}
        {!!loadError && (
          <View style={s.errorCard}>
            <Feather name="cloud-off" size={16} color={colors.rose} />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={s.errorTitle}>Couldn't sync</Text>
              <Text style={s.errorBody}>{loadError}</Text>
            </View>
          </View>
        )}

        {/* Quick actions */}
        <Text style={s.sectionTitle}>Quick actions</Text>
        <View style={s.actionGrid}>
          <ActionTile
            colors={colors}
            isDark={isDark}
            icon="arrow-down-right"
            tint={colors.rose}
            tintSoft={colors.roseSoft}
            label="Add expense"
            onPress={() => navigation.navigate("Expenses")}
          />
          <ActionTile
            colors={colors}
            isDark={isDark}
            icon="arrow-up-right"
            tint={colors.mint}
            tintSoft={colors.mintSoft}
            label="Add income"
            onPress={() => navigation.navigate("Income")}
          />
          <ActionTile
            colors={colors}
            isDark={isDark}
            icon="camera"
            tint={colors.peach}
            tintSoft={colors.peachSoft}
            label="Scan receipt"
            onPress={() => navigation.navigate("ScanReceipt")}
          />
          <ActionTile
            colors={colors}
            isDark={isDark}
            icon="bar-chart-2"
            tint={colors.lilac}
            tintSoft={colors.lilacSoft}
            label="Invest"
            onPress={() => navigation.navigate("Investments")}
          />
        </View>

        {/* AI mentor card */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => navigation.navigate("Financial Helper")}
          style={s.aiCard}
        >
          <LinearGradient
            colors={[colors.skySoft, colors.lilacSoft]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <View style={s.aiContent}>
            <View
              style={[
                s.aiIconBubble,
                {
                  backgroundColor: colors.skySoft,
                  borderColor: colors.skyBorder,
                },
              ]}
            >
              <Feather name="message-circle" size={20} color={colors.sky} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.aiTitle}>Ask your AI mentor</Text>
              <Text style={s.aiSub}>
                "Can I afford this?" · "Where's my money going?"
              </Text>
            </View>
            <Feather name="arrow-right" size={18} color={colors.textMid} />
          </View>
        </TouchableOpacity>

        <View style={{ height: 130 }} />
      </ScrollView>

      <DashboardMenuFab />

      <TutorialOverlay
        visible={showTutorial}
        navigation={navigation}
        onDone={() => setShowTutorial(false)}
      />
    </View>
  );
}

/* ─────────────────────────────────────────────────────────────
   SUB-COMPONENTS
───────────────────────────────────────────────────────────── */
function StatTile({
  colors,
  isDark,
  icon,
  iconColor,
  label,
  value,
  loading,
  onPress,
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      style={[
        st.tile,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <Feather name={icon} size={16} color={iconColor} />
      <Text style={[st.label, { color: colors.textLow }]}>{label}</Text>
      {loading ? (
        <ActivityIndicator color={iconColor} size="small" />
      ) : (
        <Text style={[st.value, { color: colors.textHi }]}>{value}</Text>
      )}
    </TouchableOpacity>
  );
}
const st = StyleSheet.create({
  tile: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 10,
    alignItems: "flex-start",
    gap: 4,
  },
  label: { fontSize: 11, fontWeight: "500", marginTop: 6 },
  value: { fontSize: 16, fontWeight: "700", letterSpacing: -0.3 },
});

function ActionTile({ colors, isDark, icon, tint, tintSoft, label, onPress }) {
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      style={[
        at.tile,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
        },
      ]}
    >
      <View
        style={[
          at.iconBubble,
          { backgroundColor: tintSoft, borderColor: tint + "44" },
        ]}
      >
        <Feather name={icon} size={18} color={tint} />
      </View>
      <Text style={[at.label, { color: colors.textHi }]}>{label}</Text>
    </TouchableOpacity>
  );
}
const at = StyleSheet.create({
  tile: {
    width: "48%",
    borderRadius: 18,
    borderWidth: 1,
    paddingVertical: 16,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconBubble: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  label: { fontSize: 14, fontWeight: "600" },
});

/* ─────────────────────────────────────────────────────────────
   STYLES
───────────────────────────────────────────────────────────── */
function makeStyles(c, isDark) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.bg },
    scroll: { flex: 1 },
    content: {
      paddingHorizontal: 20,
      paddingTop: 56,
      paddingBottom: 36,
    },

    /* topbar */
    topBar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 22,
    },
    brandRow: { flexDirection: "row", alignItems: "center", gap: 10 },
    brandLogo: { width: 28, height: 28, resizeMode: "contain" },
    brandTxt: {
      fontSize: 17,
      fontWeight: "700",
      color: c.textHi,
      letterSpacing: -0.3,
    },
    avatarBtn: {
      width: 42,
      height: 42,
      borderRadius: 14,
      backgroundColor: c.cardSoft,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
    },
    avatarImg: { width: "100%", height: "100%", resizeMode: "cover" },
    avatarInitial: { fontSize: 16, fontWeight: "700", color: c.mint },

    /* greeting */
    greetBlock: { marginBottom: 22 },
    greetSub: {
      fontSize: 15,
      color: c.textMid,
      marginBottom: 4,
    },
    greetName: {
      fontSize: 30,
      fontWeight: "700",
      color: c.textHi,
      letterSpacing: -0.6,
    },

    /* hero card */
    heroCard: {
      borderRadius: 24,
      padding: 22,
      borderWidth: 1,
      borderColor: c.border,
      marginBottom: 14,
    },
    heroHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 10,
    },
    heroLabel: {
      fontSize: 12,
      color: c.textMid,
      fontWeight: "600",
      letterSpacing: 0.2,
    },
    netBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 999,
      borderWidth: 1,
    },
    netBadgeTxt: { fontSize: 10, fontWeight: "700" },
    heroValue: {
      fontSize: 40,
      fontWeight: "800",
      letterSpacing: -1.2,
      marginBottom: 16,
    },
    barTrack: {
      height: 10,
      borderRadius: 999,
      backgroundColor: c.cardSoft,
      overflow: "hidden",
      flexDirection: "row",
    },
    barIncome: { height: "100%", borderTopLeftRadius: 999, borderBottomLeftRadius: 999 },
    barExpense: {
      height: "100%",
      borderTopRightRadius: 999,
      borderBottomRightRadius: 999,
    },
    barLegend: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginTop: 12,
    },
    legendItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    legendDot: { width: 8, height: 8, borderRadius: 999 },
    legendLabel: { fontSize: 12, color: c.textMid, fontWeight: "500" },
    legendValue: { fontSize: 13, color: c.textHi, fontWeight: "700" },

    /* stat row */
    statsRow: {
      flexDirection: "row",
      gap: 10,
      marginBottom: 22,
    },

    /* error */
    errorCard: {
      flexDirection: "row",
      alignItems: "center",
      padding: 14,
      borderRadius: 14,
      borderWidth: 1,
      backgroundColor: c.roseSoft,
      borderColor: c.roseBorder,
      marginBottom: 18,
    },
    errorTitle: { fontSize: 13, color: c.textHi, fontWeight: "700" },
    errorBody: { fontSize: 12, color: c.textMid, marginTop: 2 },

    /* section title */
    sectionTitle: {
      fontSize: 13,
      fontWeight: "700",
      color: c.textMid,
      letterSpacing: 0.3,
      marginBottom: 12,
      marginTop: 4,
    },

    /* actions grid */
    actionGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 10,
      marginBottom: 22,
    },

    /* AI card */
    aiCard: {
      borderRadius: 20,
      borderWidth: 1,
      borderColor: c.border,
      overflow: "hidden",
      marginBottom: 16,
    },
    aiContent: {
      flexDirection: "row",
      alignItems: "center",
      padding: 18,
      gap: 14,
    },
    aiIconBubble: {
      width: 44,
      height: 44,
      borderRadius: 14,
      borderWidth: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    aiTitle: { fontSize: 16, fontWeight: "700", color: c.textHi },
    aiSub: { fontSize: 12, color: c.textMid, marginTop: 3 },
  });
}
