// mobile/src/lib/api.js
import axios from "axios";

const DEV_PORT = 4000;
const LOCAL_IP = "192.168.1.7"; // 👈 your Mac’s IP on Wi-Fi

const baseURL = __DEV__
  ? `http://${LOCAL_IP}:${DEV_PORT}` // works for simulator + real phone
  : "https://your-real-api-domain.com"; // change in prod

const api = axios.create({
  baseURL,
  timeout: 60000,
});

// Optional debug:
api.interceptors.request.use((config) => {
  console.log(
    "[API] ->",
    config.method?.toUpperCase(),
    config.baseURL + config.url
  );
  return config;
});

export default api;
