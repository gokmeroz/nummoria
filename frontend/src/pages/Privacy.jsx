// frontend/src/pages/Privacy.jsx
import React, { useMemo } from "react";

export default function Privacy() {
  const lastUpdated = useMemo(
    () =>
      new Date().toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
    [],
  );

  const sections = [
    {
      title: "1. Information We Collect",
      body: "We collect only the information needed to operate Nummoria effectively, including your account details, financial entries, preferences, and activity you choose to provide inside the platform. We do not sell your data to third parties for advertising purposes.",
    },
    {
      title: "2. How We Use Data",
      body: "Your data is used to deliver core product functionality such as summaries, reports, categorization, account management, and personalized insights. We may also use aggregated and anonymized usage patterns to improve product quality, reliability, and user experience.",
    },
    {
      title: "3. Storage and Security",
      body: "We use industry-standard safeguards to protect your information in transit and at rest. Access is restricted to authorized systems and workflows necessary to run the service. While no platform can guarantee absolute security, we take protection and operational controls seriously.",
    },
    {
      title: "4. AI Features",
      body: "Some Nummoria features may use AI systems to generate financial explanations, summaries, or insights. When these features are enabled, selected inputs may be processed through trusted providers solely to power the requested functionality. Your personal data is not used by us to advertise to you.",
    },
    {
      title: "5. Your Rights",
      body: "You may request access, correction, export, or deletion of your data, subject to operational and legal requirements. You can also manage parts of your information directly inside your account where those controls are available.",
    },
    {
      title: "6. Policy Updates",
      body: "We may revise this Privacy Policy from time to time as the platform evolves. When material changes are made, the updated version will appear here with a new effective date.",
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

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <section className="mb-6">
          <GlassCard className="overflow-visible">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-white/60">
                  <span className="h-2 w-2 rounded-full bg-[#13e243]" />
                  legal
                </div>

                <div className="mt-4">
                  <h1 className="text-3xl md:text-5xl font-semibold tracking-tight text-white">
                    Privacy Policy
                  </h1>
                  <p className="mt-3 max-w-2xl text-sm md:text-base text-white/60">
                    Your data belongs to you. This policy explains how Nummoria
                    collects, uses, and protects the information required to run
                    the platform.
                  </p>
                </div>
              </div>

              <div className="max-w-md rounded-3xl border border-white/10 bg-black/20 px-4 py-4 text-sm text-white/70">
                <div className="font-semibold text-white">Last updated</div>
                <div className="mt-1">{lastUpdated}</div>
              </div>
            </div>
          </GlassCard>
        </section>

        <section>
          <GlassCard>
            <div className="divide-y divide-white/10">
              {sections.map((section) => (
                <div
                  key={section.title}
                  className="grid gap-4 py-8 md:grid-cols-[260px_minmax(0,1fr)] md:gap-8 md:py-10"
                >
                  <div className="md:pr-4">
                    <h2 className="text-lg md:text-xl font-semibold tracking-tight text-white">
                      {section.title}
                    </h2>
                  </div>

                  <div className="max-w-3xl">
                    <p className="text-sm leading-7 text-white/65 md:text-[15px] md:leading-8">
                      {section.body}
                    </p>
                  </div>
                </div>
              ))}

              <div className="grid gap-4 py-8 md:grid-cols-[260px_minmax(0,1fr)] md:gap-8 md:py-10">
                <div className="md:pr-4">
                  <h2 className="text-lg md:text-xl font-semibold tracking-tight text-white">
                    Contact
                  </h2>
                </div>

                <div className="max-w-3xl">
                  <p className="text-sm leading-7 text-white/65 md:text-[15px] md:leading-8">
                    For privacy-related questions or requests, contact{" "}
                    <a
                      href="mailto:support@nummoria.com"
                      className="text-[#dce8bf] underline decoration-white/20 underline-offset-4"
                    >
                      support@nummoria.com
                    </a>
                    .
                  </p>
                </div>
              </div>
            </div>
          </GlassCard>
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
