// src/screens/OnboardingScreen.js
import React from "react";
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
} from "react-native";
import logo from "../../assets/nummoria_logo.png";

export default function OnboardingScreen({ navigation, onFinish }) {
  async function handleStart() {
    if (typeof onFinish === "function") {
      await onFinish();
    }
    navigation.replace("Login");
  }

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.content}>
        <View style={styles.logoWrap}>
          <Image source={logo} style={styles.logo} />
          <Text style={styles.title}>Nummoria</Text>
        </View>

        {/* NEW: Punchline */}
        <Text style={styles.punchline}>
          The new way of taking control of your money with AI.{"\n"}One decision
          at a time.
        </Text>

        <TouchableOpacity
          onPress={handleStart}
          activeOpacity={0.85}
          style={styles.button}
        >
          <Text style={styles.buttonText}>Get started</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#020617",
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
    paddingHorizontal: 24,
    paddingBottom: 28,
  },

  logoWrap: {
    position: "absolute",
    top: 164,
    left: 24,
    right: 24,
    alignItems: "center",
  },
  logo: {
    width: 160,
    height: 160,
    resizeMode: "contain",
    opacity: 0.995,
  },

  title: {
    color: "#e5e7eb",
    fontSize: 28,
    fontWeight: "800",
    marginBottom: 14,
    textAlign: "center",
  },

  // NEW: Punchline styles
  punchline: {
    color: "rgba(148,163,184,0.9)",
    fontSize: 16,
    textAlign: "center",
    marginBottom: 22,
    lineHeight: 22,
    maxWidth: 320,
  },

  button: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: "#22c55e",
    paddingVertical: 14,
    borderRadius: 999,
    alignItems: "center",
  },
  buttonText: {
    color: "#022c22",
    fontWeight: "800",
    fontSize: 16,
    letterSpacing: 0.2,
  },
});
