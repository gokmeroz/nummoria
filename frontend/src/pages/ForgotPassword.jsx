import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../lib/api";
import logo from "../assets/nummoria_logo.png";

const BG = "#030508";
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

export default function ForgotPassword() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const emailOk =
    typeof email === "string" &&
    /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());

  async function submit(e) {
    e.preventDefault();
    setErr("");
    setMsg("");
    setLoading(true);

    try {
      const { data } = await api.post("/auth/forgot-password", {
        email: email.trim(),
      });

      setMsg(
        data?.message ||
          "If an account exists for this email, a reset link has been sent.",
      );
    } catch (e) {
      setErr(e?.response?.data?.error || "Failed to send reset email");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-dvh overflow-hidden bg-[#030508] text-white">
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @keyframes forgotFloat {
              0%, 100% { transform: translateY(0px); }
              50% { transform: translateY(-4px); }
            }

            @keyframes forgotPulse {
              0%, 100% { opacity: .16; transform: scale(1); }
              50% { opacity: .3; transform: scale(1.06); }
            }

            .forgot-float {
              animation: forgotFloat 5.5s ease-in-out infinite;
            }

            .forgot-pulse {
              animation: forgotPulse 3.6s ease-in-out infinite;
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
              className="absolute -right-10 -top-10 h-32 w-32 rounded-full blur-3xl forgot-pulse"
              style={{ backgroundColor: "rgba(167,139,250,0.20)" }}
            />
            <div
              className="absolute -left-8 bottom-0 h-28 w-28 rounded-full blur-3xl forgot-pulse"
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
                  auth recovery
                </span>
              </div>

              <div className="mt-6 flex items-center gap-4">
                <div className="relative forgot-float">
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
                    Forgot password
                  </h1>
                </div>
              </div>

              <p className="mt-4 text-sm md:text-base leading-relaxed text-white/65 max-w-xl">
                Enter your email and we’ll send you a password reset link if the
                account exists.
              </p>

              <ScanLine color={VIOLET} className="mt-5 max-w-md" />

              <form onSubmit={submit} className="mt-8 space-y-5">
                {msg ? (
                  <div className="border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
                    {msg}
                  </div>
                ) : null}

                {err ? (
                  <div className="border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-100">
                    {err}
                  </div>
                ) : null}

                <div>
                  <label className="block text-xs font-bold tracking-wider uppercase text-white/75 mb-2">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="you@example.com"
                    className={`w-full border px-4 py-3 text-white placeholder:text-white/30 outline-none transition ${
                      email && !emailOk
                        ? "border-red-400/30 bg-red-400/10 focus:border-red-400/40"
                        : "border-white/10 bg-white/[0.03] focus:border-white/20"
                    }`}
                  />
                  {email && !emailOk ? (
                    <p className="mt-2 text-xs text-red-200">
                      Please enter a valid email address.
                    </p>
                  ) : null}
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    type="submit"
                    disabled={loading || !emailOk}
                    className={`inline-flex h-12 items-center justify-center px-5 text-sm font-extrabold tracking-wider uppercase transition ${
                      loading || !emailOk
                        ? "cursor-not-allowed opacity-60"
                        : "hover:opacity-95"
                    }`}
                    style={{
                      background: `linear-gradient(180deg, ${MINT}, #19d96f)`,
                      color: "#02140a",
                      boxShadow: "0 0 28px rgba(0,255,135,0.18)",
                    }}
                  >
                    {loading ? "Sending..." : "Send Reset Link"}
                  </button>

                  <button
                    type="button"
                    onClick={() => navigate("/login")}
                    className="inline-flex h-12 items-center justify-center border border-white/10 bg-white/[0.05] px-5 text-sm font-bold tracking-wider uppercase text-white/80 transition hover:bg-white/[0.08] hover:text-white"
                  >
                    Back to Login
                  </button>
                </div>
              </form>
            </div>
          </div>

          <div className="mt-4 text-center text-xs tracking-wide text-white/40">
            If the email exists, the reset link should arrive shortly.
          </div>
        </div>
      </div>
    </div>
  );
}
