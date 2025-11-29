import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Image } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

export default function OnboardingScreen({ navigation }) {
  async function handleStart() {
    try {
      await AsyncStorage.setItem("hasSeenOnboarding", "true");
    } catch (e) {
      console.warn("Could not persist onboarding flag", e);
    }

    if (navigation && navigation.replace) {
      navigation.replace("Dashboard");
    }
  }

  return (
    <View style={styles.container}>
      {/* LOGO */}
      <View style={styles.logoWrap}>
        <Image
          source={require("../assets/nummoria_logo.png")}
          style={styles.logo}
        />
        <Text style={styles.brand}>Nummoria</Text>
      </View>

      {/* TITLE */}
      <View style={styles.textWrap}>
        <Text style={styles.title}>
          Control your{`\n`}finances in one place
        </Text>
        <Text style={styles.subtitle}>
          Track your spending, understand your habits, and manage your
          investments with clarity.
        </Text>
      </View>

      {/* BOTTOM BAR */}
      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.roundBtn} activeOpacity={0.8}>
          <Text style={styles.roundBtnIcon}>←</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.startBtn}
          activeOpacity={0.9}
          onPress={handleStart}
        >
          <Text style={styles.startText}>Start</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.roundBtn} activeOpacity={0.8}>
          <Text style={styles.roundBtnIcon}>››</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0b132b", // clean dark luxury vibe
    paddingHorizontal: 24,
    paddingTop: 80,
    paddingBottom: 32,
    justifyContent: "space-between",
  },

  // LOGO
  logoWrap: {
    alignItems: "flex-start",
  },
  logo: {
    width: 42,
    height: 42,
    borderRadius: 8,
  },
  brand: {
    marginTop: 6,
    color: "#e5e7eb",
    fontSize: 14,
    fontWeight: "600",
  },

  // TEXT
  textWrap: {
    marginTop: 40,
  },
  title: {
    color: "#ffffff",
    fontSize: 34,
    fontWeight: "800",
    lineHeight: 40,
  },
  subtitle: {
    marginTop: 12,
    color: "rgba(229,231,235,0.7)",
    fontSize: 15,
  },

  // BOTTOM
  bottomBar: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.09)",
    backdropFilter: "blur(6px)", // ignored on Android, works on iOS
  },

  roundBtn: {
    width: 44,
    height: 44,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  roundBtnIcon: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
  },

  startBtn: {
    flex: 1,
    marginHorizontal: 12,
    backgroundColor: "#10b981",
    borderRadius: 999,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  startText: {
    color: "#022c22",
    fontWeight: "700",
    fontSize: 16,
  },
});
