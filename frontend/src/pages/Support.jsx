/* eslint-disable no-unused-vars */

// frontend/src/pages/Support.jsx
import React, { useEffect, useMemo, useState } from "react";
import api from "../lib/api";
import logoUrl from "../assets/nummoria_logo.png";

const BRAND = {
  main: "#4f772d",
  secondary: "#90a955",
};

const CATEGORIES = ["Bug", "Billing", "Data Issue", "Feature Request", "Other"];

const defaultTicket = {
  category: "Bug",
  priority: "normal",
  subject: "",
  message: "",
  email: "",
  attachLogs: false,
};

const USE_API = false; // set true after you create a /support-tickets backend

export default function SupportPage() {
  const [ticket, setTicket] = useState(defaultTicket);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);
  const [systemInfo, setSystemInfo] = useState({
    browser: "—",
    timezone: "—",
    lang: "—",
    width: "—",
    height: "—",
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    const updateInfo = () => {
      setSystemInfo({
        browser: navigator.userAgent,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        lang: navigator.language,
        width: `${window.innerWidth}px`,
        height: `${window.innerHeight}px`,
      });
    };

    updateInfo();
    window.addEventListener("resize", updateInfo);
    return () => window.removeEventListener("resize", updateInfo);
  }, []);

  const disabled = useMemo(() => {
    return (
      !ticket.subject.trim() ||
      !ticket.message.trim() ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ticket.email || "")
    );
  }, [ticket]);

  async function submitTicket(e) {
    e.preventDefault();
    if (disabled || busy) return;

    setBusy(true);
    try {
      if (USE_API) {
        await api.post("/support-tickets", {
          ...ticket,
          userAgent: navigator.userAgent,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        });
      } else {
        await new Promise((r) => setTimeout(r, 600));
      }

      setToast({ type: "ok", msg: "Thanks! We got your message." });
      setTicket(defaultTicket);
    } catch (err) {
      setToast({
        type: "err",
        msg:
          err?.response?.data?.error ||
          err?.message ||
          "Could not send your message.",
      });
    } finally {
      setBusy(false);
      setTimeout(() => setToast(null), 3500);
    }
  }

  return (
    <div className="min-h-[100dvh] bg-[#070A07] text-white">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[#070A07]" />
        <div className="absolute inset-0 bg-[radial-gradient(1200px_800px_at_15%_0%,rgba(19,226,67,0.10),transparent_55%),radial-gradient(1000px_700px_at_85%_10%,rgba(153,23,70,0.10),transparent_55%),radial-gradient(900px_700px_at_50%_100%,rgba(255,255,255,0.04),transparent_60%)]" />
        <div className="absolute inset-0 opacity-[0.10] mix-blend-overlay bg-[linear-gradient(to_right,rgba(255,255,255,0.10)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.10)_1px,transparent_1px)] bg-[size:56px_56px]" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/35 to-black/70" />
      </div>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <Header />

        <section className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          <SectionCard title="Contact options">
            <ul className="space-y-3 text-sm text-white/70">
              <li>
                <span className="text-white">Email:</span>{" "}
                <a
                  className="text-[#dce8bf] underline decoration-white/20 underline-offset-4"
                  href="mailto:support@nummoria.app"
                >
                  support@nummoria.app
                </a>
              </li>
              <li>
                <span className="text-white">In-app:</span> use the form on this
                page
              </li>
              <li>
                <span className="text-white">Status:</span>{" "}
                <a
                  className="text-[#dce8bf] underline decoration-white/20 underline-offset-4"
                  href="https://status.nummoria.app"
                  target="_blank"
                  rel="noreferrer"
                >
                  status.nummoria.app
                </a>
              </li>
            </ul>
          </SectionCard>

          <SectionCard title="Help center">
            <ul className="space-y-2 text-sm text-white/70">
              <li>Getting started with accounts & currencies</li>
              <li>Creating categories for income, expenses, and investments</li>
              <li>Live prices & market data setup</li>
              <li>Backups, reports, and export workflows</li>
            </ul>

            <a
              className="mt-4 inline-flex text-sm font-medium text-[#dce8bf] underline decoration-white/20 underline-offset-4"
              href="/docs"
            >
              Browse docs →
            </a>
          </SectionCard>

          <SectionCard title="System info">
            <SystemInfo info={systemInfo} />
          </SectionCard>
        </section>

        <section className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="min-w-0">
            <SectionCard
              title="Send us a message"
              subtitle="Share bugs, billing questions, feature requests, or data issues."
            >
              <form onSubmit={submitTicket} className="space-y-4">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <Field label="Category">
                    <select
                      className="w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-white outline-none"
                      value={ticket.category}
                      onChange={(e) =>
                        setTicket((t) => ({ ...t, category: e.target.value }))
                      }
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c} value={c} className="text-black">
                          {c}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Priority">
                    <select
                      className="w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-white outline-none"
                      value={ticket.priority}
                      onChange={(e) =>
                        setTicket((t) => ({ ...t, priority: e.target.value }))
                      }
                    >
                      <option value="low" className="text-black">
                        Low
                      </option>
                      <option value="normal" className="text-black">
                        Normal
                      </option>
                      <option value="high" className="text-black">
                        High
                      </option>
                      <option value="urgent" className="text-black">
                        Urgent
                      </option>
                    </select>
                  </Field>
                </div>

                <Field label="Email">
                  <input
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-white placeholder:text-white/30 outline-none"
                    placeholder="you@example.com"
                    value={ticket.email}
                    onChange={(e) =>
                      setTicket((t) => ({ ...t, email: e.target.value }))
                    }
                  />
                </Field>

                <Field label="Subject">
                  <input
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-white placeholder:text-white/30 outline-none"
                    placeholder="Short summary"
                    value={ticket.subject}
                    onChange={(e) =>
                      setTicket((t) => ({ ...t, subject: e.target.value }))
                    }
                  />
                </Field>

                <Field label="Message">
                  <textarea
                    rows={7}
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-white placeholder:text-white/30 outline-none"
                    placeholder="Describe what happened, how to reproduce it, and what you expected to see."
                    value={ticket.message}
                    onChange={(e) =>
                      setTicket((t) => ({ ...t, message: e.target.value }))
                    }
                  />
                </Field>

                <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:items-center sm:justify-between">
                  <label className="inline-flex items-center gap-2 text-sm text-white/70">
                    <input
                      type="checkbox"
                      checked={ticket.attachLogs}
                      onChange={(e) =>
                        setTicket((t) => ({
                          ...t,
                          attachLogs: e.target.checked,
                        }))
                      }
                    />
                    Attach basic system info (browser, timezone)
                  </label>

                  <button
                    type="submit"
                    disabled={disabled || busy}
                    className={`rounded-2xl px-4 py-2.5 text-sm font-semibold text-white transition ${
                      disabled || busy
                        ? "cursor-not-allowed opacity-60"
                        : "hover:opacity-95"
                    }`}
                    style={{
                      background: "linear-gradient(135deg, #90a955, #4f772d)",
                    }}
                  >
                    {busy ? "Sending…" : "Send"}
                  </button>
                </div>
              </form>

              {toast && (
                <div
                  className={`mt-4 rounded-2xl border p-4 text-sm ${
                    toast.type === "ok"
                      ? "border-[#90a955]/20 bg-[#90a955]/10 text-[#dce8bf]"
                      : "border-red-400/20 bg-red-400/10 text-red-100"
                  }`}
                >
                  {toast.msg}
                </div>
              )}
            </SectionCard>
          </div>

          <aside className="space-y-6 lg:sticky lg:top-20 h-max">
            <SectionCard title="FAQ">
              <FAQ
                items={[
                  {
                    q: "Why don’t I see live prices?",
                    a: "Make sure ENABLE_QUOTES=true on your backend and yahoo-finance2 is installed. Then refresh the Investment Performance page.",
                  },
                  {
                    q: "My balances look off after editing transactions.",
                    a: "Edits to existing transactions can affect account balances depending on your account update flow. Review recent transactions or recalculate balances if needed.",
                  },
                  {
                    q: "How do I import or export data?",
                    a: "Use the Reports page for exports and ingestion flows. For migration help, contact support with the file format you want to move.",
                  },
                  {
                    q: "Can I track multiple currencies?",
                    a: "Yes. Nummoria stores amounts in minor units and formats values using each currency’s decimal precision automatically.",
                  },
                ]}
              />
            </SectionCard>

            <SectionCard title="Community & resources">
              <ul className="space-y-3 text-sm text-white/70">
                <li>
                  Product roadmap —{" "}
                  <a
                    className="text-[#dce8bf] underline decoration-white/20 underline-offset-4"
                    href="/roadmap"
                  >
                    see what’s cooking
                  </a>
                </li>
                <li>Suggest a feature by choosing “Feature Request”.</li>
                <li>Follow release notes on the home page for updates.</li>
              </ul>
            </SectionCard>
          </aside>
        </section>
      </div>
    </div>
  );
}

