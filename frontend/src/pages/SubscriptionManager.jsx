/* eslint-disable */
import { useState } from "react";
import logo from "../assets/nummoria_logo.png";

/**
 * Pricing page (WEB VIEW ONLY)
 * - Purchases are blocked on web
 * - Upgrade happens only in the mobile app
 */

const primaryColor = "#00c8ff";
const secondaryColor = "#2dfc83";

const IOS_APP_URL = "https://apps.apple.com/app/idYOUR_APP_ID";
const ANDROID_APP_URL =
  "https://play.google.com/store/apps/details?id=YOUR_PACKAGE_NAME";

export default function PricingPage() {
  const [upgradeModal, setUpgradeModal] = useState(null); // { plan: "plus" | "premium" }
  const [openFaq, setOpenFaq] = useState(0);

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
      a: "Standard gives you transaction tracking, monthly reports, and core money organization features so you can use Nummoria without a paid plan.",
    },
  ];

  return (
    <div className="min-h-[100dvh] bg-[#030608] text-white overflow-hidden">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[#030608]" />
        <div className="absolute inset-0 bg-[radial-gradient(1200px_700px_at_50%_0%,rgba(13,255,163,0.06),transparent_55%),radial-gradient(1000px_600px_at_50%_100%,rgba(0,200,255,0.05),transparent_60%)]" />
        <div className="absolute inset-0 opacity-[0.08] bg-[linear-gradient(to_right,rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:52px_52px]" />
        <div className="absolute inset-0">
          <Stars />
        </div>
        <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/25 to-black/60" />
      </div>

      <main className="mx-auto max-w-[920px] px-4 sm:px-6 lg:px-8 py-24">
        <section className="text-center">
          <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-[#1b2a22] bg-[#07100c]/80 px-4 py-1.5 text-[10px] font-semibold uppercase tracking-[0.35em] text-[#37f28c] shadow-[0_0_18px_rgba(45,252,131,0.08)]">
            Pricing
          </div>

          <h1 className="mt-6 text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white">
            Plans built for momentum
          </h1>

          <p className="mt-4 text-sm sm:text-base text-white/55">
            Start free. Upgrade when you want deeper AI clarity. Cancel anytime.
          </p>
        </section>

        <section className="mt-14 grid gap-5 md:grid-cols-3">
          <PlanCard
            title="Standard"
            subtitle="Track & report"
            price="$0"
            period="/month"
            bullets={["Track transactions", "Monthly reports", "Basic support"]}
            accent="#8e99ab"
            buttonLabel="Your plan"
            buttonDisabled
            footer="Ideal for tracking and basic reporting"
          />

          <PlanCard
            title="Plus"
            subtitle="AI clarity, every month"
            price="$4.99"
            period="/month"
            bullets={[
              "Everything in Standard",
              "AI Financial Helper",
              "Smarter summaries",
              "Priority reports",
            ]}
            accent={secondaryColor}
            featured
            badge="Most popular"
            buttonLabel="Upgrade to Plus"
            onClick={() => setUpgradeModal({ plan: "plus" })}
            footer="Best value: AI clarity + reporting"
          />

          <PlanCard
            title="Premium"
            subtitle="Advanced AI + priority support"
            price="$9.99"
            period="/month"
            bullets={[
              "Everything in Plus",
              "Advanced AI Financial Helper",
              "Priority support",
              "Early access features",
              "Data export",
              "Multi-currency support",
            ]}
            accent={primaryColor}
            buttonLabel="Upgrade to Premium"
            onClick={() => setUpgradeModal({ plan: "premium" })}
            footer="Power users: advanced AI and full exports"
          />
        </section>

        <div className="mt-8 text-center text-xs tracking-[0.18em] uppercase text-white/30">
          Purchases are handled in the mobile app. Web remains fully usable.
        </div>

        <section className="mt-24">
          <div className="text-center">
            <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-[#1b2a22] bg-[#07100c]/70 px-4 py-1.5 text-[10px] font-semibold uppercase tracking-[0.35em] text-[#37f28c]">
              FAQ
            </div>

            <h2 className="mt-5 text-4xl sm:text-5xl font-black tracking-tight">
              Quick answers
            </h2>
          </div>

          <div className="mt-10 space-y-3 max-w-[560px] mx-auto">
            {faqs.map((item, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div
                  key={idx}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-md overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? -1 : idx)}
                    className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left"
                  >
                    <span className="text-sm sm:text-base font-semibold text-white">
                      {item.q}
                    </span>
                    <span
                      className={`inline-flex h-7 w-7 items-center justify-center rounded-full border text-sm transition ${
                        isOpen
                          ? "border-[#2dfc83]/40 text-[#2dfc83] bg-[#2dfc83]/10"
                          : "border-white/10 text-white/50 bg-white/[0.03]"
                      }`}
                    >
                      {isOpen ? "−" : "+"}
                    </span>
                  </button>

                  {isOpen && (
                    <div className="px-5 pb-5 text-sm leading-6 text-white/60">
                      {item.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </main>

      <UpgradeOnlyModal
        open={!!upgradeModal}
        plan={upgradeModal?.plan}
        onClose={() => setUpgradeModal(null)}
      />
    </div>
  );
}

function PlanCard({
  title,
  subtitle,
  price,
  period,
  bullets,
  accent,
  featured = false,
  badge,
  buttonLabel,
  buttonDisabled = false,
  footer,
  onClick,
}) {
  const glow =
    accent === primaryColor
      ? "0 0 24px rgba(0,200,255,0.12)"
      : accent === secondaryColor
        ? "0 0 28px rgba(45,252,131,0.16)"
        : "0 0 20px rgba(255,255,255,0.05)";

  const cardBorder = featured ? `${accent}66` : "rgba(255,255,255,0.08)";

  return (
    <div
      className={`relative rounded-[28px] border bg-[#070b10]/88 backdrop-blur-xl px-5 pt-5 pb-4 flex flex-col min-h-[445px] ${
        featured ? "scale-[1.02]" : ""
      }`}
      style={{
        borderColor: cardBorder,
        boxShadow: glow,
      }}
    >
      <div className="pointer-events-none absolute inset-0 rounded-[28px] bg-[radial-gradient(500px_200px_at_50%_0%,rgba(255,255,255,0.03),transparent_60%)]" />

      <div className="relative flex items-start justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-[0.28em] text-white/35 font-semibold">
            {title}
          </div>
          <div className="mt-2 text-xs text-white/75 font-medium">
            {subtitle}
          </div>
        </div>

        {badge ? (
          <div
            className="rounded-full px-2.5 py-1 text-[10px] font-semibold"
            style={{
              backgroundColor:
                accent === secondaryColor
                  ? "rgba(45,252,131,0.14)"
                  : "rgba(255,255,255,0.06)",
              color:
                accent === secondaryColor
                  ? "#5effa4"
                  : "rgba(255,255,255,0.75)",
              border: `1px solid ${
                accent === secondaryColor
                  ? "rgba(45,252,131,0.25)"
                  : "rgba(255,255,255,0.08)"
              }`,
            }}
          >
            {badge}
          </div>
        ) : null}
      </div>

      <div className="relative mt-7 flex items-end gap-2">
        <div
          className="text-[58px] leading-none font-black tracking-[-0.04em]"
          style={{
            color: accent,
            textShadow:
              accent === secondaryColor
                ? "0 0 18px rgba(45,252,131,0.18)"
                : accent === primaryColor
                  ? "0 0 18px rgba(0,200,255,0.18)"
                  : "none",
          }}
        >
          {price}
        </div>
        <div className="pb-2 text-[11px] uppercase tracking-[0.18em] text-white/28">
          {period}
        </div>
      </div>

      <div className="mt-5 h-px w-full bg-white/8" />

      <ul className="relative mt-6 space-y-4 flex-1">
        {bullets.map((item, idx) => (
          <li
            key={idx}
            className="flex items-start gap-3 text-sm text-white/72"
          >
            <span
              className="mt-[6px] h-2 w-2 rounded-full shrink-0"
              style={{
                backgroundColor: accent,
                boxShadow: `0 0 8px ${accent}`,
              }}
            />
            <span>{item}</span>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={buttonDisabled ? undefined : onClick}
        disabled={buttonDisabled}
        className={`relative mt-8 h-11 w-full rounded-xl text-sm font-bold transition ${
          buttonDisabled ? "cursor-not-allowed opacity-60" : "hover:opacity-95"
        }`}
        style={{
          color: buttonDisabled ? "rgba(255,255,255,0.5)" : "#02140a",
          background: buttonDisabled
            ? "linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.04))"
            : accent === primaryColor
              ? "linear-gradient(180deg, rgba(0,200,255,0.16), rgba(0,200,255,0.08))"
              : `linear-gradient(180deg, ${accent}, ${shade(accent, -16)})`,
          border:
            accent === primaryColor
              ? "1px solid rgba(0,200,255,0.45)"
              : "1px solid rgba(255,255,255,0.06)",
          boxShadow: buttonDisabled
            ? "none"
            : `0 0 20px ${hexToRGBA(accent, 0.18)}`,
        }}
      >
        {buttonLabel}
      </button>

      <div className="mt-3 text-center text-[10px] text-white/28">{footer}</div>
    </div>
  );
}

function UpgradeOnlyModal({ open, plan, onClose }) {
  if (!open) return null;

  const planLabel = plan === "premium" ? "Premium" : "Plus";

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/70 backdrop-blur-sm px-4"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-lg overflow-hidden rounded-[28px] border border-white/10 bg-[#071018]/95 text-white shadow-2xl">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(500px_240px_at_20%_0%,rgba(45,252,131,0.12),transparent_55%),radial-gradient(500px_240px_at_80%_0%,rgba(0,200,255,0.12),transparent_55%)]" />

        <div className="relative p-6 sm:p-7">
          <div className="flex items-start gap-4">
            <img
              src={logo}
              alt="Nummoria"
              className="h-11 w-11 rounded-2xl object-contain border border-white/10 bg-white/[0.04] p-1"
            />

            <div className="flex-1">
              <div className="text-xl font-semibold tracking-tight">
                Upgrade to {planLabel} in the mobile app
              </div>
              <p className="mt-2 text-sm text-white/60">
                Purchases are available on iOS and Android only. Web remains
                fully usable, but billing is handled in the mobile app.
              </p>
            </div>

            <button
              onClick={onClose}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/70 transition hover:bg-white/[0.08] hover:text-white"
              aria-label="Close"
              type="button"
            >
              ✕
            </button>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <a
              href={IOS_APP_URL}
              className="inline-flex items-center justify-center rounded-2xl h-12 px-5 font-semibold text-[#02140a] transition hover:opacity-95"
              style={{
                background: "linear-gradient(135deg, #2dfc83, #1fd96c)",
              }}
            >
              Download on iOS
            </a>

            <a
              href={ANDROID_APP_URL}
              className="inline-flex items-center justify-center rounded-2xl h-12 px-5 font-semibold text-white transition hover:opacity-95"
              style={{
                background: "linear-gradient(135deg, #00c8ff, #0098c4)",
              }}
            >
              Get it on Android
            </a>
          </div>

          <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-xs text-white/50">
            Already installed? Open the app and go to{" "}
            <span className="text-white/75">Settings → Subscription</span>.
          </div>

          <div className="mt-5">
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-2xl h-11 border border-white/10 bg-white/[0.04] text-sm font-semibold text-white/75 transition hover:bg-white/[0.07] hover:text-white"
            >
              Not now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stars() {
  const stars = [
    { top: "10%", left: "6%", size: 2, opacity: 0.25 },
    { top: "18%", left: "17%", size: 1.5, opacity: 0.16 },
    { top: "11%", left: "27%", size: 3, opacity: 0.3 },
    { top: "24%", left: "9%", size: 2, opacity: 0.22 },
    { top: "35%", left: "14%", size: 1.5, opacity: 0.2 },
    { top: "33%", left: "26%", size: 2.5, opacity: 0.24 },
    { top: "47%", left: "74%", size: 2, opacity: 0.24 },
    { top: "58%", left: "82%", size: 2.5, opacity: 0.2 },
    { top: "72%", left: "20%", size: 1.5, opacity: 0.16 },
    { top: "78%", left: "35%", size: 2, opacity: 0.22 },
    { top: "83%", left: "77%", size: 2, opacity: 0.18 },
    { top: "88%", left: "58%", size: 1.5, opacity: 0.2 },
    { top: "67%", left: "56%", size: 3, opacity: 0.14 },
    { top: "42%", left: "89%", size: 1.5, opacity: 0.22 },
    { top: "53%", left: "30%", size: 2, opacity: 0.18 },
  ];

  const greenDots = [
    { top: "21%", left: "44%" },
    { top: "30%", left: "52%" },
    { top: "40%", left: "66%" },
    { top: "55%", left: "43%" },
    { top: "63%", left: "70%" },
    { top: "76%", left: "48%" },
    { top: "86%", left: "63%" },
    { top: "34%", left: "80%" },
    { top: "49%", left: "12%" },
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
          className="absolute rounded-full bg-[#13e243]"
          style={{
            top: s.top,
            left: s.left,
            width: 3,
            height: 3,
            opacity: 0.5,
            boxShadow: "0 0 8px rgba(19,226,67,0.35)",
          }}
        />
      ))}
    </>
  );
}

function shade(hex, pct) {
  const { r, g, b } = hexToRGB(hex);
  const t = pct < 0 ? 0 : 255;
  const p = Math.abs(pct) / 100;
  const R = Math.round((t - r) * p + r);
  const G = Math.round((t - g) * p + g);
  const B = Math.round((t - b) * p + b);
  return `rgb(${R}, ${G}, ${B})`;
}

function hexToRGB(hex) {
  let c = hex.replace("#", "");
  if (c.length === 3) {
    c = c
      .split("")
      .map((x) => x + x)
      .join("");
  }
  const num = parseInt(c, 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

function hexToRGBA(hex, a = 1) {
  const { r, g, b } = hexToRGB(hex);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}
