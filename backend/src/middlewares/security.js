// backend/src/middleware/security.js
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { security, isProd } from "../config/security.js";

function buildCsp() {
  // Keep CSP strict. If you use analytics or external scripts, add them explicitly.
  return {
    useDefaults: true,
    directives: {
      defaultSrc: ["'self'"],
      baseUri: ["'self'"],
      frameAncestors: ["'none'"],
      objectSrc: ["'none'"],
      imgSrc: ["'self'", "data:"], // add your CDN domain when you have it
      scriptSrc: ["'self'"],
      styleSrc: ["'self'"], // if you rely on inline styles, avoid; otherwise explicitly allow nonces
      connectSrc: ["'self'"], // add https://api.yourdomain.com only if needed
      upgradeInsecureRequests: isProd ? [] : null,
    },
  };
}

export function applySecurityMiddleware(app) {
  // Trust proxy (important for correct req.ip + secure cookies behind LB)
  if (security.trustProxy) app.set("trust proxy", 1);

  // Security headers
  app.use(
    helmet({
      contentSecurityPolicy: buildCsp(),
      crossOriginEmbedderPolicy: false, // often breaks if you don't need it; enable later if you want
      hsts: security.hsts.enabled ? security.hsts : false,
    }),
  );

  // CORS
  app.use(
    cors({
      origin(origin, cb) {
        // Allow non-browser clients or same-origin requests without Origin header
        if (!origin) return cb(null, true);

        if (security.allowedOrigins.length === 0) {
          // Safer default: reject if not configured in prod
          if (isProd) return cb(new Error("CORS not configured"), false);
          return cb(null, true);
        }

        const ok = security.allowedOrigins.includes(origin);
        return cb(ok ? null : new Error("Not allowed by CORS"), ok);
      },
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
      maxAge: 600,
    }),
  );

  // Body size limits (JSON + URL-encoded)
  app.use((req, res, next) => {
    // If you later add Stripe/webhooks/etc, you’ll want raw body on those routes only
    next();
  });

  // Rate limit: global
  app.use(
    rateLimit({
      windowMs: security.rate.windowMs,
      limit: security.rate.max,
      standardHeaders: "draft-7",
      legacyHeaders: false,
      message: { message: "Too many requests" },
    }),
  );

  // Example: tighter limiter for auth routes (mount this on /auth)
  app.authLimiter = rateLimit({
    windowMs: security.rate.windowMs,
    limit: security.rate.loginMax,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { message: "Too many login attempts" },
  });
}
