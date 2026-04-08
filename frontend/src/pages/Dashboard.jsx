// frontend/src/pages/Dashboard.jsx
import { useEffect, useMemo, useState } from "react";
import Footer from "../components/Footer";
import api from "../lib/api";
import HeroSlider from "../components/HeroSlider";

import seeItImg from "../assets/see_it_track_it_1.avif";

/* ─────────────────────────────────────────────────────────────
   PALETTE & UTILS
───────────────────────────────────────────────────────────── */
const BG = "#030508";
const MINT = "#00ff87";
const CYAN = "#00d4ff";
const VIOLET = "#a78bfa";

function decimalsForCurrency(code) {
  const zero = new Set(["JPY", "KRW", "CLP", "VND"]);
  const three = new Set(["BHD", "IQD", "JOD", "KWD", "OMR", "TND"]);
  if (zero.has(code)) return 0;
  if (three.has(code)) return 3;
  return 2;
}
function minorToMajorNumber(minor, currency) {
  const d = decimalsForCurrency(currency);
  return minor / Math.pow(10, d);
}

function formatCurrency(n, currency = "USD") {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `$${Number(n || 0).toLocaleString()}`;
  }
}

/* ─────────────────────────────────────────────────────────────
   HOOKS
───────────────────────────────────────────────────────────── */
function useMonthlyExpenseTotal(baseCurrency) {
  const [tx, setTx] = useState([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setError("");
        const { data } = await api.get("/transactions");
        if (!mounted) return;
        setTx(Array.isArray(data) ? data : []);
      } catch (e) {
        if (!mounted) return;
        setError(
          e?.response?.data?.error ||
            e.message ||
            "Failed to load transactions",
        );
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);
  const totalMajor = useMemo(() => {
    if (!baseCurrency) return 0;
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
      23,
      59,
      59,
      999,
    );
    let sumMinor = 0;
    for (const t of tx) {
      if (t.type !== "expense") continue;
      if (t.currency !== baseCurrency) continue;
      const d = new Date(t.date);
      if (d >= start && d <= end) sumMinor += t.amountMinor;
    }
    return minorToMajorNumber(sumMinor, baseCurrency);
  }, [tx, baseCurrency]);
  return { totalMajor, loading, error };
}

function useMonthlyIncomeTotal(baseCurrency) {
  const [tx, setTx] = useState([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setError("");
        const { data } = await api.get("/transactions");
        if (!mounted) return;
        setTx(Array.isArray(data) ? data : []);
      } catch (e) {
        if (!mounted) return;
        setError(
          e?.response?.data?.error ||
            e.message ||
            "Failed to load transactions",
        );
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);
  const totalMajor = useMemo(() => {
    if (!baseCurrency) return 0;
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
      23,
      59,
      59,
      999,
    );
    let sumMinor = 0;
    for (const t of tx) {
      if (t.type !== "income") continue;
      if (t.currency !== baseCurrency) continue;
      const d = new Date(t.date);
      if (d >= start && d <= end) sumMinor += t.amountMinor;
    }
    return minorToMajorNumber(sumMinor, baseCurrency);
  }, [tx, baseCurrency]);
  return { totalMajor, loading, error };
}

function useMonthlyInvestmentTotal(baseCurrency) {
  const [tx, setTx] = useState([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setError("");
        const { data } = await api.get("/transactions");
        if (!mounted) return;
        setTx(Array.isArray(data) ? data : []);
      } catch (e) {
        if (!mounted) return;
        setError(
          e?.response?.data?.error ||
            e.message ||
            "Failed to load transactions",
        );
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);
  const totalMajor = useMemo(() => {
    if (!baseCurrency) return 0;
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
      23,
      59,
      59,
      999,
    );
    let sumMinor = 0;
    for (const t of tx) {
      if (t.type !== "investment") continue;
      if (t.currency !== baseCurrency) continue;
      const d = new Date(t.date);
      if (d >= start && d <= end) sumMinor += t.amountMinor;
    }
    return minorToMajorNumber(sumMinor, baseCurrency);
  }, [tx, baseCurrency]);
  return { totalMajor, loading, error };
}

/* ─────────────────────────────────────────────────────────────
   DECORATOR COMPONENTS
───────────────────────────────────────────────────────────── */
function Brackets({ color = MINT, size = "10px", thick = "1.5px" }) {
  return (
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
  );
}

function ScanLine({ color = MINT, className = "" }) {
  return (
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
  );
}

function ActionChip({ label, accent = CYAN, href }) {
  return (
    <a
      href={href}
      className="inline-flex items-center gap-2 px-4 py-2.5 border bg-black/40 hover:bg-white/5 transition-colors"
      style={{ borderColor: `${accent}44` }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ backgroundColor: accent }}
      />
      <span
        className="text-xs font-bold tracking-wide"
        style={{ color: accent }}
      >
        {label}
      </span>
    </a>
  );
}

