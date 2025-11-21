// backend/src/server.js
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
// (cookieParser import here is unused, you can delete it if you want)

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env first
dotenv.config({ path: path.join(__dirname, "../.env") });

// Now other imports
import app from "./app.js";
import { connectDB } from "./config/db.js";
import { startRenewalReminderJob } from "./jobs/renewalReminders.js";

const PORT = process.env.PORT || 4000;

// Optional: hard-fail if JWT secret is missing
if (!process.env.JWT_SECRET) {
  console.error("❌ JWT_SECRET is missing. Set it in .env");
  process.exit(1);
}

// 1) Connect DB
await connectDB();

// 2) Start cron AFTER DB is ready
startRenewalReminderJob();

// 3) Start HTTP server
app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
