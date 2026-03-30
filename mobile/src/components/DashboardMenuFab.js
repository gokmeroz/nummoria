/* eslint-disable */
import React, { useRef, useEffect, useCallback } from "react";
import {
  View,
  TouchableOpacity,
  Text,
  StyleSheet,
  Animated,
  Platform,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";

/* ─── PALETTE (mirrors web landing) ─── */
const MINT = "#00ff87";
const CYAN = "#00d4ff";
const VIOLET = "#a78bfa";
const BG = "rgba(3,5,8,0.96)";
const MONO = Platform.OS === "ios" ? "Courier New" : "monospace";

/* ─── NAV ITEMS ─── */
const ITEMS = [
  {
    key: "ai",
    label: "AI",
    glyph: "✦",
    routeName: "Financial Helper",
    accent: MINT,
  },
  {
    key: "income",
    label: "Income",
    glyph: "↑",
    routeName: "Income",
    accent: MINT,
  },
  {
    key: "expenses",
    label: "Expense",
    glyph: "↓",
    routeName: "Expenses",
    accent: CYAN,
  },
  {
    key: "investments",
    label: "Invest",
    glyph: "◈",
    routeName: "Investments",
    accent: VIOLET,
  },
  {
    key: "reports",
    label: "Reports",
    glyph: "≡",
    routeName: "Reports",
    accent: CYAN,
  },
];

/* ─── hex → rgba helper ─── */
const withAlpha = (hex, a) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
};

/* ═══════════════════════════════════════
   SINGLE TAB ITEM
═══════════════════════════════════════ */
function TabItem({ item, active, onPress }) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const pillOpacity = useRef(new Animated.Value(active ? 1 : 0)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const pulseLoop = useRef(null);

  useEffect(() => {
    /* Scale + pill fade */
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: active ? 1.06 : 1,
        tension: 380,
        friction: 18,
        useNativeDriver: true,
      }),
      Animated.timing(pillOpacity, {
        toValue: active ? 1 : 0,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start();

    /* Dot pulse loop when active */
    if (active) {
      pulseLoop.current = Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, {
            toValue: 1,
            duration: 900,
            useNativeDriver: true,
          }),
          Animated.timing(glowAnim, {
            toValue: 0.4,
            duration: 900,
            useNativeDriver: true,
          }),
        ]),
      );
      pulseLoop.current.start();
    } else {
      pulseLoop.current?.stop();
      glowAnim.setValue(0);
    }

    return () => pulseLoop.current?.stop();
  }, [active]);

  const handlePress = useCallback(() => {
    /* Micro bounce on tap */
    Animated.sequence([
      Animated.spring(scaleAnim, {
        toValue: 0.92,
        tension: 500,
        friction: 10,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: active ? 1.06 : 1,
        tension: 380,
        friction: 18,
        useNativeDriver: true,
      }),
    ]).start();
    onPress();
  }, [active, onPress]);

  const { accent } = item;
  const accentFaint = withAlpha(accent, 0.14);
  const accentFainter = withAlpha(accent, 0.06);
  const accentBorder = withAlpha(accent, 0.22);
  const accentGlow = withAlpha(accent, active ? 0.6 : 0);
  const iconColor = active ? accent : "rgba(226,232,240,0.32)";
  const labelColor = active ? accent : "rgba(226,232,240,0.32)";

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.8}
      style={styles.tabTouch}
    >
      <Animated.View
        style={[styles.tabInner, { transform: [{ scale: scaleAnim }] }]}
      >
        {/* ── Active pill background ── */}
        <Animated.View
          style={[
            styles.activePill,
            {
              opacity: pillOpacity,
              borderColor: accentBorder,
            },
          ]}
        >
          <LinearGradient
            colors={[accentFaint, accentFainter, "transparent"]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>

        {/* ── Glyph icon ── */}
        <Text
          style={[
            styles.glyph,
            {
              color: iconColor,
              textShadowColor: accentGlow,
              textShadowRadius: active ? 12 : 0,
            },
          ]}
        >
          {item.glyph}
        </Text>

        {/* ── Label ── */}
        <Text numberOfLines={1} style={[styles.label, { color: labelColor }]}>
          {item.label}
        </Text>

        {/* ── Pulsing dot indicator ── */}
        <Animated.View
          style={[
            styles.dot,
            {
              backgroundColor: accent,
              shadowColor: accent,
              opacity: active ? glowAnim : 0,
            },
          ]}
        />
      </Animated.View>
    </TouchableOpacity>
  );
}

