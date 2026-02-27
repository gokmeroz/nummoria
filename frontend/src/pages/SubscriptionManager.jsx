/* eslint-disable */
import { useRef, useState } from "react";
import logo from "../assets/nummoria_logo.png";

/**
 * Pricing page (WEB VIEW ONLY)
 * - Purchases are blocked on web
 * - Upgrade happens only in the mobile app
 */

const primaryColor = "#991746ff";
const secondaryColor = "#13e243ff";

// TODO: replace with your real store links
const IOS_APP_URL = "https://apps.apple.com/app/idYOUR_APP_ID";
const ANDROID_APP_URL =
  "https://play.google.com/store/apps/details?id=YOUR_PACKAGE_NAME";

export default function PricingPage() {
  const [upgradeModal, setUpgradeModal] = useState(null); // { plan: "plus" | "premium" }

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-[#f6fbf6] via-[#f3f7ef] to-[#eef3ff] text-gray-900">
      <header className="mx-auto max-w-5xl px-6 pt-16 pb-10 text-center">
        <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight">
          Choose a plan that takes off with you ✈️
        </h1>
        <p className="mt-3 text-sm md:text-base text-gray-600">
          Simple pricing. Powerful features. Cancel anytime.
        </p>

        <div className="mt-6 inline-block bg-blue-100 border border-blue-300 rounded-lg px-4 py-3 text-sm text-blue-800">
          📱 <strong>Web is view-only:</strong> upgrades are available only in
          our mobile app (iOS / Android).
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 pb-24">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 items-stretch">
          <PlanCard
            title="Standard"
            price={0}
            period="/month"
            cta="YOUR PLAN"
            bullets={["Track Transactions", "Get Reports", "Basic support"]}
            accent="#aed121ff"
            icon="✈️"
            onRequestUpgrade={() => {}}
          />

          <PlanCard
            title="Plus"
            price={4.99}
            period="/month"
            cta="Get on Mobile"
            bullets={[
              "Track Transactions",
              "Get Reports",
              "Basic support",
              "AI Financial Helper",
            ]}
            accent={secondaryColor}
            icon="🚀"
            featured
            onRequestUpgrade={() => setUpgradeModal({ plan: "plus" })}
          />

          <PlanCard
            title="Premium"
            price={9.99}
            period="/month"
            cta="Get on Mobile"
            bullets={[
              "Track Transactions",
              "Get Reports",
              "Basic support",
              "Advanced AI Financial Helper",
              "Priority support",
              "Early access to new features",
              "Custom insights",
              "Data export",
              "Multi-currency support",
            ]}
            accent={primaryColor}
            icon="🛸"
            onRequestUpgrade={() => setUpgradeModal({ plan: "premium" })}
          />
        </div>
      </main>

      <UpgradeOnlyModal
        open={!!upgradeModal}
        plan={upgradeModal?.plan}
        onClose={() => setUpgradeModal(null)}
      />
    </div>
  );
}

function UpgradeOnlyModal({ open, plan, onClose }) {
  if (!open) return null;

  const planLabel = plan === "premium" ? "Premium" : "Plus";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

      <div className="relative w-full max-w-lg rounded-3xl bg-white shadow-2xl border border-gray-200 overflow-hidden">
        <div className="p-6 sm:p-8">
          <div className="flex items-start gap-4">
            <img
              src={logo}
              alt="Nummoria"
              className="h-10 w-10 rounded-xl object-contain bg-gray-50 border"
            />
            <div className="flex-1">
              <div className="text-lg sm:text-xl font-extrabold">
                Upgrade to {planLabel} in the mobile app
              </div>
              <p className="mt-1 text-sm text-gray-600">
                For security and platform compliance, purchases are only
                available on iOS/Android. Web is view-only.
              </p>
            </div>

            <button
              onClick={onClose}
              className="rounded-full h-9 w-9 inline-flex items-center justify-center text-gray-500 hover:bg-gray-100"
              aria-label="Close"
              type="button"
            >
              ✕
            </button>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <a
              href={IOS_APP_URL}
              className="inline-flex items-center justify-center rounded-2xl h-12 px-5 font-semibold text-white bg-black hover:bg-black/90"
            >
              Download on iOS
            </a>
            <a
              href={ANDROID_APP_URL}
              className="inline-flex items-center justify-center rounded-2xl h-12 px-5 font-semibold text-white bg-green-600 hover:bg-green-700"
            >
              Get it on Android
            </a>
          </div>

          <div className="mt-5 text-xs text-gray-500">
            Already installed? Open the app → Settings → Subscription to
            upgrade.
          </div>
        </div>

        <div className="px-6 sm:px-8 pb-6">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-2xl h-11 font-semibold border border-gray-200 hover:bg-gray-50"
          >
            Not now
          </button>
        </div>
      </div>
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
  onRequestUpgrade,
}) {
  const ref = useRef(null);

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

  const handleClick = () => {
    if (title === "Standard") return;
    if (typeof onRequestUpgrade === "function") onRequestUpgrade();
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
        backgroundImage: `radial-gradient(200px 200px at var(--x) var(--y), ${accentSoft}, transparent 60%)`,
        borderColor: accentSoft,
        boxShadow: featured
          ? `0 20px 40px -16px ${accentRing}`
          : `0 14px 30px -16px rgba(0,0,0,0.12)`,
      }}
    >
      <div
        className="relative h-40 shrink-0"
        style={{
          background: `linear-gradient(180deg, ${accent}, ${shade(accent, -10)})`,
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
          <span className="text-5xl">{icon}</span>
        </div>
      </div>

      <div className="relative px-6 pb-8 pt-2 flex-1 flex flex-col">
        <div className="text-center">
          <div className="text-sm tracking-widest font-semibold text-gray-500 uppercase">
            {title}
          </div>

          <div className="mt-2 flex items-end justify-center gap-2">
            <div className="text-4xl font-extrabold tracking-tight">
              ${price.toFixed(2)}
            </div>
            <div className="pb-2 text-xs text-gray-500 uppercase">{period}</div>
          </div>
        </div>

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

          <button
            type="button"
            onClick={handleClick}
            disabled={title === "Standard"}
            className={[
              "mt-auto mt-10 inline-flex items-center justify-center w-full rounded-full h-10 px-5 text-sm font-semibold text-white transition focus:outline-none focus:ring-2",
              title === "Standard" ? "opacity-60 cursor-not-allowed" : "",
            ].join(" ")}
            style={{
              background: `linear-gradient(180deg, ${accent}, ${shade(accent, -10)})`,
              boxShadow: `0 10px 22px -10px ${accentRing}`,
            }}
          >
            {cta}
          </button>
        </div>

        <div
          className="pointer-events-none absolute inset-0 rounded-[28px] ring-0 group-hover:ring-4 transition-[ring] duration-300"
          style={{ boxShadow: `inset 0 0 0 1px ${accentSoft}` }}
        />
      </div>
    </div>
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
