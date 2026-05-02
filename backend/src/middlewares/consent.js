// backend/src/middlewares/content.js
// Consent gate for web traffic.
// Important: OAuth routes must bypass this because Safari/AuthSession cannot send
// the mobile app's custom X-Nummoria-Client header.

function isMobileClient(req) {
  return (
    String(req.headers["x-nummoria-client"] || "")
      .trim()
      .toLowerCase() === "mobile"
  );
}

function isAuthRoute(req) {
  const path = req.path || "";
  const originalUrl = req.originalUrl || "";

  return path.startsWith("/auth/") || originalUrl.startsWith("/auth/");
}

function isPublicRoute(req) {
  const path = req.path || "";
  const originalUrl = req.originalUrl || "";

  return (
    req.method === "OPTIONS" ||
    path === "/" ||
    originalUrl === "/" ||
    path.startsWith("/health") ||
    originalUrl.startsWith("/health") ||
    path.startsWith("/privacy") ||
    originalUrl.startsWith("/privacy") ||
    path.startsWith("/terms") ||
    originalUrl.startsWith("/terms") ||
    path.startsWith("/support") ||
    originalUrl.startsWith("/support") ||
    path.startsWith("/public") ||
    originalUrl.startsWith("/public") ||
    path.startsWith("/uploads") ||
    originalUrl.startsWith("/uploads")
  );
}

export function consentGate(req, res, next) {
  // Mobile app API requests already have native/mobile consent flow.
  if (isMobileClient(req)) {
    return next();
  }

  // OAuth must be allowed before consent cookie exists.
  // This fixes Google mobile: /auth/google/mobile -> Google -> /auth/google/callback.
  if (isAuthRoute(req)) {
    return next();
  }

  // Dev/local should not be blocked by website cookie consent.
  if (process.env.NODE_ENV !== "production") {
    return next();
  }

  // Public/system routes should stay reachable.
  if (isPublicRoute(req)) {
    return next();
  }

  // Support both old and current cookie names just in case.
  const currentCookie = req.cookies?.nummoria_cookie_consent;
  const legacyCookie = req.cookies?.nummoriaConsent;

  const hasConsent =
    currentCookie === "yes" ||
    currentCookie === "true" ||
    legacyCookie === "yes" ||
    legacyCookie === "true";

  if (hasConsent) {
    return next();
  }

  return res.status(403).json({ error: "Consent required" });
}
