/* eslint-disable no-unused-vars */

// frontend/src/pages/Support.jsx
import React, { useMemo, useState } from "react";
import api from "../lib/api";
import logoUrl from "../assets/nummoria_logo.png";

const BG = "#030508";
const MINT = "#00ff87";
const CYAN = "#00d4ff";
const VIOLET = "#a78bfa";
const ROSE = "#ff4d8d";
const AMBER = "#facc15";

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

function Field({ label, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-bold tracking-wider text-white/80 uppercase">
        {label}
      </label>
      {children}
    </div>
  );
}

function StatPill({ label, value, accent = "cyan" }) {
  const color =
    { violet: VIOLET, cyan: CYAN, mint: MINT, rose: ROSE }[accent] || CYAN;

  return (
    <div
      className="relative border bg-black/40 px-4 py-3"
      style={{ borderColor: `${color}44` }}
    >
      <Brackets color={color} size="6px" thick="1px" />
      <div className="text-[10px] font-bold uppercase tracking-wider text-white/55">
        {label}
      </div>
      <div className="mt-1 text-sm font-extrabold tracking-wide text-white">
        {value}
      </div>
    </div>
  );
}

function PriorityChip({ value, selected, onClick }) {
  const styles = {
    low: {
      color: MINT,
      bg: "rgba(0,255,135,0.08)",
      bd: "rgba(0,255,135,0.28)",
    },
    normal: {
      color: CYAN,
      bg: "rgba(0,212,255,0.08)",
      bd: "rgba(0,212,255,0.28)",
    },
    high: {
      color: AMBER,
      bg: "rgba(250,204,21,0.10)",
      bd: "rgba(250,204,21,0.30)",
    },
    urgent: {
      color: ROSE,
      bg: "rgba(255,77,141,0.10)",
      bd: "rgba(255,77,141,0.30)",
    },
  }[value];

  return (
    <button
      type="button"
      onClick={onClick}
      className="border px-3 py-2 text-[11px] font-extrabold tracking-wider uppercase transition"
      style={{
        color: styles.color,
        backgroundColor: selected ? styles.bg : "rgba(255,255,255,0.02)",
        borderColor: selected ? styles.bd : "rgba(255,255,255,0.08)",
        boxShadow: selected ? `0 0 0 1px ${styles.bd} inset` : "none",
      }}
    >
      {value}
    </button>
  );
}

