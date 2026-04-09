/* eslint-disable no-empty */
/* src/pages/Goodbye.jsx */
import { useEffect } from "react";
import byeImage from "../assets/bye.jpg";
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

export default function Goodbye() {
  useEffect(() => {
    try {
      localStorage.removeItem("token");
    } catch {}
  }, []);

  return (
    <div className="relative min-h-dvh overflow-hidden bg-[#030508] text-white">
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @keyframes goodbyeFloat {
              0%, 100% { transform: translateY(0px); }
              50% { transform: translateY(-5px); }
            }

            @keyframes goodbyePulse {
              0%, 100% { opacity: .16; transform: scale(1); }
              50% { opacity: .28; transform: scale(1.06); }
            }

            .goodbye-float {
              animation: goodbyeFloat 5.5s ease-in-out infinite;
            }

            .goodbye-pulse {
              animation: goodbyePulse 3.5s ease-in-out infinite;
            }
          `,
        }}
      />

      <img
        src={byeImage}
        alt="Background"
        className="absolute inset-0 h-full w-full object-cover"
      />

      <div className="absolute inset-0 bg-black/55" />
      <div className="absolute inset-0 bg-[radial-gradient(900px_500px_at_20%_10%,rgba(0,255,135,0.10),transparent_60%),radial-gradient(800px_500px_at_80%_0%,rgba(167,139,250,0.12),transparent_58%),radial-gradient(900px_700px_at_50%_100%,rgba(0,212,255,0.08),transparent_62%)]" />
      <div className="absolute inset-0 opacity-[0.07] bg-[linear-gradient(to_right,rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.08)_1px,transparent_1px)] bg-[size:42px_42px]" />

      <div className="relative z-10 min-h-dvh px-6 py-10 flex items-center justify-center">
        <div className="w-full max-w-3xl">
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
              className="absolute -right-10 -top-10 h-36 w-36 rounded-full blur-3xl goodbye-pulse"
              style={{ backgroundColor: "rgba(167,139,250,0.22)" }}
            />
            <div
              className="absolute -left-8 bottom-0 h-32 w-32 rounded-full blur-3xl goodbye-pulse"
              style={{
                backgroundColor: "rgba(0,255,135,0.16)",
                animationDelay: "1.1s",
              }}
            />

            <div className="relative z-10">
              <div className="inline-flex items-center gap-2 border border-white/10 bg-black/40 px-3 py-1">
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: ROSE }}
                />
                <span className="text-[11px] font-extrabold tracking-wider uppercase text-white/80">
                  account status
                </span>
              </div>

              <div className="mt-6 flex flex-col md:flex-row md:items-center gap-5">
                <div className="relative goodbye-float">
                  <div
                    className="absolute inset-0 rounded-full blur-2xl opacity-25"
                    style={{ backgroundColor: "rgba(255,77,141,0.28)" }}
                  />
                  <div className="relative grid h-24 w-24 place-items-center rounded-full border border-white/10 bg-black/50">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-11 w-11 text-white/75"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                    >
                      <path d="M15 12h6" />
                      <path d="M15 8h6" />
                      <path d="M15 16h6" />
                      <path d="M8 21a5 5 0 1 1 0-10 5 5 0 0 1 0 10Z" />
                      <path d="M8 11v6" />
                    </svg>
                  </div>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-3">
                    <img
                      src={logo}
                      alt="Nummoria"
                      className="h-10 w-10 border border-white/10 bg-white/[0.04] object-contain p-1"
                    />
                    <span className="text-xs uppercase tracking-[0.22em] text-white/40">
                      Nummoria
                    </span>
                  </div>

                  <h1 className="mt-4 text-3xl md:text-5xl font-extrabold tracking-tight text-white leading-none">
                    Your account is now deactivated
                  </h1>

                  <p className="mt-4 max-w-2xl text-sm md:text-base leading-relaxed text-white/68">
                    We processed your request to delete your account with a
                    soft-delete flow. Your data is hidden and your session has
                    been cleared.
                  </p>

                  <ScanLine color={VIOLET} className="mt-5 max-w-md" />
                </div>
              </div>

              <div className="mt-8 grid gap-4 md:grid-cols-3">
                <InfoTile label="Status" value="Deactivated" accent={ROSE} />
                <InfoTile label="Access" value="Signed out" accent={CYAN} />
                <InfoTile
                  label="Restore"
                  value="Support required"
                  accent={MINT}
                />
              </div>

              <div className="mt-8 border border-white/10 bg-black/25 p-4 md:p-5 text-sm leading-7 text-white/62">
                If you change your mind, your account may be restorable for a
                limited time. Contact support using the same email address you
                originally signed up with.
              </div>

              <div className="mt-8 flex flex-col sm:flex-row gap-3">
                <a
                  href="/login"
                  className="inline-flex h-12 items-center justify-center px-5 text-sm font-extrabold tracking-wider uppercase transition hover:opacity-95"
                  style={{
                    background: `linear-gradient(180deg, ${MINT}, #19d96f)`,
                    color: "#02140a",
                    boxShadow: "0 0 28px rgba(0,255,135,0.18)",
                  }}
                >
                  Back to Login
                </a>

                <a
                  href="mailto:support@nummoria.app?subject=Restore%20my%20account"
                  className="inline-flex h-12 items-center justify-center border border-white/10 bg-white/[0.05] px-5 text-sm font-bold tracking-wider uppercase text-white/80 transition hover:bg-white/[0.08] hover:text-white"
                >
                  Contact Support
                </a>

                <a
                  href="/"
                  className="inline-flex h-12 items-center justify-center border border-white/10 bg-black/30 px-5 text-sm font-bold tracking-wider uppercase text-white/60 transition hover:bg-white/[0.05] hover:text-white"
                >
                  Go to Homepage
                </a>
              </div>
            </div>
          </div>

          <div className="mt-4 text-center text-xs tracking-wide text-white/42">
            Need help restoring access? Reach out with your original signup
            email.
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoTile({ label, value, accent = MINT }) {
  return (
    <div className="relative border border-white/10 bg-black/30 p-4 overflow-hidden">
      <Brackets color={accent} size="7px" thick="1px" />
      <div className="text-[10px] font-bold uppercase tracking-wider text-white/45">
        {label}
      </div>
      <div
        className="mt-2 text-base font-extrabold tracking-wide"
        style={{ color: accent }}
      >
        {value}
      </div>
    </div>
  );
}
