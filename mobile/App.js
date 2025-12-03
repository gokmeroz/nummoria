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
import UserScreen from "./src/screens/UserScreen";
import api from "./src/lib/api"; // ✅ important

const Stack = createNativeStackNavigator();

export default function App() {
  const [loading, setLoading] = useState(true);
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    async function bootstrap() {
      try {
        const raw = await AsyncStorage.getItem("hasSeenOnboarding");
        const token = await AsyncStorage.getItem("token");

        setHasSeenOnboarding(raw === "true");

        // if you ever store a real token, restore header
        if (token) {
          api.defaults.headers.Authorization = `Bearer ${token}`;
        }

        // 🔑 REAL CHECK: ask backend if the session is still valid
        let logged = false;
        try {
          const resp = await api.get("/me");
          if (resp?.data?.user) {
            logged = true;
          }
        } catch (e) {
          logged = false;
        }

        setIsLoggedIn(logged);
      } catch (e) {
        console.warn("Failed to read flags:", e);
        setHasSeenOnboarding(false);
        setIsLoggedIn(false);
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
        {/* 1) First ever open → onboarding */}
        {!hasSeenOnboarding ? (
          <Stack.Screen name="Onboarding">
            {(props) => (
              <OnboardingScreen
                {...props}
                onFinish={async () => {
                  await AsyncStorage.setItem("hasSeenOnboarding", "true");
                  setHasSeenOnboarding(true);
                }}
              />
            )}
          </Stack.Screen>
        ) : isLoggedIn ? (
          // 2) Session valid → go straight to tabs
          <>
            <Stack.Screen name="MainTabs" component={AppTabs} />
            <Stack.Screen name="User" component={UserScreen} />
          </>
        ) : (
          // 3) Not logged in → auth flow
          <>
            <Stack.Screen name="Login">
              {(props) => (
                <LoginScreen
                  {...props}
                  onLoggedIn={() => {
                    setIsLoggedIn(true);
                  }}
                />
              )}
            </Stack.Screen>

            <Stack.Screen name="SignUp">
              {(props) => (
                <SignUpScreen
                  {...props}
                  onSignedUp={() => {
                    setIsLoggedIn(true);
                  }}
                />
              )}
            </Stack.Screen>

            <Stack.Screen name="MainTabs" component={AppTabs} />
            <Stack.Screen name="User" component={UserScreen} />
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
