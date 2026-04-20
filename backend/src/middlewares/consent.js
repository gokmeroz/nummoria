// middlewares/consent.js
export function consentGate(req, res, next) {
  const client = req.headers["x-nummoria-client"];

  // 🔓 Allow mobile app (for now)
  if (client === "mobile") {
    return next();
  }

  // Optional: in dev, skip gate completely
  if (process.env.NODE_ENV !== "production") {
    return next();
  }

  // ✅ FIXED: match actual cookie name + value
  const consentCookie = req.cookies?.nummoria_cookie_consent;
  if (consentCookie === "yes") return next();

  return res.status(403).json({ error: "Consent required" });
}