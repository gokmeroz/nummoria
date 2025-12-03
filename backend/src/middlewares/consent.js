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

  // existing cookie-based logic
  const consentCookie = req.cookies?.nummoriaConsent;
  if (consentCookie === "granted") return next();

  return res.status(403).json({ error: "Consent required" });
}
