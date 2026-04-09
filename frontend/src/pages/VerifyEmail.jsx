import { useEffect, useMemo, useState } from "react";
import api from "../lib/api";
import logo from "../assets/nummoria_logo.png";

const MINT = "#00ff87";
const CYAN = "#00d4ff";
const VIOLET = "#a78bfa";
const ROSE = "#ff4d8d";

const Brackets = ({ color = MINT, size = "10px", thick = "1.5px" }) => (
  <>
    <div
      className="absolute top-0 left-0"
      style={{
        width: size,
        height: size,
        borderTop: `${thick} solid ${color}`,
        borderLeft: `${thick} solid ${color}`,
      }}
    />
    <div
      className="absolute top-0 right-0"
      style={{
        width: size,
        height: size,
        borderTop: `${thick} solid ${color}`,
        borderRight: `${thick} solid ${color}`,
      }}
    />
    <div
      className="absolute bottom-0 left-0"
      style={{
        width: size,
        height: size,
        borderBottom: `${thick} solid ${color}`,
        borderLeft: `${thick} solid ${color}`,
      }}
    />
    <div
      className="absolute bottom-0 right-0"
      style={{
        width: size,
        height: size,
        borderBottom: `${thick} solid ${color}`,
        borderRight: `${thick} solid ${color}`,
      }}
    />
  </>
);

const ScanLine = ({ color = MINT, className = "" }) => (
  <div className={`flex items-center gap-1.5 ${className}`}>
    <div
      className="w-[3px] h-[3px] rounded-full opacity-60"
      style={{ backgroundColor: color }}
    />
    <div
      className="flex-1 h-[1px] opacity-20"
      style={{ backgroundColor: color }}
    />
    <div
      className="w-[3px] h-[3px] rounded-full opacity-60"
      style={{ backgroundColor: color }}
    />
  </div>
);

