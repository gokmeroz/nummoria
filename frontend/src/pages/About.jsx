/* eslint-disable no-unused-vars */
import { useEffect, useMemo, useState } from "react";
import api from "../lib/api";

const BRAND = {
  main: "#4f772d",
  secondary: "#90a955",
};

function formatMoneyFromMinor(minor, currency = "USD") {
  if (minor === null || minor === undefined) return "—";
  const major = Number(minor || 0) / 100;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(major);
}

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
        label: "Active users",
        value: stats?.activeUsers?.toLocaleString?.() ?? "—",
      },
      {
        label: "Tracked volume",
        value: formatMoneyFromMinor(stats?.trackedVolumeMinor),
      },
      {
        label: "Avg. setup time",
        value: stats?.avgSetupTime != null ? `${stats.avgSetupTime} min` : "—",
      },
      {
        label: "Platforms",
        value: stats?.platforms ?? "—",
      },
    ],
    [stats],
  );

  const featureCards = [
    {
      title: "Unified money view",
      body: "Track expenses, incomes, and investments in one structured system without jumping across disconnected tools.",
    },
    {
      title: "Automation first",
      body: "Recurring flows, imports, and categorization support reduce manual work and make reports more reliable.",
    },
    {
      title: "AI-powered guidance",
      body: "Nummoria helps explain financial patterns and tradeoffs in plain language using your own data context.",
    },
    {
      title: "Privacy-minded design",
      body: "Your data is treated as product-critical information, not ad inventory. Control, clarity, and ownership come first.",
    },
    {
      title: "Built for multi-currency life",
      body: "Track global spending, income, and investments with currency-aware formatting and reporting.",
    },
    {
      title: "Made to scale with you",
      body: "From student budgeting to more advanced portfolio tracking, the platform grows without becoming chaotic.",
    },
  ];

  const stackItems = [
    {
      k: "Frontend",
      v: "React, Vite, Tailwind CSS, React Native",
    },
    {
      k: "Backend",
      v: "Node.js, Express, REST APIs",
    },
    {
      k: "Data",
      v: "MongoDB, structured financial models, category-based reporting",
    },
    {
      k: "Infrastructure",
      v: "Docker-ready architecture, deployment-friendly environment setup",
    },
    {
      k: "AI Layer",
      v: "Optional assistant workflows for summaries, explanations, and guidance",
    },
    {
      k: "Security",
      v: "Access control, authenticated routes, protected account-level operations",
    },
  ];

  const timeline = [
    {
      when: "2024 · Idea",
      what: "Nummoria started as a direct response to the frustration of scattered personal finance tracking.",
    },
    {
      when: "2025 · Core product",
      what: "The first connected system for expenses, incomes, categories, accounts, and reports took shape.",
    },
    {
      when: "2026 · Expansion",
      what: "The platform expanded toward mobile, AI-assisted workflows, and a more complete financial operating system.",
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
    <div className="min-h-[100dvh] bg-[#070A07] text-white">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[#070A07]" />
        <div className="absolute inset-0 bg-[radial-gradient(1200px_800px_at_15%_0%,rgba(19,226,67,0.10),transparent_55%),radial-gradient(1000px_700px_at_85%_10%,rgba(153,23,70,0.10),transparent_55%),radial-gradient(900px_700px_at_50%_100%,rgba(255,255,255,0.04),transparent_60%)]" />
        <div className="absolute inset-0 opacity-[0.10] mix-blend-overlay bg-[linear-gradient(to_right,rgba(255,255,255,0.10)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.10)_1px,transparent_1px)] bg-[size:56px_56px]" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/35 to-black/70" />
      </div>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <section className="mb-6">
          <GlassCard className="overflow-visible">
            <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-white/60">
                  <span className="h-2 w-2 rounded-full bg-[#13e243]" />
                  about nummoria
                </div>

                <div className="mt-4">
                  <h1 className="text-3xl md:text-5xl font-semibold tracking-tight text-white">
                    Built to make financial clarity feel native
                  </h1>
                  <p className="mt-3 max-w-2xl text-sm md:text-base text-white/60">
                    Nummoria is designed as a modern money operating system —
                    one place to track, understand, and improve your financial
                    life with structure, speed, and intelligent guidance.
                  </p>
                </div>
              </div>

              <div className="max-w-md rounded-3xl border border-white/10 bg-black/20 px-4 py-4 text-sm text-white/70">
                <div className="font-semibold text-white">What we focus on</div>
                <div className="mt-1">
                  Clear data, intelligent workflows, and a premium experience
                  for everyday money management.
                </div>
              </div>
            </div>
          </GlassCard>
        </section>

        <section className="mb-6">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {quickStats.map((item) => (
              <GlassCard key={item.label}>
                <div className="text-center">
                  <div
                    className="text-2xl md:text-3xl font-semibold tracking-tight"
                    style={{ color: "#dce8bf" }}
                  >
                    {loadingStats ? "..." : item.value}
                  </div>
                  <div className="mt-2 text-xs md:text-sm text-white/50">
                    {item.label}
                  </div>
                </div>
              </GlassCard>
            ))}
          </div>
        </section>

        <section className="mb-6 grid gap-6 lg:grid-cols-2">
          <GlassCard>
            <SectionHeading
              eyebrow="mission"
              title="Why Nummoria exists"
              text="Personal finance tools are often either too shallow, too ugly, or too fragmented. Nummoria exists to bring structure, clarity, and usability into one connected system."
            />
          </GlassCard>

          <GlassCard>
            <SectionHeading
              eyebrow="vision"
              title="What we are building toward"
              text="A financial platform that feels precise, supportive, and deeply usable — where people can understand their money, improve their habits, and make stronger long-term decisions."
            />
          </GlassCard>
        </section>

        <section className="mb-6">
          <GlassCard>
            <div className="mb-6">
              <SectionLabel>what makes nummoria different</SectionLabel>
              <h2 className="mt-3 text-2xl md:text-3xl font-semibold tracking-tight text-white">
                Designed as a system, not a checklist
              </h2>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {featureCards.map((card) => (
                <div
                  key={card.title}
                  className="rounded-3xl border border-white/10 bg-black/20 p-5"
                >
                  <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] text-[#dce8bf]">
                    •
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-white">
                    {card.title}
                  </h3>
                  <p className="mt-2 text-sm leading-7 text-white/60">
                    {card.body}
                  </p>
                </div>
              ))}
            </div>
          </GlassCard>
        </section>

        <section className="mb-6">
          <GlassCard>
            <div className="grid gap-10 lg:grid-cols-[1fr_1.2fr]">
              <div>
                <SectionLabel>our story</SectionLabel>
                <h2 className="mt-3 text-2xl md:text-3xl font-semibold tracking-tight text-white">
                  From personal frustration to product direction
                </h2>
                <p className="mt-3 text-sm leading-7 text-white/60">
                  Nummoria began as a practical response to a simple problem:
                  financial data was everywhere, but clarity was nowhere. The
                  goal became building a product that feels intentional from the
                  first entry to the final report.
                </p>
              </div>

              <div className="space-y-4">
                {timeline.map((item, index) => (
                  <div
                    key={item.when}
                    className="flex gap-4 rounded-3xl border border-white/10 bg-black/20 p-5"
                  >
                    <div className="flex flex-col items-center">
                      <div
                        className="h-3 w-3 rounded-full"
                        style={{
                          backgroundColor:
                            index === timeline.length - 1
                              ? BRAND.main
                              : BRAND.secondary,
                        }}
                      />
                      {index !== timeline.length - 1 ? (
                        <div className="mt-2 h-full w-px bg-white/10" />
                      ) : null}
                    </div>

                    <div>
                      <div className="text-sm font-semibold text-white">
                        {item.when}
                      </div>
                      <p className="mt-1 text-sm leading-7 text-white/60">
                        {item.what}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </GlassCard>
        </section>

        <section className="mb-6">
          <GlassCard>
            <div className="mb-6">
              <SectionLabel>how it is built</SectionLabel>
              <h2 className="mt-3 text-2xl md:text-3xl font-semibold tracking-tight text-white">
                A practical stack for a serious product
              </h2>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {stackItems.map((item) => (
                <div
                  key={item.k}
                  className="rounded-3xl border border-white/10 bg-black/20 p-5"
                >
                  <div className="text-xs uppercase tracking-[0.18em] text-white/40">
                    {item.k}
                  </div>
                  <div className="mt-3 text-sm leading-7 text-white/70">
                    {item.v}
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>
        </section>

        <section className="mb-6">
          <GlassCard>
            <div className="mb-6">
              <SectionLabel>faq</SectionLabel>
              <h2 className="mt-3 text-2xl md:text-3xl font-semibold tracking-tight text-white">
                Common questions
              </h2>
            </div>

            <div className="divide-y divide-white/10 rounded-3xl border border-white/10 bg-black/20">
              {faqs.map((item) => (
                <details key={item.q} className="group px-5 py-4">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left">
                    <span className="text-sm md:text-base font-medium text-white">
                      {item.q}
                    </span>
                    <span className="text-white/40 transition group-open:rotate-45">
                      +
                    </span>
                  </summary>
                  <p className="mt-3 max-w-3xl text-sm leading-7 text-white/60">
                    {item.a}
                  </p>
                </details>
              ))}
            </div>
          </GlassCard>
        </section>

        <section className="pb-6">
          <div
            className="relative overflow-hidden rounded-[32px] border border-white/10 p-8 md:p-10"
            style={{
              background:
                "linear-gradient(135deg, rgba(144,169,85,0.22), rgba(79,119,45,0.38))",
            }}
          >
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(500px_220px_at_10%_0%,rgba(255,255,255,0.10),transparent_60%)]" />

            <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-2xl">
                <div className="text-xs uppercase tracking-[0.18em] text-white/45">
                  get started
                </div>
                <h3 className="mt-3 text-2xl md:text-4xl font-semibold tracking-tight text-white">
                  Ready to build a clearer financial system?
                </h3>
                <p className="mt-3 text-sm md:text-base text-white/65">
                  Start tracking with Nummoria and turn raw transactions into a
                  cleaner, more intelligent money workflow.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <a
                  href="/signup"
                  className="inline-flex h-12 items-center justify-center rounded-2xl px-5 text-sm font-semibold text-white transition hover:opacity-95"
                  style={{
                    background: "linear-gradient(135deg, #90a955, #4f772d)",
                  }}
                >
                  Create your account
                </a>

                <a
                  href="/contact"
                  className="inline-flex h-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] px-5 text-sm font-semibold text-white/80 transition hover:bg-white/[0.08] hover:text-white"
                >
                  Contact us
                </a>
              </div>
            </div>
          </div>
        </section>

        <footer className="border-t border-white/10 pt-6 text-sm text-white/45">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              © {new Date().getFullYear()} Nummoria. All rights reserved.
            </div>
            <div className="flex gap-4">
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

function GlassCard({ children, className = "" }) {
  return (
    <div
      className={`relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-md ${className}`}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(500px_180px_at_10%_0%,rgba(19,226,67,0.06),transparent_60%),radial-gradient(420px_180px_at_90%_10%,rgba(153,23,70,0.08),transparent_60%)]" />
      <div className="relative p-5 md:p-6">{children}</div>
    </div>
  );
}

function SectionLabel({ children }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-white/50">
      <span className="h-2 w-2 rounded-full bg-[#13e243]" />
      {children}
    </div>
  );
}

function SectionHeading({ eyebrow, title, text }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-[0.18em] text-white/45">
        {eyebrow}
      </div>
      <h2 className="mt-3 text-2xl md:text-3xl font-semibold tracking-tight text-white">
        {title}
      </h2>
      <p className="mt-3 text-sm leading-7 text-white/60">{text}</p>
    </div>
  );
}
