import { useSearchParams, useNavigate } from "react-router-dom";
import { useState } from "react";
import api from "../lib/api";

export default function ResetPassword() {
  const [sp] = useSearchParams();
  const navigate = useNavigate();

  const email = sp.get("email") || "";
  const token = sp.get("token") || "";

  const [pwd, setPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const passwordsMatch = pwd === confirmPwd;
  const canSubmit = pwd.length >= 8 && confirmPwd.length >= 8 && passwordsMatch;

  async function submit(e) {
    e.preventDefault();
    setErr("");
    setMsg("");

    if (!token) {
      setErr("Missing reset token. Open this page from your email link.");
      return;
    }

    if (!passwordsMatch) {
      setErr("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const { data } = await api.post("/auth/reset-password", {
        email,
        token,
        newPassword: pwd,
      });

      setMsg(data.message || "Password updated. Redirecting to login…");
      setTimeout(() => navigate("/login", { replace: true }), 1200);
    } catch (e) {
      setErr(e.response?.data?.error || "Failed to reset password");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[100dvh] bg-[#070A07] text-white relative overflow-hidden">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[#070A07]" />
        <div className="absolute inset-0 bg-[radial-gradient(1200px_800px_at_15%_0%,rgba(19,226,67,0.10),transparent_55%),radial-gradient(1000px_700px_at_85%_10%,rgba(153,23,70,0.10),transparent_55%),radial-gradient(900px_700px_at_50%_100%,rgba(255,255,255,0.04),transparent_60%)]" />
        <div className="absolute inset-0 opacity-[0.10] mix-blend-overlay bg-[linear-gradient(to_right,rgba(255,255,255,0.10)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.10)_1px,transparent_1px)] bg-[size:56px_56px]" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/35 to-black/70" />
      </div>

      <div className="min-h-[100dvh] grid place-items-center px-4 py-8">
        <form
          onSubmit={submit}
          className="w-full max-w-md rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-md shadow-2xl overflow-hidden"
        >
          <div className="relative p-6 sm:p-7">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-white/60">
              <span className="h-2 w-2 rounded-full bg-[#13e243]" />
              password reset
            </div>

            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white">
              Reset password
            </h1>

            <p className="mt-2 text-sm text-white/60">
              Choose a new password for your account.
            </p>

            {email && (
              <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-xs text-white/55">
                For: <span className="text-white/75">{email}</span>
              </div>
            )}

            {!token && (
              <div className="mt-4 rounded-2xl border border-amber-400/20 bg-amber-300/10 px-4 py-3 text-sm text-amber-100">
                Missing reset token. Open this page from your reset email link.
              </div>
            )}

            {msg && (
              <div className="mt-4 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
                {msg}
              </div>
            )}

            {err && (
              <div className="mt-4 rounded-2xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-100">
                {err}
              </div>
            )}

            <div className="mt-5 space-y-4">
              <div>
                <label className="mb-1 block text-sm text-white/75">
                  New password
                </label>
                <input
                  type="password"
                  minLength={8}
                  required
                  className="w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-white placeholder:text-white/30 outline-none transition focus:border-white/20"
                  value={pwd}
                  onChange={(e) => setPwd(e.target.value)}
                  placeholder="At least 8 characters"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm text-white/75">
                  Confirm new password
                </label>
                <input
                  type="password"
                  minLength={8}
                  required
                  className="w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-white placeholder:text-white/30 outline-none transition focus:border-white/20"
                  value={confirmPwd}
                  onChange={(e) => setConfirmPwd(e.target.value)}
                  placeholder="Repeat your new password"
                />
              </div>

              {!passwordsMatch && confirmPwd.length > 0 && (
                <div className="text-xs text-red-300">
                  Passwords do not match.
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !canSubmit || !token}
                className="w-full rounded-2xl py-3 text-sm font-semibold text-white transition disabled:opacity-60 hover:opacity-95"
                style={{
                  background: "linear-gradient(135deg, #90a955, #4f772d)",
                }}
              >
                {loading ? "Updating…" : "Update password"}
              </button>

              <div className="text-center text-sm text-white/55">
                Back to{" "}
                <a
                  href="/login"
                  className="text-white underline underline-offset-4"
                >
                  login
                </a>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
