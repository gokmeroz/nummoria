/* eslint-disable */
import React, { useEffect, useMemo, useState } from "react";
import api from "../lib/api";
import logo from "../assets/nummoria_logo.png";

/**
 * PurchasePage
 * - Reads plan from ?plan=plus|premium (fallback to prop or "plus")
 * - Monthly/Yearly toggle (yearly = 2 months free)
 * - Optional coupon (e.g., SAVE20 -> 20% off) — adjust validateCoupon()
 * - Calls backend /billing/checkout to create a Checkout Session (Stripe/Paddle/etc.)
 * - Redirects to provider-hosted checkout page
 *
 * Expected backend: POST /billing/checkout { plan, billingCycle, coupon }
 * -> { checkoutUrl: "https://..." }
 */

const PLANS = {
  plus: {
    key: "plus",
    name: "Plus",
    features: [
      "Track Transactions",
      "Get Reports",
      "AI Financial Helper",
      "Priority Support",
    ],
    priceMonthly: 4.99,
    priceYearly: 4.99 * 10, // 2 months free
    accent: "#ff8a00",
  },
  premium: {
    key: "premium",
    name: "Premium",
    features: [
      "Everything in Plus",
      "Early access to new features",
      "Custom insights",
      "Data export",
      "Multi-currency support",
    ],
    priceMonthly: 9.99,
    priceYearly: 9.99 * 10, // 2 months free
    accent: "#7c3aed",
  },
};

// simple coupon validator stub — replace with backend validation if you prefer
function validateCoupon(code) {
  if (!code) return { pct: 0, label: "" };
  const c = code.trim().toUpperCase();
  if (c === "SAVE20") return { pct: 20, label: "SAVE20 (20% off)" };
  if (c === "TRY10") return { pct: 10, label: "TRY10 (10% off)" };
  return { pct: 0, label: "" };
}