/* ─────────────────────────────────────────────────────────────
   PAGE
───────────────────────────────────────────────────────────── */
export default function SupportPage() {
  const [ticket, setTicket] = useState(defaultTicket);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);

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
        });
      } else {
        await new Promise((r) => setTimeout(r, 600));
      }

      setToast({ type: "ok", msg: "Thanks. Your message is in the queue." });
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
    <div className="min-h-dvh bg-[#030508] text-[#e2e8f0] font-sans selection:bg-[#a78bfa]/30">
      <style
        dangerouslySetInnerHTML={{
          __html: `
            .custom-scrollbar::-webkit-scrollbar { width: 4px; height: 4px; }
            .custom-scrollbar::-webkit-scrollbar-track { background: rgba(255,255,255,0.02); }
            .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 4px; }
            .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.4); }

            @keyframes floatY {
              0%,100% { transform: translateY(0px); }
              50% { transform: translateY(-6px); }
            }
            .support-float {
              animation: floatY 5s ease-in-out infinite;
            }
          `,
        }}
      />

      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[#030508]" />
        <div className="absolute inset-0 bg-[radial-gradient(1200px_800px_at_15%_0%,rgba(0,255,135,0.08),transparent_55%),radial-gradient(1000px_700px_at_85%_10%,rgba(167,139,250,0.10),transparent_55%),radial-gradient(900px_700px_at_50%_100%,rgba(0,212,255,0.06),transparent_60%)]" />
        <div className="absolute inset-0 opacity-[0.08] bg-[linear-gradient(to_right,rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.08)_1px,transparent_1px)] bg-[size:38px_38px]" />
      </div>

      <div className="mx-auto max-w-screen-2xl w-full px-4 sm:px-6 lg:px-8 py-6 flex flex-col gap-5">
        <Header />

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <SectionCard title="Contact Options" accent="cyan">
            <div className="space-y-3 text-sm text-white/72">
              <div className="border border-white/8 bg-black/25 p-3">
                <span className="text-white font-bold uppercase tracking-wider text-[11px]">
                  Email
                </span>
                <div className="mt-1">
                  <a
                    className="text-[#dce8bf] underline decoration-white/20 underline-offset-4"
                    href="mailto:support@nummoria.app"
                  >
                    support@nummoria.app
                  </a>
                </div>
              </div>

              <div className="border border-white/8 bg-black/25 p-3">
                <span className="text-white font-bold uppercase tracking-wider text-[11px]">
                  In-App
                </span>
                <div className="mt-1">Use the form on this page.</div>
              </div>

              <div className="border border-white/8 bg-black/25 p-3">
                <span className="text-white font-bold uppercase tracking-wider text-[11px]">
                  Status
                </span>
                <div className="mt-1">
                  <a
                    className="text-[#dce8bf] underline decoration-white/20 underline-offset-4"
                    href="https://status.nummoria.app"
                    target="_blank"
                    rel="noreferrer"
                  >
                    status.nummoria.app
                  </a>
                </div>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Response Flow" accent="violet">
            <div className="grid grid-cols-1 gap-3">
              <StatPill
                label="Bug / Data"
                value="Triaged first"
                accent="violet"
              />
              <StatPill
                label="Billing"
                value="Highest trust sensitivity"
                accent="cyan"
              />
              <StatPill
                label="Feature Request"
                value="Routed to roadmap"
                accent="mint"
              />
            </div>
          </SectionCard>

          <SectionCard title="Before You Send" accent="mint">
            <ul className="space-y-3 text-sm text-white/72">
              <li className="border border-white/8 bg-black/25 p-3">
                Include what happened and what you expected.
              </li>
              <li className="border border-white/8 bg-black/25 p-3">
                Mention the page or flow where it broke.
              </li>
              <li className="border border-white/8 bg-black/25 p-3">
                Keep the subject short and precise.
              </li>
            </ul>
          </SectionCard>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_400px] items-start">
          <div className="min-w-0">
            <SectionCard
              title="Open a Ticket"
              subtitle="Bugs, billing, feature requests, or data issues"
              accent="mint"
              right={
                <div className="inline-flex items-center gap-2 border border-[#00ff87]/25 bg-black/40 px-3 py-1 text-[10px] font-bold tracking-wider text-[#00ff87] uppercase">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#00ff87]" />
                  support intake
                </div>
              }
            >
              <form onSubmit={submitTicket} className="space-y-5">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Field label="Category">
                    <select
                      className="w-full border border-white/10 bg-white/[0.03] px-4 py-3 text-white outline-none"
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

                  <Field label="Email">
                    <input
                      className="w-full border border-white/10 bg-white/[0.03] px-4 py-3 text-white placeholder:text-white/30 outline-none"
                      placeholder="you@example.com"
                      value={ticket.email}
                      onChange={(e) =>
                        setTicket((t) => ({ ...t, email: e.target.value }))
                      }
                    />
                  </Field>
                </div>

                <Field label="Priority">
                  <div className="flex flex-wrap gap-2">
                    {["low", "normal", "high", "urgent"].map((p) => (
                      <PriorityChip
                        key={p}
                        value={p}
                        selected={ticket.priority === p}
                        onClick={() =>
                          setTicket((t) => ({ ...t, priority: p }))
                        }
                      />
                    ))}
                  </div>
                </Field>

                <Field label="Subject">
                  <input
                    className="w-full border border-white/10 bg-white/[0.03] px-4 py-3 text-white placeholder:text-white/30 outline-none"
                    placeholder="Short summary"
                    value={ticket.subject}
                    onChange={(e) =>
                      setTicket((t) => ({ ...t, subject: e.target.value }))
                    }
                  />
                </Field>

                <Field label="Message">
                  <textarea
                    rows={8}
                    className="w-full border border-white/10 bg-white/[0.03] px-4 py-3 text-white placeholder:text-white/30 outline-none custom-scrollbar"
                    placeholder="Describe what happened, how to reproduce it, and what you expected to see."
                    value={ticket.message}
                    onChange={(e) =>
                      setTicket((t) => ({ ...t, message: e.target.value }))
                    }
                  />
                </Field>

                <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_auto] xl:items-end">
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
                    Attach diagnostics later when backend support exists
                  </label>

                  <button
                    type="submit"
                    disabled={disabled || busy}
                    className={`px-5 py-3 text-xs font-extrabold tracking-wider uppercase transition ${
                      disabled || busy
                        ? "cursor-not-allowed opacity-60"
                        : "hover:opacity-90"
                    }`}
                    style={{ backgroundColor: MINT, color: "#030508" }}
                  >
                    {busy ? "Sending..." : "Send Ticket"}
                  </button>
                </div>
              </form>

              {toast && (
                <div
                  className={`mt-5 border p-4 text-sm ${
                    toast.type === "ok"
                      ? "border-[#90a955]/30 bg-[#90a955]/10 text-[#dce8bf]"
                      : "border-red-400/30 bg-red-400/10 text-red-100"
                  }`}
                >
                  {toast.msg}
                </div>
              )}
            </SectionCard>
          </div>

          <aside className="space-y-5 lg:sticky lg:top-6 h-max">
            <SectionCard title="Fast Answers" accent="cyan">
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

            <SectionCard title="Community & Resources" accent="violet">
              <div className="space-y-3 text-sm text-white/72">
                <a
                  className="block border border-white/8 bg-black/25 p-3 hover:bg-white/[0.03] transition"
                  href="/roadmap"
                >
                  <div className="text-white font-bold uppercase tracking-wider text-[11px]">
                    Roadmap
                  </div>
                  <div className="mt-1 text-white/65">See what’s cooking.</div>
                </a>

                <div className="border border-white/8 bg-black/25 p-3">
                  <div className="text-white font-bold uppercase tracking-wider text-[11px]">
                    Feature Requests
                  </div>
                  <div className="mt-1 text-white/65">
                    Route them through the ticket form.
                  </div>
                </div>

                <div className="border border-white/8 bg-black/25 p-3">
                  <div className="text-white font-bold uppercase tracking-wider text-[11px]">
                    Release Notes
                  </div>
                  <div className="mt-1 text-white/65">
                    Follow updates from the home page.
                  </div>
                </div>
              </div>
            </SectionCard>

            <SectionCard title="Priority Guide" accent="rose">
              <div className="space-y-3 text-sm text-white/72">
                <div className="border border-white/8 bg-black/25 p-3">
                  <span className="text-[#00ff87] font-bold uppercase tracking-wider text-[11px]">
                    Low
                  </span>
                  <div className="mt-1">Minor UX issue or small question.</div>
                </div>
                <div className="border border-white/8 bg-black/25 p-3">
                  <span className="text-[#00d4ff] font-bold uppercase tracking-wider text-[11px]">
                    Normal
                  </span>
                  <div className="mt-1">
                    Standard bug or routine support request.
                  </div>
                </div>
                <div className="border border-white/8 bg-black/25 p-3">
                  <span className="text-[#facc15] font-bold uppercase tracking-wider text-[11px]">
                    High
                  </span>
                  <div className="mt-1">
                    Important flow blocked but workaround exists.
                  </div>
                </div>
                <div className="border border-white/8 bg-black/25 p-3">
                  <span className="text-[#ff4d8d] font-bold uppercase tracking-wider text-[11px]">
                    Urgent
                  </span>
                  <div className="mt-1">
                    Billing, data integrity, or core workflow outage.
                  </div>
                </div>
              </div>
            </SectionCard>
          </aside>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   SMALL COMPONENTS
