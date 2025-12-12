import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import api from "../lib/api";

const DEVICE_ID_KEY = "nummoria_device_id_v1";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

async function getOrCreateDeviceId() {
  const existing = await AsyncStorage.getItem(DEVICE_ID_KEY);
  if (existing) return existing;

  const newId = `dev_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  await AsyncStorage.setItem(DEVICE_ID_KEY, newId);
  return newId;
}

export async function registerForPushNotifications() {
  if (!Device.isDevice) {
    return {
      ok: false,
      reason: "Must use physical device for push notifications",
    };
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    return { ok: false, reason: "Permission not granted" };
  }

  const tokenRes = await Notifications.getExpoPushTokenAsync();
  const expoPushToken = tokenRes.data;

  const deviceId = await getOrCreateDeviceId();
  const platform = Platform.OS === "ios" ? "ios" : "android";

  // Optional: you can read app version from Constants.expoConfig.version
  const appVersion = "";

  // register with backend (UPSERT)
  await api.post("/devices/register", {
    expoPushToken,
    platform,
    deviceId,
    appVersion,
  });

  return { ok: true, expoPushToken, deviceId };
}

// Centralized listeners (call once in App root)
export function attachNotificationListeners(navigationRef) {
  // When app is foregrounded and a notification arrives
  const subReceived = Notifications.addNotificationReceivedListener(
    (notification) => {
      // Optional: update local state/inbox badge here
    }
  );

  // When user taps a notification
  const subResponse = Notifications.addNotificationResponseReceivedListener(
    (response) => {
      const data = response?.notification?.request?.content?.data || {};
      const route = data.route;
      const params = data.params || {};

      if (route && navigationRef?.current?.navigate) {
        navigationRef.current.navigate(route, params);
      }
    }
  );

  return () => {
    subReceived.remove();
    subResponse.remove();
  };
}

// Handle cold start from killed state
export async function handleInitialNotification(navigationRef) {
  const response = await Notifications.getLastNotificationResponseAsync();
  const data = response?.notification?.request?.content?.data || {};
  const route = data.route;
  const params = data.params || {};

  if (route && navigationRef?.current?.navigate) {
    navigationRef.current.navigate(route, params);
  }
}
