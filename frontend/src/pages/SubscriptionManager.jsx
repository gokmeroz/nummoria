/* eslint-disable */
import { useState, useEffect, useRef, useCallback, memo } from "react";
import logo from "../assets/nummoria_logo.png";

/**
 * Pricing page — redesigned with the Nummoria HUD aesthetic
 * Matches the visual language of ExpensesScreen.jsx
 */

/* ─── THEME ─────────────────────────────────────────────────── */
const BG = "#030508";
const MINT = "#00ff87";
const CYAN = "#00d4ff";
const VIOLET = "#a78bfa";

const IOS_APP_URL = "https://apps.apple.com/app/idYOUR_APP_ID";
const ANDROID_APP_URL =
  "https://play.google.com/store/apps/details?id=YOUR_PACKAGE_NAME";

/* ─── UI PRIMITIVES (shared with Expenses) ───────────────────── */
const Brackets = memo(({ color = MINT, size = "10px", thick = "1.5px" }) => (
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
));

const ScanLine = memo(({ color = MINT, className = "" }) => (
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
));

/* ─── STARS BACKGROUND ───────────────────────────────────────── */
function Stars() {
  const stars = [
    { top: "8%", left: "5%", size: 2, opacity: 0.22 },
    { top: "14%", left: "19%", size: 1.5, opacity: 0.14 },
    { top: "10%", left: "31%", size: 3, opacity: 0.28 },
    { top: "22%", left: "8%", size: 2, opacity: 0.2 },
    { top: "38%", left: "13%", size: 1.5, opacity: 0.18 },
    { top: "31%", left: "27%", size: 2.5, opacity: 0.22 },
    { top: "50%", left: "75%", size: 2, opacity: 0.22 },
    { top: "62%", left: "84%", size: 2.5, opacity: 0.18 },
    { top: "74%", left: "22%", size: 1.5, opacity: 0.14 },
    { top: "80%", left: "38%", size: 2, opacity: 0.2 },
    { top: "86%", left: "79%", size: 2, opacity: 0.16 },
    { top: "91%", left: "60%", size: 1.5, opacity: 0.18 },
    { top: "69%", left: "57%", size: 3, opacity: 0.12 },
    { top: "44%", left: "91%", size: 1.5, opacity: 0.2 },
    { top: "55%", left: "32%", size: 2, opacity: 0.16 },
  ];
  const greenDots = [
    { top: "19%", left: "46%" },
    { top: "28%", left: "54%" },
    { top: "41%", left: "67%" },
    { top: "57%", left: "44%" },
    { top: "65%", left: "72%" },
    { top: "78%", left: "50%" },
    { top: "88%", left: "65%" },
    { top: "35%", left: "82%" },
    { top: "51%", left: "14%" },
  ];
  return (
    <>
      {stars.map((s, i) => (
        <span
          key={`s-${i}`}
          className="absolute rounded-full bg-white"
          style={{
            top: s.top,
            left: s.left,
            width: s.size,
            height: s.size,
            opacity: s.opacity,
            boxShadow: "0 0 6px rgba(255,255,255,0.25)",
          }}
        />
      ))}
      {greenDots.map((s, i) => (
        <span
          key={`g-${i}`}
          className="absolute rounded-full"
          style={{
            top: s.top,
            left: s.left,
            width: 3,
            height: 3,
            opacity: 0.45,
            backgroundColor: MINT,
            boxShadow: "0 0 8px rgba(0,255,135,0.35)",
          }}
        />
      ))}
    </>
  );
}

/* ─── ANIMATED RING BADGE ────────────────────────────────────── */
function HudRing({ color = CYAN, size = 120 }) {
  const cx = size / 2,
    r1 = size * 0.42,
    r2 = size * 0.35;
  return (
    <svg width={size} height={size} className="pointer-events-none">
      <circle
        cx={cx}
        cy={cx}
        r={r1}
        fill="none"
        stroke={color}
        strokeOpacity=".2"
        strokeWidth="2"
        strokeDasharray="30 10 5 10"
        className="hud-spin-reverse"
      />
      <circle
        cx={cx}
        cy={cx}
        r={r2}
        fill="none"
        stroke="rgba(255,255,255,.12)"
        strokeWidth="1"
        strokeDasharray="4 6"
        className="hud-spin"
      />
      <path
        d={`M ${cx} ${cx - r2 + 10} v 8 M ${cx} ${cx + r2 - 10} v -8 M ${cx - r2 + 10} ${cx} h 8 M ${cx + r2 - 10} ${cx} h -8`}
        stroke="rgba(255,255,255,0.25)"
        strokeWidth="1.5"
      />
    </svg>
  );
}