export default function VerifyEmail() {
  const usp = new URLSearchParams(window.location.search);
  const initialEmail = (
    usp.get("email") ||
    localStorage.getItem("pendingVerifyEmail") ||
    ""
  ).trim();
  const demoFromQS = usp.get("demo") || "";

  const initialToken = (
    usp.get("token") ||
    localStorage.getItem("regToken") ||
    ""
  ).trim();

  const [email] = useState(initialEmail);
  const [regToken, setRegToken] = useState(initialToken);
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
    if (!email && !regToken) {
      setErr("Missing email/token. Go back to sign up.");
    }
  }, [email, regToken]);

  async function onVerify(e) {
    e.preventDefault();
    if (!email && !regToken) return;

    setErr("");
    setMsg("");
    setLoading(true);

    try {
      const payload = regToken
        ? { regToken, code: code.trim() }
        : { email, code: code.trim() };

      await api.post("/auth/verify-email", payload);

      setMsg("Email verified! You can now sign in.");
      localStorage.removeItem("pendingVerifyEmail");
      localStorage.removeItem("regToken");
      setRegToken("");

      setTimeout(() => {
        window.location.href = "/login";
      }, 800);
    } catch (e) {
      setErr(
        e.response?.data?.error ||
          "Verification failed. Check the code and try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function onResend() {
    if (!email && !regToken) return;

    setErr("");
    setMsg("");
    setResending(true);

    try {
      const payload = regToken ? { regToken } : { email };
      const { data } = await api.post("/auth/resend-code", payload);

      setMsg("A new verification code was sent.");

      if (data?.regToken) {
        setRegToken(String(data.regToken));
        localStorage.setItem("regToken", String(data.regToken));
      }

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
    <div className="relative min-h-dvh overflow-hidden bg-[#030508] text-white">
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @keyframes verifyFloat {
              0%, 100% { transform: translateY(0px); }
              50% { transform: translateY(-4px); }
            }

            @keyframes verifyPulse {
              0%, 100% { opacity: .16; transform: scale(1); }
              50% { opacity: .30; transform: scale(1.06); }
            }

            .verify-float {
              animation: verifyFloat 5.5s ease-in-out infinite;
            }

            .verify-pulse {
              animation: verifyPulse 3.6s ease-in-out infinite;
            }
          `,
        }}
      />

      <div className="absolute inset-0 bg-[#030508]" />
      <div className="absolute inset-0 bg-[radial-gradient(900px_500px_at_10%_0%,rgba(0,255,135,0.08),transparent_58%),radial-gradient(900px_500px_at_85%_0%,rgba(167,139,250,0.12),transparent_58%),radial-gradient(1000px_700px_at_50%_100%,rgba(0,212,255,0.08),transparent_60%)]" />
      <div className="absolute inset-0 opacity-[0.08] bg-[linear-gradient(to_right,rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.08)_1px,transparent_1px)] bg-[size:42px_42px]" />

      <div className="relative z-10 min-h-dvh px-6 py-10 flex items-center justify-center">
        <div className="w-full max-w-xl">
          <div
            className="relative overflow-hidden border bg-black/45 p-6 md:p-8 backdrop-blur-sm"
            style={{ borderColor: "rgba(167,139,250,0.28)" }}
          >
            <Brackets color={VIOLET} size="12px" thick="1.5px" />
            <div
              className="absolute top-0 inset-x-[12%] h-[1px] opacity-40"
              style={{ backgroundColor: VIOLET }}
            />
            <div
              className="absolute -right-10 -top-10 h-32 w-32 rounded-full blur-3xl verify-pulse"
              style={{ backgroundColor: "rgba(167,139,250,0.20)" }}
            />
            <div
              className="absolute -left-8 bottom-0 h-28 w-28 rounded-full blur-3xl verify-pulse"
              style={{
                backgroundColor: "rgba(0,255,135,0.16)",
                animationDelay: "1s",
              }}
            />

            <div className="relative z-10">
              <div className="inline-flex items-center gap-2 border border-white/10 bg-black/40 px-3 py-1">
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: CYAN }}
                />
                <span className="text-[11px] font-extrabold tracking-wider uppercase text-white/80">
                  email verification
                </span>
              </div>

              <div className="mt-6 flex items-center gap-4">
                <div className="relative verify-float">
                  <div
                    className="absolute inset-0 rounded-full blur-2xl opacity-20"
                    style={{ backgroundColor: "rgba(0,212,255,0.22)" }}
                  />
                  <div className="relative h-14 w-14 border border-white/10 bg-white/[0.04] p-2 flex items-center justify-center">
                    <img
                      src={logo}
                      alt="Nummoria"
                      className="h-full w-full object-contain"
                    />
                  </div>
                </div>

                <div>
                  <div className="text-xs uppercase tracking-[0.22em] text-white/40">
                    Nummoria
                  </div>
                  <h1 className="mt-1 text-3xl md:text-4xl font-extrabold tracking-tight text-white leading-none">
                    Verify your email
                  </h1>
                </div>
              </div>

              <p className="mt-4 text-sm md:text-base leading-relaxed text-white/65 max-w-xl">
                We sent a 6-digit code to{" "}
                <span className="font-semibold text-white">
                  {emailMasked || "your email"}
                </span>
                .
              </p>

              <ScanLine color={VIOLET} className="mt-5 max-w-md" />

              <form onSubmit={onVerify} className="mt-8 space-y-5">
                {demoCode ? (
                  <div className="border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
                    <strong>DEV</strong> — demo code:{" "}
                    <span className="font-mono">{demoCode}</span>
                  </div>
                ) : null}

                {err ? (
                  <div className="border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-100">
                    {err}
                  </div>
                ) : null}

                {msg ? (
                  <div className="border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
                    {msg}
                  </div>
                ) : null}

                <div>
                  <label className="block text-xs font-bold tracking-wider uppercase text-white/75 mb-2">
                    Verification Code
                  </label>
                  <input
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                    required
                    placeholder="Enter 6-digit code"
                    className="w-full border border-white/10 bg-white/[0.03] px-4 py-3 text-white placeholder:text-white/30 outline-none transition focus:border-white/20"
                  />
                  <p className="mt-2 text-xs text-white/40">
                    The code expires in about 15 minutes.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    type="submit"
                    disabled={loading || (!email && !regToken)}
                    className={`inline-flex h-12 items-center justify-center px-5 text-sm font-extrabold tracking-wider uppercase transition ${
                      loading || (!email && !regToken)
                        ? "cursor-not-allowed opacity-60"
                        : "hover:opacity-95"
                    }`}
                    style={{
                      background: `linear-gradient(180deg, ${MINT}, #19d96f)`,
                      color: "#02140a",
                      boxShadow: "0 0 28px rgba(0,255,135,0.18)",
                    }}
                  >
                    {loading ? "Verifying..." : "Verify"}
                  </button>

                  <button
                    type="button"
                    onClick={onResend}
                    disabled={resending || (!email && !regToken)}
                    className={`inline-flex h-12 items-center justify-center border border-white/10 bg-white/[0.05] px-5 text-sm font-bold tracking-wider uppercase text-white/80 transition ${
                      resending || (!email && !regToken)
                        ? "cursor-not-allowed opacity-60"
                        : "hover:bg-white/[0.08] hover:text-white"
                    }`}
                  >
                    {resending ? "Resending..." : "Resend Code"}
                  </button>
                </div>
              </form>

              <div className="mt-6 text-center">
                <a
                  href="/login"
                  className="text-sm text-white/45 underline decoration-white/20 underline-offset-4 hover:text-white/70"
                >
                  Back to login
                </a>
              </div>
            </div>
          </div>

          <div className="mt-4 text-center text-xs tracking-wide text-white/40">
            Use the email code promptly before it expires.
          </div>
        </div>
      </div>
    </div>
  );
}