export default function PurchasePage({ initialPlan }) {
  const [planKey, setPlanKey] = useState(() => {
    const sp = new URLSearchParams(window.location.search);
    return (sp.get("plan") || initialPlan || "plus").toLowerCase();
  });

  const plan = PLANS[planKey] || PLANS.plus;

  const [billingCycle, setBillingCycle] = useState("monthly"); // 'monthly' | 'yearly'
  const [coupon, setCoupon] = useState("");
  const [couponApplied, setCouponApplied] = useState(null); // {pct,label} or null
  const [processing, setProcessing] = useState(false);
  const [banner, setBanner] = useState(null);

  // (Optional) prefill user email from /me
  const [email, setEmail] = useState("");
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data } = await api.get("/me");
        if (!mounted) return;
        setEmail(data?.email || "");
      } catch {
        // ignore silently
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const accent = plan.accent;

  const price = useMemo(() => {
    return billingCycle === "yearly" ? plan.priceYearly : plan.priceMonthly;
  }, [billingCycle, plan]);

  const discountPct = couponApplied?.pct || 0;
  const discount = Number(((price * discountPct) / 100).toFixed(2));
  const subtotal = price;
  const total = Number((subtotal - discount).toFixed(2));

  function showBanner(msg, tone = "info") {
    setBanner({ msg, tone });
    window.clearTimeout(showBanner._t);
    showBanner._t = window.setTimeout(() => setBanner(null), 5000);
  }

  function onApplyCoupon(e) {
    e.preventDefault();
    const v = validateCoupon(coupon);
    if (v.pct > 0) {
      setCouponApplied(v);
      showBanner(`Coupon applied: ${v.label}`, "success");
    } else {
      setCouponApplied(null);
      showBanner("Coupon not valid.", "warn");
    }
  }

  async function onCheckout() {
    try {
      setProcessing(true);
      setBanner(null);

      const payload = {
        plan: plan.key, // "plus" | "premium"
        billingCycle, // "monthly" | "yearly"
        coupon: couponApplied ? coupon : "", // send raw code if applied
        email, // optional but handy for prefill
        // You can also include success/cancel URLs if your backend expects them
      };

      const { data } = await api.post("/billing/checkout", payload);
      const url = data?.checkoutUrl || data?.url;
      if (!url) throw new Error("No checkout URL returned by server.");
      window.location.href = url;
    } catch (err) {
      const msg =
        err?.response?.data?.message || err.message || "Checkout failed.";
      showBanner(msg, "error");
      setProcessing(false);
    }
  }

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-[#f6fbf6] via-[#f3f7ef] to-[#eef3ff] text-gray-900">
      {/* Top */}
      <header className="mx-auto max-w-5xl px-6 pt-10 pb-6">
        <div className="flex items-center justify-between">
          <a href="/pricing" className="text-sm text-gray-600 hover:underline">
            ← Back to Pricing
          </a>
          <img src={logo} alt="Nummoria" className="h-8 w-auto opacity-90" />
        </div>
        <h1 className="mt-4 text-2xl md:text-3xl font-extrabold tracking-tight">
          Complete your purchase
        </h1>
        <p className="text-sm text-gray-600 mt-1">
          You’re getting <span className="font-medium">{plan.name}</span> —
          secure checkout.
        </p>
      </header>

      {/* Banner */}
      {banner && (
        <div className={`mx-auto max-w-5xl px-6`}>
          <div
            className={[
              "rounded-xl px-4 py-3 text-sm border",
              banner.tone === "success" &&
                "bg-emerald-50 text-emerald-800 border-emerald-200",
              banner.tone === "warn" &&
                "bg-amber-50 text-amber-900 border-amber-200",
              banner.tone === "error" &&
                "bg-rose-50 text-rose-900 border-rose-200",
              (!["success", "warn", "error"].includes(banner.tone) ||
                !banner.tone) &&
                "bg-slate-50 text-slate-700 border-slate-200",
            ].join(" ")}
          >
            {banner.msg}
          </div>
        </div>
      )}

      {/* Content */}
      <main className="mx-auto max-w-5xl px-6 py-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Left: form */}
          <div className="md:col-span-2 rounded-2xl border bg-white shadow-sm p-5">
            {/* Plan selector (if user changes URL) */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-gray-600">Plan:</span>
              <button
                type="button"
                onClick={() => setPlanKey("plus")}
                className={`px-3 py-1 rounded-full text-sm border ${
                  planKey === "plus"
                    ? "bg-[#ffedd5] border-[#ff8a00] text-[#9a5500]"
                    : "bg-white border-gray-200 text-gray-700"
                }`}
                title="Plus"
              >
                Plus
              </button>
              <button
                type="button"
                onClick={() => setPlanKey("premium")}
                className={`px-3 py-1 rounded-full text-sm border ${
                  planKey === "premium"
                    ? "bg-violet-50 border-[#7c3aed] text-[#4c1d95]"
                    : "bg-white border-gray-200 text-gray-700"
                }`}
                title="Premium"
              >
                Premium
              </button>
            </div>

            {/* Billing cycle */}
            <div className="mt-5">
              <div className="text-sm font-medium">Billing cycle</div>
              <div className="mt-2 inline-flex rounded-full border overflow-hidden">
                <CycleChip
                  active={billingCycle === "monthly"}
                  onClick={() => setBillingCycle("monthly")}
                  label="Monthly"
                />
                <CycleChip
                  active={billingCycle === "yearly"}
                  onClick={() => setBillingCycle("yearly")}
                  label="Yearly — 2 months free"
                />
              </div>
            </div>

            {/* Email (optional) */}
            <div className="mt-6">
              <label className="text-sm font-medium">Email for receipt</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="mt-1 w-full rounded-xl border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#90a955]/40"
              />
            </div>

            {/* Coupon */}
            <form onSubmit={onApplyCoupon} className="mt-6">
              <label className="text-sm font-medium">Coupon</label>
              <div className="mt-1 flex gap-2">
                <input
                  value={coupon}
                  onChange={(e) => setCoupon(e.target.value)}
                  placeholder="e.g., SAVE20"
                  className="flex-1 rounded-xl border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#90a955]/40"
                />
                <button
                  type="submit"
                  className="rounded-xl border px-4 py-2 font-semibold hover:bg-[#eef5ea]"
                >
                  Apply
                </button>
              </div>
              {couponApplied?.pct > 0 && (
                <div className="mt-2 text-xs text-emerald-700 bg-emerald-50 inline-block px-2 py-1 rounded-md">
                  Applied: {couponApplied.label}
                </div>
              )}
            </form>

            {/* Payment method (provider handles card entry after redirect) */}
            <div className="mt-8">
              <div className="text-sm font-medium">Payment</div>
              <p className="text-xs text-gray-500 mt-1">
                You’ll be redirected to our secure payment provider to complete
                your purchase.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <PayBadge>Visa</PayBadge>
                <PayBadge>Mastercard</PayBadge>
                <PayBadge>Amex</PayBadge>
                <PayBadge>Apple&nbsp;Pay</PayBadge>
                <PayBadge>Google&nbsp;Pay</PayBadge>
              </div>
            </div>

            {/* Actions */}
            <div className="mt-8 flex items-center justify-between">
              <a
                href="/pricing"
                className="text-sm text-gray-600 hover:underline"
              >
                ← Back
              </a>
              <button
                type="button"
                disabled={processing}
                onClick={onCheckout}
                className="rounded-xl px-5 py-2.5 font-semibold text-white disabled:opacity-60"
                style={{
                  background: `linear-gradient(180deg, ${accent}, ${shade(
                    accent,
                    -10
                  )})`,
                  boxShadow: `0 10px 22px -10px ${hexToRGBA(accent, 0.25)}`,
                }}
              >
                {processing
                  ? "Redirecting…"
                  : `Checkout ${plan.name} (${billingCycle})`}
              </button>
            </div>

            <p className="mt-3 text-xs text-gray-500">
              By continuing, you agree to our{" "}
              <a href="/terms" className="underline">
                Terms
              </a>{" "}
              and{" "}
              <a href="/privacy" className="underline">
                Privacy Policy
              </a>
              .
            </p>
          </div>

          {/* Right: order summary */}
          <aside className="rounded-2xl border bg-white shadow-sm p-5">
            <div className="flex items-center gap-3">
              {/* <div
                className="h-10 w-10 rounded-2xl grid place-items-center text-white font-bold"
                style={{ background: plan.accent }}
              >
                ₮
              </div> */}
              <img
                src={logo}
                alt="Nummoria"
                className="h-8 w-auto opacity-90"
              />

              <div>
                <div className="text-sm text-gray-500">Your plan</div>
                <div className="text-lg font-bold">{plan.name}</div>
              </div>
            </div>

            <ul className="mt-5 space-y-2 text-sm">
              {plan.features.map((f, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span
                    className="mt-1 inline-block h-2 w-2 rounded-full"
                    style={{ backgroundColor: plan.accent }}
                  />
                  <span className="text-gray-700">{f}</span>
                </li>
              ))}
            </ul>

            <div className="mt-6 border-t pt-4 text-sm">
              <Row label="Billing">
                {billingCycle === "yearly"
                  ? "Yearly (2 months free)"
                  : "Monthly"}
              </Row>
              <Row label="Subtotal">${subtotal.toFixed(2)}</Row>
              {discount > 0 && (
                <Row label="Discount">−${discount.toFixed(2)}</Row>
              )}
              <Row label="Tax">Calculated at checkout</Row>
              <div className="mt-3 flex items-center justify-between font-semibold text-base">
                <span>Total due now</span>
                <span>${total.toFixed(2)}</span>
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}

/* --------------------- tiny components --------------------- */

function CycleChip({ active, onClick, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "px-4 py-1 text-sm",
        active ? "bg-white text-gray-900" : "bg-gray-50 text-gray-600",
        "border-r last:border-r-0 border-gray-200",
      ].join(" ")}
    >
      {label}
    </button>
  );
}

function PayBadge({ children }) {
  return (
    <span className="rounded-full border border-gray-200 bg-gray-50 text-gray-700 text-xs px-3 py-1">
      {children}
    </span>
  );
}

function Row({ label, children }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-gray-500">{label}</span>
      <span>{children}</span>
    </div>
  );
}

/* ----------------------- helpers ----------------------- */
function shade(hex, pct) {
  const { r, g, b } = hexToRGB(hex);
  const t = pct < 0 ? 0 : 255;
  const p = Math.abs(pct) / 100;
  const R = Math.round((t - r) * p + r);
  const G = Math.round((t - g) * p + g);
  const B = Math.round((t - b) * p + b);
  return `rgb(${R}, ${G}, ${B})`;
}

function hexToRGB(hex) {
  let c = hex.replace("#", "");
  if (c.length === 3)
    c = c
      .split("")
      .map((x) => x + x)
      .join("");
  const num = parseInt(c, 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

function hexToRGBA(hex, a = 1) {
  const { r, g, b } = hexToRGB(hex);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}
