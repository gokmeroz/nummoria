// frontend/src/pages/Reports.jsx
import React, { useMemo, useState } from "react";
import api from "../lib/api";

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
        // Fallback demo flow
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
    <div className="min-h-[100dvh] bg-[#f8faf8]">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-white/80 backdrop-blur border-b">
        <div className="mx-auto max-w-6xl px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src="../src/assets/nummora_logo.png"
              alt="Nummora Logo"
              className="h-8 w-8"
            />
            <h1
              className="text-lg sm:text-xl font-semibold"
              style={{ color: BRAND.main }}
            >
              Support
            </h1>
            <img
              src="../src/assets/nummora_logo.png"
              alt="Nummora Logo"
              className="h-8 w-8"
            />
          </div>
          <div className="text-sm text-gray-500">We’re here to help.</div>
        </div>
      </header>

      {/* Body */}
      <main className="mx-auto max-w-6xl px-4 py-8 space-y-8">
        {/* Quick Actions */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card title="Contact options">
            <ul className="space-y-2 text-sm">
              <li>
                📧 Email:{" "}
                <a
                  className="underline decoration-dotted"
                  href="mailto:support@nummora.app"
                >
                  support@nummora.app
                </a>
              </li>
              <li>💬 In-app: use the form on this page</li>
              <li>
                🛠 Status:{" "}
                <a
                  className="underline decoration-dotted"
                  href="https://status.nummora.app"
                  target="_blank"
                  rel="noreferrer"
                >
                  status.nummora.app
                </a>
              </li>
            </ul>
          </Card>

          <Card title="Help center">
            <ul className="list-disc ml-5 text-sm space-y-1">
              <li>Getting started with accounts & currencies</li>
              <li>Creating categories (income/expense/investment)</li>
              <li>Live prices & market data setup</li>
              <li>Backups & export</li>
            </ul>
            <a
              className="mt-3 inline-block text-sm font-medium"
              style={{ color: BRAND.main }}
              href="/docs"
            >
              Browse docs →
            </a>
          </Card>

          <Card title="System info">
            <SystemInfo />
          </Card>
        </section>

        {/* Submit Ticket */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          <div className="lg:col-span-2">
            <Card title="Send us a message">
              <form onSubmit={submitTicket} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Field label="Category">
                    <select
                      className="w-full border rounded-lg px-3 py-2 bg-white"
                      value={ticket.category}
                      onChange={(e) =>
                        setTicket((t) => ({ ...t, category: e.target.value }))
                      }
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Priority">
                    <select
                      className="w-full border rounded-lg px-3 py-2 bg-white"
                      value={ticket.priority}
                      onChange={(e) =>
                        setTicket((t) => ({ ...t, priority: e.target.value }))
                      }
                    >
                      <option value="low">Low</option>
                      <option value="normal">Normal</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </Field>
                </div>

                <Field label="Email">
                  <input
                    className="w-full border rounded-lg px-3 py-2"
                    placeholder="you@example.com"
                    value={ticket.email}
                    onChange={(e) =>
                      setTicket((t) => ({ ...t, email: e.target.value }))
                    }
                  />
                </Field>

                <Field label="Subject">
                  <input
                    className="w-full border rounded-lg px-3 py-2"
                    placeholder="Short summary"
                    value={ticket.subject}
                    onChange={(e) =>
                      setTicket((t) => ({ ...t, subject: e.target.value }))
                    }
                  />
                </Field>

                <Field label="Message">
                  <textarea
                    rows={6}
                    className="w-full border rounded-lg px-3 py-2"
                    placeholder="Describe what's happening, steps to reproduce, and what you expected to see."
                    value={ticket.message}
                    onChange={(e) =>
                      setTicket((t) => ({ ...t, message: e.target.value }))
                    }
                  />
                </Field>

                <div className="flex items-center justify-between">
                  <label className="inline-flex items-center gap-2 text-sm">
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
                    className={`px-4 py-2 rounded-xl text-white font-semibold ${
                      disabled || busy
                        ? "opacity-60 cursor-not-allowed"
                        : "hover:opacity-90"
                    }`}
                    style={{ background: BRAND.main }}
                  >
                    {busy ? "Sending…" : "Send"}
                  </button>
                </div>
              </form>
            </Card>
            {toast && (
              <div
                className={`mt-3 rounded-xl border p-3 text-sm ${
                  toast.type === "ok"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-red-200 bg-red-50 text-red-700"
                }`}
              >
                {toast.msg}
              </div>
            )}
          </div>

          {/* FAQ */}
          <div className="space-y-4">
            <Card title="FAQ">
              <FAQ
                items={[
                  {
                    q: "Why don't I see live prices?",
                    a: "Make sure ENABLE_QUOTES=true on your backend and yahoo-finance2 is installed. Then refresh the Investment Performance page.",
                  },
                  {
                    q: "My balances look off after editing transactions.",
                    a: "Edits to existing transactions can affect account balances if configured. Recalculate or review the account's recent transactions.",
                  },
                  {
                    q: "How do I import/export data?",
                    a: "Use the Reports page to export CSV (coming soon). For imports, contact support and we’ll help you migrate.",
                  },
                  {
                    q: "Can I track multiple currencies?",
                    a: "Yes. Nummora stores amounts in minor units and formats using your currency's decimals automatically.",
                  },
                ]}
              />
            </Card>

            <Card title="Community & resources">
              <ul className="text-sm space-y-2">
                <li>
                  🧭 Product roadmap —{" "}
                  <a className="underline decoration-dotted" href="/roadmap">
                    see what's cooking
                  </a>
                </li>
                <li>💡 Suggest a feature — choose “Feature Request” above</li>
                <li>
                  🔔 Subscribe to updates — follow release notes on the home
                  page
                </li>
              </ul>
            </Card>
          </div>
        </section>
      </main>

      {/* Footer stripe */}
      <div className="h-1 w-full" style={{ background: BRAND.secondary }} />
    </div>
  );
}

/* ----------------------------- Small components ----------------------------- */
function Card({ title, children }) {
  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      {title && (
        <h2 className="text-sm font-semibold text-gray-700 mb-3">{title}</h2>
      )}
      {children}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <div className="text-sm text-gray-600 mb-1">{label}</div>
      {children}
    </label>
  );
}

function SystemInfo() {
  const info = {
    browser: navigator.userAgent,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    lang: navigator.language,
    width: `${window.innerWidth}px`,
    height: `${window.innerHeight}px`,
  };
  return (
    <div className="text-xs text-gray-600 space-y-1">
      {Object.entries(info).map(([k, v]) => (
        <div key={k} className="flex items-center justify-between gap-3">
          <span className="uppercase tracking-wide">{k}</span>
          <code className="bg-gray-50 border rounded px-2 py-0.5 truncate max-w-[60%]">
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
    <div className="divide-y">
      {items.map((it, idx) => {
        const open = idx === openIdx;
        return (
          <div key={idx} className="py-2">
            <button
              type="button"
              className="w-full text-left flex items-center justify-between"
              onClick={() => setOpenIdx(open ? null : idx)}
            >
              <span className="font-medium text-sm">{it.q}</span>
              <span className="text-xs text-gray-500">{open ? "−" : "+"}</span>
            </button>
            {open && <p className="mt-2 text-sm text-gray-700">{it.a}</p>}
          </div>
        );
      })}
    </div>
  );
}