/* ─── PLAN CARD ──────────────────────────────────────────────── */
const PLAN_ACCENT = { standard: VIOLET, plus: MINT, premium: CYAN };

function PlanCard({
  plan,
  title,
  subtitle,
  price,
  period,
  bullets,
  featured,
  badge,
  buttonLabel,
  buttonDisabled,
  footer,
  onClick,
  animDelay = 0,
}) {
  const color = PLAN_ACCENT[plan] || CYAN;
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className="relative border flex flex-col overflow-hidden transition-all duration-500 card-reveal"
      style={{
        borderColor: hovered ? `${color}88` : `${color}33`,
        backgroundColor: `${BG}`,
        animationDelay: `${animDelay}ms`,
        boxShadow: hovered
          ? `0 0 40px ${color}18, inset 0 0 20px ${color}06`
          : "none",
        transform:
          featured && hovered
            ? "translateY(-4px)"
            : featured
              ? "translateY(-2px)"
              : hovered
                ? "translateY(-2px)"
                : "none",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Brackets */}
      <Brackets color={color} size="12px" thick="1.5px" />

      {/* Top accent line */}
      <div
        className="absolute top-0 inset-x-[10%] h-[1px] transition-opacity duration-500"
        style={{ backgroundColor: color, opacity: hovered ? 0.7 : 0.3 }}
      />

      {/* Scanline overlay */}
      <div
        className="absolute inset-0 opacity-[0.025] pointer-events-none"
        style={{
          background:
            "repeating-linear-gradient(0deg,rgba(255,255,255,0.05) 0px,rgba(255,255,255,0.05) 1px,transparent 1px,transparent 4px)",
        }}
      />

      {/* Grid pattern */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.04]"
        style={{
          backgroundImage: `linear-gradient(to right,${color} 1px,transparent 1px),linear-gradient(to bottom,${color} 1px,transparent 1px)`,
          backgroundSize: "28px 28px",
        }}
      />

      {/* Corner glow */}
      <div
        className="absolute -top-6 -right-6 w-24 h-24 rounded-full blur-3xl pointer-events-none transition-opacity duration-500"
        style={{ backgroundColor: color, opacity: hovered ? 0.12 : 0.04 }}
      />

      <div className="relative p-5 md:p-6 flex flex-col flex-1">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3 mb-6">
          <div>
            <div
              className="inline-flex items-center gap-2 border bg-black/40 px-3 py-1 mb-3"
              style={{ borderColor: `${color}33` }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full transition-all duration-300"
                style={{
                  backgroundColor: color,
                  boxShadow: hovered ? `0 0 8px ${color}` : "none",
                }}
              />
              <span className="text-[10px] font-extrabold tracking-[0.28em] text-white/80 uppercase">
                {title}
              </span>
            </div>
            <p className="text-xs text-white/55 tracking-wider uppercase">
              {subtitle}
            </p>
          </div>
          {badge && (
            <span
              className="border px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase"
              style={{
                borderColor: `${color}44`,
                color,
                backgroundColor: `${color}11`,
              }}
            >
              {badge}
            </span>
          )}
        </div>

        <ScanLine color={color} className="mb-6" />

        {/* Price */}
        <div className="flex items-end gap-2 mb-8">
          <div
            className="text-[56px] leading-none font-black tracking-[-0.04em] transition-all duration-300"
            style={{
              color,
              textShadow: hovered ? `0 0 24px ${color}55` : "none",
            }}
          >
            {price}
          </div>
          <div className="pb-2 text-[10px] uppercase tracking-[0.2em] text-white/30">
            {period}
          </div>
        </div>

        {/* Bullets */}
        <ul className="flex-1 space-y-3 mb-8">
          {bullets.map((b, i) => (
            <li
              key={i}
              className="flex items-start gap-3 text-sm text-white/70"
            >
              <span
                className="mt-[6px] h-2 w-2 rounded-full shrink-0 transition-all duration-300"
                style={{
                  backgroundColor: color,
                  boxShadow: hovered ? `0 0 8px ${color}` : "none",
                }}
              />
              <span className="tracking-wide">{b}</span>
            </li>
          ))}
        </ul>

        <ScanLine color={color} className="mb-5" />

        {/* Button */}
        <button
          type="button"
          onClick={buttonDisabled ? undefined : onClick}
          disabled={buttonDisabled}
          className="relative w-full h-11 border text-xs font-extrabold tracking-[0.2em] uppercase transition-all duration-300 overflow-hidden group/btn"
          style={{
            borderColor: buttonDisabled
              ? "rgba(255,255,255,0.08)"
              : `${color}55`,
            color: buttonDisabled ? "rgba(255,255,255,0.35)" : color,
            backgroundColor: buttonDisabled
              ? "rgba(255,255,255,0.03)"
              : `${color}0d`,
          }}
        >
          {!buttonDisabled && (
            <span
              className="absolute inset-0 opacity-0 group-hover/btn:opacity-100 transition-opacity duration-300"
              style={{ backgroundColor: `${color}18` }}
            />
          )}
          <span className="relative z-10">{buttonLabel}</span>
        </button>

        <p className="mt-3 text-center text-[10px] text-white/25 tracking-wider uppercase">
          {footer}
        </p>
      </div>
    </div>
  );
}

/* ─── FAQ ITEM ───────────────────────────────────────────────── */
function FaqItem({ q, a, isOpen, onToggle, idx }) {
  const color = [VIOLET, CYAN, MINT, CYAN][idx % 4];
  return (
    <div
      className="relative border overflow-hidden transition-all duration-300"
      style={{
        borderColor: isOpen ? `${color}44` : "rgba(255,255,255,0.07)",
        backgroundColor: isOpen ? `${color}06` : "transparent",
      }}
    >
      <Brackets color={color} size="7px" thick="1px" />
      <div
        className="absolute top-0 inset-x-[15%] h-[1px] transition-opacity duration-300"
        style={{ backgroundColor: color, opacity: isOpen ? 0.35 : 0 }}
      />

      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left"
      >
        <span className="text-sm font-bold tracking-wide text-white/90">
          {q}
        </span>
        <span
          className="flex-shrink-0 inline-flex h-7 w-7 items-center justify-center border text-sm font-bold transition-all duration-300"
          style={{
            borderColor: isOpen ? `${color}55` : "rgba(255,255,255,0.1)",
            color: isOpen ? color : "rgba(255,255,255,0.4)",
            backgroundColor: isOpen ? `${color}15` : "transparent",
          }}
        >
          {isOpen ? "−" : "+"}
        </span>
      </button>

      {isOpen && (
        <div className="px-5 pb-5">
          <ScanLine color={color} className="mb-3" />
          <p className="text-sm leading-6 text-white/55 tracking-wide">{a}</p>
        </div>
      )}
    </div>
  );
}

/* ─── UPGRADE MODAL ──────────────────────────────────────────── */
function UpgradeModal({ open, plan, onClose }) {
  if (!open) return null;
  const planLabel = plan === "premium" ? "Premium" : "Plus";
  const color = plan === "premium" ? CYAN : MINT;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-[#030508]/92 backdrop-blur-sm px-4"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="relative w-full max-w-lg border text-white shadow-2xl overflow-hidden"
        style={{ backgroundColor: BG, borderColor: `${color}33` }}
      >
        <Brackets color={color} size="14px" thick="1.5px" />
        <div
          className="absolute top-0 inset-x-[10%] h-[1.5px] opacity-60"
          style={{ backgroundColor: color }}
        />
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `radial-gradient(600px 300px at 50% 0%, ${color}08, transparent 60%)`,
          }}
        />

        {/* Grid overlay */}
        <div
          className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{
            backgroundImage: `linear-gradient(to right,${color} 1px,transparent 1px),linear-gradient(to bottom,${color} 1px,transparent 1px)`,
            backgroundSize: "24px 24px",
          }}
        />

        <div className="relative p-6 sm:p-7">
          <div className="flex items-start gap-4 mb-6">
            <img
              src={logo}
              alt="Nummoria"
              className="h-11 w-11 rounded-none border object-contain p-1 flex-shrink-0"
              style={{
                borderColor: `${color}33`,
                backgroundColor: `${color}08`,
              }}
            />
            <div className="flex-1 min-w-0">
              <div
                className="inline-flex items-center gap-2 border bg-black/40 px-3 py-1 mb-2"
                style={{ borderColor: `${color}33` }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: color }}
                />
                <span className="text-[10px] font-extrabold tracking-[0.28em] text-white/80 uppercase">
                  Upgrade Required
                </span>
              </div>
              <h2
                className="text-lg font-extrabold tracking-tight uppercase"
                style={{ color }}
              >
                Upgrade to {planLabel}
              </h2>
              <p className="mt-1 text-sm text-white/55 tracking-wide leading-relaxed">
                Purchases are available on iOS and Android only. Web stays fully
                usable — billing lives in the app.
              </p>
            </div>
            <button
              onClick={onClose}
              className="inline-flex h-9 w-9 items-center justify-center border text-white/60 transition hover:text-white flex-shrink-0"
              style={{
                borderColor: "rgba(255,255,255,0.1)",
                backgroundColor: "rgba(255,255,255,0.03)",
              }}
              aria-label="Close"
              type="button"
            >
              ✕
            </button>
          </div>

          <ScanLine color={color} className="mb-6" />

          <div className="grid gap-3 sm:grid-cols-2 mb-5">
            <a
              href={IOS_APP_URL}
              className="inline-flex items-center justify-center h-12 border text-xs font-extrabold tracking-[0.2em] uppercase transition-all duration-300 hover:opacity-90"
              style={{
                borderColor: `${MINT}55`,
                color: "#030508",
                backgroundColor: MINT,
              }}
            >
              Download on iOS
            </a>
            <a
              href={ANDROID_APP_URL}
              className="inline-flex items-center justify-center h-12 border text-xs font-extrabold tracking-[0.2em] uppercase transition-all duration-300 hover:opacity-90"
              style={{
                borderColor: `${CYAN}55`,
                color: "#030508",
                backgroundColor: CYAN,
              }}
            >
              Get it on Android
            </a>
          </div>

          <div
            className="relative border px-4 py-3 mb-5"
            style={{
              borderColor: "rgba(255,255,255,0.08)",
              backgroundColor: "rgba(0,0,0,0.3)",
            }}
          >
            <Brackets color="rgba(255,255,255,0.12)" size="6px" thick="1px" />
            <p className="text-xs text-white/45 tracking-wide">
              Already installed? Open the app and navigate to{" "}
              <span className="text-white/75 font-bold">
                Settings → Subscription
              </span>
              .
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-full h-11 border text-xs font-extrabold tracking-[0.2em] uppercase transition-all duration-300 hover:bg-white/5"
            style={{
              borderColor: "rgba(255,255,255,0.08)",
              color: "rgba(255,255,255,0.6)",
              backgroundColor: "rgba(255,255,255,0.02)",
            }}
          >
            Not Now
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── FEATURE COMPARISON ROW ─────────────────────────────────── */
function CompareRow({ label, std, plus, prem, isEven }) {
  const cell = (val, color) => {
    if (val === false) return <span className="text-white/20 text-xs">—</span>;
    if (val === true)
      return (
        <span className="font-bold text-xs" style={{ color }}>
          ✓
        </span>
      );
    return (
      <span className="font-extrabold text-sm" style={{ color }}>
        {val}
      </span>
    );
  };
  return (
    <div
      className={`grid grid-cols-4 items-center px-4 py-3 border-b border-white/5 transition-colors duration-200 ${isEven ? "bg-white/[0.01]" : ""} hover:bg-white/[0.025]`}
    >
      <span className="text-white/65 tracking-wide text-xs uppercase font-bold pr-4">
        {label}
      </span>
      <span className="text-center">{cell(std, VIOLET)}</span>
      <span className="text-center">{cell(plus, MINT)}</span>
      <span className="text-center">{cell(prem, CYAN)}</span>
    </div>
  );
}

