// frontend/src/pages/Docs.jsx
import React from "react";

const BG = "#030508";
const MINT = "#00ff87";
const CYAN = "#00d4ff";
const VIOLET = "#a78bfa";

const Brackets = ({ color = MINT }) => (
  <>
    <div
      className="absolute top-0 left-0 w-3 h-3 border-t border-l"
      style={{ borderColor: color }}
    />
    <div
      className="absolute top-0 right-0 w-3 h-3 border-t border-r"
      style={{ borderColor: color }}
    />
    <div
      className="absolute bottom-0 left-0 w-3 h-3 border-b border-l"
      style={{ borderColor: color }}
    />
    <div
      className="absolute bottom-0 right-0 w-3 h-3 border-b border-r"
      style={{ borderColor: color }}
    />
  </>
);

const Section = ({ title, children, accent = VIOLET }) => (
  <div
    className="relative border p-6"
    style={{
      borderColor: `${accent}33`,
      background: "rgba(255,255,255,0.02)",
    }}
  >
    <Brackets color={accent} />
    <h2 className="text-xl font-extrabold text-white mb-4 uppercase tracking-wider">
      {title}
    </h2>
    {children}
  </div>
);

export default function Docs() {
  return (
    <div className="min-h-dvh bg-[#030508] text-white">
      {/* BG */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[#030508]" />
        <div className="absolute inset-0 bg-[radial-gradient(1200px_800px_at_10%_0%,rgba(0,255,135,0.08),transparent_60%),radial-gradient(800px_600px_at_90%_10%,rgba(167,139,250,0.1),transparent_60%)]" />
      </div>

      <div className="max-w-7xl mx-auto px-6 py-10 space-y-8">
        {/* HERO */}
        <div
          className="relative border p-8"
          style={{ borderColor: `${VIOLET}33` }}
        >
          <Brackets color={VIOLET} />

          <h1 className="text-5xl font-extrabold text-white">Documentation</h1>

          <p className="mt-4 text-white/70 max-w-2xl">
            Clear, practical guidance for using Nummoria to track expenses,
            income, and investments.
          </p>
        </div>

        {/* QUICK START */}
        <Section title="Quick Start" accent={MINT}>
          <div className="grid md:grid-cols-3 gap-4">
            {[
              ["Create workspace", "Sign up, set currency and timezone"],
              ["Add transactions", "Start with simple expenses"],
              ["Review data", "Check dashboard weekly"],
            ].map(([t, d]) => (
              <div className="border border-white/10 p-4 bg-black/40">
                <div className="font-bold text-white">{t}</div>
                <div className="text-sm text-white/60 mt-1">{d}</div>
              </div>
            ))}
          </div>
        </Section>

        {/* CORE CONCEPTS */}
        <Section title="Core Concepts" accent={CYAN}>
          <div className="grid md:grid-cols-3 gap-4">
            {[
              ["Transactions", "All data is transactions"],
              ["Categories", "Group and analyze"],
              ["Multi Currency", "Stored in minor units"],
            ].map(([t, d]) => (
              <div className="border border-white/10 p-4 bg-black/40">
                <div className="font-bold text-white">{t}</div>
                <div className="text-sm text-white/60 mt-1">{d}</div>
              </div>
            ))}
          </div>
        </Section>

        {/* DAILY */}
        <Section title="Daily Use" accent={VIOLET}>
          <div className="space-y-3">
            <div className="border border-white/10 p-4 bg-black/40">
              Add and edit transactions anytime.
            </div>
            <div className="border border-white/10 p-4 bg-black/40">
              Use filters to find patterns.
            </div>
            <div className="border border-white/10 p-4 bg-black/40">
              Track recurring expenses.
            </div>
          </div>
        </Section>

        {/* TIPS */}
        <Section title="Tips" accent={MINT}>
          <ul className="space-y-2 text-white/70">
            <li>• Log purchases daily</li>
            <li>• Keep categories simple</li>
            <li>• Review monthly</li>
          </ul>
        </Section>

        {/* SECURITY */}
        <Section title="Security & Privacy" accent={CYAN}>
          <ul className="space-y-2 text-white/70">
            <li>• Your data is yours</li>
            <li>• Secure auth (JWT/OAuth)</li>
            <li>• Minor unit storage</li>
          </ul>
        </Section>

        {/* CTA */}
        <div
          className="relative border p-8 text-center"
          style={{ borderColor: `${MINT}33` }}
        >
          <Brackets color={MINT} />

          <h3 className="text-2xl font-extrabold text-white">
            Ready to get organized?
          </h3>

          <div className="mt-4 flex justify-center gap-3">
            <a
              href="/signup"
              className="px-6 py-3 font-bold text-black"
              style={{ backgroundColor: MINT }}
            >
              Start Now
            </a>

            <a
              href="/contact"
              className="px-6 py-3 border border-white/20 text-white"
            >
              Contact
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