/* ----------------------------- Small components ----------------------------- */

function Header() {
  return (
    <section className="mb-6">
      <SectionCard className="overflow-visible">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-white/60">
              <span className="h-2 w-2 rounded-full bg-[#13e243]" />
              support center
            </div>

            <div className="mt-4 flex items-center gap-3">
              <img
                src={logoUrl}
                alt="Nummoria"
                className="h-11 w-11 rounded-2xl border border-white/10 bg-white/[0.04] object-contain p-1"
              />
              <div>
                <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-white">
                  Support
                </h1>
                <p className="mt-2 max-w-2xl text-sm md:text-base text-white/60">
                  Need help with bugs, billing, data issues, or feature ideas?
                  Send a message and we’ll route it correctly.
                </p>
              </div>
            </div>
          </div>

          <div className="max-w-md rounded-3xl border border-white/10 bg-black/20 px-4 py-4 text-sm text-white/70">
            <div className="font-semibold text-white">We’re here to help</div>
            <div className="mt-1">
              Share the issue clearly and include reproducible details for the
              fastest resolution.
            </div>
          </div>
        </div>
      </SectionCard>
    </section>
  );
}

function SectionCard({ title, subtitle, children, className = "" }) {
  return (
    <div
      className={`relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-md ${className}`}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(500px_180px_at_10%_0%,rgba(19,226,67,0.06),transparent_60%),radial-gradient(420px_180px_at_90%_10%,rgba(153,23,70,0.08),transparent_60%)]" />
      <div className="relative p-5 md:p-6">
        {title ? (
          <div className="mb-4">
            <h2 className="text-lg font-semibold tracking-tight text-white">
              {title}
            </h2>
            {subtitle ? (
              <p className="mt-1 text-sm text-white/55">{subtitle}</p>
            ) : null}
          </div>
        ) : null}
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <div className="mb-1.5 text-sm font-medium text-white/75">{label}</div>
      {children}
    </label>
  );
}

function SystemInfo({ info }) {
  return (
    <div className="space-y-2 text-xs text-white/60">
      {Object.entries(info).map(([k, v]) => (
        <div key={k} className="flex items-center justify-between gap-3">
          <span className="uppercase tracking-wide text-white/45">{k}</span>
          <code className="max-w-[60%] truncate rounded-xl border border-white/10 bg-black/20 px-2 py-1 text-white/75">
            {String(v)}
          </code>
        </div>
      ))}
    </div>
  );
}

function FAQ({ items = [] }) {
  const [openIdx, setOpenIdx] = useState(null);

  return (
    <div className="divide-y divide-white/8">
      {items.map((it, idx) => {
        const open = idx === openIdx;
        return (
          <div key={idx} className="py-3">
            <button
              type="button"
              className="flex w-full items-center justify-between gap-4 text-left"
              onClick={() => setOpenIdx(open ? null : idx)}
            >
              <span className="text-sm font-medium text-white">{it.q}</span>
              <span className="text-xs text-white/45">{open ? "−" : "+"}</span>
            </button>
            {open && <p className="mt-2 text-sm text-white/65">{it.a}</p>}
          </div>
        );
      })}
    </div>
  );
}
