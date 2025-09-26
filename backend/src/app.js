import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import "dotenv/config";
import marketRouter from "./routes/marketRoutes.js";
import authRoutes from "./routes/auth.js";
import meRoutes from "./routes/me.js";
import accountRoutes from "./routes/accountRoutes.js";
import categoryRoutes from "./routes/categoryRoutes.js";
import transactionRoutes from "./routes/transactionRoutes.js";
import investmentPerformance from "./routes/investmentPerformance.js";
const app = express(); // Initialize Express app

app.use(express.json()); // Middleware to parse JSON bodies
app.use(cors()); // Enable CORS for all routes
app.use(helmet()); // Secure HTTP headers
app.use(morgan("dev")); // HTTP request logger

app.use("/auth", authRoutes); // Auth routes
app.use("/me", meRoutes); // User profile routes
app.use("/accounts", accountRoutes); // Account management routes
app.use("/categories", categoryRoutes); // Category management routes
app.use("/transactions", transactionRoutes); // Transaction management routes
app.use("/investments", investmentPerformance, marketRouter);
//Basic health check route
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: Date.now() });
});
// Basic route for testing
app.get("/me", (req, res) => {
  res.send("My Page...\n This site is under construction");
});
export default app; // Export the app for use in server.js
