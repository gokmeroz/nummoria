// backend/src/middlewares/auth.js
import jwt from "jsonwebtoken";
import "../config/env.js";
import { requireEnv } from "../config/env.js";
const JWT_SECRET = requireEnv("JWT_SECRET");

export function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ")
      ? header.slice(7)
      : req.cookies?.token || null;

    if (!token) return res.status(401).json({ error: "No token" });

    const payload = jwt.verify(token, JWT_SECRET);
    // Accept any of these just in case your token uses a different claim
    req.userId = payload.userId || payload.id || payload._id;
    if (!req.userId) return res.status(401).json({ error: "Invalid token" });

    next();
  } catch (err) {
    return res.status(401).json({ error: "Unauthorized" });
  }
}
