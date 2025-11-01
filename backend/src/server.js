// backend/src/server.js
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import app from "./app.js";
import { connectDB } from "./config/db.js";

// --- Load env from backend/.env explicitly ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../.env") });
// --------------------------------------------

const PORT = process.env.PORT || 4000;

// Small sanity log (masked)
(() => {
  const k = process.env.OPENAI_API_KEY || "";
  const mask = k ? `${k.slice(0, 7)}…${k.slice(-4)}` : "(missing)";
  console.log(`[env] NODE_ENV=${process.env.NODE_ENV || "undefined"}`);
  console.log(`[env] OPENAI_API_KEY=${mask}`);
})();

try {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
} catch (err) {
  console.error("❌ Failed to start:", err.message);
  process.exit(1);
}
