/* eslint-disable */
import React, { useEffect } from "react";
const logoUrl = new URL("../assets/nummoria_logo.png", import.meta.url).href;
const mainColor = "#10b981";
const secondaryColor = "#047857";

// Scroll-reveal without external deps
function useScrollReveal() {
  useEffect(() => {
    const els = document.querySelectorAll("[data-reveal]");
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) e.target.classList.add("reveal-show");
        });
      },
      { threshold: 0.2 }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
}

// Smooth scroll for in-page anchors
function useSmoothScroll() {
  useEffect(() => {
    const anchors = Array.from(document.querySelectorAll('a[href^="#"]'));
    const onClick = (e) => {
      const href = e.currentTarget.getAttribute("href");
      const target = href && document.querySelector(href);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    };
    anchors.forEach((a) => a.addEventListener("click", onClick));
    return () =>
      anchors.forEach((a) => a.removeEventListener("click", onClick));
  }, []);
}

export default function WelcomeLanding() {
  useScrollReveal();
  useSmoothScroll();

  return (
    <div className="min-h-screen bg-[#0b0f0d] text-white selection:bg-emerald-200/40 selection:text-emerald-950 scroll-smooth">
      {/* NAVBAR */}
      <header className="sticky top-0 z-50 border-b border-white/10 backdrop-blur-2xl bg-white/10 shadow-lg shadow-emerald-500/10">
        <div className="mx-auto flex h-24 max-w-7xl items-center justify-between px-10">
          {/* Left Nav Links */}
          <nav className="flex items-center gap-8 text-lg font-semibold text-white/80">
            <a
              href="#features"
              className="hover:text-emerald-300 transition-colors"
            >
              Features
            </a>
            <a
              href="#pricing"
              className="hover:text-emerald-300 transition-colors"
            >
              Pricing
            </a>
            <a
              href="#about"
              className="hover:text-emerald-300 transition-colors"
            >
              About
            </a>
            <a
              href="#contact"
              className="hover:text-emerald-300 transition-colors"
            >
              Contact
            </a>
          </nav>

          {/* Center Logo */}
          <div className="flex items-center gap-4">
            <img
              src={logoUrl}
              alt="Nummoria logo"
              className="w-14 h-14 rounded-2xl shadow-xl shadow-emerald-500/20"
            />
            <a
              href="#top"
              className="text-3xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-br from-emerald-300 to-emerald-600 drop-shadow-lg hover:scale-105 transition-transform"
            >
              Nummoria
            </a>
          </div>

          {/* Auth Buttons */}
          <div className="flex items-center gap-4">
            {/* <a
              href="/signup"
              className="rounded-2xl border border-white/40 px-6 py-3 text-lg font-semibold text-white/90 hover:border-white/70 hover:bg-white/10 backdrop-blur-md transition-all"
            ></a> */}
            <a
              href="/login"
              className="rounded-2xl border border-white/30 px-6 py-3 text-lg text-white/80 hover:border-white/60 hover:bg-white/10 backdrop-blur-md transition-all"
            >
              Log in / Sign up
            </a>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section id="top" className="relative isolate overflow-hidden">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_40%_at_50%_-10%,rgba(79,119,45,0.35),transparent_60%)]" />
        <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-10 px-4 pb-24 pt-16 md:grid-cols-2 md:pt-20">
          <div data-reveal="left" className="reveal">
            <h1 className="text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
              Personal finance that actually helps you decide
            </h1>
            <p className="mt-4 text-white/70 sm:text-lg">
              Track income, expenses, and investments in one clean dashboard.
              Get insights as you scroll.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <a
                href="/login"
                className="rounded-xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-emerald-950 shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400"
              >
                Open Web App
              </a>
              <StoreBadges />
            </div>
            <ul className="mt-6 grid grid-cols-1 gap-2 text-sm text-white/70 sm:grid-cols-2">
              <li className="flex items-center gap-2">
                <Dot /> Zero-setup onboarding
              </li>
              <li className="flex items-center gap-2">
                <Dot /> Bank-like categories
              </li>
              <li className="flex items-center gap-2">
                <Dot /> Investment tracking
              </li>
              <li className="flex items-center gap-2">
                <Dot /> CSV/PDF import
              </li>
            </ul>
          </div>

          <div data-reveal="right" className="relative reveal">
            <div className="relative mx-auto w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-3 shadow-2xl">
              <div className="aspect-[9/19] w-full overflow-hidden rounded-2xl bg-black/70">
                <div className="flex h-full flex-col">
                  <div className="h-10 w-full bg-gradient-to-r from-emerald-500/30 to-transparent" />
                  <div className="flex-1 space-y-3 p-4">
                    <div className="h-3 w-24 rounded bg-white/10" />
                    <div className="h-4 w-40 rounded bg-white/10" />
                    <div className="h-24 w-full rounded-xl bg-white/5" />
                    <div className="h-24 w-full rounded-xl bg-white/5" />
                    <div className="h-24 w-full rounded-xl bg-white/5" />
                  </div>
                </div>
              </div>
            </div>
            <div className="absolute -left-8 -top-6 -z-10 h-40 w-40 rounded-full bg-emerald-500/20 blur-2xl" />
          </div>
        </div>
      </section>

      {/* FEATURE ROWS */}
      <FeatureRow
        id="features"
        eyebrow="Accounts"
        title="All your money, organized by reality"
        desc="Multi-currency accounts with real-time summaries. Attach institutions, categories, and rules."
        bullets={[
          "Multiple accounts",
          "Per-currency totals",
          "Reconciliations",
          "Transfers",
        ]}
      />
      <FeatureRow
        id="investments"
        flip
        eyebrow="Investments"
        title="Stocks, crypto, land — tracked together"
        desc="Add tickers or manual assets. See performance and allocation in one place."
        bullets={[
          "Positions & lots",
          "Cost basis",
          "Simple charts",
          "CSV import",
        ]}
      />

      {/* PRICING */}
      <section id="pricing" className="mx-auto max-w-6xl px-6 py-20">
        <header className="text-center mb-10">
          <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight text-white">
            Choose a plan that takes off with you ✈️
          </h2>
          <p className="mt-3 text-sm md:text-base text-white/70">
            Simple pricing. Powerful features. Cancel anytime.
          </p>
        </header>

        <div className="grid gap-6 md:grid-cols-3 items-stretch">
          <PlanCard
            title="Standard"
            price={0}
            period="/month"
            cta="YOUR PLAN"
            bullets={["Track Transactions", "Get Reports", "Basic support"]}
            accent="#aed121ff"
            icon="✈️"
            logoSrc={logoUrl}
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
            accent="#13e243ff"
            icon="🚀"
            featured
            big
            logoSrc={logoUrl}
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
              "More Advanced AI Financial Helper",
              "Priority support",
              "Early access to new features",
              "Custom insights",
              "Data export",
              "Multi-currency support",
            ]}
            accent="#991746ff"
            icon="🛸"
            logoSrc={logoUrl}
          />
        </div>
      </section>

      {/* ABOUT (anchor target) */}
      <section
        id="about"
        className="mx-auto max-w-6xl px-4 py-16 text-white/80"
      >
        <h3 className="text-2xl font-bold mb-2">About</h3>
        <p>Built for clarity, speed, and long-term use.</p>
      </section>

      {/* MARQUEE */}
      <section className="my-20 border-y border-white/10 py-8">
        <div className="animate-marquee flex gap-8 whitespace-nowrap px-4 text-white/60 [animation-duration:14s]">
          {Array.from({ length: 12 }).map((_, i) => (
            <span key={i} className="text-sm">
              • Secure • Fast • Private • Insightful
            </span>
          ))}
        </div>
      </section>

      {/* CTA / CONTACT (anchor target) */}
      <section id="contact" className="mx-auto max-w-6xl px-4 py-16">
        <div
          data-reveal="up"
          className="reveal rounded-3xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] p-8 md:p-12"
        >
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
            Start in minutes. Keep for years.
          </h2>
          <p className="mt-3 max-w-2xl text-white/70">
            Create an account, import past transactions, and see your real
            picture instantly.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <a
              href="/signup"
              className="rounded-xl bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-white/90"
            >
              Create free account
            </a>
            <a
              href="/login"
              className="rounded-xl border border-white/20 px-5 py-3 text-sm font-semibold text-white/90 hover:border-white/40"
            >
              I already have an account
            </a>
            <StoreBadges compact />
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="mx-auto mt-10 max-w-6xl px-4 pb-16 text-xs text-white/60">
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-6">
          <div>© {new Date().getFullYear()} Nummoria</div>
          <nav className="flex gap-4">
            <a href="/privacy" className="hover:text-white/80">
              Privacy
            </a>
            <a href="/terms" className="hover:text-white/80">
              Terms
            </a>
            <a href="/contact" className="hover:text-white/80">
              Contact
            </a>
          </nav>
        </div>
      </footer>

      {/* Styles for reveal + marquee */}
      <style>{`
        .reveal {opacity: 0; transform: translateY(16px); transition: opacity .6s ease, transform .6s ease;}
        .reveal[data-reveal="left"] {transform: translateX(-40px);}
        .reveal[data-reveal="right"] {transform: translateX(40px);}
        .reveal-show {opacity: 1; transform: translate(0,0);} 
        @keyframes marquee {0%{transform:translateX(0)}100%{transform:translateX(-600px)}}
        .animate-marquee {animation: marquee linear infinite;}
      `}</style>
    </div>
  );
}

