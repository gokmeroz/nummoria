// mobile/src/lib/api.js
import axios from "axios";
import { Platform } from "react-native";
import Constants from "expo-constants";

const DEV_PORT = 4000;

// 🔴 CHANGE THIS IF YOUR IP CHANGES
const LAN_IP = "http://192.168.1.26:4000";

// Optional override via env
const ENV_BASE = (process.env.EXPO_PUBLIC_API_URL || "")
  .trim()
  .replace(/\/+$/, "");

function isExpoGoOnRealDevice() {
  // Expo Go + real phone => hostUri exists and is NOT localhost
  const hostUri = Constants.expoConfig?.hostUri;
  return !!hostUri && !hostUri.includes("localhost");
}

function getDevBaseURL() {
  if (ENV_BASE) return ENV_BASE;

  // Android emulator
  if (Platform.OS === "android") {
    return "http://10.0.2.2:4000";
  }

  // iOS real device (Expo Go)
  if (isExpoGoOnRealDevice()) {
    return LAN_IP;
  }

  // iOS simulator
  return "http://localhost:4000";
}

const api = axios.create({
  baseURL: __DEV__ ? getDevBaseURL() : "https://your-real-api-domain.com",
  timeout: 60000,
});

api.interceptors.request.use((config) => {
  console.log(
    "[API] ->",
    config.method?.toUpperCase(),
    `${config.baseURL}${config.url}`
  );
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    console.log(
      "[API] <- ERROR",
      err?.message,
      err?.code,
      err?.response?.status,
      err?.response?.data
    );
    return Promise.reject(err);
  }
);

export default api;
