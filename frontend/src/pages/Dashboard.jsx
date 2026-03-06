// frontend/src/pages/Dashboard.jsx
import { useEffect, useMemo, useState } from "react";
import Footer from "../components/Footer";
import api from "../lib/api";
import HeroSlider from "../components/HeroSlider";

// ✅ import local assets instead of using ../../src/... strings
import seeItImg from "../assets/see_it_track_it_1.avif";

/* money utils */
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

/* hooks */
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

export default function Dashboard() {
  const [me, setMe] = useState(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    api
      .get("/me")
      .then(({ data }) => setMe(data))
      .catch((e) => setErr(e.response?.data?.error || "Failed to load /me"));
  }, []);

  const main = "#4f772d";
  const secondary = "#90a955";

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

  /* Slides */
  const slides = [
    {
      image: seeItImg, // ✅ imported asset
      alt: "Finance background",
      title: "See it. Track it.",
      subtitle:
        "Real-time visibility into your cash flow, spending, and investments — all in one place. Stay compliant with your own rules and never miss a beat.",
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
    <div className="min-h-dvh bg-[#070A07] text-white">
      {/* subtle background texture + glow */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(1200px_800px_at_20%_10%,rgba(19,226,67,0.10),transparent_55%),radial-gradient(900px_700px_at_80%_20%,rgba(153,23,70,0.12),transparent_55%),radial-gradient(900px_700px_at_50%_90%,rgba(255,255,255,0.06),transparent_60%)]" />
        <div className="absolute inset-0 opacity-[0.10] mix-blend-overlay bg-[linear-gradient(to_right,rgba(255,255,255,0.10)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.10)_1px,transparent_1px)] bg-[size:56px_56px]" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/40 to-black/70" />
      </div>

      {/* FULL-BLEED HERO */}
      <section className="relative w-screen">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-16 left-8 h-40 w-40 rounded-full blur-3xl opacity-30 bg-[#13e243]" />
          <div className="absolute -top-12 right-10 h-40 w-40 rounded-full blur-3xl opacity-25 bg-[#991746]" />
        </div>

        {/* Keep your HeroSlider intact; we just wrap it for styling */}
        <div className="relative">
          <HeroSlider
            slides={slides}
            minHeight={520}
            className="rounded-none"
          />
          {/* bottom fade to merge with dark content */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent to-[#070A07]" />
        </div>
      </section>

      {/* Content */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 md:py-16">
        <div className="flex flex-col items-center text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-white/70 backdrop-blur-md">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ background: secondary }}
            />
            LIVE MONTHLY SNAPSHOT
          </div>

          <h2 className="mt-5 text-3xl md:text-4xl font-semibold tracking-tight">
            A clear picture of your money — instantly
          </h2>

          <p className="mt-3 max-w-3xl text-base md:text-lg text-white/70">
            From students to growing teams: track expenses, monitor income, and
            keep an eye on investments with Nummoria. Export, share, and
            automate.
          </p>
        </div>

        {/* Stats */}
        <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard
            title="This Month's Expenses"
            value={
              expLoading
                ? "…"
                : formatCurrency(monthlyExpense, me?.baseCurrency || "USD")
            }
            main={main}
            secondary={secondary}
            accent="expense"
          />
          <StatCard
            title="This Month's Income"
            value={
              incLoading
                ? "…"
                : formatCurrency(monthlyIncome, me?.baseCurrency || "USD")
            }
            main={main}
            secondary={secondary}
            accent="income"
          />
          <StatCard
            title="Invested Balance"
            value={
              invLoading
                ? "…"
                : formatCurrency(monthlyInvestments, me?.baseCurrency || "USD")
            }
            main={main}
            secondary={secondary}
            accent="invest"
          />
        </div>

        {/* Errors (kept same logic, upgraded UI) */}
        {(err || expErr || incErr || invErr) && (
          <div className="mt-10">
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-md p-4 md:p-5">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 h-9 w-9 rounded-xl bg-[#991746]/20 border border-[#991746]/30 grid place-items-center">
                  <span className="text-sm">!</span>
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium text-white">
                    Something didn’t load
                  </div>
                  <div className="mt-1 text-sm text-white/70 space-y-1">
                    {err && <div>{err}</div>}
                    {expErr && <div>{expErr}</div>}
                    {incErr && <div>{incErr}</div>}
                    {invErr && <div>{invErr}</div>}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* <Footer /> */}
    </div>
  );
}

/** Simple stat card (UI upgraded, same inputs/outputs) */
function StatCard({ title, value, main, secondary, accent }) {
  const accentMap = {
    expense: {
      glow: "rgba(153,23,70,0.18)",
      chip: "bg-[#991746]/15 border-[#991746]/30 text-white/80",
      dot: "#991746",
    },
    income: {
      glow: "rgba(19,226,67,0.16)",
      chip: "bg-[#13e243]/15 border-[#13e243]/30 text-white/80",
      dot: "#13e243",
    },
    invest: {
      glow: "rgba(144,169,85,0.16)",
      chip: "bg-white/5 border-white/10 text-white/80",
      dot: secondary,
    },
  };
  const a = accentMap[accent] || accentMap.invest;

  return (
    <div className="group relative rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-md p-5 md:p-6 overflow-hidden transition-transform duration-300 hover:-translate-y-0.5">
      {/* ambient glow */}
      <div
        className="pointer-events-none absolute -top-10 -right-10 h-44 w-44 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{ background: a.glow }}
      />
      {/* top hairline */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{
          background:
            "linear-gradient(to right, transparent, rgba(255,255,255,0.18), transparent)",
        }}
      />

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-wider text-white/60">
            {title}
          </div>
          <div className="mt-2 text-3xl md:text-[34px] font-semibold tracking-tight">
            <span
              className="bg-clip-text text-transparent"
              style={{
                backgroundImage: `linear-gradient(135deg, ${secondary}, ${main})`,
              }}
            >
              {value}
            </span>
          </div>
        </div>

        <div
          className={`shrink-0 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] ${a.chip}`}
        >
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ background: a.dot }}
          />
          THIS MONTH
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between text-xs text-white/55">
        <div className="inline-flex items-center gap-2">
          <span className="inline-block h-1 w-1 rounded-full bg-white/40" />
          Updated from transactions
        </div>
        <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          Hovered
        </div>
      </div>
    </div>
  );
}

/** currency helper */
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
