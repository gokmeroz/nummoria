// src/pages/VerifyEmail.jsx
import { useEffect, useMemo, useState } from "react";
import api from "../lib/api";

export default function VerifyEmail() {
  const usp = new URLSearchParams(window.location.search);
  const initialEmail = (
    usp.get("email") ||
    localStorage.getItem("pendingVerifyEmail") ||
    ""
  ).trim();
  const demoFromQS = usp.get("demo") || "";

  const [email] = useState(initialEmail);
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [demoCode, setDemoCode] = useState(demoFromQS);

  const emailMasked = useMemo(() => {
    if (!email) return "";
    const [u, d] = email.split("@");
    if (!d) return email;
    const maskU =
      u.length <= 2
        ? u[0] + "*"
        : u[0] + "*".repeat(Math.max(1, u.length - 2)) + u[u.length - 1];
    return `${maskU}@${d}`;
  }, [email]);

  useEffect(() => {
    if (!email) {
      setErr("Missing email. Go back to sign up.");
    }
  }, [email]);

  async function onVerify(e) {
    e.preventDefault();
    if (!email) return;
    setErr("");
    setMsg("");
    setLoading(true);
    try {
      await api.post("/auth/verify-email", { email, code: code.trim() });
      setMsg("Email verified! You can now sign in.");
      // Clear pending state and send user to login
      localStorage.removeItem("pendingVerifyEmail");
      setTimeout(() => {
        window.location.href = "/login";
      }, 800);
    } catch (e) {
      setErr(
        e.response?.data?.error ||
          "Verification failed. Check the code and try again."
      );
    } finally {
      setLoading(false);
    }
  }

  async function onResend() {
    if (!email) return;
    setErr("");
    setMsg("");
    setResending(true);
    try {
      const { data } = await api.post("/auth/resend-code", { email });
      setMsg("A new verification code was sent.");
      if (data?.devVerificationCode) {
        setDemoCode(String(data.devVerificationCode));
      }
    } catch (e) {
      setErr(e.response?.data?.error || "Could not resend the code.");
    } finally {
      setResending(false);
    }
  }

  return (
    <div className="min-h-dvh flex items-center justify-center p-4 bg-gray-50">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-6">
        <h1 className="text-2xl font-extrabold text-[#4f772d]">
          Verify your email
        </h1>
        <p className="mt-2 text-gray-600">
          We sent a 6-digit code to{" "}
          <span className="font-medium">{emailMasked}</span>.
        </p>

        {demoCode && (
          <div className="mt-3 text-sm bg-amber-50 border border-amber-200 text-amber-800 px-3 py-2 rounded">
            <strong>DEV</strong> — demo code:{" "}
            <span className="font-mono">{demoCode}</span>
          </div>
        )}

        <form onSubmit={onVerify} className="mt-6 space-y-4">
          {err && (
            <div className="text-sm bg-red-50 text-red-700 px-3 py-2 rounded">
              {err}
            </div>
          )}
          {msg && (
            <div className="text-sm bg-green-50 text-green-700 px-3 py-2 rounded">
              {msg}
            </div>
          )}

          <div>
            <label className="block text-sm mb-1">Verification code</label>
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
              The code expires in ~15 minutes.
            </p>
          </div>

          <button
            className="w-full bg-[#4f772d] text-white py-2 rounded-full font-semibold shadow-md hover:shadow-lg hover:bg-[#90a955] transition disabled:opacity-60"
            disabled={loading || !email}
          >
            {loading ? "Verifying…" : "Verify"}
          </button>
        </form>

        <div className="mt-4 text-sm text-gray-600 flex items-center justify-between">
          <span>Didn’t get the code?</span>
          <button
            onClick={onResend}
            className="text-[#4f772d] underline disabled:opacity-60"
            disabled={resending || !email}
          >
            {resending ? "Resending…" : "Resend code"}
          </button>
        </div>

        <div className="mt-6 text-center">
          <a href="/login" className="text-sm text-gray-500 underline">
            Back to login
          </a>
        </div>
      </div>
    </div>
  );
}