/* ═══════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════ */
export default function DashboardMenuFab() {
  const navigation = useNavigation();
  const route = useRoute();

  const isActive = (routeName) => route?.name === routeName;

  const go = (routeName) => {
    if (!routeName || route?.name === routeName) return;
    navigation.navigate(routeName);
  };

  return (
    <View pointerEvents="box-none" style={styles.wrap}>
      {/* ── Ambient glow beneath the bar ── */}
      <View style={styles.ambientGlow} />

      {/* ── Glass bar ── */}
      <BlurView intensity={55} tint="dark" style={styles.bar}>
        {/* ── Signature top gradient line ── */}
        <LinearGradient
          colors={["transparent", MINT, CYAN, VIOLET, "transparent"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.topLine}
        />

        {/* ── Corner accent dots (decor) ── */}
        <View
          style={[
            styles.cornerDot,
            { top: 10, left: 14, backgroundColor: withAlpha(MINT, 0.28) },
          ]}
        />
        <View
          style={[
            styles.cornerDot,
            { top: 10, right: 14, backgroundColor: withAlpha(CYAN, 0.22) },
          ]}
        />

        {/* ── Tab row ── */}
        <View style={styles.tabsRow}>
          {ITEMS.map((item) => (
            <TabItem
              key={item.key}
              item={item}
              active={isActive(item.routeName)}
              onPress={() => go(item.routeName)}
            />
          ))}
        </View>

        {/* ── Bottom gradient fade ── */}
        <LinearGradient
          colors={[withAlpha(MINT, 0), withAlpha(MINT, 0.03)]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.bottomFade}
          pointerEvents="none"
        />
      </BlurView>
    </View>
  );
}

/* ═══════════════════════════════════════
   STYLES
═══════════════════════════════════════ */
const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    paddingHorizontal: 14,
    paddingBottom: 22,
    zIndex: 50,
  },

  /* Ambient glow that bleeds below bar */
  ambientGlow: {
    position: "absolute",
    left: 60,
    right: 60,
    bottom: 10,
    height: 44,
    borderRadius: 30,
    backgroundColor: withAlpha(MINT, 0.07),
    // React Native can't blur this natively; it acts as a soft colour spill
  },

  /* Main frosted glass container */
  bar: {
    width: "100%",
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "rgba(0,255,135,0.11)",
    backgroundColor: BG,
    overflow: "hidden",
  },

  /* Top rainbow accent line */
  topLine: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 1.2,
    opacity: 0.7,
  },

  /* Bottom subtle tint */
  bottomFade: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 8,
  },

  /* Decorative corner pixel dots */
  cornerDot: {
    position: "absolute",
    width: 3,
    height: 3,
    borderRadius: 1.5,
  },

  /* Row of tabs */
  tabsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 12,
    paddingBottom: 12,
    paddingHorizontal: 8,
  },

  /* Touchable area for each tab */
  tabTouch: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 62,
  },

  /* Animated inner wrapper */
  tabInner: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 7,
    paddingHorizontal: 10,
    minWidth: 52,
    position: "relative",
  },

  /* Glowing pill behind active tab */
  activePill: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
  },

  /* Large unicode glyph acting as icon */
  glyph: {
    fontSize: 19,
    fontWeight: "600",
    lineHeight: 24,
    marginBottom: 3,
  },

  /* Monospace label */
  label: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.35,
    fontFamily: MONO,
    marginBottom: 5,
  },

  /* Pulsing dot at bottom of active tab */
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    shadowOpacity: 1,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
});
