// mobile/src/notifications/notifications.js
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { Platform } from "react-native";

// IMPORTANT: configure how notifications show when app is foregrounded
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * Ask permission + get Expo push token.
 * Returns string token or null (if permission denied / simulator).
 */
export async function registerForPushTokenAsync() {
  try {
    // Physical device required for push token
    if (!Device.isDevice) {
      console.log("[push] Must use physical device for push notifications");
      return null;
    }

    // Permission
    const { status: existingStatus } =
      await Notifications.getPermissionsAsync();

    let finalStatus = existingStatus;
    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") {
      console.log("[push] Permission not granted");
      return null;
    }

    // Token
    // Note: Works in EAS builds and modern Expo Go with EAS projectId
    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ||
      Constants?.easConfig?.projectId;

    const tokenRes = await Notifications.getExpoPushTokenAsync({
      projectId,
    });

    const token = tokenRes?.data;
    if (!token) return null;

    // Android channel
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#22c55e",
      });
    }

    return token;
  } catch (err) {
    console.log("[push] register error:", err?.message || err);
    return null;
  }
}

/**
 * Sets up listeners for:
 * 1) receiving notifications in foreground
 * 2) tapping notifications (navigation)
 *
 * Returns cleanup function.
 */
export function attachNotificationListeners({ onTap }) {
  const receivedSub = Notifications.addNotificationReceivedListener(
    (notification) => {
      // You can update UI / store badge count here if you want.
      // console.log("[push] received:", notification);
    }
  );

  const responseSub = Notifications.addNotificationResponseReceivedListener(
    (response) => {
      try {
        const data = response?.notification?.request?.content?.data || {};

        // We standardize backend payload to contain route + params
        if (typeof onTap === "function") {
          onTap(data);
        }
      } catch (e) {
        console.log("[push] tap handler error:", e?.message || e);
      }
    }
  );

  return () => {
    receivedSub?.remove?.();
    responseSub?.remove?.();
  };
}
