// backend/src/middlewares/consent.js
export function consentGate(req, res, next) {
  // Always allow auth + consent + health/static (so user can log in and decide)
  if (
    req.path.startsWith("/auth/") ||
    req.path.startsWith("/consent/") ||
    req.path === "/status" ||
    req.method === "OPTIONS"
  ) {
    return next();
  }

  const consent = req.cookies?.nummoria_cookie_consent;
  if (consent === "yes") return next();

  // Let GET pages load (so the banner can show), block mutating calls
  if (req.method === "GET") return next();

  return res.status(451).json({
    error: "Consent required",
    reason: "CONSENT_REQUIRED",
  });
}
