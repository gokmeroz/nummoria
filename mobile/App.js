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
import InvestmentPerformanceScreen from "./src/screens/InvestmentPerformance";
import api from "./src/lib/api";

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

        if (token) {
          api.defaults.headers.Authorization = `Bearer ${token}`;
        }

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

  const getInitialRoute = () => {
    if (!hasSeenOnboarding) return "Onboarding";
    if (!isLoggedIn) return "Login";
    return "MainTabs";
  };

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{ headerShown: false }}
        initialRouteName={getInitialRoute()}
      >
        {/* Onboarding */}
        <Stack.Screen name="Onboarding">
          {(props) => (
            <OnboardingScreen
              {...props}
              onFinish={async () => {
                await AsyncStorage.setItem("hasSeenOnboarding", "true");
                setHasSeenOnboarding(true);
                props.navigation.replace("Login");
              }}
            />
          )}
        </Stack.Screen>

        {/* Login */}
        <Stack.Screen name="Login">
          {(props) => (
            <LoginScreen
              {...props}
              onLoggedIn={() => {
                setIsLoggedIn(true);
                props.navigation.replace("MainTabs");
              }}
            />
          )}
        </Stack.Screen>

        {/* SignUp */}
        <Stack.Screen name="SignUp">
          {(props) => (
            <SignUpScreen
              {...props}
              onSignedUp={() => {
                setIsLoggedIn(true);
                props.navigation.replace("MainTabs");
              }}
            />
          )}
        </Stack.Screen>

        {/* Main tabs */}
        <Stack.Screen name="MainTabs" component={AppTabs} />

        {/* ✅ User profile screen with native back button to Dashboard */}
        <Stack.Screen
          name="User"
          component={UserScreen}
          options={{
            headerShown: true,
            title: "Profile",
            headerBackTitle: "", // 👈 FORCE EMPTY BACK LABEL
            headerBackTitleVisible: false,
            presentation: "card",
            headerStyle: { backgroundColor: "#020819" },
            headerTintColor: "#e5e7eb",
            headerTitleStyle: { fontWeight: "700" },
          }}
        />

        {/* ✅ Market / performance popup screen */}
        <Stack.Screen
          name="InvestmentPerformance"
          component={InvestmentPerformanceScreen}
          options={{
            headerShown: true,
            title: "Market & Performance",
            headerBackTitleVisible: false,
            presentation: "card",
            headerStyle: { backgroundColor: "#020819" },
            headerTintColor: "#e5e7eb",
            headerTitleStyle: { fontWeight: "700" },
          }}
        />
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