function Dot() {
  return <span className="block h-1.5 w-1.5 rounded-full bg-emerald-400" />;
}

function StoreBadges({ compact = false }) {
  return (
    <div className={`flex items-center gap-2 ${compact ? "scale-95" : ""}`}>
      <a
        href="https://apps.apple.com/app/id0000000000"
        aria-label="Download on the App Store"
        className="group inline-flex items-center gap-2 rounded-xl border border-white/20 px-3 py-2 hover:border-white/40 hover:bg-white/5"
      >
        <AppleBadge />
        <div className="text-left leading-none">
          <div className="text-[10px] text-white/60">Download on the</div>
          <div className="text-sm font-semibold">App Store</div>
        </div>
      </a>
      <a
        href="https://play.google.com/store/apps/details?id=com.example"
        aria-label="Get it on Google Play"
        className="group inline-flex items-center gap-2 rounded-xl border border-white/20 px-3 py-2 hover:border-white/40 hover:bg-white/5"
      >
        <PlayBadge />
        <div className="text-left leading-none">
          <div className="text-[10px] text-white/60">GET IT ON</div>
          <div className="text-sm font-semibold">Google Play</div>
        </div>
      </a>
    </div>
  );
}

function AppleBadge() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="opacity-90"
    >
      <path d="M16.365 1.43c.056.73-.27 1.44-.77 1.98-.48.56-1.29 1-2.07.93-.07-.72.29-1.45.78-1.99.49-.56 1.36-.98 2.06-.92h0zM20.51 17.03c-.38.88-.84 1.75-1.45 2.51-.55.7-1.23 1.39-2.11 1.42-.92.04-1.22-.55-2.28-.55-1.06 0-1.4.53-2.29.56-.9.04-1.59-.75-2.15-1.44-1.17-1.49-2.07-3.6-1.83-5.64.2-1.15.8-2.22 1.73-2.96.81-.64 1.9-1.11 2.95-.92.3.06.6.16.88.29.26.12.52.29.8.28.23 0 .45-.15.64-.26.53-.31 1.01-.67 1.6-.87.86-.3 1.8-.28 2.6.17.39.22.72.54.95.94-.88.53-1.47 1.49-1.39 2.53.09 1.02.7 1.98 1.68 2.45-.2.29-.43.56-.66.85z" />
    </svg>
  );
}

