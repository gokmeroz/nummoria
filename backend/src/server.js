// backend/src/server.js
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env first (single source of truth)
dotenv.config({ path: path.join(__dirname, "../.env") });

// Now other imports
import app from "./app.js";
import { connectDB } from "./config/db.js";
import { startRenewalReminderJob } from "./jobs/renewalReminders.js";

const isProd = process.env.NODE_ENV === "production";

// Pick correct runtime URLs (optional, but useful for logs / sanity)
const FRONTEND_URL = isProd
  ? process.env.FRONTEND_URL_PROD || process.env.FRONTEND_URL
  : process.env.FRONTEND_URL;

const BACKEND_URL = isProd
  ? process.env.BACKEND_URL_PROD || process.env.BACKEND_URL
  : process.env.BACKEND_URL;

const PORT =
  Number(process.env.PORT) ||
  (BACKEND_URL ? Number(new URL(BACKEND_URL).port) : 4000) ||
  4000;

// ✅ Hard-fail secrets (prod AND dev)
if (!process.env.JWT_SECRET) {
  console.error(
    "❌ JWT_SECRET is missing. Set it in .env / platform env vars.",
  );
  process.exit(1);
}
if (!process.env.REGISTRATION_TOKEN_SECRET) {
  console.error(
    "❌ REGISTRATION_TOKEN_SECRET is missing. Set it in .env / platform env vars.",
  );
  process.exit(1);
}

// ✅ Hard-fail DB vars based on NODE_ENV
if (isProd && !process.env.MONGO_URI_PROD) {
  console.error("❌ MONGO_URI_PROD is missing in production env.");
  process.exit(1);
}
if (!isProd && !process.env.MONGO_URI) {
  console.error("❌ MONGO_URI is missing in development env.");
  process.exit(1);
}

// ✅ CORS sanity
if (isProd) {
  if (!process.env.CORS_ORIGINS) {
    console.warn(
      "⚠️  CORS_ORIGINS is not set in production. Recommended:\n" +
        "CORS_ORIGINS=https://nummoria.com,https://www.nummoria.com",
    );
  } else if (process.env.CORS_ORIGINS.includes("*")) {
    console.error("❌ Refusing to start: CORS_ORIGINS must not contain '*'.");
    process.exit(1);
  }
}

// ✅ Optional: trust proxy when behind a load balancer (Render/Fly/Nginx)
if (isProd && String(process.env.TRUST_PROXY).toLowerCase() === "true") {
  app.set("trust proxy", 1);
}

// Startup banner (no secrets)
console.log("🟢 Starting Nummoria backend");
console.log(`ENV: ${process.env.NODE_ENV || "development"}`);
if (FRONTEND_URL) console.log(`FRONTEND_URL: ${FRONTEND_URL}`);
if (BACKEND_URL) console.log(`BACKEND_URL: ${BACKEND_URL}`);
console.log(`PORT: ${PORT}`);

// Crash safety: log and exit; process manager should restart
process.on("uncaughtException", (err) => {
  console.error("❌ uncaughtException:", err);
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  console.error("❌ unhandledRejection:", reason);
  process.exit(1);
});

// 1) Connect DB
await connectDB();

// 2) Start cron AFTER DB is ready
startRenewalReminderJob();

// 3) Start HTTP server
const server = app.listen(PORT, () => {
  console.log(`✅ Server is running on port ${PORT}`);
});

// Graceful shutdown (SIGTERM from Docker/K8s/Render etc.)
function shutdown(signal) {
  console.log(`\n🛑 Received ${signal}. Shutting down...`);
  server.close(() => {
    console.log("✅ HTTP server closed.");
    process.exit(0);
  });

  // Force exit if it hangs
  setTimeout(() => {
    console.error("❌ Force exiting after timeout.");
    process.exit(1);
  }, 10_000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