/* ─────────────────────────────────────────────────────────────
   MAIN DASHBOARD
───────────────────────────────────────────────────────────── */
export default function Dashboard() {
  const [me, setMe] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    api
      .get("/me")
      .then(({ data }) => setMe(data))
      .catch((e) => setErr(e.response?.data?.error || "Failed to load /me"));
  }, []);

  const {
    totalMajor: monthlyExpense,
    loading: expLoading,
    error: expErr,
  } = useMonthlyExpenseTotal(me?.baseCurrency || "USD");
  const {
    totalMajor: monthlyIncome,
    loading: incLoading,
    error: incErr,
  } = useMonthlyIncomeTotal(me?.baseCurrency || "USD");
  const {
    totalMajor: monthlyInvestments,
    loading: invLoading,
    error: invErr,
  } = useMonthlyInvestmentTotal(me?.baseCurrency || "USD");

  const slides = [
    {
      image: seeItImg,
      alt: "Finance background",
      title: "See it. Track it.",
      subtitle:
        "Real-time visibility into your cash flow, spending, and investments.",
      ctas: [
        { label: "GET ADVICE", href: "/ai/financial-advice" },
        { label: "VIEW REPORTS", href: "/reports" },
      ],
      dim: true,
    },
    {
      image:
        "https://images.unsplash.com/photo-1553729784-e91953dec042?w=1920&q=80&auto=format&fit=crop",
      alt: "Charts and analytics",
      title: "A clear picture of your money — instantly",
      subtitle:
        "Track expenses, monitor income, and keep an eye on investments.",
      ctas: [{ label: "Open Dashboard", href: "/reports" }],
      dim: true,
    },
    {
      image:
        "https://images.unsplash.com/photo-1554224155-1696413565d3?w=1920&q=80&auto=format&fit=crop",
      alt: "Wallet & receipts",
      title: "Control your spending",
      subtitle: "Categorize, filter by date, and export with one click.",
      ctas: [{ label: "Go to Expenses", href: "/expenses" }],
      dim: true,
    },
    {
      image:
        "https://images.unsplash.com/photo-1517148815978-75f6acaaf32c?w=1920&q=80&auto=format&fit=crop",
      alt: "Stock market display",
      title: "Invest with clarity",
      subtitle: "Positions, P&L, and performance in one clean view.",
      ctas: [{ label: "View Investments", href: "/investments/performance" }],
      dim: true,
    },
    {
      image: "https://images.unsplash.com/photo-1550547660-d9450f859349",
      alt: "Hamburger meal display",
      title: "Want fries with that?",
      subtitle: "Check out our new AI based advicer if it is healthy for ya!.",
      ctas: [{ label: "AI Financial Mentor", href: "/ai/financial-helper" }],
      dim: true,
    },
  ];

  return (
    <div className="min-h-dvh text-[#e2e8f0] bg-[#030508]">
      {/* ── FULL-BLEED HERO ── */}
      <section className="relative w-full">
        <div className="relative">
          <HeroSlider slides={slides} minHeight={520} className="w-full" />
          {/* Bottom fade to merge seamlessly into the dark content area */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-[#030508]" />
        </div>
      </section>

      {/* ── DASHBOARD CONTENT ── */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        {/* Header Row */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2 text-[10px] font-extrabold tracking-[0.2em] text-white/70 uppercase">
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: MINT }}
            />
            Live Monthly Snapshot
          </div>
          <div className="text-[10px] font-bold tracking-[0.15em] text-white/40 uppercase">
            {new Date().toLocaleString("default", {
              month: "short",
              year: "numeric",
            })}
          </div>
        </div>

        {/* Title & Description */}
        <div className="mb-8">
          <h2 className="text-3xl font-extrabold tracking-tight text-white mb-2">
            A clear picture of your money — instantly
          </h2>
          <p className="text-[13px] text-white/50 max-w-2xl leading-relaxed">
            Track expenses, monitor income, and keep an eye on investments with
            Nummoria. Export, share, and automate.
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <StatCard
            title="This Month's Expenses"
            value={
              expLoading
                ? "…"
                : formatCurrency(monthlyExpense, me?.baseCurrency || "USD")
            }
            accent="expense"
          />
          <StatCard
            title="This Month's Income"
            value={
              incLoading
                ? "…"
                : formatCurrency(monthlyIncome, me?.baseCurrency || "USD")
            }
            accent="income"
          />
          <StatCard
            title="Invested Balance"
            value={
              invLoading
                ? "…"
                : formatCurrency(monthlyInvestments, me?.baseCurrency || "USD")
            }
            accent="invest"
          />
        </div>

        {/* Errors */}
        {(err || expErr || incErr || invErr) && (
          <div className="relative flex items-start gap-3 p-4 mb-10 border bg-[#a78bfa]/5 border-[#a78bfa]/20">
            <Brackets color={VIOLET} size="8px" thick="1px" />
            <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center border bg-[#a78bfa]/10 border-[#a78bfa]/30">
              <span className="text-sm font-bold" style={{ color: VIOLET }}>
                !
              </span>
            </div>
            <div>
              <h3 className="text-[11px] font-bold text-white tracking-widest uppercase mb-1">
                System Warning
              </h3>
              <div className="text-xs text-white/60 space-y-1">
                {err && <div>[User]: {err}</div>}
                {expErr && <div>[Expenses]: {expErr}</div>}
                {incErr && <div>[Income]: {incErr}</div>}
                {invErr && <div>[Invest]: {invErr}</div>}
              </div>
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="mb-12">
          <div className="flex items-center gap-2 text-[10px] font-extrabold tracking-[0.2em] text-white/70 uppercase mb-5">
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: CYAN }}
            />
            Quick Actions
          </div>
          <div className="flex flex-wrap gap-4">
            <ActionChip label="Add Expense" accent={VIOLET} href="/expenses" />
            <ActionChip label="Add Income" accent={MINT} href="/income" />
            <ActionChip
              label="AI Mentor"
              accent={CYAN}
              href="/ai/financial-helper"
            />
          </div>
        </div>

        {/* AI Mentor Card */}
        <div className="relative border bg-[#00d4ff]/5 border-[#00d4ff]/30 p-8 md:p-10 mb-16">
          <Brackets color={CYAN} size="14px" thick="1.5px" />
          <div
            className="absolute top-0 inset-x-[15%] h-[1px] opacity-40"
            style={{ backgroundColor: CYAN }}
          />

          <div className="flex flex-col md:flex-row gap-6 items-start">
            <div
              className="hidden md:block w-[2px] h-24 opacity-60"
              style={{ backgroundColor: CYAN }}
            />
            <div className="flex-1">
              <div
                className="text-[10px] font-extrabold tracking-[0.2em] mb-3 uppercase"
                style={{ color: CYAN }}
              >
                AI Financial Mentor
              </div>
              <h3 className="text-3xl font-extrabold text-white tracking-tight leading-[1.1] mb-4">
                Ask Nummoria's
                <br />
                AI mentor
              </h3>
              <p className="text-[13px] text-white/60 mb-6 max-w-lg leading-relaxed">
                "Can I afford this?", "How much should I invest?", or "What
                happens if I move in 3 years?" — ask in plain language.
              </p>
              <a
                href="/ai/financial-helper"
                className="inline-flex items-center gap-3 px-5 py-3 transition-opacity hover:opacity-80"
                style={{ backgroundColor: CYAN }}
              >
                <span
                  className="text-[11px] font-extrabold tracking-[0.15em]"
                  style={{ color: BG }}
                >
                  INITIATE CHAT
                </span>
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: BG }}
                />
              </a>
            </div>
          </div>
        </div>
      </section>
      {/* <Footer /> */}
    </div>
  );
}

