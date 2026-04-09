// frontend/src/pages/Contact.jsx
import React, { useMemo, useState } from "react";
import api from "../lib/api";

const BG = "#030508";
const MINT = "#00ff87";
const CYAN = "#00d4ff";
const VIOLET = "#a78bfa";
const ROSE = "#ff4d8d";
const AMBER = "#facc15";

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

function Field({ label, hint, children }) {
  return (
    <label className="block">
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-xs font-bold tracking-wider text-white/80 uppercase">
          {label}
        </span>
        {hint ? (
          <span className="text-[10px] uppercase tracking-wider text-white/35">
            {hint}
          </span>
        ) : null}
      </div>
      {children}
    </label>
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

function QuickLinkCard({ title, value, href, accent = "cyan" }) {
  const color =
    { violet: VIOLET, cyan: CYAN, mint: MINT, rose: ROSE }[accent] || CYAN;

  return (
    <a
      href={href}
      target={href.startsWith("http") ? "_blank" : undefined}
      rel={href.startsWith("http") ? "noreferrer" : undefined}
      className="relative flex items-center justify-between border border-white/10 bg-black/25 px-4 py-4 transition hover:bg-white/[0.04]"
    >
      <Brackets color={color} size="7px" thick="1px" />
      <div>
        <div className="text-sm font-bold tracking-wide text-white">
          {title}
        </div>
        <div className="mt-1 text-xs text-white/50">{value}</div>
      </div>
      <span className="text-white/35">→</span>
    </a>
  );
}

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
        accent: "mint",
      },
      {
        title: "Status",
        value: "status.nummoria.app",
        href: "https://status.nummoria.app",
        accent: "cyan",
      },
      {
        title: "Privacy",
        value: "View policy",
        href: "/privacy",
        accent: "violet",
      },
      {
        title: "Terms",
        value: "View terms",
        href: "/terms",
        accent: "rose",
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
              <div
                className="inline-flex items-center gap-2 border px-3 py-1 text-[11px] uppercase tracking-[0.18em]"
                style={{
                  borderColor: `${MINT}33`,
                  color: MINT,
                  backgroundColor: "rgba(0,0,0,0.25)",
                }}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: MINT }}
                />
                contact
              </div>

              <h1 className="mt-5 text-3xl md:text-6xl font-extrabold tracking-tight text-white leading-none">
                Contact Nummoria
              </h1>

              <p className="mt-4 max-w-3xl text-sm md:text-base text-white/65 leading-relaxed">
                Questions, feedback, support issues, partnership ideas, or
                product suggestions — send us a message and we’ll review it.
              </p>

              <ScanLine color={VIOLET} className="mt-6 w-full max-w-md" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 xl:w-[500px]">
              <StatPill
                label="Routing"
                value="Reviewed by email"
                accent="mint"
              />
              <StatPill
                label="Topics"
                value="Support to partnerships"
                accent="cyan"
              />
              <StatPill
                label="Goal"
                value="Clear response flow"
                accent="violet"
              />
            </div>
          </div>
        </SectionCard>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.25fr)_400px] items-start">
          <SectionCard
            title="Send a Message"
            subtitle="Share enough detail so we can understand the issue clearly and respond faster"
            accent="mint"
            className="min-w-0"
          >
            {status.text ? (
              <div
                className={`mb-5 border px-4 py-3 text-sm ${
                  status.kind === "ok"
                    ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-100"
                    : "border-red-400/20 bg-red-400/10 text-red-100"
                }`}
              >
                {status.text}
              </div>
            ) : null}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Full Name">
                  <input
                    type="text"
                    name="name"
                    value={form.name}
                    onChange={handleChange}
                    required
                    placeholder="Your full name"
                    className="w-full border border-white/10 bg-white/[0.03] px-4 py-3 text-white placeholder:text-white/30 outline-none transition focus:border-white/20"
                  />
                </Field>

                <Field
                  label="Email Address"
                  hint={form.email && !emailOk ? "invalid" : ""}
                >
                  <input
                    type="email"
                    name="email"
                    value={form.email}
                    onChange={handleChange}
                    required
                    placeholder="you@example.com"
                    className={`w-full border px-4 py-3 text-white placeholder:text-white/30 outline-none transition ${
                      form.email && !emailOk
                        ? "border-red-400/30 bg-red-400/10 focus:border-red-400/40"
                        : "border-white/10 bg-white/[0.03] focus:border-white/20"
                    }`}
                  />
                </Field>
              </div>

              {form.email && !emailOk ? (
                <p className="-mt-2 text-xs text-red-200">
                  Please enter a valid email address.
                </p>
              ) : null}

              <Field label="Message">
                <textarea
                  name="message"
                  rows="8"
                  value={form.message}
                  onChange={handleChange}
                  required
                  placeholder="Tell us what happened, what you expected, and any useful details we should know."
                  className="w-full border border-white/10 bg-white/[0.03] px-4 py-3 text-white placeholder:text-white/30 outline-none transition focus:border-white/20 custom-scrollbar"
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

              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
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

                <button
                  type="submit"
                  disabled={!canSend}
                  className={`inline-flex h-12 items-center justify-center px-5 text-sm font-extrabold tracking-wider uppercase transition ${
                    canSend
                      ? "hover:opacity-95"
                      : "cursor-not-allowed opacity-60"
                  }`}
                  style={{ backgroundColor: MINT, color: "#030508" }}
                >
                  {isSending ? "Sending..." : "Send Message"}
                </button>
              </div>
            </form>
          </SectionCard>

          <div className="space-y-5">
            <SectionCard
              title="Direct Links"
              subtitle="Fast access to the most relevant destinations"
              accent="cyan"
            >
              <div className="space-y-3">
                {quickLinks.map((item) => (
                  <QuickLinkCard
                    key={item.title}
                    title={item.title}
                    value={item.value}
                    href={item.href}
                    accent={item.accent}
                  />
                ))}
              </div>
            </SectionCard>

            <SectionCard
              title="Before You Send"
              subtitle="A better message gets a faster answer"
              accent="rose"
            >
              <ul className="space-y-3 text-sm text-white/62">
                <li className="border border-white/8 bg-black/25 p-3">
                  Include steps to reproduce the issue when relevant.
                </li>
                <li className="border border-white/8 bg-black/25 p-3">
                  Mention the page, feature, or platform involved.
                </li>
                <li className="border border-white/8 bg-black/25 p-3">
                  Add context that helps us verify and resolve faster.
                </li>
              </ul>
            </SectionCard>
          </div>
        </div>
      </div>
    </div>
  );
}
