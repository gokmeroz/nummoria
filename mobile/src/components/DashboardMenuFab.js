/* eslint-disable */
import React, { useRef, useEffect, useCallback, useMemo } from "react";
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
import { Feather } from "@expo/vector-icons";

import { useTheme } from "../theme/ThemeContext";

/* ─── NAV ITEMS — keys map to Feather icon names ─── */
function getItems(colors) {
  return [
    {
      key: "home",
      label: "Home",
      icon: "home",
      routeName: "Dashboard",
      accent: colors.mint,
    },
    {
      key: "ai",
      label: "AI",
      icon: "message-circle",
      routeName: "Financial Helper",
      accent: colors.sky,
    },
    {
      key: "income",
      label: "Income",
      icon: "arrow-up-right",
      routeName: "Income",
      accent: colors.mint,
    },
    {
      key: "expenses",
      label: "Expense",
      icon: "arrow-down-right",
      routeName: "Expenses",
      accent: colors.rose,
    },
    {
      key: "investments",
      label: "Invest",
      icon: "bar-chart-2",
      routeName: "Investments",
      accent: colors.lilac,
    },
  ];
}

const withAlpha = (hex, a) => {
  if (!hex || !hex.startsWith("#")) return hex;
  const h = hex.length === 4
    ? "#" + hex.slice(1).split("").map((c) => c + c).join("")
    : hex;
  const r = parseInt(h.slice(1, 3), 16);
  const g = parseInt(h.slice(3, 5), 16);
  const b = parseInt(h.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
};

/* ═══════════════════════════════════════
   SINGLE TAB ITEM
═══════════════════════════════════════ */
function TabItem({ item, active, onPress, colors }) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const pillOpacity = useRef(new Animated.Value(active ? 1 : 0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: active ? 1.04 : 1,
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
  }, [active]);

  const handlePress = useCallback(() => {
    Animated.sequence([
      Animated.spring(scaleAnim, {
        toValue: 0.92,
        tension: 500,
        friction: 10,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: active ? 1.04 : 1,
        tension: 380,
        friction: 18,
        useNativeDriver: true,
      }),
    ]).start();
    onPress();
  }, [active, onPress]);

  const { accent } = item;
  const iconColor = active ? accent : colors.textLow;
  const labelColor = active ? accent : colors.textLow;

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.85}
      style={styles.tabTouch}
    >
      <Animated.View
        style={[styles.tabInner, { transform: [{ scale: scaleAnim }] }]}
      >
        <Animated.View
          style={[
            styles.activePill,
            {
              opacity: pillOpacity,
              borderColor: withAlpha(accent, 0.30),
            },
          ]}
        >
          <LinearGradient
            colors={[withAlpha(accent, 0.18), withAlpha(accent, 0.04)]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>

        <Feather name={item.icon} size={18} color={iconColor} />
        <Text
          numberOfLines={1}
          style={[styles.label, { color: labelColor }]}
        >
          {item.label}
        </Text>
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
  const { colors, isDark } = useTheme();

  const ITEMS = useMemo(() => getItems(colors), [colors]);

  const isActive = (routeName) => route?.name === routeName;
  const go = (routeName) => {
    if (!routeName || route?.name === routeName) return;
    navigation.navigate(routeName);
  };

  return (
    <View pointerEvents="box-none" style={styles.wrap}>
      <BlurView
        intensity={isDark ? 55 : 75}
        tint={isDark ? "dark" : "light"}
        style={[
          styles.bar,
          {
            borderColor: colors.border,
            backgroundColor: isDark
              ? "rgba(14,20,36,0.78)"
              : "rgba(255,255,255,0.82)",
          },
        ]}
      >
        {/* Soft gradient hairline at top */}
        <LinearGradient
          colors={[
            "transparent",
            withAlpha(colors.mint, 0.45),
            withAlpha(colors.sky, 0.45),
            withAlpha(colors.lilac, 0.45),
            "transparent",
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.topLine}
        />

        <View style={styles.tabsRow}>
          {ITEMS.map((item) => (
            <TabItem
              key={item.key}
              item={item}
              active={isActive(item.routeName)}
              onPress={() => go(item.routeName)}
              colors={colors}
            />
          ))}
        </View>
      </BlurView>
    </View>
  );
}

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
  bar: {
    width: "100%",
    borderRadius: 28,
    borderWidth: 1,
    overflow: "hidden",
  },
  topLine: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 1.2,
    opacity: 0.8,
  },
  tabsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 10,
    paddingBottom: 10,
    paddingHorizontal: 6,
  },
  tabTouch: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 56,
  },
  tabInner: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 8,
    minWidth: 52,
    position: "relative",
  },
  activePill: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
  },
  label: {
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 0.2,
    marginTop: 4,
  },
});
