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

  // Determine initial route based on state
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
        {/* Define ALL screens once - no conditional rendering */}
        <Stack.Screen name="Onboarding">
          {(props) => (
            <OnboardingScreen
              {...props}
              onFinish={async () => {
                await AsyncStorage.setItem("hasSeenOnboarding", "true");
                setHasSeenOnboarding(true);
                // Navigate to login after onboarding
                props.navigation.replace("Login");
              }}
            />
          )}
        </Stack.Screen>

        <Stack.Screen name="Login">
          {(props) => (
            <LoginScreen
              {...props}
              onLoggedIn={() => {
                setIsLoggedIn(true);
                // Navigate to main tabs after login
                props.navigation.replace("MainTabs");
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
                // Navigate to main tabs after signup
                props.navigation.replace("MainTabs");
              }}
            />
          )}
        </Stack.Screen>

        <Stack.Screen name="MainTabs" component={AppTabs} />
        <Stack.Screen name="User" component={UserScreen} />
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
