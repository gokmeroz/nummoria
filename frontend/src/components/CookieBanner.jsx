/* eslint-disable no-unused-vars */
import { useState, useEffect } from "react";
import api from "../lib/api"; // axios instance

const CONSENT_KEY = "nummoria_cookie_consent";

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const hasCookie = document.cookie
      .split("; ")
      .find((r) => r.startsWith(`${CONSENT_KEY}=`));
    if (!hasCookie) setVisible(true);
  }, []);

  const setConsentCookie = (value) => {
    // 365 days
    document.cookie = `${CONSENT_KEY}=${value}; path=/; max-age=31536000; SameSite=Lax`;
  };

  const acceptCookies = async () => {
    // Optimistic UI: hide immediately
    setConsentCookie("yes");
    setVisible(false);
    try {
      await api.post("/consent/accept", {}, { withCredentials: true });
    } catch (err) {
      // keep cookie + hidden even if request fails
      console.error(
        "Consent accept failed (kept locally):",
        err?.message || err
      );
    }
  };

  const declineCookies = async () => {
    setConsentCookie("no");
    setVisible(false);
    try {
      await api.post("/consent/reject", {}, { withCredentials: true });
    } catch (err) {
      console.error(
        "Consent reject failed (kept locally):",
        err?.message || err
      );
    }
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 w-full z-50 bg-[#4f772d] text-white px-6 py-4 text-sm shadow-[0_-2px_8px_rgba(0,0,0,0.2)]">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
        <p className="leading-snug text-center sm:text-left">
          By clicking “Accept”, you agree to cookies for experience, analytics
          and personalization.{" "}
          <a
            href="/privacy"
            className="underline text-[#dcedc1] hover:text-white transition-colors"
          >
            Learn more
          </a>
          .
        </p>
        <div className="flex gap-3">
          <button
            onClick={declineCookies}
            className="border border-white text-white font-semibold px-5 py-2 rounded-md hover:bg-white/10 transition-all"
          >
            Decline
          </button>
          <button
            onClick={acceptCookies}
            className="bg-white text-[#4f772d] font-semibold px-5 py-2 rounded-md hover:bg-[#e8f5e9] transition-all"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
