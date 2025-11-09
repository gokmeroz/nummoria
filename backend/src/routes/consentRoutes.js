// backend/src/routes/consentRoutes.js
import { Router } from "express";
import { setConsentCookie, clearAuthCookie } from "../utils/cookies.js";

const router = Router();

/** Accept cookies: set consent cookie to "yes". */
router.post("/accept", (req, res) => {
  setConsentCookie(res, true);
  return res.json({ ok: true, consent: "yes" });
});

/** Reject cookies: set consent cookie to "no" and clear auth cookie. */
router.post("/reject", (req, res) => {
  setConsentCookie(res, false);
  clearAuthCookie(res); // important: drop any session if user rejects
  return res.json({ ok: true, consent: "no" });
});

export default router;
