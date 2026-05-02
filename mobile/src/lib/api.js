// mobile/src/lib/api.js
import axios from "axios";
import { Platform } from "react-native";
import Constants from "expo-constants";

const DEV_PORT = 4000;
const MAC_LAN_IP = "192.168.1.4";

const PROD_API_URL = "https://api.nummoria.com";

const ENV_BASE = (process.env.EXPO_PUBLIC_API_URL || "")
  .trim()
  .replace(/\/+$/, "");

function getHostFromExpo() {
  const hostUri =
    Constants.expoConfig?.hostUri ||
    Constants.manifest2?.extra?.expoClient?.hostUri ||
    Constants.manifest?.hostUri;

  if (!hostUri) return null;
  const host = hostUri.split(":")[0];
  return host || null;
}

function isLocalhost(host) {
  return host === "localhost" || host === "127.0.0.1";
}

function getDevBaseURL() {
  if (ENV_BASE) return ENV_BASE;

  if (Platform.OS === "android") {
    return `http://10.0.2.2:${DEV_PORT}`;
  }

  const host = getHostFromExpo();

  if (host && !isLocalhost(host)) {
    return `http://${host}:${DEV_PORT}`;
  }

  return `http://${MAC_LAN_IP}:${DEV_PORT}`;
}

function getBaseURL() {
  if (ENV_BASE) return ENV_BASE;

  if (__DEV__) return getDevBaseURL();

  return PROD_API_URL;
}

const api = axios.create({
  baseURL: getBaseURL(),
  timeout: 60000,
  headers: {
    "Content-Type": "application/json",
    "X-Nummoria-Client": "mobile",
  },
});

console.log("[API] baseURL =", api.defaults.baseURL);

api.interceptors.request.use((config) => {
  console.log(
    "[API] ->",
    config.method?.toUpperCase(),
    `${config.baseURL}${config.url}`,
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
      err?.response?.data,
    );
    return Promise.reject(err);
  },
);

export default api;