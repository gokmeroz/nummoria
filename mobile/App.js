// mobile/App.js
import React, { useEffect, useRef, useState } from "react";
import { Platform, StyleSheet } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Device from "expo-device";

// NEW: use JS-based splash gate instead of native splash hold
import SplashGateScreen from "./src/screens/SplashGateScreen";

import OnboardingScreen from "./src/screens/OnboardingScreen";
import LoginScreen from "./src/screens/LoginScreen";
import SignUpScreen from "./src/screens/SignUpScreen";
// import AppTabs from "./src/navigation/AppTabs";
import MainStack from "./src/navigation/MainStack";
import UserScreen from "./src/screens/UserScreen";
import InvestmentPerformanceScreen from "./src/screens/InvestmentPerformance";
import TermsScreen from "./src/screens/TermsScreen";
import api from "./src/lib/api";

import {
  registerForPushTokenAsync,
  attachNotificationListeners,
} from "./src/notifications/notifications";

const Stack = createNativeStackNavigator();

// Local consent gate
const CONSENT_KEY = (userId) => `consent:${String(userId)}`;

async function hasAcceptedConsent(userId) {
  if (!userId) return false;
  try {
    const raw = await AsyncStorage.getItem(CONSENT_KEY(userId));
    if (!raw) return false;
    const c = JSON.parse(raw);
    return !!(c?.termsAccepted && c?.cookiesAccepted);
  } catch {
    return false;
  }
}

export default function App() {
  const navigationRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // ✅ We compute the real next route after splash gate
  const [initialRoute, setInitialRoute] = useState("Login");

  // ✅ Register device on backend (requires being authenticated already)
  async function registerDeviceOnBackend() {
    const expoPushToken = await registerForPushTokenAsync();
    if (!expoPushToken) return;

    await api.post("/devices/register", {
      expoPushToken,
      platform: Platform.OS,
      deviceName: Device.deviceName || "",
      modelName: Device.modelName || "",
      osVersion: Device.osVersion || "",
    });
  }

  // ✅ Attach notification listeners ONCE
  useEffect(() => {
    const detach = attachNotificationListeners({
      onTap: (data) => {
        const route = data?.route;
        const params =
          data?.params ||
          (data?.transactionId ? { transactionId: data.transactionId } : {});

        if (route && navigationRef.current?.navigate) {
          try {
            navigationRef.current.navigate(route, params);
          } catch (e) {
            console.log("[push] navigation failed:", e?.message || e);
          }
        }
      },
    });

    return () => {
      if (typeof detach === "function") detach();
    };
  }, []);

  // ✅ Boot: onboarding + restore token + validate session + consent gate
  useEffect(() => {
    async function bootstrap() {
      try {
        const raw = await AsyncStorage.getItem("hasSeenOnboarding");
        const token = await AsyncStorage.getItem("token");
        const userId = await AsyncStorage.getItem("defaultId");

        const seen = raw === "true";
        setHasSeenOnboarding(seen);

        // Set auth header early
        if (token) {
          api.defaults.headers.Authorization = `Bearer ${token}`;
        } else {
          delete api.defaults.headers.Authorization;
        }

        // If onboarding not seen, go onboarding
        if (!seen) {
          setIsLoggedIn(false);
          setInitialRoute("Onboarding");
          return;
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

        if (!logged) {
          setInitialRoute("Login");
          return;
        }

        // Consent gate
        const accepted = await hasAcceptedConsent(userId);
        setInitialRoute(accepted ? "Main" : "Terms");

        // Register push token ONLY when authenticated
        if (logged && token) {
          try {
            await registerDeviceOnBackend();
          } catch (e) {
            console.warn("[push] device register failed:", e?.message || e);
          }
        }
      } catch (e) {
        console.warn("Failed to read flags:", e);
        setHasSeenOnboarding(false);
        setIsLoggedIn(false);
        setInitialRoute("Onboarding");
      } finally {
        setLoading(false);
      }
    }

    bootstrap();
  }, []);

  // ✅ Centralized post-auth routing (login + signup use the same gate)
  async function routeAfterAuth(navigation) {
    const userId = await AsyncStorage.getItem("defaultId");
    const accepted = await hasAcceptedConsent(userId);

    if (!accepted) {
      navigation.replace("Terms");
      return;
    }
    navigation.replace("Main");
  }

  // NEW: while booting, still show SplashGate; it will wait 2s and then
  // navigate to whatever initialRoute we computed (or "Login" by default).
  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator
        screenOptions={{ headerShown: false }}
        initialRouteName="SplashGate" // NEW
      >
        {/* NEW: Splash gate always first */}
        <Stack.Screen name="SplashGate">
          {(props) => (
            <SplashGateScreen
              {...props}
              route={{
                ...props.route,
                params: {
                  ...(props.route?.params || {}),
                  // If bootstrap finished, use computed route.
                  // Otherwise, fall back to Login.
                  nextRoute: loading ? "Login" : initialRoute,
                },
              }}
            />
          )}
        </Stack.Screen>

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

                const token = await AsyncStorage.getItem("token");
                if (token) {
                  api.defaults.headers.Authorization = `Bearer ${token}`;
                } else {
                  delete api.defaults.headers.Authorization;
                }

                try {
                  await registerDeviceOnBackend();
                } catch (e) {
                  console.warn(
                    "[push] device register failed after login:",
                    e?.message || e,
                  );
                }

                await routeAfterAuth(props.navigation);
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
                if (token) {
                  api.defaults.headers.Authorization = `Bearer ${token}`;
                } else {
                  delete api.defaults.headers.Authorization;
                }

                try {
                  await registerDeviceOnBackend();
                } catch (e) {
                  console.warn(
                    "[push] device register failed after signup:",
                    e?.message || e,
                  );
                }

                await routeAfterAuth(props.navigation);
              }}
            />
          )}
        </Stack.Screen>

        {/* Terms */}
        <Stack.Screen
          name="Terms"
          component={TermsScreen}
          options={{ headerShown: false, gestureEnabled: false }}
        />

        {/* Main */}
        <Stack.Screen name="Main" component={MainStack} />

        {/* User profile */}
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

        {/* Investment performance */}
        <Stack.Screen
          name="InvestmentPerformance"
          component={InvestmentPerformanceScreen}
          options={{
            headerShown: false,
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
