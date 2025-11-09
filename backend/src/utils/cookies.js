// backend/src/utils/cookies.js
const isProd = process.env.NODE_ENV === "production";
const COOKIE_NAME = process.env.COOKIE_NAME || "nummoria_token";
// Leave undefined by default; set this in PROD only (e.g., ".nummoria.app")
const BACKEND_DOMAIN = process.env.BACKEND_DOMAIN || undefined;

// Optional env override for cross-site prod setups:
//   COOKIE_SAMESITE=none|lax|strict (default lax for dev/most cases)
const COOKIE_SAMESITE = (process.env.COOKIE_SAMESITE || "lax").toLowerCase();

export function setAuthCookie(res, token, maxAgeMs = 1000 * 60 * 60 * 8) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProd, // requires HTTPS in prod
    sameSite: COOKIE_SAMESITE, // set to "none" if FE/BE are on different sites in PROD
    path: "/",
    ...(isProd && BACKEND_DOMAIN ? { domain: BACKEND_DOMAIN } : {}),
    maxAge: maxAgeMs,
  });
}

export function clearAuthCookie(res) {
  const opts = {
    httpOnly: true,
    secure: isProd,
    sameSite: COOKIE_SAMESITE,
    path: "/",
    ...(isProd && BACKEND_DOMAIN ? { domain: BACKEND_DOMAIN } : {}),
  };
  res.clearCookie(COOKIE_NAME, opts);
}

export function getCookieName() {
  return COOKIE_NAME;
}
export function setConsentCookie(
  res,
  consent = true,
  maxAgeMs = 1000 * 60 * 60 * 24 * 365
) {
  const isProd = process.env.NODE_ENV === "production";
  const BACKEND_DOMAIN = process.env.BACKEND_DOMAIN || undefined;

  res.cookie("nummoria_cookie_consent", consent ? "yes" : "no", {
    httpOnly: false, // must be readable by browser JS for FE checks
    secure: isProd,
    sameSite: "lax",
    path: "/",
    ...(isProd && BACKEND_DOMAIN ? { domain: BACKEND_DOMAIN } : {}),
    maxAge: maxAgeMs,
  });
}

export function hasConsentCookie(req) {
  return req.cookies?.nummoria_cookie_consent === "yes";
}
