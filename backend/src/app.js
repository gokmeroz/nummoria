// backend/src/app.js
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import path from "path";
import "dotenv/config";
import cookieParser from "cookie-parser";
import marketRouter from "./routes/marketRoutes.js";
import authRoutes from "./routes/auth.js";
import meRoutes from "./routes/me.js";
import accountRoutes from "./routes/accountRoutes.js";
import categoryRoutes from "./routes/categoryRoutes.js";
import transactionRoutes from "./routes/transactionRoutes.js";
import investmentPerformance from "./routes/investmentPerformance.js";
import financialHelperRoutes from "./routes/financialHelperRoutes.js";
import statsRoutes from "./routes/stats.js";
import contactRoutes from "./routes/contact.js";

const app = express();

app.use(cookieParser());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  })
);

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }, // allow images from this origin
  })
);

app.use(morgan("dev"));

// Serve /uploads publicly (MUST be before routes)
app.use(
  "/uploads",
  express.static(path.join(process.cwd(), "uploads"), {
    setHeaders(res) {
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    },
  })
);

// Routes (mount each exactly once)
app.use("/auth", authRoutes);
app.use("/me", meRoutes);
app.use("/accounts", accountRoutes);
app.use("/categories", categoryRoutes);
app.use("/transactions", transactionRoutes);
app.use("/investments", investmentPerformance, marketRouter);
app.use("/ai/financial-helper", financialHelperRoutes);
app.use("/stats", statsRoutes);
app.use("/contact", contactRoutes);

app.get("/health", (req, res) =>
  res.json({ status: "ok", timestamp: Date.now() })
);

// Centralized error handler (shows the real reason for 500s)
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  if (err?.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({ error: "File too large" });
  }
  res.status(500).json({ error: err?.message || "Server error" });
});

export default app;
