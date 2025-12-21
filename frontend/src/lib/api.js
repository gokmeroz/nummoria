// frontend/src/lib/api.js
import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:4000",
  withCredentials: true,
  // ✅ DO NOT set Content-Type globally.
  // Let axios/browser set it automatically:
  // - application/json for JSON bodies
  // - multipart/form-data with boundary for FormData uploads
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;

  // ✅ If caller didn't explicitly set Content-Type, and it's not FormData,
  // default to JSON. This keeps your normal API calls unchanged.
  const isFormData =
    typeof FormData !== "undefined" && config.data instanceof FormData;

  if (!isFormData && !config.headers["Content-Type"]) {
    config.headers["Content-Type"] = "application/json";
  }

  return config;
});

function shouldSkip401Redirect(err) {
  const url = err?.config?.url || "";
  // Normalize for both absolute and relative
  // Examples:
  //   "/ai/financial-helper/ingest"
  //   "http://localhost:4000/ai/financial-helper/ingest"
  return (
    url.includes("/ai/financial-helper/ingest") || url.includes("/ingest/") // optional: if you ever call /ingest/pdf or /ingest/csv from frontend
  );
}

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      // ✅ Upload endpoint: do NOT hard-redirect.
      // Let the UI show an error message instead (prevents "wtf it kicked me to login").
      if (shouldSkip401Redirect(err)) {
        return Promise.reject(err);
      }

      // Default behavior for everything else
      localStorage.removeItem("token");
      if (!location.pathname.startsWith("/login")) {
        location.href = "/login";
      }
    }

    return Promise.reject(err);
  }
);

export default api;
