/* eslint-disable no-unused-vars */
import React, { useEffect, useMemo, useState } from "react";
import api from "../lib/api";

const BG = "#030508";
const MINT = "#00ff87";
const CYAN = "#00d4ff";
const VIOLET = "#a78bfa";
const ROSE = "#ff4d8d";
const AMBER = "#facc15";

function formatMoneyFromMinor(minor, currency = "USD") {
  if (minor === null || minor === undefined) return "—";
  const major = Number(minor || 0) / 100;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(major);
}

/* ─────────────────────────────────────────────────────────────
   HUD UI
───────────────────────────────────────────────────────────── */
const Brackets = React.memo(
  ({ color = MINT, size = "10px", thick = "1.5px" }) => (
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
  ),
);

const ScanLine = React.memo(({ color = MINT, className = "" }) => (
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

function SectionCard({
  title,
  subtitle,
  right,
  children,
  className = "",
  accent = "violet",
}) {
  const AC = {
    violet: {
      col: VIOLET,
      bg: "rgba(167,139,250,0.03)",
      bd: "rgba(167,139,250,0.22)",
    },
    cyan: {
      col: CYAN,
      bg: "rgba(0,212,255,0.03)",
      bd: "rgba(0,212,255,0.22)",
    },
    mint: {
      col: MINT,
      bg: "rgba(0,255,135,0.03)",
      bd: "rgba(0,255,135,0.22)",
    },
    rose: {
      col: ROSE,
      bg: "rgba(255,77,141,0.03)",
      bd: "rgba(255,77,141,0.22)",
    },
  }[accent] || {
    col: VIOLET,
    bg: "rgba(167,139,250,0.03)",
    bd: "rgba(167,139,250,0.22)",
  };

  return (
    <div
      className={`relative border p-4 md:p-5 flex flex-col h-full overflow-hidden ${className}`}
      style={{ backgroundColor: AC.bg, borderColor: AC.bd }}
    >
      <Brackets color={AC.col} size="10px" thick="1.5px" />
      <div
        className="absolute top-0 inset-x-[15%] h-[1px] opacity-40"
        style={{ backgroundColor: AC.col }}
      />
      <div
        className="absolute -right-12 -top-12 h-28 w-28 rounded-full blur-3xl opacity-15"
        style={{ backgroundColor: AC.col }}
      />
      {(title || right) && (
        <div className="mb-4 flex items-start justify-between gap-4 relative z-10">
          <div>
            {title && (
              <h2 className="text-base font-extrabold tracking-wider text-white uppercase">
                {title}
              </h2>
            )}
            {subtitle && (
              <p className="mt-1 text-xs text-white/80 tracking-wider uppercase">
                {subtitle}
              </p>
            )}
          </div>
          {right && <div>{right}</div>}
        </div>
      )}
      <div className="flex-1 min-h-0 relative z-10">{children}</div>
    </div>
  );
}

function MetricCard({ label, value, accent = "cyan", loading = false }) {
  const color =
    { violet: VIOLET, cyan: CYAN, mint: MINT, rose: ROSE }[accent] || CYAN;

  return (
    <div className="border border-white/10 bg-black/40 p-4 relative overflow-hidden h-full flex flex-col justify-center">
      <Brackets color={color} size="6px" thick="1px" />
      <div className="text-[10px] font-bold uppercase tracking-wider text-white/65 mb-2">
        {label}
      </div>
      <div
        className="text-2xl md:text-3xl font-extrabold tracking-tight"
        style={{ color }}
      >
        {loading ? "..." : value}
      </div>
    </div>
  );
}

function SectionLabel({ children, accent = "mint" }) {
  const color =
    { violet: VIOLET, cyan: CYAN, mint: MINT, rose: ROSE }[accent] || MINT;

  return (
    <div
      className="inline-flex items-center gap-2 border px-3 py-1 text-[11px] uppercase tracking-[0.18em]"
      style={{
        borderColor: `${color}33`,
        color,
        backgroundColor: "rgba(0,0,0,0.25)",
      }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: color }}
      />
      {children}
    </div>
  );
}

function SectionHeading({ eyebrow, title, text, accent = "mint" }) {
  return (
    <div>
      <SectionLabel accent={accent}>{eyebrow}</SectionLabel>
      <h2 className="mt-4 text-2xl md:text-3xl font-extrabold tracking-tight text-white">
        {title}
      </h2>
      <p className="mt-3 text-sm leading-7 text-white/62">{text}</p>
    </div>
  );
}

function TimelineCard({ when, what, accent = "mint", isLast = false }) {
  const color =
    { violet: VIOLET, cyan: CYAN, mint: MINT, rose: ROSE }[accent] || MINT;

  return (
    <div className="flex gap-4 border border-white/10 bg-black/25 p-5">
      <div className="flex flex-col items-center">
        <div
          className="h-3 w-3 rounded-full"
          style={{ backgroundColor: color, boxShadow: `0 0 10px ${color}` }}
        />
        {!isLast ? <div className="mt-2 h-full w-px bg-white/10" /> : null}
      </div>

      <div>
        <div className="text-sm font-extrabold tracking-wide text-white">
          {when}
        </div>
        <p className="mt-1 text-sm leading-7 text-white/62">{what}</p>
      </div>
    </div>
  );
}

function FAQ({ items = [] }) {
  const [openIdx, setOpenIdx] = useState(0);

  return (
    <div className="space-y-3">
      {items.map((item, idx) => {
        const open = idx === openIdx;
        return (
          <div
            key={item.q}
            className={`border transition ${
              open
                ? "border-[#a78bfa]/25 bg-[#a78bfa]/[0.05]"
                : "border-white/8 bg-black/25"
            }`}
          >
            <button
              type="button"
              className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left"
              onClick={() => setOpenIdx(open ? null : idx)}
            >
              <span className="text-sm md:text-base font-bold tracking-wide text-white">
                {item.q}
              </span>
              <span className="text-xs text-white/45">{open ? "−" : "+"}</span>
            </button>
            {open && (
              <div className="px-4 pb-4">
                <p className="max-w-3xl text-sm leading-7 text-white/62">
                  {item.a}
                </p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function FeatureCard({ title, body, accent = "cyan" }) {
  const color =
    { violet: VIOLET, cyan: CYAN, mint: MINT, rose: ROSE }[accent] || CYAN;

  return (
    <div className="relative border border-white/10 bg-black/25 p-5 overflow-hidden">
      <Brackets color={color} size="8px" thick="1px" />
      <div
        className="inline-flex h-10 w-10 items-center justify-center border text-sm font-extrabold"
        style={{ borderColor: `${color}33`, color }}
      >
        •
      </div>
      <h3 className="mt-4 text-lg font-extrabold tracking-tight text-white">
        {title}
      </h3>
      <p className="mt-2 text-sm leading-7 text-white/62">{body}</p>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   PAGE
───────────────────────────────────────────────────────────── */
export default function About() {
  const [stats, setStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const { data } = await api.get("/stats");
        setStats(data);
      } catch (err) {
        console.error("Failed to load stats", err);
      } finally {
        setLoadingStats(false);
      }
    }
    fetchStats();
  }, []);

  const quickStats = useMemo(
    () => [
      {
        label: "Active Users",
        value: stats?.activeUsers?.toLocaleString?.() ?? "—",
        accent: "mint",
      },
      {
        label: "Tracked Volume",
        value: formatMoneyFromMinor(stats?.trackedVolumeMinor),
        accent: "cyan",
      },
      {
        label: "Avg. Setup Time",
        value: stats?.avgSetupTime != null ? `${stats.avgSetupTime} min` : "—",
        accent: "violet",
      },
      {
        label: "Platforms",
        value: stats?.platforms ?? "—",
        accent: "rose",
      },
    ],
    [stats],
  );

  const featureCards = [
    {
      title: "Unified money view",
      body: "Track expenses, incomes, and investments in one structured system without jumping across disconnected tools.",
      accent: "cyan",
    },
    {
      title: "Automation first",
      body: "Recurring flows, imports, and categorization support reduce manual work and make reports more reliable.",
      accent: "mint",
    },
    {
      title: "AI-powered guidance",
      body: "Nummoria helps explain financial patterns and tradeoffs in plain language using your own data context.",
      accent: "violet",
    },
    {
      title: "Privacy-minded design",
      body: "Your data is treated as product-critical information, not ad inventory. Control, clarity, and ownership come first.",
      accent: "rose",
    },
    {
      title: "Built for multi-currency life",
      body: "Track global spending, income, and investments with currency-aware formatting and reporting.",
      accent: "cyan",
    },
    {
      title: "Made to scale with you",
      body: "From student budgeting to more advanced portfolio tracking, the platform grows without becoming chaotic.",
      accent: "mint",
    },
  ];

  const stackItems = [
    {
      k: "Frontend",
      v: "React, Vite, Tailwind CSS, React Native",
      accent: "cyan",
    },
    {
      k: "Backend",
      v: "Node.js, Express, REST APIs",
      accent: "mint",
    },
    {
      k: "Data",
      v: "MongoDB, structured financial models, category-based reporting",
      accent: "violet",
    },
    {
      k: "Infrastructure",
      v: "Docker-ready architecture, deployment-friendly environment setup",
      accent: "rose",
    },
    {
      k: "AI Layer",
      v: "Optional assistant workflows for summaries, explanations, and guidance",
      accent: "cyan",
    },
    {
      k: "Security",
      v: "Access control, authenticated routes, protected account-level operations",
      accent: "mint",
    },
  ];

  const timeline = [
    {
      when: "2024 · Idea",
      what: "Nummoria started as a direct response to the frustration of scattered personal finance tracking.",
      accent: "mint",
    },
    {
      when: "2025 · Core product",
      what: "The first connected system for expenses, incomes, categories, accounts, and reports took shape.",
      accent: "cyan",
    },
    {
      when: "2026 · Expansion",
      what: "The platform expanded toward mobile, AI-assisted workflows, and a more complete financial operating system.",
      accent: "violet",
    },
  ];

  const faqs = [
    {
      q: "What is Nummoria?",
      a: "Nummoria is a personal finance platform designed to help users manage transactions, accounts, reports, and investments in one place.",
    },
    {
      q: "Is it only for simple budgeting?",
      a: "No. It is designed to support both everyday budgeting and more advanced financial tracking, including investments and reporting.",
    },
    {
      q: "Does it support AI features?",
      a: "Yes. AI features are designed to be optional and focused on explanations, summaries, and decision support.",
    },
    {
      q: "Can I export my data?",
      a: "Yes. Data portability is part of the product direction, and export/report workflows are built into the platform experience.",
    },
  ];

  return (
    <div className="min-h-dvh bg-[#030508] text-[#e2e8f0] font-sans selection:bg-[#a78bfa]/30">
      <style
        dangerouslySetInnerHTML={{
          __html: `
            .custom-scrollbar::-webkit-scrollbar { width: 4px; height: 4px; }
            .custom-scrollbar::-webkit-scrollbar-track { background: rgba(255,255,255,0.02); }
            .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 4px; }
            .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.4); }
          `,
        }}
      />

      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[#030508]" />
        <div className="absolute inset-0 bg-[radial-gradient(1200px_800px_at_15%_0%,rgba(0,255,135,0.08),transparent_55%),radial-gradient(1000px_700px_at_85%_10%,rgba(167,139,250,0.10),transparent_55%),radial-gradient(900px_700px_at_50%_100%,rgba(0,212,255,0.06),transparent_60%)]" />
        <div className="absolute inset-0 opacity-[0.08] bg-[linear-gradient(to_right,rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.08)_1px,transparent_1px)] bg-[size:38px_38px]" />
      </div>

      <div className="mx-auto max-w-screen-2xl w-full px-4 sm:px-6 lg:px-8 py-6 flex flex-col gap-5">
        <SectionCard className="overflow-visible" accent="violet">
          <div className="flex flex-col gap-8 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-4xl">
              <SectionLabel accent="mint">about nummoria</SectionLabel>

              <h1 className="mt-5 text-3xl md:text-6xl font-extrabold tracking-tight text-white leading-none">
                Built to make financial clarity feel native
              </h1>

              <p className="mt-4 max-w-3xl text-sm md:text-base text-white/65 leading-relaxed">
                Nummoria is designed as a modern money operating system — one
                place to track, understand, and improve your financial life with
                structure, speed, and intelligent guidance.
              </p>

              <ScanLine color={VIOLET} className="mt-6 w-full max-w-md" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 xl:w-[460px]">
              <MetricCard label="Core Focus" value="Clear data" accent="mint" />
              <MetricCard
                label="Workflow"
                value="Automation-led"
                accent="cyan"
              />
              <MetricCard
                label="Experience"
                value="Premium UX"
                accent="violet"
              />
              <MetricCard
                label="Direction"
                value="Financial OS"
                accent="rose"
              />
            </div>
          </div>
        </SectionCard>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {quickStats.map((item) => (
            <MetricCard
              key={item.label}
              label={item.label}
              value={item.value}
              accent={item.accent}
              loading={loadingStats}
            />
          ))}
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <SectionCard accent="mint">
            <SectionHeading
              eyebrow="mission"
              title="Why Nummoria exists"
              text="Personal finance tools are often either too shallow, too ugly, or too fragmented. Nummoria exists to bring structure, clarity, and usability into one connected system."
              accent="mint"
            />
          </SectionCard>

          <SectionCard accent="violet">
            <SectionHeading
              eyebrow="vision"
              title="What we are building toward"
              text="A financial platform that feels precise, supportive, and deeply usable — where people can understand their money, improve their habits, and make stronger long-term decisions."
              accent="violet"
            />
          </SectionCard>
        </div>

        <SectionCard accent="cyan">
          <div className="mb-6">
            <SectionLabel accent="cyan">
              what makes nummoria different
            </SectionLabel>
            <h2 className="mt-4 text-2xl md:text-4xl font-extrabold tracking-tight text-white">
              Designed as a system, not a checklist
            </h2>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {featureCards.map((card) => (
              <FeatureCard
                key={card.title}
                title={card.title}
                body={card.body}
                accent={card.accent}
              />
            ))}
          </div>
        </SectionCard>

        <SectionCard accent="rose">
          <div className="grid gap-10 lg:grid-cols-[1fr_1.2fr]">
            <div>
              <SectionHeading
                eyebrow="our story"
                title="From personal frustration to product direction"
                text="Nummoria began as a practical response to a simple problem: financial data was everywhere, but clarity was nowhere. The goal became building a product that feels intentional from the first entry to the final report."
                accent="rose"
              />
            </div>

            <div className="space-y-4">
              {timeline.map((item, index) => (
                <TimelineCard
                  key={item.when}
                  when={item.when}
                  what={item.what}
                  accent={item.accent}
                  isLast={index === timeline.length - 1}
                />
              ))}
            </div>
          </div>
        </SectionCard>

        <SectionCard accent="mint">
          <div className="mb-6">
            <SectionLabel accent="mint">how it is built</SectionLabel>
            <h2 className="mt-4 text-2xl md:text-4xl font-extrabold tracking-tight text-white">
              A practical stack for a serious product
            </h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {stackItems.map((item) => (
              <div
                key={item.k}
                className="relative border border-white/10 bg-black/25 p-5 overflow-hidden"
              >
                <Brackets
                  color={
                    { cyan: CYAN, mint: MINT, violet: VIOLET, rose: ROSE }[
                      item.accent
                    ]
                  }
                  size="8px"
                  thick="1px"
                />
                <div className="text-xs uppercase tracking-[0.18em] text-white/40">
                  {item.k}
                </div>
                <div className="mt-3 text-sm leading-7 text-white/70">
                  {item.v}
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard accent="violet">
          <div className="mb-6">
            <SectionLabel accent="violet">faq</SectionLabel>
            <h2 className="mt-4 text-2xl md:text-4xl font-extrabold tracking-tight text-white">
              Common questions
            </h2>
          </div>

          <FAQ items={faqs} />
        </SectionCard>

        <div
          className="relative overflow-hidden border border-white/10 p-8 md:p-10"
          style={{
            background:
              "linear-gradient(135deg, rgba(0,255,135,0.10), rgba(167,139,250,0.12), rgba(0,212,255,0.10))",
          }}
        >
          <Brackets color={MINT} size="12px" thick="1.5px" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(500px_220px_at_10%_0%,rgba(255,255,255,0.10),transparent_60%)]" />

          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <div className="text-xs uppercase tracking-[0.18em] text-white/45">
                get started
              </div>
              <h3 className="mt-3 text-2xl md:text-5xl font-extrabold tracking-tight text-white leading-none">
                Ready to build a clearer financial system?
              </h3>
              <p className="mt-4 text-sm md:text-base text-white/65 leading-relaxed">
                Start tracking with Nummoria and turn raw transactions into a
                cleaner, more intelligent money workflow.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <a
                href="/signup"
                className="inline-flex h-12 items-center justify-center px-5 text-sm font-extrabold tracking-wider uppercase text-[#030508] transition hover:opacity-95"
                style={{ backgroundColor: MINT }}
              >
                Create Your Account
              </a>

              <a
                href="/contact"
                className="inline-flex h-12 items-center justify-center border border-white/10 bg-white/[0.05] px-5 text-sm font-bold tracking-wider uppercase text-white/80 transition hover:bg-white/[0.08] hover:text-white"
              >
                Contact Us
              </a>
            </div>
          </div>
        </div>

        <footer className="border-t border-white/10 pt-6 text-sm text-white/45">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              © {new Date().getFullYear()} Nummoria. All rights reserved.
            </div>
            <div className="flex gap-4 flex-wrap">
              <a href="/privacy" className="transition hover:text-white/75">
                Privacy
              </a>
              <a href="/terms" className="transition hover:text-white/75">
                Terms
              </a>
              <a href="/contact" className="transition hover:text-white/75">
                Contact
              </a>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
