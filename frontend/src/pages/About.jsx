/* eslint-disable no-unused-vars */
import { useMemo, useEffect, useState } from "react";
import api from "../lib/api";

/**
 * About Page — Nummoria (no overlaps, all sections clearly separated)
 * - Removed all negative margins (no -mt-*)
 * - Compact hero + normal flow layout
 * - Consistent vertical spacing between sections
 */

const BRAND = {
  main: "#4f772d",
  secondary: "#90a955",
  dark: "#1c1f1a",
  light: "#f6f9f4",
};

// export const getUserCount = async (req, res) => {
//   try {
//     const count = await User.countDocuments({});
//     res.json({ totalUsers: count });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: "Failed to count users" });
//   }
// };
function formatMoneyFromMinor(minor, currency = "USD") {
  const major = Number(minor || 0) / 100;
  return new Intl.NumberFormat(undefined, {
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
  const gradients = useMemo(
    () => ({
      hero: {
        background: `linear-gradient(135deg, ${BRAND.main} 0%, ${BRAND.secondary} 100%)`,
      },
    }),
    []
  );

  return (
    <div className="min-h-screen w-full bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      {/* HERO — compact, no overlap */}
      <section className="relative overflow-hidden" style={gradients.hero}>
        <div className="absolute inset-0 opacity-20 pointer-events-none">
          <div
            className="absolute -top-24 -left-24 h-72 w-72 rounded-full blur-3xl"
            style={{ background: BRAND.light }}
          />
          <div
            className="absolute -bottom-24 -right-24 h-72 w-72 rounded-full blur-3xl"
            style={{ background: BRAND.dark }}
          />
        </div>

        <div className="relative mx-auto max-w-6xl px-6 py-12 md:py-14 lg:py-16">
          <h1 className="text-3xl md:text-5xl lg:text-6xl font-extrabold tracking-tight text-white drop-shadow-sm">
            About Nummoria
          </h1>
          <p className="mt-4 max-w-2xl text-zinc-100/90 text-base md:text-lg">
            Your all-in-one money OS — track expenses, incomes, and investments,
            get AI insights, and build the life you want with clarity.
          </p>
          <div className="mt-6 flex flex-wrap gap-2.5">
            <a
              href="/"
              className="inline-flex items-center gap-2 rounded-xl bg-white/95 px-4 py-2.5 text-zinc-900 shadow hover:bg-white"
            >
              Get Started <span aria-hidden>→</span>
            </a>
            <a
              href="/docs"
              className="inline-flex items-center gap-2 rounded-xl border border-white/60 bg-transparent px-4 py-2.5 text-white hover:bg-white/10"
            >
              Read the Docs
            </a>
          </div>
        </div>
      </section>

      {/* QUICK STATS — normal flow (no negative margin) */}
      <section className="mx-auto max-w-6xl px-6 py-8 md:py-10">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {[
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
              value:
                (stats?.avgSetupTime ?? "—") +
                (stats?.avgSetupTime != null ? " min" : ""),
            },
            { label: "Platforms", value: stats?.platforms ?? "—" },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-2xl border border-zinc-200/70 bg-white p-5 text-center shadow-sm dark:border-zinc-800/70 dark:bg-zinc-900"
            >
              <div
                className="text-xl md:text-2xl font-extrabold"
                style={{ color: BRAND.main }}
              >
                {s.value}
              </div>
              <div className="mt-1 text-xs md:text-sm text-zinc-500 dark:text-zinc-400">
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* MISSION & VISION */}
      <section className="mx-auto max-w-5xl px-6 py-12 md:py-14">
        <div className="grid items-start gap-8 md:grid-cols-2">
          <div>
            <h2 className="text-xl md:text-2xl font-bold">Our Mission</h2>
            <p className="mt-3 text-zinc-600 dark:text-zinc-300">
              Make personal finance effortless for everyone. Nummoria turns
              messy transactions into clean, searchable knowledge and then
              layers in AI-powered guidance that helps you decide, not just
              record.
            </p>
          </div>
          <div>
            <h2 className="text-xl md:text-2xl font-bold">Our Vision</h2>
            <p className="mt-3 text-zinc-600 dark:text-zinc-300">
              A world where managing money feels like using a great fitness app:
              measurable habits, clear progress, and smart nudges that make
              tomorrow’s decisions easier than today’s.
            </p>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="mx-auto max-w-6xl px-6 py-12 md:py-14">
        <h2 className="text-xl md:text-2xl font-bold">
          What makes Nummoria different
        </h2>
        <div className="mt-6 grid gap-5 md:grid-cols-3">
          {[
            {
              title: "Unified money view",
              body: "Connect expenses, income, and investments in one place with fast search and clean summaries.",
            },
            {
              title: "Built-in automation",
              body: "Recurring rules, category suggestions, and CSV/PDF import save hours every month.",
            },
            {
              title: "AI insights (opt-in)",
              body: "Explain unusual spikes, compare months, or ask 'why is my savings rate lower?' in plain language.",
            },
            {
              title: "Privacy first",
              body: "Your data stays your data. Local caching, export anytime, and role-based controls for shared budgets.",
            },
            {
              title: "Multi-currency",
              body: "Track TRY, USD, EUR and more. See live conversions and set a base currency you control.",
            },
            {
              title: "Grows with you",
              body: "From student budgets to side-hustles and portfolios, Nummoria scales without complexity.",
            },
          ].map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-zinc-200/70 bg-white p-5 shadow-sm transition hover:shadow-md dark:border-zinc-800/70 dark:bg-zinc-900"
            >
              <div
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl"
                style={{ background: BRAND.light }}
              >
                <span
                  className="text-base font-bold"
                  style={{ color: BRAND.main }}
                >
                  •
                </span>
              </div>
              <h3 className="mt-3 text-base md:text-lg font-semibold">
                {f.title}
              </h3>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
                {f.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* STORY */}
      <section className="mx-auto max-w-5xl px-6 py-12 md:py-14">
        <h2 className="text-xl md:text-2xl font-bold">Our story</h2>
        <ol className="relative mt-6 border-s border-zinc-200 dark:border-zinc-800">
          {[
            {
              when: "2024 → Idea",
              what: "Started as a personal tool to understand where money goes each month — fast, honest, and simple.",
            },
            {
              when: "2025 → Public alpha",
              what: "Released the first version with expenses, income, and early investment tracking.",
            },
            {
              when: "2026 → Mobile & AI",
              what: "Launched the mobile app and added optional AI insights for smart explanations and planning.",
            },
          ].map((t, i) => (
            <li key={t.when} className="mb-8 ms-6">
              <span
                className="absolute -start-3 mt-1 flex h-6 w-6 items-center justify-center rounded-full ring-4 ring-white dark:ring-zinc-950"
                style={{ background: i === 2 ? BRAND.main : BRAND.secondary }}
              />
              <h4 className="font-semibold">{t.when}</h4>
              <p className="mt-1 text-zinc-600 dark:text-zinc-300">{t.what}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* TECH STACK */}
      <section className="mx-auto max-w-6xl px-6 py-12 md:py-14">
        <h2 className="text-xl md:text-2xl font-bold">How it’s built</h2>
        <p className="mt-2 max-w-3xl text-zinc-600 dark:text-zinc-300">
          We build with a practical, secure stack focused on speed and DX.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              k: "Frontend",
              v: "React (Vite), React Native (Expo), Tailwind, Zustand",
            },
            {
              k: "Backend",
              v: "Node.js/Express, C#/.NET (services), REST/JSON",
            },
            { k: "Database", v: "MongoDB & SQL (analytics), Prisma/Mongoose" },
            {
              k: "Infra",
              v: "Docker, AWS (EC2/S3), CI/CD with GitHub Actions",
            },
            { k: "AI", v: "Optional OpenAI-based assistants for insights" },
            { k: "Security", v: "RBAC, JWT/OAuth (prod), audit logs, backups" },
          ].map((item) => (
            <div
              key={item.k}
              className="rounded-2xl border border-zinc-200/70 bg-white p-5 shadow-sm dark:border-zinc-800/70 dark:bg-zinc-900"
            >
              <div className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                {item.k}
              </div>
              <div className="mt-2 font-medium">{item.v}</div>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-5xl px-6 pb-16 md:pb-20">
        <h2 className="text-xl md:text-2xl font-bold">FAQ</h2>
        <div className="mt-5 divide-y divide-zinc-200 dark:divide-zinc-800 rounded-2xl border border-zinc-200/70 dark:border-zinc-800/70 overflow-hidden">
          {[
            {
              q: "Is Nummoria free?",
              a: "There’s a generous free tier during development. We’ll introduce fair pricing for premium features after launch.",
            },
            {
              q: "Do you support CSV/PDF imports?",
              a: "Yes, you can import bank statements and categorize quickly. We’re expanding provider integrations over time.",
            },
            {
              q: "How does AI work here?",
              a: "AI is opt-in and scoped to your data. It helps explain trends and generate summaries; you stay in control.",
            },
            {
              q: "Can I export my data?",
              a: "Absolutely. You can export your data at any time.",
            },
          ].map((f) => (
            <details
              key={f.q}
              className="group open:bg-zinc-50/60 dark:open:bg-zinc-900/60"
            >
              <summary className="cursor-pointer list-none px-6 py-4 font-medium hover:bg-zinc-50/60 dark:hover:bg-zinc-900/60">
                <span className="mr-2" style={{ color: BRAND.main }}>
                  ▸
                </span>
                {f.q}
              </summary>
              <div className="px-6 pb-4 text-zinc-600 dark:text-zinc-300">
                {f.a}
              </div>
            </details>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-zinc-200/70 bg-gradient-to-br from-white to-zinc-50 dark:from-zinc-900 dark:to-zinc-950 dark:border-zinc-800/70">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <div
            className="rounded-3xl p-8 md:p-10 shadow-lg"
            style={{
              background: `linear-gradient(135deg, ${BRAND.secondary} 0%, ${BRAND.main} 100%)`,
            }}
          >
            <h3 className="text-2xl md:text-3xl font-extrabold text-white">
              Ready to take control of your money?
            </h3>
            <p className="mt-2 max-w-2xl text-zinc-100/90">
              Join thousands building smarter habits with Nummoria.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <a
                href="/signup"
                className="rounded-2xl bg-white px-5 py-3 font-semibold text-zinc-900 shadow hover:bg-zinc-100"
              >
                Create your account
              </a>
              <a
                href="/contact"
                className="rounded-2xl border border-white/70 px-5 py-3 font-semibold text-white hover:bg-white/10"
              >
                Contact us
              </a>
            </div>
          </div>
        </div>
      </section>

      <footer className="mx-auto max-w-6xl px-6 pb-10 text-sm text-zinc-500 dark:text-zinc-400">
        <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
          <div>© {new Date().getFullYear()} Nummoria. All rights reserved.</div>
          <div className="flex gap-4">
            <a href="/privacy" className="hover:underline">
              Privacy
            </a>
            <a href="/terms" className="hover:underline">
              Terms
            </a>
            <a href="/status" className="hover:underline">
              Status
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
