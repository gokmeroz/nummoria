// frontend/src/pages/Dashboard.jsx
import { useEffect, useMemo, useState } from "react";
import api from "../lib/api";

/* ----------------------- money helpers (minor → major) ---------------------- */
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

/* --------------------- hook: this month's expense total --------------------- */
function useMonthlyExpenseTotal(baseCurrency) {
  const [tx, setTx] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
    const start = new Date(now.getFullYear(), now.getMonth(), 1); // first day 00:00
    const end = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
      23,
      59,
      59,
      999
    ); // last day 23:59:59

    let sumMinor = 0;
    for (const t of tx) {
      if (t.type !== "expense") continue;
      if (t.currency !== baseCurrency) continue; // simple same-currency sum
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

  // monthly expenses (live)
  const {
    totalMajor: monthlyExpense,
    loading: expLoading,
    error: expErr,
  } = useMonthlyExpenseTotal(me?.baseCurrency || "USD");

  return (
    <div className="min-h-dvh bg-white">
      {/* Hero */}
      <section className="relative">
        <div
          className="h-[360px] md:h-[460px] bg-center bg-cover"
          style={{ backgroundImage: "url('/hero.jpg')" }}
        />
        {/* Overlay card */}
        <div className="absolute inset-0 flex items-center">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 w-full">
            <div className="max-w-xl bg-white/90 backdrop-blur rounded shadow-md p-6 md:p-8">
              <h1
                className="text-3xl md:text-4xl font-bold leading-tight"
                style={{ color: main }}
              >
                See it. Track it.
              </h1>
              <p className="mt-3 text-gray-700">
                Real-time visibility into your cash flow, spending, and
                investments — all in one place. Stay compliant with your own
                rules and never miss a beat.
              </p>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <a
                  href="/transactions/new"
                  className="px-5 py-2.5 rounded font-semibold text-white transition"
                  style={{ backgroundColor: main }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.backgroundColor = secondary)
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.backgroundColor = main)
                  }
                >
                  ADD TRANSACTION
                </a>
                <a
                  href="/reports"
                  className="px-5 py-2.5 rounded font-semibold border"
                  style={{ borderColor: main, color: main }}
                >
                  VIEW REPORTS
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Social proof / stats */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 md:py-14">
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

        {/* KPI cards */}
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
            value={formatCurrency(4100, me?.baseCurrency || "USD")}
            main={main}
            secondary={secondary}
          />
          <StatCard
            title="Invested Balance"
            value={formatCurrency(12850, me?.baseCurrency || "USD")}
            main={main}
            secondary={secondary}
          />
        </div>

        {err && <div className="text-red-600 mt-6 text-center">{err}</div>}
        {expErr && (
          <div className="text-red-600 mt-2 text-center">{expErr}</div>
        )}

        {/* {me && (
          <div
            className="mt-8 rounded border bg-white p-5 shadow-sm max-w-3xl mx-auto"
            style={{ borderColor: secondary }}
          >
            <h3 className="font-semibold mb-3" style={{ color: main }}>
              Profile
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
              <div>
                <span className="font-medium" style={{ color: main }}>
                  Name:
                </span>{" "}
                {me.name}
              </div>
              <div>
                <span className="font-medium" style={{ color: main }}>
                  Email:
                </span>{" "}
                {me.email}
              </div>
              <div>
                <span className="font-medium" style={{ color: main }}>
                  Base currency:
                </span>{" "}
                {me.baseCurrency}
              </div>
              <div>
                <span className="font-medium" style={{ color: main }}>
                  TZ:
                </span>{" "}
                {me.tz}
              </div>
            </div>
          </div>
        )} */}
      </section>

      {/* Footer-ish CTA */}
      <section className="bg-gray-50 border-t">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-gray-700">
            Ready to dive deeper into your finances?
          </p>
          <div className="flex items-center gap-3">
            <a
              href="/expenses"
              className="px-4 py-2 rounded text-white transition"
              style={{ backgroundColor: main }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.backgroundColor = secondary)
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.backgroundColor = main)
              }
            >
              Go to Expenses
            </a>
            <a
              href="/investments"
              className="px-4 py-2 rounded border"
              style={{ borderColor: main, color: main }}
            >
              View Investments
            </a>
          </div>
        </div>
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

/** currency helper (safe fallback) */
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
