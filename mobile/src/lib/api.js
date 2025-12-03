// mobile/src/lib/api.js
import axios from "axios";
import { Platform } from "react-native";

// ✅ put your Mac's LAN IP here (NOT localhost)
const LOCAL_IP = "192.168.1.3"; // <--- CHANGE THIS

const baseURL = __DEV__
  ? Platform.select({
      ios: `http://${LOCAL_IP}:4000`, // iPhone / iOS simulator
      android: `http://${LOCAL_IP}:4000`, // Android device / emulator
      default: `http://${LOCAL_IP}:4000`,
    })
  : "https://your-real-api-domain.com"; // prod

const api = axios.create({
  baseURL,
  timeout: 10000,
});

export default api;
