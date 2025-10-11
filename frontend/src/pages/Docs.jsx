// frontend/src/pages/Docs.jsx
import { useMemo } from "react";

const BRAND = {
  main: "#4f772d",
  secondary: "#90a955",
  dark: "#1c1f1a",
  light: "#f6f9f4",
};

export default function Docs() {
  const styles = useMemo(
    () => ({
      heroBg: {
        background: `linear-gradient(135deg, ${BRAND.main} 0%, ${BRAND.secondary} 100%)`,
      },
    }),
    []
  );

  return (
    <div className="min-h-screen w-full bg-white text-zinc-900">
      {/* HERO */}
      <section className="relative overflow-hidden" style={styles.heroBg}>
        <div className="absolute inset-0 opacity-15 pointer-events-none">
          <div
            className="absolute -top-24 -left-24 h-72 w-72 rounded-full blur-3xl"
            style={{ background: BRAND.light }}
          />
          <div
            className="absolute -bottom-24 -right-24 h-72 w-72 rounded-full blur-3xl"
            style={{ background: "#132a13" }}
          />
        </div>

        <div className="relative mx-auto max-w-6xl px-6 py-16">
          <h1 className="text-4xl md:text-5xl font-extrabold text-white drop-shadow">
            Nummoria Documentation
          </h1>
          <p className="mt-4 text-lg md:text-xl text-white/95 max-w-3xl">
            Clear, practical guidance for using Nummoria to track expenses,
            income, and investments—without the fluff.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a
              href="/login"
              className="rounded-2xl bg-white px-6 py-3 text-sm md:text-base font-semibold text-zinc-900 shadow hover:bg-zinc-100"
            >
              Create an account
            </a>
            <a
              href="#quick-start"
              className="rounded-2xl border border-white/70 px-6 py-3 text-sm md:text-base font-semibold text-white hover:bg-white/10"
            >
              Quick start
            </a>
          </div>
        </div>
      </section>

      {/* CONTENT */}
      <main className="mx-auto max-w-6xl px-6 py-12 space-y-14">
        {/* Quick Start */}
        <section id="quick-start" className="scroll-mt-20">
          <h2 className="text-2xl md:text-3xl font-bold">Quick start</h2>
          <ol className="mt-4 grid gap-4 md:grid-cols-3">
            {[
              {
                n: "01",
                t: "Create your workspace",
                d: "Sign up, set base currency (e.g., TRY/USD/EUR), and your time zone.",
                cta: { href: "/signup", label: "Sign up" },
              },
              {
                n: "02",
                t: "Add your first transactions",
                d: "Record incomes and expenses. You can import CSV later; start simple.",
                cta: { href: "/expenses", label: "Add a transaction" },
              },
              {
                n: "03",
                t: "Review and categorize",
                d: "Use tags/categories so summaries are accurate. Check the dashboard weekly.",
                cta: { href: "/incomes", label: "Add income" },
              },
            ].map((s) => (
              <li
                key={s.n}
                className="rounded-2xl border border-zinc-200/70 bg-white p-5 shadow-sm"
              >
                <div className="text-sm font-mono text-zinc-500">{s.n}</div>
                <div className="mt-1 text-lg font-semibold">{s.t}</div>
                <p className="mt-1 text-zinc-600">{s.d}</p>
                <a
                  href={s.cta.href}
                  className="mt-3 inline-block rounded-xl bg-emerald-600 px-4 py-2 text-white text-sm font-semibold hover:bg-emerald-700"
                >
                  {s.cta.label}
                </a>
              </li>
            ))}
          </ol>
        </section>

        {/* Concepts */}
        <section id="concepts" className="scroll-mt-20">
          <h2 className="text-2xl md:text-3xl font-bold">Core concepts</h2>
          <div className="mt-6 grid gap-6 md:grid-cols-3">
            {[
              {
                k: "Transactions",
                v: "Every entry is a transaction with a type (income, expense, or investment), amount, currency, and date.",
              },
              {
                k: "Categories & Tags",
                v: "Group spending and income for clear summaries. Keep it simple; 8–12 categories is plenty.",
              },
              {
                k: "Multi-currency",
                v: "Amounts are stored in minor units (e.g., cents/kuruş). Reports convert to your base currency.",
              },
            ].map((c) => (
              <div
                key={c.k}
                className="rounded-2xl border border-zinc-200/70 bg-white p-6 shadow-sm"
              >
                <div
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl"
                  style={{ background: BRAND.light }}
                >
                  <span
                    className="text-lg font-bold"
                    style={{ color: BRAND.main }}
                  >
                    •
                  </span>
                </div>
                <h3 className="mt-3 text-lg font-semibold">{c.k}</h3>
                <p className="mt-2 text-sm text-zinc-600">{c.v}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Daily use */}
        <section id="daily" className="scroll-mt-20">
          <h2 className="text-2xl md:text-3xl font-bold">Daily use</h2>
          <div className="mt-6 grid gap-6 md:grid-cols-2">
            {[
              {
                t: "Add and edit transactions",
                b: "Use the Expenses/Incomes pages. Keep descriptions short and meaningful. Edit or delete mistakes anytime.",
                link: "/expenses",
              },
              {
                t: "Search & filter",
                b: "Filter by date, category, or amount to find patterns quickly. Save common filters as bookmarks.",
                link: "/expenses?filter=today",
              },
              {
                t: "Recurring items",
                b: "For rents/subscriptions, mark as recurring so they’re auto-created each period.",
                link: "/expenses?tab=recurring",
              },
              {
                t: "Imports & exports",
                b: "Import CSV when migrating from another app. Export your full data anytime.",
                link: "/settings/data",
              },
            ].map((item) => (
              <div
                key={item.t}
                className="rounded-2xl border border-zinc-200/70 bg-white p-6 shadow-sm"
              >
                <div className="text-base font-semibold">{item.t}</div>
                <p className="mt-2 text-sm text-zinc-600">{item.b}</p>
                <a
                  href={item.link}
                  className="mt-3 inline-block text-emerald-700 hover:text-emerald-800 underline"
                >
                  Open
                </a>
              </div>
            ))}
          </div>
        </section>

        {/* Tips */}
        <section id="tips" className="scroll-mt-20">
          <h2 className="text-2xl md:text-3xl font-bold">Simple tips</h2>
          <ul className="mt-4 grid gap-3 md:grid-cols-2">
            {[
              "Log purchases the same day—small habit, big clarity.",
              "Use consistent category names to keep charts clean.",
              "Set a base currency and stick to it for reporting.",
              "Review last month’s summary; set one change for this month.",
            ].map((tip) => (
              <li
                key={tip}
                className="rounded-xl border border-zinc-200/70 bg-white p-4 text-sm text-zinc-700"
              >
                {tip}
              </li>
            ))}
          </ul>
        </section>

        {/* Security & Privacy */}
        <section id="security" className="scroll-mt-20">
          <h2 className="text-2xl md:text-3xl font-bold">Security & privacy</h2>
          <div className="mt-4 rounded-2xl border border-zinc-200/70 bg-white p-6 shadow-sm">
            <ul className="list-disc pl-6 text-sm text-zinc-700 space-y-2">
              <li>Your data is yours. You can export or delete it anytime.</li>
              <li>
                Authentication uses standard best practices (JWT/OAuth in prod).
              </li>
              <li>Minor units storage reduces floating-point errors.</li>
              <li>Backups and audit logging are part of the roadmap.</li>
            </ul>
            <div className="mt-3 flex gap-4 text-sm">
              <a
                href="/privacy"
                className="underline text-emerald-700 hover:text-emerald-800"
              >
                Privacy Policy
              </a>
              <a
                href="/terms"
                className="underline text-emerald-700 hover:text-emerald-800"
              >
                Terms of Use
              </a>
              <a
                href="/contact"
                className="underline text-emerald-700 hover:text-emerald-800"
              >
                Contact
              </a>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="scroll-mt-20">
          <h2 className="text-2xl md:text-3xl font-bold">FAQ</h2>
          <div className="mt-4 divide-y divide-zinc-200 rounded-2xl border border-zinc-200/70 overflow-hidden">
            {[
              {
                q: "Is it free?",
                a: "There’s a free tier during development. Paid features will arrive later with clear pricing.",
              },
              {
                q: "Do you support CSV imports?",
                a: "Yes. Use the data settings page to import from banks or other apps.",
              },
              {
                q: "Can I use multiple currencies?",
                a: "Yes. Set a base currency for reports; transactions keep their original currency.",
              },
              {
                q: "How do I get support?",
                a: "Use the Contact page or email support. We usually respond within 1–2 business days.",
              },
            ].map((f) => (
              <details key={f.q} className="group open:bg-zinc-50/60">
                <summary className="cursor-pointer list-none px-6 py-4 font-medium hover:bg-zinc-50/60">
                  <span className="mr-2" style={{ color: BRAND.main }}>
                    ▸
                  </span>
                  {f.q}
                </summary>
                <div className="px-6 pb-4 text-zinc-700 text-sm">{f.a}</div>
              </details>
            ))}
          </div>
        </section>
      </main>

      {/* CTA */}
      <section className="border-t border-zinc-200/70 bg-gradient-to-br from-white to-zinc-50">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <div
            className="rounded-3xl p-8 md:p-12 shadow-lg"
            style={{
              background: `linear-gradient(135deg, ${BRAND.secondary} 0%, ${BRAND.main} 100%)`,
            }}
          >
            <h3 className="text-2xl md:text-3xl font-extrabold text-white">
              Ready to get organized?
            </h3>
            <p className="mt-2 max-w-2xl text-zinc-100/90">
              Start with your last 7 days of activity. You’ll see patterns fast.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
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

      {/* FOOTER */}
      <footer className="mx-auto max-w-6xl px-6 pb-10 text-sm text-zinc-500">
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
