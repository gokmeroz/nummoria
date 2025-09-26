import "dotenv/config";

import app from "./app.js";
import { connectDB } from "./config/db.js";

const PORT = process.env.PORT || 4000;

try {
  await connectDB(); // ⬅️ wait for Mongo
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
} catch (err) {
  console.error("❌ Failed to start:", err.message);
  process.exit(1);
}
