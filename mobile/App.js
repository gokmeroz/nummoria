// App.js
import React, { useEffect, useRef, useState } from "react";
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
// import FinancialAdvisorScreen from "./src/screens/FinancialAdvisorScreen";
import api from "./src/lib/api";

import {
  registerForPushNotifications,
  attachNotificationListeners,
  handleInitialNotification,
} from "./notifications/notifications";

const Stack = createNativeStackNavigator();

export default function App() {
  const navigationRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // Attach notification listeners ONCE (foreground + tap handling)
  useEffect(() => {
    const detach = attachNotificationListeners(navigationRef);
    return () => {
      if (typeof detach === "function") detach();
    };
  }, []);

  useEffect(() => {
    async function bootstrap() {
      try {
        const raw = await AsyncStorage.getItem("hasSeenOnboarding");
        const token = await AsyncStorage.getItem("token");

        setHasSeenOnboarding(raw === "true");

        // Set auth header early (needed for /me and /devices/register)
        if (token) {
          api.defaults.headers.Authorization = `Bearer ${token}`;
        } else {
          delete api.defaults.headers.Authorization;
        }

        // Validate session
        let logged = false;
        try {
          const resp = await api.get("/me");
          if (resp?.data?.user) logged = true;
        } catch (e) {
          logged = false;
        }

        setIsLoggedIn(logged);

        // ✅ Register push token ONLY when authenticated
        // This ensures /devices/register behaves the same in dev & prod.
        if (logged && token) {
          try {
            await registerForPushNotifications();
          } catch (e) {
            // Do not block app boot for notification failures
            console.warn("Push registration failed:", e?.message || e);
          }
        }
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
    <NavigationContainer
      ref={navigationRef}
      onReady={() => {
        // ✅ Handle cold start notification routing (app launched by tapping push)
        handleInitialNotification(navigationRef).catch((e) => {
          console.warn(
            "Initial notification handling failed:",
            e?.message || e
          );
        });
      }}
    >
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
              onLoggedIn={async () => {
                setIsLoggedIn(true);

                // Ensure api auth header is set (LoginScreen should save token)
                const token = await AsyncStorage.getItem("token");
                if (token)
                  api.defaults.headers.Authorization = `Bearer ${token}`;

                // ✅ Register push token now that we are logged in
                try {
                  await registerForPushNotifications();
                } catch (e) {
                  console.warn(
                    "Push registration failed after login:",
                    e?.message || e
                  );
                }

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
              onSignedUp={async () => {
                setIsLoggedIn(true);

                const token = await AsyncStorage.getItem("token");
                if (token)
                  api.defaults.headers.Authorization = `Bearer ${token}`;

                // ✅ Register push token now that we are logged in
                try {
                  await registerForPushNotifications();
                } catch (e) {
                  console.warn(
                    "Push registration failed after signup:",
                    e?.message || e
                  );
                }

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
            headerBackTitle: "",
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
