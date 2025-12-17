// mobile/src/lib/api.js
import axios from "axios";
import { Platform } from "react-native";
import Constants from "expo-constants";

const DEV_PORT = 4000;

const ENV_BASE = (process.env.EXPO_PUBLIC_API_URL || "")
  .trim()
  .replace(/\/+$/, "");

function getHostFromExpo() {
  // Typical values:
  // - "192.168.1.5:8081"
  // - "localhost:8081"
  const hostUri = Constants.expoConfig?.hostUri;
  if (!hostUri) return null;

  const host = hostUri.split(":")[0]; // take "192.168.1.5"
  return host || null;
}

function getDevBaseURL() {
  if (ENV_BASE) return ENV_BASE;

  // Android emulator -> host machine
  if (Platform.OS === "android") return `http://10.0.2.2:${DEV_PORT}`;

  // iOS simulator can hit localhost on your Mac
  // But if you run on a real device, localhost would be the phone (wrong),
  // so use the Expo host IP when it's not localhost.
  const host = getHostFromExpo();
  if (host && host !== "localhost" && host !== "127.0.0.1") {
    return `http://${host}:${DEV_PORT}`;
  }

  return `http://localhost:${DEV_PORT}`;
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
