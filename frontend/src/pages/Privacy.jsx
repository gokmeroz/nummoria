// frontend/src/pages/Privacy.jsx
import React, { useMemo } from "react";

const BG = "#030508";
const MINT = "#00ff87";
const CYAN = "#00d4ff";
const VIOLET = "#a78bfa";
const ROSE = "#ff4d8d";

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

function SectionLabel({ children, accent = "mint" }) {
  const color =
    { violet: VIOLET, cyan: CYAN, mint: MINT, rose: ROSE }[accent] || MINT;

  return (
    <div
      className="inline-flex items-center gap-2 border px-3 py-1 text-[11px] uppercase tracking-[0.18em]"
      style={{
        borderColor: `${color}33`,
        color,
        backgroundColor: "rgba(0,0,0,0.25)",
      }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: color }}
      />
      {children}
    </div>
  );
}

function LegalBlock({ title, body, accent = "cyan" }) {
  const color =
    { violet: VIOLET, cyan: CYAN, mint: MINT, rose: ROSE }[accent] || CYAN;

  return (
    <div className="grid gap-4 py-8 md:grid-cols-[280px_minmax(0,1fr)] md:gap-8 md:py-10">
      <div className="md:pr-4">
        <div
          className="inline-flex items-center gap-2 border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em]"
          style={{
            borderColor: `${color}33`,
            color,
            backgroundColor: "rgba(0,0,0,0.22)",
          }}
        >
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: color }}
          />
          section
        </div>
        <h2 className="mt-4 text-lg md:text-xl font-extrabold tracking-tight text-white">
          {title}
        </h2>
      </div>

      <div className="max-w-3xl">
        <p className="text-sm leading-7 text-white/65 md:text-[15px] md:leading-8">
          {body}
        </p>
      </div>
    </div>
  );
}

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
      accent: "mint",
    },
    {
      title: "2. How We Use Data",
      body: "Your data is used to deliver core product functionality such as summaries, reports, categorization, account management, and personalized insights. We may also use aggregated and anonymized usage patterns to improve product quality, reliability, and user experience.",
      accent: "cyan",
    },
    {
      title: "3. Storage and Security",
      body: "We use industry-standard safeguards to protect your information in transit and at rest. Access is restricted to authorized systems and workflows necessary to run the service. While no platform can guarantee absolute security, we take protection and operational controls seriously.",
      accent: "violet",
    },
    {
      title: "4. AI Features",
      body: "Some Nummoria features may use AI systems to generate financial explanations, summaries, or insights. When these features are enabled, selected inputs may be processed through trusted providers solely to power the requested functionality. Your personal data is not used by us to advertise to you.",
      accent: "rose",
    },
    {
      title: "5. Your Rights",
      body: "You may request access, correction, export, or deletion of your data, subject to operational and legal requirements. You can also manage parts of your information directly inside your account where those controls are available.",
      accent: "cyan",
    },
    {
      title: "6. Policy Updates",
      body: "We may revise this Privacy Policy from time to time as the platform evolves. When material changes are made, the updated version will appear here with a new effective date.",
      accent: "mint",
    },
  ];

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
          <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-4xl">
              <SectionLabel accent="mint">legal</SectionLabel>

              <h1 className="mt-5 text-3xl md:text-6xl font-extrabold tracking-tight text-white leading-none">
                Privacy Policy
              </h1>

              <p className="mt-4 max-w-3xl text-sm md:text-base text-white/65 leading-relaxed">
                Your data belongs to you. This policy explains how Nummoria
                collects, uses, and protects the information required to run the
                platform.
              </p>

              <ScanLine color={VIOLET} className="mt-6 w-full max-w-md" />
            </div>

            <div className="xl:w-[360px]">
              <SectionCard
                title="Last Updated"
                subtitle="Current published version"
                accent="mint"
                className="h-full"
              >
                <div className="text-2xl font-extrabold tracking-tight text-white">
                  {lastUpdated}
                </div>
              </SectionCard>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="Policy Overview"
          subtitle="How Nummoria handles data, access, protection, and change management"
          accent="cyan"
        >
          <div className="divide-y divide-white/10">
            {sections.map((section) => (
              <LegalBlock
                key={section.title}
                title={section.title}
                body={section.body}
                accent={section.accent}
              />
            ))}

            <div className="grid gap-4 py-8 md:grid-cols-[280px_minmax(0,1fr)] md:gap-8 md:py-10">
              <div className="md:pr-4">
                <div
                  className="inline-flex items-center gap-2 border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em]"
                  style={{
                    borderColor: `${ROSE}33`,
                    color: ROSE,
                    backgroundColor: "rgba(0,0,0,0.22)",
                  }}
                >
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: ROSE }}
                  />
                  contact
                </div>
                <h2 className="mt-4 text-lg md:text-xl font-extrabold tracking-tight text-white">
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
        </SectionCard>
      </div>
    </div>
  );
}
