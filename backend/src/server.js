// backend/src/server.js
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env first
dotenv.config({ path: path.join(__dirname, "../.env") });

// Now other imports
import app from "./app.js";
import { connectDB } from "./config/db.js";
import { startRenewalReminderJob } from "./jobs/renewalReminders.js";

const PORT = process.env.PORT || 4000;
const isProd = process.env.NODE_ENV === "production";

// Optional: hard-fail if JWT secret is missing
if (!process.env.JWT_SECRET) {
  console.error("❌ JWT_SECRET is missing. Set it in .env");
  process.exit(1);
}

// Optional: warn if CORS_ORIGINS missing in production
if (isProd && !process.env.CORS_ORIGINS) {
  console.warn(
    "⚠️  CORS_ORIGINS is not set in production. Set it to your allowed frontend origins.",
  );
}

// Crash safety: log and exit; your process manager should restart (PM2/Docker/K8s)
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
  console.log(`Server is running on port ${PORT}`);
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
