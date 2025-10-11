// frontend/src/pages/Contact.jsx
import { useState, useMemo } from "react";
import api from "../lib/api";

const BRAND = {
  main: "#4f772d",
  secondary: "#90a955",
  dark: "#1c1f1a",
  light: "#f6f9f4",
};

export default function Contact() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    message: "",
    website: "",
  }); // website = honeypot
  const [status, setStatus] = useState({ kind: "", text: "" });
  const [isSending, setIsSending] = useState(false);

  const gradients = useMemo(
    () => ({
      hero: {
        background: `linear-gradient(135deg, ${BRAND.main} 0%, ${BRAND.secondary} 100%)`,
      },
    }),
    []
  );

  const emailOk =
    typeof form.email === "string" &&
    /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.trim());

  const canSend =
    !isSending &&
    form.name.trim().length >= 2 &&
    emailOk &&
    form.message.trim().length >= 5;

  const handleChange = (e) =>
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    if (!canSend) return;

    // honeypot check (bots fill hidden "website" field)
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
        { withCredentials: true }
      );

      setStatus({
        kind: "ok",
        text: data?.message || "✅ Message sent successfully!",
      });
      setForm({ name: "", email: "", message: "", website: "" });
    } catch (err) {
      const msg =
        err?.response?.data?.error ||
        err?.message ||
        "❌ Failed to send message. Try again later.";
      setStatus({ kind: "error", text: msg });
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="min-h-screen w-full bg-white text-zinc-900">
      {/* HERO */}
      <section className="relative overflow-hidden" style={gradients.hero}>
        <div className="relative mx-auto max-w-4xl px-6 py-20 text-center text-white">
          <h1 className="text-4xl md:text-5xl font-extrabold">Contact Us</h1>
          <p className="mt-4 text-lg text-zinc-100/90">
            Have a question, feedback, or partnership idea? We’d love to hear
            from you.
          </p>
        </div>
      </section>

      {/* FORM */}
      <section className="mx-auto max-w-3xl px-6 py-16">
        <form
          onSubmit={handleSubmit}
          className="rounded-3xl border border-zinc-200 bg-white p-8 shadow-lg space-y-6"
        >
          {/* Success/Error banner */}
          {status.text && (
            <div
              className={`rounded-xl px-4 py-3 text-sm ${
                status.kind === "ok"
                  ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                  : "bg-red-50 text-red-800 border border-red-200"
              }`}
            >
              {status.text}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-zinc-700">
              Full name
            </label>
            <input
              type="text"
              name="name"
              value={form.name}
              onChange={handleChange}
              required
              className="mt-1 w-full rounded-xl border border-zinc-300 px-4 py-2 focus:border-emerald-600 focus:ring-emerald-600"
              placeholder="Your full name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700">
              Email address
            </label>
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              required
              className={`mt-1 w-full rounded-xl border px-4 py-2 focus:border-emerald-600 focus:ring-emerald-600 ${
                form.email && !emailOk ? "border-red-400" : "border-zinc-300"
              }`}
              placeholder="you@example.com"
            />
            {form.email && !emailOk && (
              <p className="mt-1 text-xs text-red-600">
                Please enter a valid email.
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700">
              Message
            </label>
            <textarea
              name="message"
              rows="5"
              value={form.message}
              onChange={handleChange}
              required
              className="mt-1 w-full rounded-xl border border-zinc-300 px-4 py-2 focus:border-emerald-600 focus:ring-emerald-600"
              placeholder="Tell us how we can help — bug reports, feature requests, feedback, or just say hi!"
            />
          </div>

          {/* Honeypot (hidden) */}
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

          <button
            type="submit"
            disabled={!canSend}
            className={`w-full rounded-xl px-4 py-3 font-semibold text-white ${
              canSend ? "hover:opacity-95" : "opacity-60 cursor-not-allowed"
            }`}
            style={{ backgroundColor: BRAND.main }}
          >
            {isSending ? "Sending…" : "Send Message"}
          </button>

          <p className="text-center text-xs text-zinc-500">
            We’ll reply to you at your email address. By contacting us, you
            agree to our{" "}
            <a href="/privacy" className="underline">
              Privacy Policy
            </a>
            .
          </p>
        </form>
      </section>
    </div>
  );
}