/** * Sharp, terminal-style Stat Card matching your screenshot
 */
function StatCard({ title, value, accent }) {
  const ACC = {
    expense: {
      color: VIOLET,
      bg: "rgba(167,139,250,0.03)",
      bd: "rgba(167,139,250,0.25)",
    },
    income: {
      color: MINT,
      bg: "rgba(0,255,135,0.03)",
      bd: "rgba(0,255,135,0.25)",
    },
    invest: {
      color: CYAN,
      bg: "rgba(0,212,255,0.03)",
      bd: "rgba(0,212,255,0.25)",
    },
  };
  const a = ACC[accent] || ACC.invest;

  return (
    <div
      className="relative border p-6 flex flex-col justify-between min-h-[140px]"
      style={{ backgroundColor: a.bg, borderColor: a.bd }}
    >
      <Brackets color={a.color} size="8px" thick="1.5px" />

      <div>
        {/* Pill Badge */}
        <div
          className="inline-flex items-center gap-2 border px-2 py-1 mb-4 bg-black/40"
          style={{ borderColor: a.bd }}
        >
          <span
            className="w-1 h-1 rounded-full"
            style={{ backgroundColor: a.color }}
          />
          <span
            className="text-[8px] font-extrabold tracking-[0.2em] uppercase"
            style={{ color: a.color }}
          >
            This Month
          </span>
        </div>

        {/* Title */}
        <div className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-1">
          {title}
        </div>

        {/* Value */}
        <div
          className="text-4xl font-extrabold tracking-tighter"
          style={{ color: a.color }}
        >
          {value}
        </div>
      </div>

      <div className="mt-8">
        <ScanLine color={a.color} className="mb-2" />
        <div className="text-[10px] text-white/30 tracking-wide">
          Updated from transactions
        </div>
      </div>
    </div>
  );
}
