// backend/src/app.js
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import path from "path";
import cookieParser from "cookie-parser";
import crypto from "crypto";
import rateLimit from "express-rate-limit";

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
import adminUserRoutes from "./routes/adminUserRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import adminActivityRoutes from "./routes/adminActivityRoutes.js";
import { consentGate } from "./middlewares/consent.js";
import { requireAuth } from "./middlewares/auth.js";
import autoTransactionRoutes from "./routes/autoTransactionRoutes.js";
import devicesRouter from "./routes/devices.js";
import notificationsRouter from "./routes/notifications.js";

const app = express();

const isProd = process.env.NODE_ENV === "production";

// ---- env-driven config ----
// Option B: Support CORS_ORIGINS allowlist, fallback to FRONTEND_URL.
const FRONTEND = process.env.FRONTEND_URL || "http://localhost:5173";
const CORS_ORIGINS = (process.env.CORS_ORIGINS || FRONTEND)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const TRUST_PROXY = process.env.TRUST_PROXY === "true"; // set true behind LB/proxy
const BODY_LIMIT = process.env.BODY_LIMIT || "200kb";

// ---- trust proxy ----
if (TRUST_PROXY) {
  // 1 hop proxy (Render/Fly/NGINX/Cloudflare typical). Adjust if needed.
  app.set("trust proxy", 1);
}

// ---- request id ----
app.use((req, res, next) => {
  req.id = crypto.randomUUID();
  res.setHeader("X-Request-Id", req.id);
  next();
});

// ---- logging ----
morgan.token("rid", (req) => req.id);
app.use(
  morgan(
    ":method :url :status :res[content-length] - :response-time ms rid=:rid",
  ),
);

// ---- core middlewares ----
app.use(cookieParser());
app.use(express.json({ limit: BODY_LIMIT }));
app.use(express.urlencoded({ extended: true, limit: BODY_LIMIT }));

// ---- CORS (allowlist) ----
app.use(
  cors({
    origin(origin, cb) {
      // Allow non-browser clients / same-origin without Origin header
      if (!origin) return cb(null, true);

      const ok = CORS_ORIGINS.includes(origin);
      return cb(ok ? null : new Error("Not allowed by CORS"), ok);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    maxAge: 600,
  }),
);

// ---- Security headers (Helmet) ----
// NOTE: This CSP is intentionally strict-ish. If your web uses external scripts,
// add explicit domains to scriptSrc/connectSrc/imgSrc etc.
app.use(
  helmet({
    // Keep compatibility with serving images from /uploads
    crossOriginResourcePolicy: { policy: "cross-origin" },

    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        defaultSrc: ["'self'"],
        baseUri: ["'self'"],
        frameAncestors: ["'none'"],
        objectSrc: ["'none'"],

        // If you serve avatars/receipts from /uploads you can keep 'self' + data:
        imgSrc: ["'self'", "data:"],

        // If your frontend injects inline styles, avoid it; otherwise you must loosen.
        styleSrc: ["'self'"],

        scriptSrc: ["'self'"],

        // If your API is on another domain in production, add it explicitly.
        connectSrc: ["'self'"],

        // In prod, auto-upgrade http -> https for subresources
        upgradeInsecureRequests: isProd ? [] : null,
      },
    },

    // HSTS only in prod (preload is optional; keep if you plan to go all-in on HTTPS)
    hsts: isProd
      ? {
          maxAge: 63072000, // 2 years
          includeSubDomains: true,
          preload: true,
        }
      : false,
  }),
);

// ---- Rate limiting ----
const windowMs = Number(process.env.RATE_WINDOW_MS || 60_000);
const globalLimit = Number(process.env.RATE_MAX || 120);
const authLimit = Number(process.env.RATE_LOGIN_MAX || 10);

app.use(
  rateLimit({
    windowMs,
    limit: globalLimit,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { message: "Too many requests" },
  }),
);

const authLimiter = rateLimit({
  windowMs,
  limit: authLimit,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { message: "Too many login attempts" },
});

// ---- static files ----
// ⚠️ Serving user uploads via static is convenient but riskier.
// This adds safer headers. Longer-term: serve via controller + allowlist.
const uploadsDir = path.join(process.cwd(), "uploads");
const IMAGE_EXTS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);
const SAFE_INLINE_EXTS = new Set([...IMAGE_EXTS, ".pdf"]);

app.use(
  "/uploads",
  express.static(uploadsDir, {
    setHeaders(res, filePath) {
      // Caching for immutable assets
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");

      // Prevent MIME sniffing
      res.setHeader("X-Content-Type-Options", "nosniff");

      const ext = path.extname(filePath).toLowerCase();

      // If it’s not a known-safe inline type, force download
      if (!SAFE_INLINE_EXTS.has(ext)) {
        res.setHeader("Content-Disposition", "attachment");
      } else {
        // Images/PDF may be displayed inline (needed for avatars)
        res.removeHeader("Content-Disposition");
      }
    },
  }),
);

// ---- helpers ----
const noCache = (_req, res, next) => {
  res.setHeader(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, proxy-revalidate",
  );
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.setHeader("Surrogate-Control", "no-store");
  next();
};

// ---- public endpoints (no consent required) ----
app.get("/health", (req, res) =>
  res.json({ status: "ok", timestamp: Date.now(), rid: req.id }),
);

app.get("/debug/openai", (req, res) => {
  const k = process.env.OPENAI_API_KEY || "";
  res.json({
    hasKey: Boolean(k),
    keyPreview: k ? `${k.slice(0, 7)}…${k.slice(-4)}` : null,
    nodeEnv: process.env.NODE_ENV,
    rid: req.id,
  });
});

// Auth & consent endpoints must stay BEFORE the consent gate
app.use("/auth", authLimiter, authRoutes);
app.use("/consent", consentRoutes);

// ---- consent gate applies from here down ----
app.use(consentGate);

// Apply no-cache specifically to /me so clients never see 304 with empty body
app.use("/me", noCache, meRoutes);

// Auth-required / consent-gated app routes
app.use("/accounts", accountRoutes);
app.use("/categories", categoryRoutes);
app.use("/transactions", transactionRoutes);
app.use("/auto/transactions", autoTransactionRoutes);
app.use("/investments", investmentPerformance, marketRouter);
app.use("/ai/financial-helper", financialHelperRoutes);
app.use("/stats", statsRoutes);
app.use("/contact", contactRoutes);
app.use("/ingest", ingestRoutes);

// ✅ Notifications infrastructure (auth-protected)
app.use("/devices", requireAuth, devicesRouter);
app.use("/notifications", requireAuth, notificationsRouter);

// Admin
app.use("/admin", adminUserRoutes);
app.use("/admin", adminRoutes);
app.use("/api", adminActivityRoutes);

// ---- 404 fallback ----
app.use((req, res) => {
  res.status(404).json({ message: "Not found", rid: req.id });
});

// ---- error handler (safe in prod) ----
app.use((err, req, res, _next) => {
  const status = err?.statusCode || err?.status || 500;

  // Always log server-side with request id
  console.error(`Unhandled error rid=${req?.id || "n/a"}`, err);

  if (err?.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({ error: "File too large", rid: req.id });
  }

  // Don’t leak internals in production
  const message =
    status >= 500 && isProd ? "Internal Server Error" : err?.message || "Error";

  res.status(status).json({
    error: message,
    rid: req.id,
  });
});

export default app;
