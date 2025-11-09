// backend/src/middlewares/auth.js
import jwt from "jsonwebtoken";
import { getCookieName } from "../utils/cookies.js";
import "../config/env.js";
import { requireEnv } from "../config/env.js";

const JWT_SECRET = requireEnv("JWT_SECRET");
const COOKIE_NAME = getCookieName();

/** Prefer header Bearer; fall back to secure cookie */
function getTokenFromReq(req) {
  // 1) Authorization: Bearer <token>
  const h = req.headers?.authorization || "";
  if (h.startsWith("Bearer ")) return h.slice(7);

  // 2) HttpOnly cookie we set at login
  if (req.cookies && req.cookies[COOKIE_NAME]) {
    return req.cookies[COOKIE_NAME];
  }

  // 3) absolutely nothing found
  return null;
}

export function requireAuth(req, res, next) {
  try {
    const token = getTokenFromReq(req);
    if (!token) return res.status(401).json({ error: "No token" });

    const payload = jwt.verify(token, JWT_SECRET);

    const id = payload.id || payload.userId || payload._id;
    if (!id) return res.status(401).json({ error: "Invalid token" });

    req.user = {
      id,
      email: payload.email,
      role: payload.role || "user",
      ...payload,
    };
    req.userId = id;

    return next();
  } catch (err) {
    return res.status(401).json({ error: "Unauthorized" });
  }
}
/**
 * Optional auth: attaches req.user if present; otherwise continues unauthenticated.
 */
export function optionalAuth(req, _res, next) {
  try {
    const token = getTokenFromReq(req);
    if (!token) return next();

    const payload = jwt.verify(token, JWT_SECRET);
    const id = payload.id || payload.userId || payload._id;
    if (!id) return next();

    req.user = {
      id,
      email: payload.email,
      role: payload.role || "user",
      ...payload,
    };
    req.userId = id;
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