function PlayBadge() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="opacity-90"
    >
      <path d="M3.01 2.406c-.01.063-.02.127-.02.191v18.806c0 .064.01.128.02.191l10.73-9.594L3.01 2.406zM14.53 11.5l4.79-4.29c-.33-.255-.78-.267-1.19-.036L14.53 11.5zm0 1l3.6 4.325c.41.23.86.218 1.19-.037L14.53 12.5zM13.25 12L3 21.403c.15.834.98 1.23 1.67.83l15.44-8.74c.9-.51.9-1.93 0-2.44L4.67 2.313c-.69-.401-1.52-.004-1.67.833L13.25 12z" />
    </svg>
  );
}

// FeatureRow component (plain React) with anchor id
function FeatureRow({ id, flip = false, eyebrow, title, desc, bullets }) {
  return (
    <section id={id} className="mx-auto max-w-6xl px-4 py-16">
      <div
        className={`grid grid-cols-1 items-center gap-10 md:grid-cols-2 ${
          flip ? "md:[&>div:first-child]:order-2" : ""
        }`}
      >
        <div data-reveal={flip ? "right" : "left"} className="reveal space-y-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
            {eyebrow}
          </div>
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
            {title}
          </h2>
          <p className="max-w-2xl text-white/70">{desc}</p>
          <ul className="mt-4 grid grid-cols-1 gap-2 text-sm text-white/70 sm:grid-cols-2">
            {bullets.map((b, i) => (
              <li key={i} className="flex items-center gap-2">
                <Dot /> {b}
              </li>
            ))}
          </ul>
        </div>

        <div data-reveal={flip ? "left" : "right"} className="reveal relative">
          <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-3 shadow-2xl">
            <div className="aspect-video w-full rounded-2xl bg-gradient-to-br from-emerald-400/10 to-white/0" />
          </div>
          <div className="absolute -right-6 -top-6 -z-10 h-40 w-40 rounded-full bg-emerald-500/20 blur-2xl" />
        </div>
      </div>
    </section>
  );
}

// ---------- PlanCard + helpers ----------
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
  logoSrc,
}) {
  const ref = React.useRef(null);

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
        "bg-white/10 backdrop-blur supports-[backdrop-filter]:bg-white/5",
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
        <div className="absolute inset-x-0 -bottom-8 h-16 bg-white/90 rounded-t-[40%/60%]" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-4xl mr-2">{icon}</div>
          <img
            src={logoSrc}
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
          <div className="text-sm tracking-widest font-semibold text-white/70 uppercase">
            {title}
          </div>
          <div className="mt-2 flex items-end justify-center gap-2">
            <div
              className={`${
                big ? "text-5xl md:text-6xl" : "text-4xl"
              } font-extrabold tracking-tight text-white`}
            >
              ${price.toFixed(2)}
            </div>
            <div className="pb-2 text-xs text-white/60 uppercase">{period}</div>
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
                <span className="text-white/80">{b}</span>
              </li>
            ))}
          </ul>

          <button
            type="button"
            onClick={() =>
              (window.location.href = `/subscriptions/purchase?plan=${title.toLowerCase()}`)
            }
            className="mt-auto inline-flex items-center justify-center w-full rounded-full h-11 px-5 text-sm font-semibold text-white transition focus:outline-none focus:ring-2"
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
  let c = (hex || "").replace("#", "");
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
