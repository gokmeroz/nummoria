// backend/src/server.js
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import cookieParser from "cookie-parser";

// Load .env BEFORE any other imports use env vars
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../.env") });

// Now it’s safe to import the rest
import app from "./app.js";
import { connectDB } from "./config/db.js";

const PORT = process.env.PORT || 4000;

// Optional: hard-fail if JWT secret is missing
if (!process.env.JWT_SECRET) {
  console.error("❌ JWT_SECRET is missing. Set it in .env");
  process.exit(1);
}

await connectDB();
app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