───────────────────────────────────────────────────────────── */
function Header() {
  return (
    <SectionCard className="overflow-visible" accent="violet">
      <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-2 border border-white/10 bg-black/40 px-3 py-1 text-[11px] font-extrabold tracking-wider text-white/80 uppercase">
            <span className="h-1.5 w-1.5 rounded-full bg-[#13e243]" />
            Support Center
          </div>

          <div className="mt-5 flex items-start gap-4">
            <div className="support-float relative shrink-0">
              <div className="absolute inset-0 rounded-2xl blur-2xl opacity-30 bg-[#a78bfa]" />
              <img
                src={logoUrl}
                alt="Nummoria"
                className="relative h-14 w-14 border border-white/10 bg-white/[0.04] object-contain p-2"
              />
            </div>

            <div className="min-w-0">
              <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-white leading-none">
                Support
              </h1>
              <p className="mt-3 max-w-3xl text-sm md:text-base text-white/68 leading-relaxed">
                Need help with bugs, billing, broken data, or feature ideas?
                Open a clean ticket and route it correctly on the first pass.
              </p>
              <ScanLine color={VIOLET} className="mt-5 w-full max-w-md" />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 min-w-0 xl:w-[480px]">
          <StatPill label="Routing" value="Category-based" accent="cyan" />
          <StatPill label="Priority" value="Low → Urgent" accent="rose" />
          <StatPill label="Docs" value="Self-serve first" accent="mint" />
        </div>
      </div>
    </SectionCard>
  );
}

function FAQ({ items = [] }) {
  const [openIdx, setOpenIdx] = useState(0);

  return (
    <div className="space-y-3">
      {items.map((it, idx) => {
        const open = idx === openIdx;
        return (
          <div
            key={idx}
            className={`border transition ${
              open
                ? "border-[#00d4ff]/25 bg-[#00d4ff]/[0.05]"
                : "border-white/8 bg-black/25"
            }`}
          >
            <button
              type="button"
              className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left"
              onClick={() => setOpenIdx(open ? null : idx)}
            >
              <span className="text-sm font-bold tracking-wide text-white">
                {it.q}
              </span>
              <span className="text-xs text-white/45">{open ? "−" : "+"}</span>
            </button>
            {open && (
              <div className="px-4 pb-4 text-sm text-white/68 leading-relaxed">
                {it.a}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
