// mobile/src/lib/api.js
import axios from "axios";
import { Platform } from "react-native";

const DEV_PORT = 4000;

// For iOS simulator, host = 127.0.0.1 (your Mac)
// For Android emulator, host = 10.0.2.2 (Android’s alias for host machine)
const baseURL = __DEV__
  ? Platform.select({
      ios: `http://127.0.0.1:${DEV_PORT}`,
      android: `http://10.0.2.2:${DEV_PORT}`,
      default: `http://127.0.0.1:${DEV_PORT}`,
    })
  : "https://your-real-api-domain.com";

const api = axios.create({
  baseURL,
  timeout: 60000,
});

// (optional) debug
// api.interceptors.request.use((config) => {
//   console.log("[API] ->", config.method?.toUpperCase(), config.baseURL + config.url);
//   return config;
// });

export default api;
