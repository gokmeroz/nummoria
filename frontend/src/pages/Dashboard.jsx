// frontend/src/pages/Dashboard.jsx
import { useEffect, useMemo, useState } from "react";
import Footer from "../components/Footer";
import api from "../lib/api";
import HeroSlider from "../components/HeroSlider";

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
          e?.response?.data?.error || e.message || "Failed to load transactions"
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
      999
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
          e?.response?.data?.error || e.message || "Failed to load transactions"
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
      999
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
          e?.response?.data?.error || e.message || "Failed to load transactions"
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
      999
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
      image: "../../src/assets/investmentMeme.gif",
      alt: "Finance background",
      title: "See it. Track it.",
      subtitle:
        "Real-time visibility into your cash flow, spending, and investments — all in one place. Stay compliant with your own rules and never miss a beat.",
      ctas: [
        { label: "GET ADVICE", href: "/ai/financial-advice" },
        { label: "VIEW REPORTS", href: "/reports" },
      ],
      card: { main, secondary },
      dim: false,
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
  ];

  // If your navbar is fixed and ~64px tall, set topOffset=64 below.
  return (
    <div className="min-h-dvh bg-white">
      {/* FULL-BLEED HERO */}
      <section className="relative w-screen">
        <HeroSlider
          slides={slides}
          fullscreen
          topOffset={64} // adjust if your header height differs (or 0 if not fixed)
          className="rounded-none"
        />
      </section>

      {/* Content */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 md:py-16">
        <h2
          className="text-2xl md:text-3xl font-semibold text-center"
          style={{ color: main }}
        >
          A clear picture of your money — instantly
        </h2>
        <p className="mt-3 max-w-3xl mx-auto text-center text-gray-600">
          From students to growing teams: track expenses, monitor income, and
          keep an eye on investments with Nummora. Export, share, and automate.
        </p>

        <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard
            title="This Month's Expenses"
            value={
              expLoading
                ? "…"
                : formatCurrency(monthlyExpense, me?.baseCurrency || "USD")
            }
            main={main}
            secondary={secondary}
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
          />
        </div>

        {err && <div className="text-red-600 mt-6 text-center">{err}</div>}
        {expErr && (
          <div className="text-red-600 mt-2 text-center">{expErr}</div>
        )}
        {incErr && (
          <div className="text-red-600 mt-2 text-center">{incErr}</div>
        )}
        {invErr && (
          <div className="text-red-600 mt-2 text-center">{invErr}</div>
        )}
      </section>
    </div>
  );
}

/** Simple stat card */
function StatCard({ title, value, main, secondary }) {
  return (
    <div
      className="rounded-lg border bg-white p-5 shadow-sm"
      style={{ borderColor: secondary }}
    >
      <div className="text-sm text-gray-600">{title}</div>
      <div className="mt-2 text-2xl font-semibold" style={{ color: main }}>
        {value}
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
