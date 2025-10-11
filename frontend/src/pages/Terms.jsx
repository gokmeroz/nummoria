// frontend/src/pages/Terms.jsx
import React, { useMemo } from "react";

const BRAND = {
  main: "#4f772d",
  secondary: "#90a955",
};

export default function Terms() {
  const gradients = useMemo(
    () => ({
      hero: {
        background: `linear-gradient(135deg, ${BRAND.main}, ${BRAND.secondary})`,
      },
    }),
    []
  );

  return (
    <div className="min-h-screen w-full bg-white text-zinc-900">
      {/* HERO */}
      <section className="relative overflow-hidden" style={gradients.hero}>
        <div className="relative mx-auto max-w-4xl px-6 py-20 text-center text-white">
          <h1 className="text-4xl md:text-5xl font-extrabold">
            Terms of Service
          </h1>
          <p className="mt-4 text-lg text-zinc-100/90">
            These terms outline your rights and responsibilities when using
            Nummoria.
          </p>
        </div>
      </section>

      {/* CONTENT */}
      <section className="mx-auto max-w-3xl px-6 py-16 space-y-10">
        <div>
          <h2 className="text-2xl font-bold mb-3">1. Acceptance of Terms</h2>
          <p className="text-zinc-600">
            By creating an account or using Nummoria, you agree to these Terms
            of Service and our Privacy Policy. If you disagree with any part,
            you may stop using the service at any time.
          </p>
        </div>

        <div>
          <h2 className="text-2xl font-bold mb-3">2. Use of the Service</h2>
          <p className="text-zinc-600">
            You agree to use Nummoria responsibly, for lawful purposes only, and
            not to exploit vulnerabilities, distribute malware, or attempt to
            access other users’ data.
          </p>
        </div>

        <div>
          <h2 className="text-2xl font-bold mb-3">3. Intellectual Property</h2>
          <p className="text-zinc-600">
            Nummoria’s code, design, and brand assets are protected by
            intellectual property laws. You may not reproduce, distribute, or
            modify them without prior written permission.
          </p>
        </div>

        <div>
          <h2 className="text-2xl font-bold mb-3">4. Termination</h2>
          <p className="text-zinc-600">
            We reserve the right to suspend or terminate accounts that violate
            these terms, abuse resources, or compromise platform security. Users
            may also delete their accounts at any time from the profile
            settings.
          </p>
        </div>

        <div>
          <h2 className="text-2xl font-bold mb-3">
            5. Limitation of Liability
          </h2>
          <p className="text-zinc-600">
            Nummoria is provided “as is.” We strive for reliability but cannot
            guarantee uninterrupted access or the accuracy of insights. We are
            not liable for financial losses or damages resulting from use of the
            service.
          </p>
        </div>

        <div>
          <h2 className="text-2xl font-bold mb-3">6. Changes to Terms</h2>
          <p className="text-zinc-600">
            These terms may be updated periodically. Continued use after changes
            constitutes acceptance of the revised version.
          </p>
        </div>

        <p className="text-sm text-zinc-500">
          Last updated: {new Date().toLocaleDateString()}
        </p>
      </section>
    </div>
  );
}