/* ─── MAIN PAGE ──────────────────────────────────────────────── */
export default function PricingPage() {
  const [upgradeModal, setUpgradeModal] = useState(null);
  const [openFaq, setOpenFaq] = useState(0);
  const [tick, setTick] = useState(0);

  // Subtle live ticker for the HUD feel
  useEffect(() => {
    const id = setInterval(() => setTick((t) => (t + 1) % 9999), 1800);
    return () => clearInterval(id);
  }, []);

  const faqs = [
    {
      q: "Is this financial advice?",
      a: "No. Nummoria provides educational guidance, scenario analysis, and structured financial insights based on your inputs. It does not provide regulated financial advice.",
    },
    {
      q: "Can I upgrade on web?",
      a: "No. For platform and billing compliance, upgrades are available only through the mobile app on iOS and Android.",
    },
    {
      q: "Can I cancel anytime?",
      a: "Yes. You can manage or cancel your subscription through your mobile app store subscription settings at any time.",
    },
    {
      q: "What is included in Standard?",
      a: "Standard gives you transaction tracking, monthly reports, and core money organisation features so you can use Nummoria without a paid plan.",
    },
  ];

  const compareFeatures = [
    { label: "AI Chats per Day", std: "1", plus: "5", prem: "∞" },
    { label: "Monthly Reports", std: true, plus: true, prem: true },
    { label: "Basic Support", std: true, plus: true, prem: true },
    { label: "AI Financial Helper", std: false, plus: true, prem: true },
    { label: "Smarter Summaries", std: false, plus: true, prem: true },
    { label: "Priority Reports", std: false, plus: true, prem: true },
    { label: "Advanced AI Helper", std: false, plus: false, prem: true },
    { label: "Priority Support", std: false, plus: false, prem: true },
    { label: "Early Access Features", std: false, plus: false, prem: true },
    { label: "Data Export", std: false, plus: false, prem: true },
    { label: "Multi-Currency Support", std: false, plus: false, prem: true },
  ];

  return (
    <div
      className="min-h-[100dvh] overflow-hidden"
      style={{ backgroundColor: BG, color: "#e2e8f0" }}
    >
      {/* ── GLOBAL STYLES ── */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @keyframes spin-slow         { 100% { transform: rotate(360deg);  } }
        @keyframes spin-slow-reverse { 100% { transform: rotate(-360deg); } }
        @keyframes fadeSlideUp       { from { opacity:0; transform:translateY(18px); } to { opacity:1; transform:none; } }
        @keyframes pulseGlow         { 0%,100% { opacity:.5; } 50% { opacity:1; } }
        @keyframes ticker            { from { transform:translateX(0); } to { transform:translateX(-50%); } }

        .hud-spin         { animation: spin-slow          20s linear infinite; transform-origin:center; }
        .hud-spin-reverse { animation: spin-slow-reverse  15s linear infinite; transform-origin:center; }
        .card-reveal      { animation: fadeSlideUp .55s cubic-bezier(.22,1,.36,1) both; }
        .pulse-glow       { animation: pulseGlow 2.4s ease-in-out infinite; }

        .ticker-wrap { overflow:hidden; }
        .ticker-inner { display:flex; width:max-content; animation: ticker 28s linear infinite; }

        .custom-scrollbar::-webkit-scrollbar { width:4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background:rgba(255,255,255,0.02); }
        .custom-scrollbar::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.18); border-radius:4px; }
      `,
        }}
      />

      {/* ── FIXED BACKGROUND ── */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div style={{ position: "absolute", inset: 0, backgroundColor: BG }} />
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `radial-gradient(1100px 600px at 50% -5%, rgba(0,255,135,0.055), transparent 55%),
                      radial-gradient(900px 500px at 80% 90%, rgba(0,212,255,0.045), transparent 60%),
                      radial-gradient(700px 400px at 10% 60%, rgba(167,139,250,0.04), transparent 55%)`,
          }}
        />
        {/* Fine grid */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            opacity: 0.06,
            backgroundImage:
              "linear-gradient(to right,rgba(255,255,255,0.06) 1px,transparent 1px),linear-gradient(to bottom,rgba(255,255,255,0.06) 1px,transparent 1px)",
            backgroundSize: "44px 44px",
          }}
        />
        <div style={{ position: "absolute", inset: 0 }}>
          <Stars />
        </div>
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(to bottom, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.55) 100%)",
          }}
        />
      </div>

      {/* ── TICKER TAPE ── */}
      <div className="border-b border-white/5 bg-black/30 backdrop-blur-sm py-1.5 overflow-hidden">
        <div className="ticker-wrap">
          <div className="ticker-inner">
            {Array(2)
              .fill(null)
              .map((_, ri) => (
                <div key={ri} className="flex gap-8 px-4 items-center">
                  {[
                    "NUMMORIA",
                    "EXPENSE LEDGER",
                    "AI CLARITY",
                    "TRACK · REPORT · OPTIMISE",
                    "PLANS FROM $0",
                  ].map((t, i) => (
                    <span
                      key={i}
                      className="flex items-center gap-2 text-[10px] font-extrabold tracking-[0.3em] uppercase whitespace-nowrap"
                    >
                      <span
                        className="h-1 w-1 rounded-full pulse-glow"
                        style={{
                          backgroundColor: [MINT, CYAN, VIOLET, MINT, CYAN][
                            i % 5
                          ],
                        }}
                      />
                      <span
                        style={{
                          color: [
                            MINT,
                            CYAN,
                            VIOLET,
                            "rgba(255,255,255,0.5)",
                            "rgba(255,255,255,0.5)",
                          ][i % 5],
                        }}
                      >
                        {t}
                      </span>
                    </span>
                  ))}
                </div>
              ))}
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-screen-xl w-full px-4 sm:px-6 lg:px-8 py-10 flex flex-col gap-10">
        {/* ── HERO HEADER ── */}
        <div
          className="relative border border-[#00ff87]/20 bg-[#00ff87]/[0.02] p-6 md:p-8 overflow-hidden card-reveal"
          style={{ animationDelay: "0ms" }}
        >
          <Brackets color={MINT} size="14px" thick="1.5px" />
          <div
            className="absolute top-0 inset-x-[10%] h-[1px] opacity-40"
            style={{ backgroundColor: MINT }}
          />
          <div
            className="absolute inset-0 pointer-events-none opacity-[0.03]"
            style={{
              backgroundImage: `linear-gradient(to right,${MINT} 1px,transparent 1px),linear-gradient(to bottom,${MINT} 1px,transparent 1px)`,
              backgroundSize: "28px 28px",
            }}
          />

          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 border border-white/10 bg-black/40 px-3 py-1 mb-4">
                <span
                  className="w-1.5 h-1.5 rounded-full pulse-glow"
                  style={{ backgroundColor: MINT }}
                />
                <span className="text-[10px] font-extrabold tracking-[0.35em] text-white/80 uppercase">
                  Pricing
                </span>
              </div>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tight text-white leading-none mb-4">
                Plans built for
                <br />
                <span style={{ color: MINT }}>momentum</span>
              </h1>
              <p className="max-w-lg text-base text-white/55 leading-relaxed tracking-wide">
                Start free. Upgrade when you want deeper AI clarity. Cancel
                anytime through your app store.
              </p>
              <ScanLine color={MINT} className="mt-6 max-w-sm" />
            </div>

            {/* HUD ring cluster */}
            <div className="relative flex-shrink-0 hidden md:flex items-center justify-center w-36 h-36">
              <div
                className="absolute inset-0 rounded-full blur-3xl opacity-15"
                style={{ backgroundColor: MINT }}
              />
              <HudRing color={MINT} size={144} />
              <div className="absolute inset-0 flex items-center justify-center flex-col">
                <div className="text-[10px] font-extrabold tracking-[0.3em] text-white/60 uppercase mb-1">
                  From
                </div>
                <div className="text-2xl font-black" style={{ color: MINT }}>
                  $0
                </div>
                <div className="text-[9px] tracking-[0.25em] text-white/40 uppercase">
                  /month
                </div>
              </div>
            </div>
          </div>

          {/* Live HUD status bar */}
          <div className="mt-6 flex flex-wrap items-center gap-3">
            {[
              { label: "Status", val: "Active", color: MINT },
              { label: "Plans", val: "3 tiers", color: CYAN },
              { label: "Billing", val: "App store only", color: VIOLET },
              {
                label: "Tick",
                val: `#${String(tick).padStart(4, "0")}`,
                color: "rgba(255,255,255,0.25)",
              },
            ].map(({ label, val, color }) => (
              <div
                key={label}
                className="inline-flex items-center gap-2 border bg-black/40 px-3 py-1"
                style={{ borderColor: "rgba(255,255,255,0.08)" }}
              >
                <span className="text-[10px] tracking-wider text-white/40 uppercase">
                  {label}
                </span>
                <span
                  className="text-[10px] font-extrabold tracking-wider uppercase"
                  style={{ color }}
                >
                  {val}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* ── PLAN CARDS ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-5">
          <PlanCard
            plan="standard"
            title="Standard"
            subtitle="Track & report"
            price="$0"
            period="/month"
            bullets={[
              "1 AI chat per 24 hours",
              "Transaction tracking",
              "Monthly reports",
              "Basic support",
            ]}
            buttonLabel="Your plan"
            buttonDisabled
            footer="Ideal for tracking and basic reporting"
            animDelay={80}
          />
          <PlanCard
            plan="plus"
            title="Plus"
            subtitle="AI clarity, every month"
            price="$4.99"
            period="/month"
            featured
            badge="Most popular"
            bullets={[
              "Everything in Standard",
              "5 AI chats per 24 hours",
              "AI Financial Helper",
              "Smarter summaries",
              "Priority reports",
            ]}
            buttonLabel="Upgrade to Plus"
            onClick={() => setUpgradeModal({ plan: "plus" })}
            footer="Best value: AI clarity + reporting"
            animDelay={160}
          />
          <PlanCard
            plan="premium"
            title="Premium"
            subtitle="Advanced AI + priority support"
            price="$9.99"
            period="/month"
            bullets={[
              "Everything in Plus",
              "Unlimited AI chats",
              "Advanced AI Helper",
              "Priority support",
              "Early access features",
              "Data export",
              "Multi-currency",
            ]}
            buttonLabel="Upgrade to Premium"
            onClick={() => setUpgradeModal({ plan: "premium" })}
            footer="Power users: advanced AI and full exports"
            animDelay={240}
          />
        </div>

        {/* ── APP-ONLY NOTICE ── */}
        <div
          className="relative border border-white/6 bg-white/[0.015] px-5 py-3 flex items-center gap-3 card-reveal"
          style={{ animationDelay: "320ms" }}
        >
          <Brackets color="rgba(255,255,255,0.12)" size="7px" thick="1px" />
          <span
            className="w-1.5 h-1.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: CYAN }}
          />
          <span className="text-[11px] tracking-[0.2em] uppercase text-white/30 font-bold">
            Purchases are handled exclusively in the mobile app · Web remains
            fully usable
          </span>
        </div>

        {/* ── FEATURE COMPARISON ── */}
        <div
          className="relative border border-[#a78bfa]/20 bg-[#a78bfa]/[0.02] overflow-hidden card-reveal"
          style={{ animationDelay: "360ms" }}
        >
          <Brackets color={VIOLET} size="12px" thick="1.5px" />
          <div
            className="absolute top-0 inset-x-[10%] h-[1px] opacity-35"
            style={{ backgroundColor: VIOLET }}
          />

          <div className="p-5 md:p-6">
            <div
              className="inline-flex items-center gap-2 border bg-black/40 px-3 py-1 mb-4"
              style={{ borderColor: `${VIOLET}33` }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: VIOLET }}
              />
              <span className="text-[10px] font-extrabold tracking-[0.28em] text-white/80 uppercase">
                Feature Matrix
              </span>
            </div>
            <ScanLine color={VIOLET} className="mb-5 max-w-xs" />

            {/* Column headers */}
            <div className="grid grid-cols-4 items-center px-4 py-2 mb-1">
              <span className="text-[10px] font-extrabold tracking-wider text-white/40 uppercase">
                Feature
              </span>
              {[
                { label: "Standard", color: VIOLET },
                { label: "Plus", color: MINT },
                { label: "Premium", color: CYAN },
              ].map(({ label, color }) => (
                <span
                  key={label}
                  className="text-center text-[10px] font-extrabold tracking-wider uppercase"
                  style={{ color }}
                >
                  {label}
                </span>
              ))}
            </div>

            <div className="border border-white/6">
              {compareFeatures.map((row, i) => (
                <CompareRow key={row.label} {...row} isEven={i % 2 === 0} />
              ))}
            </div>
          </div>
        </div>

        {/* ── FAQ ── */}
        <div
          className="grid grid-cols-1 lg:grid-cols-12 gap-5 card-reveal"
          style={{ animationDelay: "440ms" }}
        >
          {/* Left label panel */}
          <div className="lg:col-span-4 relative border border-[#00d4ff]/18 bg-[#00d4ff]/[0.02] p-5 md:p-6 flex flex-col justify-between">
            <Brackets color={CYAN} size="10px" thick="1.5px" />
            <div
              className="absolute top-0 inset-x-[10%] h-[1px] opacity-3"
              style={{ backgroundColor: CYAN }}
            />
            <div>
              <div
                className="inline-flex items-center gap-2 border bg-black/40 px-3 py-1 mb-4"
                style={{ borderColor: `${CYAN}33` }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: CYAN }}
                />
                <span className="text-[10px] font-extrabold tracking-[0.28em] text-white/80 uppercase">
                  FAQ
                </span>
              </div>
              <h2 className="text-3xl md:text-4xl font-black tracking-tight text-white mb-3">
                Quick
                <br />
                answers
              </h2>
              <p className="text-sm text-white/45 tracking-wide leading-relaxed">
                Everything you need to know before choosing a plan.
              </p>
            </div>
            <ScanLine color={CYAN} className="mt-6" />

            {/* Mini HUD ring decoration */}
            <div className="relative mt-6 hidden lg:flex items-center justify-center">
              <div
                className="absolute inset-0 rounded-full blur-3xl opacity-10"
                style={{ backgroundColor: CYAN }}
              />
              <HudRing color={CYAN} size={100} />
              <div className="absolute inset-0 flex items-center justify-center flex-col">
                <span className="text-[9px] font-extrabold tracking-[0.3em] text-white/40 uppercase">
                  {faqs.length} answers
                </span>
              </div>
            </div>
          </div>

          {/* Right accordion */}
          <div className="lg:col-span-8 flex flex-col gap-2.5">
            {faqs.map((item, idx) => (
              <FaqItem
                key={idx}
                q={item.q}
                a={item.a}
                idx={idx}
                isOpen={openFaq === idx}
                onToggle={() => setOpenFaq(openFaq === idx ? -1 : idx)}
              />
            ))}
          </div>
        </div>

        {/* ── BOTTOM CTA ── */}
        <div
          className="relative border border-[#00ff87]/15 bg-[#00ff87]/[0.02] p-6 md:p-8 overflow-hidden card-reveal text-center"
          style={{ animationDelay: "520ms" }}
        >
          <Brackets color={MINT} size="12px" thick="1.5px" />
          <div
            className="absolute top-0 inset-x-[10%] h-[1px] opacity-30"
            style={{ backgroundColor: MINT }}
          />
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: `radial-gradient(700px 300px at 50% 0%, ${MINT}07, transparent 60%)`,
            }}
          />

          <div
            className="inline-flex items-center gap-2 border bg-black/40 px-3 py-1 mb-5"
            style={{ borderColor: `${MINT}33` }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full pulse-glow"
              style={{ backgroundColor: MINT }}
            />
            <span className="text-[10px] font-extrabold tracking-[0.28em] text-white/80 uppercase">
              Get started
            </span>
          </div>

          <h2 className="text-3xl md:text-4xl font-black tracking-tight text-white mb-3">
            Ready to take control?
          </h2>
          <p className="text-sm text-white/45 mb-8 max-w-sm mx-auto leading-relaxed tracking-wide">
            Download the app, start on Standard for free, and upgrade whenever
            you need deeper AI clarity.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <a
              href={IOS_APP_URL}
              className="inline-flex items-center justify-center h-11 px-7 border text-xs font-extrabold tracking-[0.2em] uppercase transition-all duration-300 hover:opacity-90"
              style={{
                borderColor: `${MINT}55`,
                color: "#030508",
                backgroundColor: MINT,
              }}
            >
              iOS App
            </a>
            <a
              href={ANDROID_APP_URL}
              className="inline-flex items-center justify-center h-11 px-7 border text-xs font-extrabold tracking-[0.2em] uppercase transition-all duration-300 hover:opacity-90"
              style={{
                borderColor: `${CYAN}55`,
                color: "#030508",
                backgroundColor: CYAN,
              }}
            >
              Android App
            </a>
          </div>

          <ScanLine color={MINT} className="mt-8 max-w-xs mx-auto" />
        </div>
      </main>

      <UpgradeModal
        open={!!upgradeModal}
        plan={upgradeModal?.plan}
        onClose={() => setUpgradeModal(null)}
      />
    </div>
  );
}
