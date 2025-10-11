// frontend/src/pages/Privacy.jsx
import React, { useMemo } from "react";

const BRAND = {
  main: "#4f772d",
  secondary: "#90a955",
  light: "#f6f9f4",
};

export default function Privacy() {
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
            Privacy Policy
          </h1>
          <p className="mt-4 text-lg text-zinc-100/90">
            Your data belongs to you. We’re transparent about how Nummoria uses
            and protects it.
          </p>
        </div>
      </section>

      {/* CONTENT */}
      <section className="mx-auto max-w-3xl px-6 py-16 space-y-10">
        <div>
          <h2 className="text-2xl font-bold mb-3">1. Information We Collect</h2>
          <p className="text-zinc-600">
            We collect minimal information necessary to operate Nummoria — such
            as your name, email address, and transaction data you choose to
            input. We never sell or share your data with third parties for
            advertising.
          </p>
        </div>

        <div>
          <h2 className="text-2xl font-bold mb-3">2. How We Use Data</h2>
          <p className="text-zinc-600">
            Your data is used to provide personalized summaries, insights, and
            account management features. Aggregated, anonymized data may be used
            for product analytics to improve Nummoria’s functionality and
            performance.
          </p>
        </div>

        <div>
          <h2 className="text-2xl font-bold mb-3">3. Storage and Security</h2>
          <p className="text-zinc-600">
            All data is encrypted in transit (HTTPS) and at rest. We use secure
            cloud storage providers and apply strict access controls. You can
            export or delete your data anytime from your account settings.
          </p>
        </div>

        <div>
          <h2 className="text-2xl font-bold mb-3">4. AI Features</h2>
          <p className="text-zinc-600">
            AI analysis is optional. When enabled, your selected data may be
            processed through trusted AI APIs for generating insights. No
            personal data is used to train third-party models.
          </p>
        </div>

        <div>
          <h2 className="text-2xl font-bold mb-3">5. Your Rights</h2>
          <p className="text-zinc-600">
            You can request a data export or deletion at any time. Email{" "}
            <a
              href="mailto:support@nummoria.com"
              className="underline text-emerald-700"
            >
              support@nummoria.com
            </a>{" "}
            for assistance.
          </p>
        </div>

        <div>
          <h2 className="text-2xl font-bold mb-3">6. Updates</h2>
          <p className="text-zinc-600">
            We may update this policy occasionally. Changes will be reflected
            here with a new “last updated” date.
          </p>
        </div>

        <p className="text-sm text-zinc-500">
          Last updated: {new Date().toLocaleDateString()}
        </p>
      </section>
    </div>
  );
}
