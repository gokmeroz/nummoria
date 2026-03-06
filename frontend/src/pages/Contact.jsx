// frontend/src/pages/Contact.jsx
import { useMemo, useState } from "react";
import api from "../lib/api";

export default function Contact() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    message: "",
    website: "",
  });

  const [status, setStatus] = useState({ kind: "", text: "" });
  const [isSending, setIsSending] = useState(false);

  const emailOk =
    typeof form.email === "string" &&
    /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.trim());

  const canSend =
    !isSending &&
    form.name.trim().length >= 2 &&
    emailOk &&
    form.message.trim().length >= 5;

  const quickLinks = useMemo(
    () => [
      {
        title: "Support",
        value: "support@nummoria.com",
        href: "mailto:support@nummoria.com",
      },
      {
        title: "Status",
        value: "status.nummoria.app",
        href: "https://status.nummoria.app",
      },
      {
        title: "Privacy",
        value: "View policy",
        href: "/privacy",
      },
      {
        title: "Terms",
        value: "View terms",
        href: "/terms",
      },
    ],
    [],
  );

  const handleChange = (e) =>
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    if (!canSend) return;

    if (form.website) {
      setStatus({ kind: "error", text: "Spam detected." });
      return;
    }

    setIsSending(true);
    setStatus({ kind: "", text: "" });

    try {
      const { data } = await api.post(
        "/contact",
        {
          name: form.name.trim(),
          email: form.email.trim(),
          message: form.message.trim(),
        },
        { withCredentials: true },
      );

      setStatus({
        kind: "ok",
        text: data?.message || "Message sent successfully.",
      });
      setForm({ name: "", email: "", message: "", website: "" });
    } catch (err) {
      const msg =
        err?.response?.data?.error ||
        err?.message ||
        "Failed to send message. Try again later.";
      setStatus({ kind: "error", text: msg });
    } finally {
      setIsSending(false);
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
        <section className="mb-6">
          <GlassCard className="overflow-visible">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-white/60">
                  <span className="h-2 w-2 rounded-full bg-[#13e243]" />
                  contact
                </div>

                <div className="mt-4">
                  <h1 className="text-3xl md:text-5xl font-semibold tracking-tight text-white">
                    Contact Nummoria
                  </h1>
                  <p className="mt-3 max-w-2xl text-sm md:text-base text-white/60">
                    Questions, feedback, support issues, partnership ideas, or
                    product suggestions — send us a message and we’ll review it.
                  </p>
                </div>
              </div>

              <div className="max-w-md rounded-3xl border border-white/10 bg-black/20 px-4 py-4 text-sm text-white/70">
                <div className="font-semibold text-white">Response flow</div>
                <div className="mt-1">
                  Messages are reviewed through the Nummoria support workflow
                  and replied to by email.
                </div>
              </div>
            </div>
          </GlassCard>
        </section>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1.25fr)_380px]">
          <GlassCard>
            <div className="mb-5">
              <h2 className="text-xl font-semibold tracking-tight text-white">
                Send a message
              </h2>
              <p className="mt-2 text-sm text-white/55">
                Share enough detail so we can understand the issue clearly and
                respond faster.
              </p>
            </div>

            {status.text ? (
              <div
                className={`mb-5 rounded-2xl border px-4 py-3 text-sm ${
                  status.kind === "ok"
                    ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-100"
                    : "border-red-400/20 bg-red-400/10 text-red-100"
                }`}
              >
                {status.text}
              </div>
            ) : null}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Full name">
                  <input
                    type="text"
                    name="name"
                    value={form.name}
                    onChange={handleChange}
                    required
                    placeholder="Your full name"
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-white placeholder:text-white/30 outline-none transition focus:border-white/20"
                  />
                </Field>

                <Field label="Email address">
                  <input
                    type="email"
                    name="email"
                    value={form.email}
                    onChange={handleChange}
                    required
                    placeholder="you@example.com"
                    className={`w-full rounded-2xl border px-4 py-3 text-white placeholder:text-white/30 outline-none transition ${
                      form.email && !emailOk
                        ? "border-red-400/30 bg-red-400/10 focus:border-red-400/40"
                        : "border-white/10 bg-white/[0.05] focus:border-white/20"
                    }`}
                  />
                </Field>
              </div>

              {form.email && !emailOk ? (
                <p className="-mt-1 text-xs text-red-200">
                  Please enter a valid email address.
                </p>
              ) : null}

              <Field label="Message">
                <textarea
                  name="message"
                  rows="7"
                  value={form.message}
                  onChange={handleChange}
                  required
                  placeholder="Tell us what happened, what you expected, and any useful details we should know."
                  className="w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-white placeholder:text-white/30 outline-none transition focus:border-white/20"
                />
              </Field>

              <div className="hidden">
                <label>Website</label>
                <input
                  type="text"
                  name="website"
                  value={form.website}
                  onChange={handleChange}
                  autoComplete="off"
                  tabIndex="-1"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={!canSend}
                  className={`inline-flex h-12 items-center justify-center rounded-2xl px-5 text-sm font-semibold text-white transition ${
                    canSend
                      ? "hover:opacity-95"
                      : "cursor-not-allowed opacity-60"
                  }`}
                  style={{
                    background: "linear-gradient(135deg, #90a955, #4f772d)",
                  }}
                >
                  {isSending ? "Sending…" : "Send Message"}
                </button>
              </div>

              <p className="text-xs leading-6 text-white/45">
                By contacting us, you agree to our{" "}
                <a
                  href="/privacy"
                  className="text-white/70 underline decoration-white/20 underline-offset-4"
                >
                  Privacy Policy
                </a>
                .
              </p>
            </form>
          </GlassCard>

          <div className="space-y-6">
            <GlassCard>
              <div className="mb-4">
                <h2 className="text-lg font-semibold tracking-tight text-white">
                  Direct links
                </h2>
                <p className="mt-1 text-sm text-white/55">
                  Fast access to the most relevant support destinations.
                </p>
              </div>

              <div className="space-y-3">
                {quickLinks.map((item) => (
                  <a
                    key={item.title}
                    href={item.href}
                    target={item.href.startsWith("http") ? "_blank" : undefined}
                    rel={
                      item.href.startsWith("http") ? "noreferrer" : undefined
                    }
                    className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/20 px-4 py-3 transition hover:bg-white/[0.05]"
                  >
                    <div>
                      <div className="text-sm font-medium text-white">
                        {item.title}
                      </div>
                      <div className="mt-1 text-xs text-white/50">
                        {item.value}
                      </div>
                    </div>
                    <span className="text-white/35">→</span>
                  </a>
                ))}
              </div>
            </GlassCard>

            <GlassCard>
              <div className="mb-4">
                <h2 className="text-lg font-semibold tracking-tight text-white">
                  Before you send
                </h2>
              </div>

              <ul className="space-y-3 text-sm text-white/60">
                <li className="flex gap-3">
                  <span className="mt-1 h-2 w-2 rounded-full bg-[#13e243] shrink-0" />
                  <span>
                    Include steps to reproduce the issue when relevant.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="mt-1 h-2 w-2 rounded-full bg-[#13e243] shrink-0" />
                  <span>Mention the page, feature, or platform involved.</span>
                </li>
                <li className="flex gap-3">
                  <span className="mt-1 h-2 w-2 rounded-full bg-[#13e243] shrink-0" />
                  <span>
                    Add context that helps us verify and resolve faster.
                  </span>
                </li>
              </ul>
            </GlassCard>
          </div>
        </section>
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

function Field({ label, children }) {
  return (
    <label className="block">
      <div className="mb-2 text-sm font-medium text-white/75">{label}</div>
      {children}
    </label>
  );
}
