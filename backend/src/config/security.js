// backend/src/config/security.js
export const isProd = process.env.NODE_ENV === "production";

export const security = {
  // CORS
  allowedOrigins: (process.env.CORS_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),

  // Trust proxy if behind a load balancer (Render, Fly, Nginx, Cloudflare, etc.)
  trustProxy: process.env.TRUST_PROXY === "true",

  // Rate limiting
  rate: {
    windowMs: Number(process.env.RATE_WINDOW_MS || 60_000),
    max: Number(process.env.RATE_MAX || 120), // global per IP
    loginMax: Number(process.env.RATE_LOGIN_MAX || 10),
  },

  // Payload limits
  bodyLimit: process.env.BODY_LIMIT || "200kb",

  // HSTS
  hsts: {
    enabled: isProd,
    maxAge: 63072000, // 2 years
    includeSubDomains: true,
    preload: true,
  },
};
