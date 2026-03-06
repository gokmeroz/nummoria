// frontend/src/pages/Terms.jsx
import React from "react";
import logoUrl from "../assets/nummoria_logo.png";

export default function Terms() {
  const lastUpdated = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const sections = [
    {
      title: "1. Acceptance of Terms",
      body: "By creating an account or using Nummoria, you agree to these Terms of Service and our Privacy Policy. If you do not agree with any part of these terms, you should stop using the service.",
    },
    {
      title: "2. Use of the Service",
      body: "You agree to use Nummoria lawfully and responsibly. You may not misuse the platform, attempt unauthorized access, interfere with infrastructure, distribute malware, or try to access data that does not belong to you.",
    },
    {
      title: "3. Intellectual Property",
      body: "Nummoria’s software, branding, interfaces, design assets, and related content are protected by applicable intellectual property laws. You may not copy, reproduce, distribute, reverse engineer, or modify them without prior written permission.",
    },
    {
      title: "4. Termination",
      body: "We may suspend or terminate accounts that violate these terms, abuse the platform, or create operational or security risks. You may also stop using the service and delete your account at any time from your profile settings.",
    },
    {
      title: "5. Limitation of Liability",
      body: "Nummoria is provided on an “as is” and “as available” basis. We strive for reliability and clarity, but we do not guarantee uninterrupted availability, complete accuracy, or fitness for a particular purpose. We are not liable for financial losses, missed opportunities, or other damages resulting from use of the service.",
    },
    {
      title: "6. Changes to Terms",
      body: "We may update these terms from time to time. Continued use of Nummoria after revised terms are published constitutes acceptance of the updated version.",
    },
    {
      title: "7. Contact",
      body: "For questions about these terms, contact Nummoria through the support page or the official support email listed in the product.",
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

      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <section className="relative overflow-hidden rounded-[32px] border border-white/10 bg-white/[0.04] backdrop-blur-md">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(700px_260px_at_15%_0%,rgba(19,226,67,0.08),transparent_60%),radial-gradient(520px_220px_at_85%_10%,rgba(153,23,70,0.10),transparent_60%)]" />

          <div className="relative px-6 py-10 md:px-10 md:py-14">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-white/60">
              <span className="h-2 w-2 rounded-full bg-[#13e243]" />
              Legal
            </div>

            <div className="mt-6 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
              <div className="max-w-3xl">
                <div className="flex items-center gap-3">
                  <img
                    src={logoUrl}
                    alt="Nummoria"
                    className="h-12 w-12 rounded-2xl border border-white/10 bg-white/[0.04] object-contain p-1.5"
                  />
                  <div>
                    <div className="text-sm uppercase tracking-[0.22em] text-white/45">
                      Nummoria
                    </div>
                    <h1 className="mt-1 text-4xl font-semibold tracking-tight text-white md:text-6xl">
                      Terms of Service
                    </h1>
                  </div>
                </div>

                <p className="mt-5 max-w-2xl text-sm leading-7 text-white/60 md:text-base">
                  These terms govern your access to and use of Nummoria. Please
                  read them carefully before using the platform.
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/65">
                <div className="text-white font-medium">Last updated</div>
                <div className="mt-1">{lastUpdated}</div>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-6">
          <div className="mx-auto max-w-3xl">
            <div className="rounded-[28px] border border-white/10 bg-[#0B0F0B]/75 backdrop-blur-md overflow-hidden">
              <div className="border-b border-white/10 px-6 py-5 md:px-8">
                <h2 className="text-lg font-semibold tracking-tight text-white">
                  Agreement
                </h2>
                <p className="mt-2 text-sm leading-7 text-white/55">
                  This page is intended to present legal information in a clear,
                  readable format. It does not provide financial advice or
                  replace professional legal counsel.
                </p>
              </div>

              <div className="px-6 py-2 md:px-8">
                {sections.map((section, index) => (
                  <div
                    key={section.title}
                    className={`py-6 ${
                      index !== sections.length - 1
                        ? "border-b border-white/10"
                        : ""
                    }`}
                  >
                    <h3 className="text-xl font-semibold tracking-tight text-white">
                      {section.title}
                    </h3>
                    <p className="mt-3 text-sm leading-8 text-white/62 md:text-[15px]">
                      {section.body}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6 text-center text-xs tracking-[0.14em] uppercase text-white/35">
              Nummoria legal
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
