/* eslint-disable */
import { s } from "framer-motion/client";
import React, { useRef } from "react";
import logo from "../assets/nummoria_logo.png";

/**
 * Pricing page with aligned Buy buttons.
 * - Mouse-follow highlight
 * - Equal-height cards
 * - Buttons pinned to bottom with extra spacing
 * - Tailwind-only
 */
const primaryColor = "#991746ff";
const secondaryColor = "#13e243ff";
export default function PricingPage() {
  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-[#f6fbf6] via-[#f3f7ef] to-[#eef3ff] text-gray-900">
      <header className="mx-auto max-w-5xl px-6 pt-16 pb-10 text-center">
        <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight">
          Choose a plan that takes off with you ✈️
        </h1>
        <p className="mt-3 text-sm md:text-base text-gray-600">
          Simple pricing. Powerful features. Cancel anytime.
        </p>
      </header>

      <main className="mx-auto max-w-6xl px-6 pb-24">
        <div className="grid gap-6 md:grid-cols-3 items-stretch">
          <PlanCard
            title="Standard"
            price={0}
            period="/month"
            cta="YOUR PLAN"
            bullets={["Track Transactions", "Get Reports", "Basic support"]}
            accent="#aed121ff"
            icon="✈️"
          />

          <PlanCard
            title="Plus"
            price={4.99}
            period="/month"
            cta="Buy"
            bullets={[
              "Track Transactions",
              "Get Reports",
              "Basic support",
              "AI Financial Helper",
            ]}
            accent={secondaryColor}
            icon="🚀"
            featured
            big
          />

          <PlanCard
            title="Premium"
            price={9.99}
            period="/month"
            cta="Buy"
            bullets={[
              "Track Transactions",
              "Get Reports",
              "Basic support",
              "More Advance AI Financial Helper",
              "Priority support",
              "Early access to new features",
              "Custom insights",
              "Data export",
              "Multi-currency support",
            ]}
            accent={primaryColor}
            icon="🛸"
          />
        </div>
      </main>
    </div>
  );
}

function PlanCard({
  title,
  price,
  period,
  cta,
  bullets,
  accent = "#4f772d",
  icon = "✨",
  featured = false,
  big = false,
}) {
  const ref = useRef(null);

  // Mouse-follow glow & parallax
  const onMouseMove = (e) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    el.style.setProperty("--x", `${px}px`);
    el.style.setProperty("--y", `${py}px`);
    const rx = (py / rect.height - 0.5) * -8;
    const ry = (px / rect.width - 0.5) * 8;
    el.style.transform = `perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg) scale(1.02)`;
  };
  const onMouseLeave = () => {
    const el = ref.current;
    if (!el) return;
    el.style.transform = "";
  };

  const accentRing = hexToRGBA(accent, 0.25);
  const accentSoft = hexToRGBA(accent, 0.1);
  const accentText = accent;

  return (
    <div
      ref={ref}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      className={[
        "group relative flex flex-col h-full rounded-[28px] border shadow-sm overflow-hidden",
        "bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/70",
        "transition-transform duration-200 ease-out will-change-transform",
        featured ? "ring-2" : "ring-1",
      ].join(" ")}
      style={{
        backgroundImage: `
          radial-gradient(200px 200px at var(--x) var(--y), ${accentSoft}, transparent 60%)
        `,
        borderColor: accentSoft,
        boxShadow: featured
          ? `0 20px 40px -16px ${accentRing}`
          : `0 14px 30px -16px rgba(0,0,0,0.12)`,
      }}
    >
      {/* Header */}
      <div
        className="relative h-40 shrink-0"
        style={{
          background: `linear-gradient(180deg, ${accent}, ${shade(
            accent,
            -10
          )})`,
        }}
      >
        <div
          className="absolute inset-0 opacity-15 mix-blend-overlay pointer-events-none"
          style={{
            background:
              "radial-gradient(120% 80% at 80% -10%, rgba(255,255,255,.35), rgba(255,255,255,0) 60%)",
          }}
        />
        <div className="absolute inset-x-0 -bottom-8 h-16 bg-white rounded-t-[40%/60%]" />
        <div className="absolute inset-0 flex items-center justify-center">
          <img
            src={logo}
            alt="Nummoria logo"
            className="h-14 w-14 object-contain drop-shadow-lg"
          />
        </div>
      </div>

      {/* Body */}
      <div
        className={`relative px-6 pb-8 pt-2 flex-1 flex flex-col ${
          big ? "md:pt-0" : ""
        }`}
      >
        <div className="text-center">
          <div className="text-sm tracking-widest font-semibold text-gray-500 uppercase">
            {title}
          </div>

          <div className="mt-2 flex items-end justify-center gap-2">
            <div
              className={`${
                big ? "text-5xl md:text-6xl" : "text-4xl"
              } font-extrabold tracking-tight`}
            >
              ${price.toFixed(2)}
            </div>
            <div className="pb-2 text-xs text-gray-500 uppercase">{period}</div>
          </div>
        </div>

        {/* Features + Button */}
        <div className="mt-4 flex flex-col flex-1">
          <ul className="mt-5 space-y-2 text-sm text-left mx-auto max-w-[18rem]">
            {bullets.map((b, i) => (
              <li key={i} className="flex items-start gap-2">
                <span
                  className="mt-1 inline-block h-2 w-2 rounded-full"
                  style={{ backgroundColor: accentText }}
                />
                <span className="text-gray-700">{b}</span>
              </li>
            ))}
          </ul>
          {/* Buy button always bottom aligned with more space */}
          <button
            type="button"
            onClick={() =>
              (window.location.href =
                "subscriptions/purchase?plan=" + title.toLowerCase())
            } // Add this line
            className="mt-auto mt-10 inline-flex items-center justify-center w-full rounded-full h-10 px-5 text-sm font-semibold text-white transition focus:outline-none focus:ring-2"
            style={{
              background: `linear-gradient(180deg, ${accent}, ${shade(
                accent,
                -10
              )})`,
              boxShadow: `0 10px 22px -10px ${accentRing}`,
            }}
          >
            {cta}
          </button>
        </div>

        {/* hover ring highlight */}
        <div
          className="pointer-events-none absolute inset-0 rounded-[28px] ring-0 group-hover:ring-4 transition-[ring] duration-300"
          style={{ boxShadow: `inset 0 0 0 1px ${accentSoft}` }}
        />
      </div>
    </div>
  );
}

/* ----------------------- helpers ----------------------- */
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
  if (c.length === 3)
    c = c
      .split("")
      .map((x) => x + x)
      .join("");
  const num = parseInt(c, 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

function hexToRGBA(hex, a = 1) {
  const { r, g, b } = hexToRGB(hex);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}
