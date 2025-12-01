// src/screens/OnboardingScreen.js
import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";

export default function OnboardingScreen({ navigation, onFinish }) {
  async function handleStart() {
    // App.js already sets AsyncStorage and updates state
    if (typeof onFinish === "function") {
      await onFinish();
    }
    navigation.replace("Login");
  }

  return (
    <View style={styles.root}>
      {/* your onboarding UI */}
      <Text style={styles.title}>Welcome to Nummoria</Text>
      <TouchableOpacity onPress={handleStart} style={styles.button}>
        <Text style={styles.buttonText}>Get started</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#020617",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  title: {
    color: "#e5e7eb",
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 24,
  },
  button: {
    backgroundColor: "#22c55e",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 999,
  },
  buttonText: {
    color: "#022c22",
    fontWeight: "700",
    fontSize: 16,
  },
});
