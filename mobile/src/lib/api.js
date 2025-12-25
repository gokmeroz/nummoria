// mobile/src/lib/api.js
import axios from "axios";
import { Platform } from "react-native";
import Constants from "expo-constants";

// ✅ Set this to your backend port
// IMPORTANT: confirm your backend is actually on 4000.
// If it's on 3000, change DEV_PORT to 3000.
const DEV_PORT = 4000;

// ✅ Your Mac LAN IP from ifconfig
const MAC_LAN_IP = "192.168.1.4";

// Optional override via env: EXPO_PUBLIC_API_URL="http://192.168.1.4:4000"
const ENV_BASE = (process.env.EXPO_PUBLIC_API_URL || "")
  .trim()
  .replace(/\/+$/, "");

function getHostFromExpo() {
  // hostUri examples:
  // - "192.168.1.4:8081"
  // - "localhost:8081"
  const hostUri =
    Constants.expoConfig?.hostUri ||
    Constants.manifest2?.extra?.expoClient?.hostUri || // fallback for some expo runtimes
    Constants.manifest?.hostUri; // legacy

  if (!hostUri) return null;
  const host = hostUri.split(":")[0];
  return host || null;
}

function isLocalhost(host) {
  return host === "localhost" || host === "127.0.0.1";
}

function getDevBaseURL() {
  // 1) Explicit env always wins
  if (ENV_BASE) return ENV_BASE;

  // 2) Android emulator -> host machine
  if (Platform.OS === "android") return `http://10.0.2.2:${DEV_PORT}`;

  // 3) iOS: try to use Expo host IP (works for device + simulator)
  const host = getHostFromExpo();
  if (host && !isLocalhost(host)) {
    return `http://${host}:${DEV_PORT}`;
  }

  // 4) iOS simulator: localhost is fine
  // 5) iOS real device: localhost is WRONG, so hard fallback to Mac LAN IP
  // We can't perfectly detect simulator vs device without extra libs,
  // so we choose a safe fallback that works for device.
  return `http://${MAC_LAN_IP}:${DEV_PORT}`;
}

const api = axios.create({
  baseURL: __DEV__ ? getDevBaseURL() : "https://your-real-api-domain.com",
  timeout: 60000,
});

// ✅ Log baseURL once (super useful)
console.log("[API] baseURL =", api.defaults.baseURL);

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
