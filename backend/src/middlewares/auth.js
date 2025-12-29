// backend/src/middlewares/auth.js
import jwt from "jsonwebtoken";
import { getCookieName } from "../utils/cookies.js";
import "../config/env.js";
import { requireEnv } from "../config/env.js";
import { User } from "../models/user.js"; // NEW

const JWT_SECRET = requireEnv("JWT_SECRET");
const COOKIE_NAME = getCookieName();

/** Prefer header Bearer; fall back to secure cookie */
function getTokenFromReq(req) {
  const h = req.headers?.authorization || "";
  if (h.startsWith("Bearer ")) return h.slice(7);

  if (req.cookies && req.cookies[COOKIE_NAME]) {
    return req.cookies[COOKIE_NAME];
  }

  return null;
}

export async function requireAuth(req, res, next) {
  try {
    const token = getTokenFromReq(req);
    if (!token) return res.status(401).json({ error: "No token" });

    const payload = jwt.verify(token, JWT_SECRET);

    const id = payload.id || payload.userId || payload._id;
    if (!id) return res.status(401).json({ error: "Invalid token" });

    // NEW: load current user from DB (for isActive + force logout checks)
    const dbUser = await User.findById(id).select(
      "email role isActive authInvalidBefore"
    );
    if (!dbUser) return res.status(401).json({ error: "Unauthorized" });

    // NEW: block inactive users
    if (dbUser.isActive === false) {
      return res.status(403).json({ error: "Account inactive" });
    }

    // NEW: force-logout enforcement using JWT iat
    // If token was issued BEFORE authInvalidBefore -> reject
    if (dbUser.authInvalidBefore && payload.iat) {
      const tokenIssuedAtMs = payload.iat * 1000;
      if (tokenIssuedAtMs < dbUser.authInvalidBefore.getTime()) {
        return res.status(401).json({ error: "Session expired" });
      }
    }

    // Keep your existing req.user shape, but prefer DB-truth for role/email
    req.user = {
      id: String(dbUser._id),
      email: dbUser.email,
      role: dbUser.role || "user",
      ...payload,
    };
    req.userId = String(dbUser._id);

    return next();
  } catch (err) {
    return res.status(401).json({ error: "Unauthorized" });
  }
}

/**
 * Optional auth: attaches req.user if present; otherwise continues unauthenticated.
 */
export async function optionalAuth(req, _res, next) {
  try {
    const token = getTokenFromReq(req);
    if (!token) return next();

    const payload = jwt.verify(token, JWT_SECRET);
    const id = payload.id || payload.userId || payload._id;
    if (!id) return next();

    // NEW: load from DB so role/isActive are current
    const dbUser = await User.findById(id).select(
      "email role isActive authInvalidBefore"
    );
    if (!dbUser) return next();

    if (dbUser.isActive === false) return next();

    if (dbUser.authInvalidBefore && payload.iat) {
      const tokenIssuedAtMs = payload.iat * 1000;
      if (tokenIssuedAtMs < dbUser.authInvalidBefore.getTime()) {
        return next();
      }
    }

    req.user = {
      id: String(dbUser._id),
      email: dbUser.email,
      role: dbUser.role || "user",
      ...payload,
    };
    req.userId = String(dbUser._id);
  } catch {
    // ignore errors; proceed as anonymous
  }
  return next();
}

/**
 * Require admin role (after requireAuth).
 */
export function requireAdmin(req, res, next) {
  if (!req.user || (req.user.role || "user") !== "admin") {
    return res.status(403).json({ error: "Forbidden" });
  }
  return next();
}
