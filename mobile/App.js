// App.js
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  SafeAreaView,
  Text,
  StyleSheet,
} from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import AsyncStorage from "@react-native-async-storage/async-storage";

import OnboardingScreen from "./src/screens/OnboardingScreen";
import LoginScreen from "./src/screens/LoginScreen";
import SignUpScreen from "./src/screens/SignUpScreen";
import AppTabs from "./src/navigation/AppTabs";

const Stack = createNativeStackNavigator();

export default function App() {
  const [loading, setLoading] = useState(true);
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState(false);

  useEffect(() => {
    async function bootstrap() {
      try {
        const raw = await AsyncStorage.getItem("hasSeenOnboarding");
        // 🔑 convert string -> boolean safely
        setHasSeenOnboarding(raw === "true");
      } catch (e) {
        console.warn("Failed to read onboarding flag:", e);
        setHasSeenOnboarding(false);
      } finally {
        setLoading(false);
      }
    }
    bootstrap();
  }, []);

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingRoot}>
        <ActivityIndicator size="large" color="#22c55e" />
        <Text style={styles.loadingText}>Loading Nummoria…</Text>
      </SafeAreaView>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {/* If user has NOT seen onboarding → show it first */}
        {!hasSeenOnboarding ? (
          <>
            <Stack.Screen name="Onboarding">
              {(props) => (
                <OnboardingScreen
                  {...props}
                  onFinish={async () => {
                    // when onboarding is done, store "true"
                    await AsyncStorage.setItem("hasSeenOnboarding", "true");
                    setHasSeenOnboarding(true);
                  }}
                />
              )}
            </Stack.Screen>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="SignUp" component={SignUpScreen} />
            <Stack.Screen name="MainTabs" component={AppTabs} />
          </>
        ) : (
          // Already saw onboarding → go straight to auth / main
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="SignUp" component={SignUpScreen} />
            <Stack.Screen name="MainTabs" component={AppTabs} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loadingRoot: {
    flex: 1,
    backgroundColor: "#020617",
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    marginTop: 12,
    color: "#e5e7eb",
    fontSize: 16,
    fontWeight: "600",
  },
});
