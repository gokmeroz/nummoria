/* eslint-disable no-unused-vars */
// src/pages/Login.jsx
import { useEffect, useMemo, useState } from "react";
import api from "../lib/api";
import Footer from "../components/Footer";

export default function Login() {
  // ───────────── login state ─────────────
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginErr, setLoginErr] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginReason, setLoginReason] = useState(""); // "UNVERIFIED" etc.

  // ───────────── signup state ────────────
  const [name, setName] = useState("");
  const [signEmail, setSignEmail] = useState("");
  const [signPassword, setSignPassword] = useState("");
  const [signErr, setSignErr] = useState("");
  const [signLoading, setSignLoading] = useState(false);

  // ───────────── social state ────────────
  const [socialLoading, setSocialLoading] = useState("");
  const [socialErr, setSocialErr] = useState("");

  // ───────────── debug panel ─────────────
  const [meProbe, setMeProbe] = useState({
    tried: false,
    ok: false,
    body: null,
  });
  const [lastSetCookieSeen, setLastSetCookieSeen] = useState(null);

  // Absolute API base for redirects
  const API_BASE =
    (api?.defaults?.baseURL || "").replace(/\/+$/, "") ||
    window.location.origin;

  // =============== email verification modal state ===============
  const [showVerify, setShowVerify] = useState(false);
  const [verifyEmail, setVerifyEmail] = useState(""); // which email to verify
  const [code, setCode] = useState("");
  const [verifyMsg, setVerifyMsg] = useState("");
  const [verifyErr, setVerifyErr] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);

  const maskedEmail = useMemo(() => {
    const email = verifyEmail?.trim();
    if (!email) return "";
    const [u, d] = email.split("@");
    if (!d) return email;
    const maskU =
      u.length <= 2
        ? u[0] + "*"
        : u[0] + "*".repeat(Math.max(1, u.length - 2)) + u[u.length - 1];
    return `${maskU}@${d}`;
  }, [verifyEmail]);

  // Lock scroll when modal open
  useEffect(() => {
    if (showVerify) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => (document.body.style.overflow = "");
  }, [showVerify]);

  // On mount: quick probe of /me so you can see current auth state
  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/me", { withCredentials: true });
        setMeProbe({ tried: true, ok: true, body: data });
      } catch (e) {
        setMeProbe({
          tried: true,
          ok: false,
          body: e?.response?.data || { error: e?.message || "Unknown" },
        });
      }
    })();
  }, []);

  // ====================== LOGIN ======================
  async function onLogin(e) {
    e.preventDefault();
    setLoginErr("");
    setLoginReason("");
    setLoginLoading(true);

    try {
      // 1) Login (must send credentials)
      const resp = await api.post(
        "/auth/login",
        { email: loginEmail, password: loginPassword },
        { withCredentials: true }
      );

      const data = resp?.data || {};

      // 2) (Optional) remember some UI bits
      if (data?.user?.id) {
        localStorage.setItem("defaultId", data.user.id);
        localStorage.setItem("userEmail", data.user.email || "");
        localStorage.setItem("userName", data.user.name || "");
      }
      // Only set token if backend returns it
      if (data?.token) localStorage.setItem("token", data.token);

      // 3) Post-login sanity: cookie should work on /me
      try {
        const meResp = await api.get("/me", { withCredentials: true });
        setMeProbe({ tried: true, ok: true, body: meResp.data });
        location.href = "/"; // all good
        return;
      } catch (meErr) {
        const body = meErr?.response?.data || {
          error: meErr?.message || "Unknown",
        };
        console.error("Sanity /me failed after login:", body);
        setMeProbe({ tried: true, ok: false, body });
        // Still go home so app can try again on mount
        location.href = "/";
        return;
      }
    } catch (e) {
      const status = e.response?.status;
      const body = e.response?.data || {};
      const errMsg = body.error || "Login failed";

      // ⚠️ Email not verified yet
      if (
        status === 403 &&
        (body.reason === "UNVERIFIED" || body.needsVerification === true)
      ) {
        const email = (loginEmail || "").trim();
        setVerifyEmail(email);
        setLoginReason("UNVERIFIED");
        const message = body.maskedEmail
          ? `Your account isn't verified yet. Check your inbox (${body.maskedEmail}) or resend the code.`
          : "Your account isn't verified yet. Check your inbox or resend the code.";
        setLoginErr(message);
        setLoginLoading(false);
        return;
      }

      setLoginErr(errMsg);
    } finally {
      setLoginLoading(false);
    }
  }

  // ====================== SIGNUP ======================
  async function onSignup(e) {
    e.preventDefault();
    setSignErr("");
    setSignLoading(true);
    try {
      const { data } = await api.post(
        "/auth/register",
        { name, email: signEmail, password: signPassword },
        { withCredentials: true }
      );

      // After successful registration, open verify modal
      const email = (signEmail || "").trim();
      setVerifyEmail(email);
      localStorage.setItem("pendingVerifyEmail", email);
      setShowVerify(true);
    } catch (e) {
      setSignErr(e.response?.data?.error || "Registration failed");
    } finally {
      setSignLoading(false);
    }
  }

  // ====================== SOCIAL ======================
  function startSocial(provider) {
    try {
      setSocialErr("");
      setSocialLoading(provider);
      const next = encodeURIComponent(`${window.location.origin}/`);
      const url = `${API_BASE}/auth/${provider}?next=${next}`;
      window.location.href = url;
    } catch (err) {
      setSocialErr(`Could not start social sign-in. Please try again: ${err}`);
      setSocialLoading("");
    }
  }

  // =================== VERIFY HANDLERS (modal) ===================
  async function onVerifySubmit(e) {
    e.preventDefault();
    if (!verifyEmail) return;
    setVerifyErr("");
    setVerifyMsg("");
    setVerifying(true);
    try {
      await api.post(
        "/auth/verify-email",
        { email: verifyEmail, code: code.trim() },
        { withCredentials: true }
      );
      setVerifyMsg("Email verified! Signing you in…");

      // Auto-login right after successful verification
      const { data } = await api.post(
        "/auth/login",
        { email: verifyEmail, password: signPassword || loginPassword },
        { withCredentials: true }
      );

      if (data?.user?.id) {
        localStorage.setItem("defaultId", data.user.id);
        localStorage.setItem("userEmail", data.user.email || "");
        localStorage.setItem("userName", data.user.name || "");
      }
      if (data?.token) localStorage.setItem("token", data.token);

      localStorage.removeItem("pendingVerifyEmail");

      try {
        const meResp = await api.get("/me", { withCredentials: true });
        setMeProbe({ tried: true, ok: true, body: meResp.data });
      } catch (meErr) {
        setMeProbe({
          tried: true,
          ok: false,
          body: meErr?.response?.data || { error: meErr?.message || "Unknown" },
        });
      }

      location.href = "/";
    } catch (e) {
      setVerifyErr(
        e.response?.data?.error ||
          "Verification failed. Check the code and try again."
      );
    } finally {
      setVerifying(false);
    }
  }

  async function onResendCode() {
    if (!verifyEmail) return;
    setVerifyErr("");
    setVerifyMsg("");
    setResending(true);
    try {
      await api.post(
        "/auth/resend-code",
        { email: verifyEmail },
        { withCredentials: true }
      );
      setVerifyMsg("A new verification code was sent.");
    } catch (e) {
      setVerifyErr(e.response?.data?.error || "Could not resend the code.");
    } finally {
      setResending(false);
    }
  }

  return (
    <div className="relative min-h-dvh flex flex-col">
      {/* Background */}
      <img
        src="../../src/assets/loginAlt.jpg"
        alt="Background"
        className="absolute inset-0 w-full h-full object-cover -z-10"
      />
      <div className="absolute inset-0 bg-black/50 -z-10" />

      {/* Main */}
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-5xl bg-white rounded-2xl shadow-xl overflow-hidden grid grid-cols-1 md:grid-cols-2">
          {/* Left: Sign in */}
          <div className="relative p-8 md:p-10 bg-[#4f772d]/90 text-white flex flex-col justify-center">
            <div className="relative">
              <h2 className="text-3xl font-extrabold">Welcome Back!</h2>
              <p className="mt-2 text-white/90">
                To keep connected with us please login with your personal info.
              </p>

              <form onSubmit={onLogin} className="mt-8 space-y-4">
                {loginErr && (
                  <div className="text-sm bg-white/15 px-3 py-2 rounded">
                    {loginErr}
                    {loginReason === "UNVERIFIED" && (
                      <div className="mt-2 flex items-center gap-4">
                        <button
                          type="button"
                          className="underline"
                          onClick={() => onResendCode()}
                          disabled={!verifyEmail}
                          title="Resend verification code"
                        >
                          Resend code
                        </button>
                        <button
                          type="button"
                          className="underline"
                          onClick={() => setShowVerify(true)}
                          title="Enter code"
                        >
                          Enter code
                        </button>
                      </div>
                    )}
                  </div>
                )}

                <div>
                  <label className="text-sm">Email</label>
                  <input
                    type="email"
                    className="mt-1 w-full rounded-lg px-3 py-2 bg-white text-gray-900 placeholder-gray-400 outline-none focus:ring-2 focus:ring-[#90a955]"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="you@nummoria.com"
                    required
                  />
                </div>
                <div>
                  <label className="text-sm">Password</label>
                  <input
                    type="password"
                    className="mt-1 w-full rounded-lg px-3 py-2 bg-white text-gray-900 placeholder-gray-400 outline-none focus:ring-2 focus:ring-[#90a955]"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                  />
                </div>
                <button
                  className="w-full rounded-full border-2 border-white py-2 font-semibold hover:bg-white hover:text-[#4f772d] transition disabled:opacity-60"
                  disabled={loginLoading}
                >
                  {loginLoading ? "Signing in..." : "SIGN IN"}
                </button>
                <div className="text-sm text-white/90">
                  <a href="/forgot-password" className="underline">
                    Forgot password?
                  </a>
                </div>
              </form>
            </div>
          </div>

          {/* Right: Create account */}
          <div className="p-8 md:p-10 flex flex-col justify-center bg-white/95">
            <h2 className="text-3xl font-extrabold text-[#4f772d]">
              Create Account
            </h2>

            {/* Social providers */}
            <div className="mt-5">
              {socialErr && (
                <div className="text-sm text-red-600 mb-3">{socialErr}</div>
              )}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  aria-label="Continue with Google"
                  title="Continue with Google"
                  className="w-9 h-9 rounded-full border flex items-center justify-center"
                  disabled={!!socialLoading}
                  onClick={() => {
                    setSocialLoading(true);
                    const apiUrl =
                      import.meta.env.VITE_API_URL || "http://localhost:4000";
                    window.location.href = `${apiUrl}/auth/google?next=/`;
                  }}
                >
                  {/* Google G */}
                  <svg width="20" height="20" viewBox="0 0 48 48">
                    <path
                      fill="#FFC107"
                      d="M43.6 20.5H42V20H24v8h11.3C33.7 32.6 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.7 1.1 7.8 3l5.7-5.7C33.9 6.3 29.2 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 19.3-8.8 19.3-20c0-1.3-.1-2.5-.7-3.5z"
                    />
                    <path
                      fill="#FF3D00"
                      d="M6.3 14.7l6.6 4.8C14.5 16 18.9 12 24 12c3 0 5.7 1.1 7.8 3l5.7-5.7C33.9 6.3 29.2 4 24 4 16.2 4 9.4 8.4 6.3 14.7z"
                    />
                    <path
                      fill="#4CAF50"
                      d="M24 44c5.2 0 9.9-1.9 13.5-5.1l-6.2-5c-2 1.4-4.7 2.2-7.3 2.2-5.3 0-9.7-3.4-11.3-8.1l-6.6 5.1C9.4 39.6 16.2 44 24 44z"
                    />
                    <path
                      fill="#1976D2"
                      d="M43.6 20.5H42V20H24v8h11.3c-1.1 3.6-4.5 6-8.3 6-5.3 0-9.7-3.4-11.3-8.1l-6.6 5.1C9.4 39.6 16.2 44 24 44c8.6 0 19.3-6.2 19.3-20 0-1.3-.1-2.5-.7-3.5z"
                    />
                  </svg>
                </button>

                <button
                  type="button"
                  aria-label="Continue with Twitter"
                  title="Continue with Twitter"
                  className="w-10 h-10 rounded-full border flex items-center justify-center hover:bg-gray-50 disabled:opacity-60"
                  disabled={!!socialLoading}
                  onClick={() => startSocial("twitter")}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="black">
                    <path d="M18.244 2H21.5l-7.42 8.49L22 22h-6.77l-5.3-6.97L4.77 22H1.5l7.92-9.05L2 2h6.91l4.79 6.39L18.244 2zm-2.37 18h2.11L8.21 4H6.01l9.864 16z" />
                  </svg>
                </button>

                <button
                  type="button"
                  aria-label="Continue with GitHub"
                  title="Continue with GitHub"
                  className="w-10 h-10 rounded-full border flex items-center justify-center hover:bg-gray-50 disabled:opacity-60 bg-black"
                  disabled={!!socialLoading}
                  onClick={() => startSocial("github")}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="white"
                  >
                    <path d="M12 .5C5.73.5.5 5.74.5 12.02c0 5.1 3.29 9.42 7.86 10.95.58.11.79-.25.79-.56 0-.28-.01-1.02-.02-2 -3.2.7-3.88-1.54-3.88-1.54-.53-1.35-1.3-1.71-1.3-1.71-1.06-.72.08-.71.08-.71 1.17.08 1.79 1.2 1.79 1.2 1.04 1.79 2.73 1.27 3.4.97.1-.76.41-1.27.75-1.56-2.55-.29-5.23-1.28-5.23-5.7 0-1.26.45-2.29 1.2-3.1-.12-.29-.52-1.45.11-3.02 0 0 .97-.31 3.18 1.18a11.1 11.1 0 0 1 2.9-.39c.98 0 1.96.13 2.9.39 2.2-1.49 3.17-1.18 3.17-1.18.63 1.57.23 2.73.11 3.02.75.81 1.2 1.84 1.2 3.1 0 4.43-2.69 5.41-5.25 5.7.42.36.8 1.09.8 2.2 0 1.59-.01 2.87-.01 3.26 0 .31.21.68.8.56 A10.52 10.52 0 0 0 23.5 12c0-6.28-5.23-11.5-11.5-11.5z" />
                  </svg>
                </button>

                {socialLoading && (
                  <span className="text-sm text-gray-500">
                    Redirecting to {socialLoading}…
                  </span>
                )}
              </div>

              <p className="mt-4 text-gray-500 text-sm">
                or use your email for registration:
              </p>
            </div>

            <form onSubmit={onSignup} className="mt-4 space-y-4">
              {signErr && <div className="text-sm text-red-600">{signErr}</div>}
              <div>
                <label className="block text-sm mb-1">Name</label>
                <input
                  className="w-full border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-[#90a955]"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  required
                />
              </div>
              <div>
                <label className="block text-sm mb-1">Email</label>
                <input
                  type="email"
                  className="w-full border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-[#90a955]"
                  value={signEmail}
                  onChange={(e) => setSignEmail(e.target.value)}
                  placeholder="you@nummoria.com"
                  required
                />
              </div>
              <div>
                <label className="block text-sm mb-1">Password</label>
                <input
                  type="password"
                  className="w-full border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-[#90a955]"
                  value={signPassword}
                  onChange={(e) => setSignPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  minLength={8}
                  required
                />
              </div>
              <button
                className="w-full bg-[#4f772d] text-white py-2 rounded-full font-semibold shadow-md hover:shadow-lg hover:bg-[#90a955] transition disabled:opacity-60"
                disabled={signLoading}
              >
                {signLoading ? "Creating..." : "SIGN UP"}
              </button>

              <div className="text-xs text-gray-500 text-center">
                By continuing you agree to our{" "}
                <a className="underline" href="/terms">
                  Terms
                </a>{" "}
                and{" "}
                <a className="underline" href="/privacy">
                  Privacy Policy
                </a>
                .
              </div>

              <div className="text-sm text-gray-600">
                Already have an account?{" "}
                <a href="#" className="text-[#4f772d] underline">
                  Sign in on the left
                </a>
              </div>
            </form>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-auto w-full">
        <Footer fullBleed className="bg-white/70 backdrop-blur-sm" />
      </footer>

      {/* ===================== VERIFY MODAL ===================== */}
      {showVerify && (
        <div
          className="fixed inset-0 z-[100] grid place-items-center bg-black/60 p-4"
          onMouseDown={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-6">
            <div className="flex items-start justify-between">
              <h2 className="text-xl font-extrabold text-[#4f772d]">
                Verify your email
              </h2>
              <button
                className="text-gray-500 hover:text-gray-700"
                onClick={() => setShowVerify(false)}
                aria-label="Close"
                title="Close"
              >
                ×
              </button>
            </div>

            <p className="mt-1 text-gray-600">
              We sent a 6-digit code to{" "}
              <span className="font-medium">{maskedEmail}</span>.
            </p>

            <form onSubmit={onVerifySubmit} className="mt-5 space-y-4">
              {verifyErr && (
                <div className="text-sm bg-red-50 text-red-700 px-3 py-2 rounded">
                  {verifyErr}
                </div>
              )}
              {verifyMsg && (
                <div className="text-sm bg-green-50 text-green-700 px-3 py-2 rounded">
                  {verifyMsg}
                </div>
              )}

              <div>
                <label className="block text-sm mb-1">Verification Code</label>
                <input
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  className="w-full border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-[#90a955]"
                  placeholder="Enter 6-digit code"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Expires ~15 minutes after request.
                </p>
              </div>

              <button
                className="w-full bg-[#4f772d] text-white py-2 rounded-full font-semibold shadow-md hover:shadow-lg hover:bg-[#90a955] transition disabled:opacity-60"
                disabled={verifying || !verifyEmail}
              >
                {verifying ? "Verifying…" : "Verify & Continue"}
              </button>
            </form>

            <div className="mt-4 text-sm text-gray-600 flex items-center justify-between">
              <span>Didn’t get the code?</span>
              <button
                onClick={onResendCode}
                className="text-[#4f772d] underline disabled:opacity-60"
                disabled={resending || !verifyEmail}
              >
                {resending ? "Resending…" : "Resend code"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
