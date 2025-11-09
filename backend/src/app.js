// backend/src/app.js
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import path from "path";
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
import ingestRoutes from "./routes/ingestRoutes.js";
import consentRoutes from "./routes/consentRoutes.js";
import { consentGate } from "./middlewares/consent.js";

const FRONTEND = process.env.FRONTEND_URL || "http://localhost:5173";

const app = express();

// ---- core middlewares ----
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  cors({
    origin: FRONTEND,
    credentials: true,
  })
);

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

app.use(morgan("dev"));

// ---- static files ----
app.use(
  "/uploads",
  express.static(path.join(process.cwd(), "uploads"), {
    setHeaders(res) {
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    },
  })
);

// ---- helpers ----
const noCache = (_req, res, next) => {
  res.setHeader(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, proxy-revalidate"
  );
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.setHeader("Surrogate-Control", "no-store");
  next();
};

// ---- public endpoints (no consent required) ----
app.get("/health", (req, res) =>
  res.json({ status: "ok", timestamp: Date.now() })
);

app.get("/debug/openai", (req, res) => {
  const k = process.env.OPENAI_API_KEY || "";
  res.json({
    hasKey: Boolean(k),
    keyPreview: k ? `${k.slice(0, 7)}…${k.slice(-4)}` : null,
    nodeEnv: process.env.NODE_ENV,
  });
});

// Auth & consent endpoints must stay BEFORE the consent gate
app.use("/auth", authRoutes);
app.use("/consent", consentRoutes);

// ---- consent gate applies from here down ----
app.use(consentGate);

// Apply no-cache specifically to /me so clients never see 304 with empty body
app.use("/me", noCache, meRoutes);

// Auth-required / consent-gated app routes
app.use("/accounts", accountRoutes);
app.use("/categories", categoryRoutes);
app.use("/transactions", transactionRoutes);
app.use("/investments", investmentPerformance, marketRouter);
app.use("/ai/financial-helper", financialHelperRoutes);
app.use("/stats", statsRoutes);
app.use("/contact", contactRoutes);
app.use("/ingest", ingestRoutes);

// ---- error handler ----
app.use((err, _req, res, _next) => {
  console.error("Unhandled error:", err);
  if (err?.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({ error: "File too large" });
  }
  res.status(500).json({ error: err?.message || "Server error" });
});

export default app;
