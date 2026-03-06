/* eslint-disable no-unused-vars */

// src/pages/Reports.jsx
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ResponsiveSankey } from "@nivo/sankey";
import api from "../lib/api";
import logoUrl from "../assets/nummoria_logo.png";

/* =========================== Money helpers =========================== */

const DATE_LANG = "en-US";
const main = "#4f772d";
const secondary = "#90a955";

function decimalsForCurrency(code) {
  const zero = new Set(["JPY", "KRW", "CLP", "VND"]);
  const three = new Set(["BHD", "IQD", "JOD", "KWD", "OMR", "TND"]);
  if (zero.has(code)) return 0;
  if (three.has(code)) return 3;
  return 2;
}

function minorToMajor(minor, currency = "USD") {
  const d = decimalsForCurrency(currency || "USD");
  return Number(Number(minor || 0) / Math.pow(10, d));
}

const fmtMoneyUI = (minor, cur = "USD") =>
  new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: cur || "USD",
  }).format(minorToMajor(minor, cur));

function fmtDate(dateLike) {
  const d = new Date(dateLike);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(DATE_LANG, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function csvEscape(v) {
  const s = String(v ?? "");
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function startOfUTC(dateLike) {
  const d = new Date(dateLike);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function startOfMonthUTC(dateLike) {
  const d = new Date(dateLike);
  return startOfUTC(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)));
}

function endOfMonthUTC(dateLike) {
  const d = new Date(dateLike);
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0, 23, 59, 59, 999),
  );
}

function addMonthsUTC(dateLike, n) {
  const d = new Date(dateLike);
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, d.getUTCDate()),
  );
}

/* =========================== Shared UI =========================== */

function Field({ label, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-white/75">{label}</label>
      {children}
    </div>
  );
}

function Chip({ label, selected, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3.5 py-2 text-sm transition ${
        selected
          ? "border-white/15 bg-white/[0.08] text-white"
          : "border-white/10 bg-white/[0.03] text-white/65 hover:bg-white/[0.05] hover:text-white"
      }`}
    >
      {label}
    </button>
  );
}

function SectionCard({ title, subtitle, right, children, className = "" }) {
  return (
    <div
      className={`relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-md ${className}`}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(500px_180px_at_10%_0%,rgba(19,226,67,0.06),transparent_60%),radial-gradient(420px_180px_at_90%_10%,rgba(153,23,70,0.08),transparent_60%)]" />
      <div className="relative p-5 md:p-6">
        {(title || right) && (
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              {title ? (
                <h2 className="text-lg font-semibold tracking-tight text-white">
                  {title}
                </h2>
              ) : null}
              {subtitle ? (
                <p className="mt-1 text-sm text-white/55">{subtitle}</p>
              ) : null}
            </div>
            {right ? <div>{right}</div> : null}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

function MetricCard({ label, value, tone = "neutral" }) {
  const toneClass =
    tone === "positive"
      ? "text-[#dce8bf]"
      : tone === "negative"
        ? "text-red-200"
        : "text-white";

  return (
    <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
      <div className="text-xs uppercase tracking-[0.18em] text-white/40">
        {label}
      </div>
      <div
        className={`mt-2 text-2xl font-semibold tracking-tight ${toneClass}`}
      >
        {value}
      </div>
    </div>
  );
}

function TotalsCard({ totals }) {
  return (
    <SectionCard
      title="Totals / Money Flow"
      subtitle="Summarized from the currently filtered transaction set."
      className="mb-6"
    >
      {totals.length === 0 ? (
        <div className="rounded-2xl border border-white/8 bg-black/20 p-6 text-sm text-white/55">
          No transactions match these filters.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {totals.map((t) => {
            const netUp = t.netMinor >= 0;
            return (
              <div
                key={t.currency}
                className="rounded-2xl border border-white/8 bg-black/20 p-4"
              >
                <div className="mb-3 flex items-center justify-between">
                  <div className="text-sm font-semibold text-white">
                    {t.currency}
                  </div>
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] text-white/60">
                    Currency
                  </span>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between gap-3 text-white/65">
                    <span>Income</span>
                    <span className="font-medium text-white">
                      {fmtMoneyUI(t.incomeMinor, t.currency)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3 text-white/65">
                    <span>Outflow</span>
                    <span className="font-medium text-white">
                      {fmtMoneyUI(t.outMinor, t.currency)}
                    </span>
                  </div>
                  <div className="h-px bg-white/8" />
                  <div
                    className={`flex items-center justify-between gap-3 font-semibold ${
                      netUp ? "text-[#dce8bf]" : "text-red-200"
                    }`}
                  >
                    <span>Net</span>
                    <span>{fmtMoneyUI(t.netMinor, t.currency)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </SectionCard>
  );
}

/* =========================== Page =========================== */

export default function Reports() {
  /* ---------- data ---------- */
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [accounts, setAccounts] = useState([]);

  /* ---------- UI state ---------- */
  const [loading, setLoading] = useState(true);
  const [initialDone, setInitialDone] = useState(false);
  const [err, setErr] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  /* filters */
  const [fStart, setFStart] = useState("");
  const [fEnd, setFEnd] = useState("");
  const [fType, setFType] = useState("ALL");
  const [fAccountId, setFAccountId] = useState("ALL");
  const [fCategoryId, setFCategoryId] = useState("ALL");
  const [fCurrency, setFCurrency] = useState("USD");
  const [fMin, setFMin] = useState("");
  const [fMax, setFMax] = useState("");

  const sankeyRef = useRef(null);

  /* ---------- load data ---------- */
  const loadAll = useCallback(async () => {
    try {
      setLoading(true);
      setErr("");

      const [txRes, catRes, accRes] = await Promise.all([
        api.get("/transactions"),
        api.get("/categories"),
        api.get("/accounts"),
      ]);

      setTransactions(Array.isArray(txRes.data) ? txRes.data : []);
      setCategories(Array.isArray(catRes.data) ? catRes.data : []);
      setAccounts((accRes.data || []).filter((a) => !a?.isDeleted));
    } catch (e) {
      setErr(
        e?.response?.data?.error || e.message || "Failed to load reports data",
      );
    } finally {
      setLoading(false);
      setInitialDone(true);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  /* ---------- lookups ---------- */
  const categoriesById = useMemo(() => {
    const m = new Map();
    for (const c of categories) m.set(c._id, c);
    return m;
  }, [categories]);

  const accountsById = useMemo(() => {
    const m = new Map();
    for (const a of accounts) m.set(a._id, a);
    return m;
  }, [accounts]);

  const currencies = useMemo(() => {
    const s = new Set(transactions.map((t) => t.currency || "USD"));
    const arr = Array.from(s);
    if (!arr.includes("USD")) arr.unshift("USD");
    return arr;
  }, [transactions]);

  const typeCounts = useMemo(() => {
    const out = { income: 0, expense: 0, investment: 0 };
    for (const t of transactions) {
      const k = String(t.type || "").toLowerCase();
      if (k in out) out[k] += 1;
    }
    return out;
  }, [transactions]);

  /* ---------- filters ---------- */
  const resetFilters = () => {
    setFStart("");
    setFEnd("");
    setFType("ALL");
    setFAccountId("ALL");
    setFCategoryId("ALL");
    setFCurrency("USD");
    setFMin("");
    setFMax("");
  };

  const rows = useMemo(() => {
    let start = null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(fStart)) {
      start = new Date(`${fStart}T00:00:00`);
    }

    let end = null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(fEnd)) {
      end = new Date(`${fEnd}T23:59:59.999`);
    }

    let minNum = null;
    if (fMin.trim() !== "" && !Number.isNaN(Number(fMin))) {
      minNum = Number(fMin);
    }

    let maxNum = null;
    if (fMax.trim() !== "" && !Number.isNaN(Number(fMax))) {
      maxNum = Number(fMax);
    }

    const filtered = transactions.filter((t) => {
      if (fType !== "ALL" && (t.type || "").toLowerCase() !== fType)
        return false;
      if (fAccountId !== "ALL" && t.accountId !== fAccountId) return false;
      if (fCategoryId !== "ALL" && t.categoryId !== fCategoryId) return false;

      const cur = t.currency || "USD";
      if (fCurrency && cur !== fCurrency) return false;

      const dt = new Date(t.date);
      if (start && dt < start) return false;
      if (end && dt > end) return false;

      const major = minorToMajor(t.amountMinor, cur);
      if (minNum !== null && major < minNum) return false;
      if (maxNum !== null && major > maxNum) return false;

      return true;
    });

    filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
    return filtered;
  }, [
    transactions,
    fStart,
    fEnd,
    fType,
    fAccountId,
    fCategoryId,
    fCurrency,
    fMin,
    fMax,
  ]);

  /* ---------- KPI summary ---------- */
  const reportKpis = useMemo(() => {
    const now = new Date();
    const thisStart = startOfMonthUTC(now);
    const thisEnd = endOfMonthUTC(now);
    const lastStart = startOfMonthUTC(addMonthsUTC(now, -1));
    const lastEnd = endOfMonthUTC(addMonthsUTC(now, -1));

    const source = rows.filter((r) => (r.currency || "USD") === fCurrency);

    const sumByType = (arr, type) =>
      arr
        .filter((t) => t.type === type)
        .reduce((acc, t) => acc + Number(t.amountMinor || 0), 0);

    const within = (arr, s, e) =>
      arr.filter((t) => {
        const d = new Date(t.date);
        return d >= s && d <= e;
      });

    const thisMonth = within(source, thisStart, thisEnd);
    const lastMonth = within(source, lastStart, lastEnd);

    const thisIncome = sumByType(thisMonth, "income");
    const thisExpense = sumByType(thisMonth, "expense");
    const thisInvestment = sumByType(thisMonth, "investment");
    const lastNet =
      sumByType(lastMonth, "income") -
      sumByType(lastMonth, "expense") -
      sumByType(lastMonth, "investment");
    const thisNet = thisIncome - thisExpense - thisInvestment;

    return {
      thisIncome,
      thisExpense,
      thisInvestment,
      lastNet,
      thisNet,
    };
  }, [rows, fCurrency]);

  /* ---------- totals ---------- */
  const totalsByCurrency = useMemo(() => {
    const map = new Map();
    for (const t of rows) {
      const cur = t.currency || "USD";
      const bucket = map.get(cur) || { incomeMinor: 0, outMinor: 0 };
      if (t.type === "income") bucket.incomeMinor += Number(t.amountMinor || 0);
      else bucket.outMinor += Number(t.amountMinor || 0);
      map.set(cur, bucket);
    }
    return [...map.entries()].map(([currency, v]) => {
      const netMinor = v.incomeMinor - v.outMinor;
      return {
        currency,
        incomeMinor: v.incomeMinor,
        outMinor: v.outMinor,
        netMinor,
      };
    });
  }, [rows]);

  /* ---------- sankey ---------- */
  const sankeyData = useMemo(() => {
    if (!fCurrency) return null;
    const cur = fCurrency;

    let totalIncome = 0;
    const catMap = new Map();

    for (const t of rows) {
      if ((t.currency || "USD") !== cur) continue;
      if (t.type === "income") {
        totalIncome += Number(t.amountMinor || 0);
      } else if (t.type === "expense") {
        const catId = t.categoryId || "UNCAT";
        const name = categoriesById.get(catId)?.name || "Other";
        catMap.set(name, (catMap.get(name) || 0) + Number(t.amountMinor || 0));
      }
    }

    if (totalIncome <= 0 || catMap.size === 0) return null;

    const catEntries = [...catMap.entries()].sort((a, b) => b[1] - a[1]);
    const top = catEntries.slice(0, 6);
    const otherSum = catEntries.slice(6).reduce((acc, [, v]) => acc + v, 0);

    const nodes = [{ id: "Income" }];
    const links = [];

    let totalExpenses = 0;

    for (const [name, minor] of top) {
      nodes.push({ id: name });
      links.push({
        source: "Income",
        target: name,
        value: minorToMajor(minor, cur),
      });
      totalExpenses += minor;
    }

    if (otherSum > 0) {
      nodes.push({ id: "Other" });
      links.push({
        source: "Income",
        target: "Other",
        value: minorToMajor(otherSum, cur),
      });
      totalExpenses += otherSum;
    }

    const net = totalIncome - totalExpenses;
    if (net > 0) {
      nodes.push({ id: "Sparen / Savings" });
      links.push({
        source: "Income",
        target: "Sparen / Savings",
        value: minorToMajor(net, cur),
      });
    }

    return { nodes, links };
  }, [rows, fCurrency, categoriesById]);

  /* ---------- import / export ---------- */

  const handleImportCsv = async () => {
    try {
      if (typeof window === "undefined" || typeof document === "undefined")
        return;

      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".csv,text/csv";
      input.style.display = "none";

      const handleChange = async (e) => {
        const file = e.target.files && e.target.files[0];
        document.body.removeChild(input);
        input.removeEventListener("change", handleChange);

        if (!file) return;

        const formData = new FormData();
        formData.append("file", file);

        setLoading(true);
        try {
          const response = await api.post("/ingest/csv", formData, {
            headers: { "Content-Type": "multipart/form-data" },
          });
          alert(response.data.message || "CSV imported successfully");
          await loadAll();
        } catch (err) {
          alert(
            err?.response?.data?.error || err.message || "Failed to import CSV",
          );
        } finally {
          setLoading(false);
        }
      };

      input.addEventListener("change", handleChange);
      document.body.appendChild(input);
      input.click();
    } catch (err) {
      alert(err.message || "Failed to open file picker");
    }
  };

  const handleImportPdf = async () => {
    try {
      if (typeof window === "undefined" || typeof document === "undefined")
        return;

      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".pdf,application/pdf";
      input.style.display = "none";

      const handleChange = async (e) => {
        const file = e.target.files && e.target.files[0];
        document.body.removeChild(input);
        input.removeEventListener("change", handleChange);

        if (!file) return;

        const formData = new FormData();
        formData.append("file", file);

        setLoading(true);
        try {
          const response = await api.post("/ingest/pdf", formData, {
            headers: { "Content-Type": "multipart/form-data" },
          });
          alert(response.data.message || "PDF imported successfully");
          await loadAll();
        } catch (err) {
          alert(
            err?.response?.data?.error || err.message || "Failed to import PDF",
          );
        } finally {
          setLoading(false);
        }
      };

      input.addEventListener("change", handleChange);
      document.body.appendChild(input);
      input.click();
    } catch (err) {
      alert(err.message || "Failed to open file picker");
    }
  };

  const handleDownloadCsv = async () => {
    try {
      if (!rows || rows.length === 0) {
        alert("No transactions to export");
        return;
      }

      const headers = [
        "Date",
        "Account",
        "Category",
        "Type",
        "Description",
        "Amount",
      ];
      const csvLines = [headers.map(csvEscape).join(",")];

      rows.forEach((tx) => {
        const date = new Date(tx.date).toISOString().slice(0, 10);
        const accName = accountsById.get(tx.accountId)?.name || "";
        const catName = categoriesById.get(tx.categoryId)?.name || "";
        const isIncome = tx.type === "income";
        let amt = minorToMajor(tx.amountMinor, tx.currency);
        if (!isIncome) amt = -Math.abs(amt);
        const desc = tx.description || "";

        csvLines.push(
          [date, accName, catName, tx.type || "", desc, amt.toString()]
            .map(csvEscape)
            .join(","),
        );
      });

      const csvContent = csvLines.join("\n");
      const blob = new Blob([csvContent], {
        type: "text/csv;charset=utf-8;",
      });

      if (typeof document === "undefined") return;

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `transactions_${new Date()
        .toISOString()
        .slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(err.message || "Failed to download CSV");
    }
  };

  const handleDownloadPdf = async () => {
    try {
      if (!rows || rows.length === 0) {
        alert("No transactions to export");
        return;
      }
      if (typeof window === "undefined" || typeof document === "undefined")
        return;

      let sankeySvgHtml = "";
      try {
        if (sankeyRef.current) {
          const svg = sankeyRef.current.querySelector("svg");
          if (svg) {
            const cloned = svg.cloneNode(true);
            cloned.removeAttribute("width");
            cloned.removeAttribute("height");
            sankeySvgHtml = cloned.outerHTML;
          }
        }
      } catch (e) {
        sankeySvgHtml = "";
      }

      const tableRowsHtml = rows
        .map((tx) => {
          const accName = accountsById.get(tx.accountId)?.name || "—";
          const catName = categoriesById.get(tx.categoryId)?.name || "—";
          const isIncome = tx.type === "income";
          let val = minorToMajor(tx.amountMinor, tx.currency);
          if (!isIncome) val = -Math.abs(val);

          const formattedAmount = new Intl.NumberFormat(undefined, {
            style: "currency",
            currency: tx.currency || "USD",
          }).format(val);

          return `<tr>
<td>${fmtDate(tx.date)}</td>
<td>${accName}</td>
<td>${catName}</td>
<td>${tx.type}</td>
<td>${(tx.description || "").replace(/</g, "&lt;")}</td>
<td style="text-align:right;">${formattedAmount}</td>
</tr>`;
        })
        .join("");

      const sankeyHtml = sankeySvgHtml
        ? `<div style="margin-bottom:16px;">
  <h2 style="font-size:14px; margin:0 0 8px;">Cash-Flow (Sankey) · ${fCurrency}</h2>
  <div style="border:1px solid #e5e7eb; border-radius:4px; padding:4px;">
    ${sankeySvgHtml}
  </div>
</div>`
        : "";

      const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Transactions Report</title>
  <style>
    body { font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; padding: 24px; background:#f5f5f5; }
    h1 { font-size: 18px; margin-bottom: 12px; }
    table { border-collapse: collapse; width: 100%; font-size: 12px; }
    th, td { border: 1px solid #d1d5db; padding: 6px 8px; text-align: left; }
    th { background: #f3f4f6; font-weight: 600; }
    td:last-child, th:last-child { text-align: right; }
    svg { max-width: 100%; height: auto; }
  </style>
</head>
<body>
  <h1>Nummoria – Transactions Report</h1>
  ${sankeyHtml}
  <table>
    <thead>
      <tr>
        <th>Date</th>
        <th>Account</th>
        <th>Category</th>
        <th>Type</th>
        <th>Description</th>
        <th>Amount</th>
      </tr>
    </thead>
    <tbody>
      ${tableRowsHtml}
    </tbody>
  </table>
</body>
</html>`;

      const win = window.open("", "_blank");
      if (!win) {
        alert(
          "Popup blocked. Allow popups for this site to download the PDF (via print dialog).",
        );
        return;
      }
      win.document.open();
      win.document.write(html);
      win.document.close();
      win.focus();
      win.print();
    } catch (err) {
      alert(err.message || "Failed to generate PDF");
    }
  };

  /* ---------- loading ---------- */
  if (!initialDone && loading) {
    return (
      <div className="min-h-[60vh] grid place-items-center bg-[#070A07] px-4">
        <div className="relative w-full max-w-sm">
          <div className="pointer-events-none absolute -inset-10 opacity-40">
            <div className="absolute left-4 top-6 h-40 w-40 rounded-full blur-3xl bg-[#13e243]/20" />
            <div className="absolute right-6 top-10 h-40 w-40 rounded-full blur-3xl bg-[#991746]/20" />
          </div>

          <div className="relative rounded-3xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <img
                src={logoUrl}
                alt="Nummoria logo"
                className="h-9 w-9 rounded-xl"
              />
              <div>
                <div className="text-lg font-semibold text-white">Nummoria</div>
                <div className="text-sm text-white/50">
                  Loading your reports…
                </div>
              </div>
            </div>

            <div className="mt-5 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
              <div className="h-full w-1/3 animate-[reportsload_1.2s_ease-in-out_infinite] bg-white/30" />
            </div>

            <style>{`
              @keyframes reportsload {
                0% { transform: translateX(-120%); }
                100% { transform: translateX(320%); }
              }
            `}</style>
          </div>
        </div>
      </div>
    );
  }

  /* ============================= RENDER ============================= */

  return (
    <div className="min-h-[100dvh] bg-[#070A07] text-white">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[#070A07]" />
        <div className="absolute inset-0 bg-[radial-gradient(1200px_800px_at_15%_0%,rgba(19,226,67,0.10),transparent_55%),radial-gradient(1000px_700px_at_85%_10%,rgba(153,23,70,0.10),transparent_55%),radial-gradient(900px_700px_at_50%_100%,rgba(255,255,255,0.04),transparent_60%)]" />
        <div className="absolute inset-0 opacity-[0.10] mix-blend-overlay bg-[linear-gradient(to_right,rgba(255,255,255,0.10)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.10)_1px,transparent_1px)] bg-[size:56px_56px]" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/35 to-black/70" />
      </div>

      <div className="mx-4 px-4 py-6 sm:px-6 lg:px-8">
        <section className="mb-6">
          <SectionCard className="overflow-visible">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-white/60">
                  <span className="h-2 w-2 rounded-full bg-[#13e243]" />
                  reports center
                </div>

                <div className="mt-4">
                  <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-white">
                    Reports
                  </h1>
                  <p className="mt-2 max-w-2xl text-sm md:text-base text-white/60">
                    Analyze transactions, filter cash flow, export records, and
                    visualize how income moves through spending categories.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                <button
                  type="button"
                  onClick={() => setShowFilters((v) => !v)}
                  className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white/80 transition hover:bg-white/[0.07]"
                  title="Show filters"
                >
                  <svg
                    className="h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <line x1="4" y1="21" x2="4" y2="14" />
                    <line x1="4" y1="10" x2="4" y2="3" />
                    <line x1="12" y1="21" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12" y2="3" />
                    <line x1="20" y1="21" x2="20" y2="16" />
                    <line x1="20" y1="12" x2="20" y2="3" />
                    <line x1="1" y1="14" x2="7" y2="14" />
                    <line x1="9" y1="8" x2="15" y2="8" />
                    <line x1="17" y1="16" x2="23" y2="16" />
                  </svg>
                  <span>Filters</span>
                </button>

                <button
                  type="button"
                  onClick={loadAll}
                  className="inline-flex items-center rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white/70 transition hover:bg-white/[0.07] hover:text-white"
                  title="Refresh"
                >
                  Refresh
                </button>

                <button
                  type="button"
                  onClick={handleImportCsv}
                  className="inline-flex items-center rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-semibold text-white/80 transition hover:bg-white/[0.07]"
                >
                  Import CSV
                </button>

                <button
                  type="button"
                  onClick={handleImportPdf}
                  className="inline-flex items-center rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-semibold text-white/80 transition hover:bg-white/[0.07]"
                >
                  Import PDF
                </button>

                <button
                  type="button"
                  onClick={handleDownloadCsv}
                  className="inline-flex items-center rounded-2xl px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-95"
                  style={{
                    background: "linear-gradient(135deg, #90a955, #4f772d)",
                  }}
                >
                  Download CSV
                </button>

                <button
                  type="button"
                  onClick={handleDownloadPdf}
                  className="inline-flex items-center rounded-2xl px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-95"
                  style={{
                    background: "linear-gradient(135deg, #991746, #7d1238)",
                  }}
                >
                  Download PDF
                </button>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <Chip
                label={`All (${transactions.length})`}
                selected={fType === "ALL"}
                onClick={() => setFType("ALL")}
              />
              <Chip
                label={`Income (${typeCounts.income})`}
                selected={fType === "income"}
                onClick={() => setFType("income")}
              />
              <Chip
                label={`Expenses (${typeCounts.expense})`}
                selected={fType === "expense"}
                onClick={() => setFType("expense")}
              />
              <Chip
                label={`Investments (${typeCounts.investment})`}
                selected={fType === "investment"}
                onClick={() => setFType("investment")}
              />
            </div>

            {showFilters && (
              <div className="mt-5 grid grid-cols-1 gap-3 rounded-3xl border border-white/10 bg-black/20 p-4 md:grid-cols-2 xl:grid-cols-4">
                <Field label="From">
                  <input
                    type="date"
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-white outline-none"
                    value={fStart}
                    onChange={(e) => setFStart(e.target.value)}
                  />
                </Field>

                <Field label="To">
                  <input
                    type="date"
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-white outline-none"
                    value={fEnd}
                    onChange={(e) => setFEnd(e.target.value)}
                  />
                </Field>

                <Field label="Account">
                  <select
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-white outline-none"
                    value={fAccountId}
                    onChange={(e) => setFAccountId(e.target.value)}
                  >
                    <option value="ALL" className="text-black">
                      All accounts
                    </option>
                    {accounts.map((a) => (
                      <option key={a._id} value={a._id} className="text-black">
                        {a.name}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Category">
                  <select
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-white outline-none"
                    value={fCategoryId}
                    onChange={(e) => setFCategoryId(e.target.value)}
                  >
                    <option value="ALL" className="text-black">
                      All categories
                    </option>
                    {categories.map((c) => (
                      <option key={c._id} value={c._id} className="text-black">
                        {c.name}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Currency">
                  <select
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-white outline-none"
                    value={fCurrency}
                    onChange={(e) => setFCurrency(e.target.value)}
                  >
                    {currencies.map((c) => (
                      <option key={c} value={c} className="text-black">
                        {c}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Min amount">
                  <input
                    type="number"
                    placeholder="e.g. 50"
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-white placeholder:text-white/30 outline-none"
                    value={fMin}
                    onChange={(e) => setFMin(e.target.value)}
                  />
                </Field>

                <Field label="Max amount">
                  <input
                    type="number"
                    placeholder="e.g. 1000"
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-white placeholder:text-white/30 outline-none"
                    value={fMax}
                    onChange={(e) => setFMax(e.target.value)}
                  />
                </Field>

                <div className="flex items-end">
                  <button
                    type="button"
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/75 transition hover:bg-white/[0.07]"
                    onClick={resetFilters}
                  >
                    Reset filters
                  </button>
                </div>
              </div>
            )}

            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <MetricCard label="Visible Rows" value={String(rows.length)} />
              <MetricCard
                label="This Income"
                value={fmtMoneyUI(reportKpis.thisIncome, fCurrency)}
                tone="positive"
              />
              <MetricCard
                label="This Expense"
                value={fmtMoneyUI(reportKpis.thisExpense, fCurrency)}
                tone="negative"
              />
              <MetricCard
                label="This Investment"
                value={fmtMoneyUI(reportKpis.thisInvestment, fCurrency)}
              />
              <MetricCard
                label="This Net"
                value={fmtMoneyUI(reportKpis.thisNet, fCurrency)}
                tone={reportKpis.thisNet >= 0 ? "positive" : "negative"}
              />
            </div>
          </SectionCard>
        </section>

        {err ? (
          <div className="mb-6 rounded-2xl border border-red-400/20 bg-red-400/10 p-4 text-red-100">
            {err}
          </div>
        ) : null}

        <TotalsCard totals={totalsByCurrency} />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="space-y-6 min-w-0">
            <SectionCard
              title={`Cash-Flow (Sankey) · ${fCurrency}`}
              subtitle="Visual breakdown of current filtered income into top expense categories."
            >
              <div ref={sankeyRef} className="h-[420px] min-w-0">
                {!sankeyData ? (
                  <div className="flex h-full items-center justify-center rounded-2xl border border-white/8 bg-black/20 text-sm text-white/50">
                    Not enough data to display cash-flow for {fCurrency}.
                  </div>
                ) : (
                  <ResponsiveSankey
                    data={sankeyData}
                    margin={{ top: 20, right: 180, bottom: 20, left: 40 }}
                    align="justify"
                    colors={{ scheme: "paired" }}
                    theme={{
                      text: {
                        fill: "rgba(255,255,255,0.72)",
                        fontSize: 12,
                      },
                      tooltip: {
                        container: {
                          background: "#0b0f0b",
                          color: "#ffffff",
                          fontSize: 12,
                          borderRadius: 12,
                          border: "1px solid rgba(255,255,255,0.08)",
                        },
                      },
                    }}
                    nodeOpacity={1}
                    nodeThickness={12}
                    nodeInnerPadding={2}
                    nodeSpacing={16}
                    nodeBorderWidth={1}
                    nodeBorderColor={{
                      from: "color",
                      modifiers: [["darker", 0.2]],
                    }}
                    nodeBorderRadius={0}
                    linkOpacity={0.45}
                    linkBlendMode="multiply"
                    enableLinkGradient
                    labelPosition="outside"
                    labelOrientation="horizontal"
                    labelPadding={8}
                    labelTextColor={{
                      from: "color",
                      modifiers: [["darker", 1.2]],
                    }}
                    animate
                    motionConfig="gentle"
                  />
                )}
              </div>
            </SectionCard>

            <SectionCard
              title="All Transactions"
              subtitle={`${rows.length} visible transaction${rows.length === 1 ? "" : "s"} after current filters.`}
              right={
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] text-white/60">
                  {fCurrency}
                </span>
              }
            >
              {rows.length === 0 ? (
                <div className="rounded-2xl border border-white/8 bg-black/20 p-10 text-center text-white/55">
                  No transactions found.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-white/8 bg-black/20">
                  <table className="min-w-full border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-white/8 bg-white/[0.03] text-left">
                        <th className="px-4 py-3 font-medium text-white/70">
                          Date
                        </th>
                        <th className="px-4 py-3 font-medium text-white/70">
                          Account
                        </th>
                        <th className="px-4 py-3 font-medium text-white/70">
                          Category
                        </th>
                        <th className="px-4 py-3 font-medium text-white/70">
                          Type
                        </th>
                        <th className="px-4 py-3 font-medium text-white/70">
                          Description
                        </th>
                        <th className="px-4 py-3 text-right font-medium text-white/70">
                          Amount
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((tx, idx) => {
                        const accName =
                          accountsById.get(tx.accountId)?.name || "—";
                        const catName =
                          categoriesById.get(tx.categoryId)?.name || "—";
                        const isIncome = tx.type === "income";
                        let val = minorToMajor(tx.amountMinor, tx.currency);
                        if (!isIncome) val = -Math.abs(val);

                        return (
                          <tr
                            key={tx._id}
                            className={`border-t border-white/8 ${
                              idx % 2 === 1
                                ? "bg-white/[0.02]"
                                : "bg-transparent"
                            }`}
                          >
                            <td className="px-4 py-3 text-white/78">
                              {fmtDate(tx.date)}
                            </td>
                            <td className="px-4 py-3 text-white/72">
                              {accName}
                            </td>
                            <td className="px-4 py-3 text-white/72">
                              {catName}
                            </td>
                            <td className="px-4 py-3">
                              <span className="inline-flex rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs text-white/65">
                                {tx.type}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-white/60">
                              {tx.description || ""}
                            </td>
                            <td
                              className={`px-4 py-3 text-right font-medium ${
                                val >= 0 ? "text-[#dce8bf]" : "text-red-200"
                              }`}
                            >
                              {new Intl.NumberFormat(undefined, {
                                style: "currency",
                                currency: tx.currency || "USD",
                              }).format(val)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </SectionCard>
          </div>

          <aside className="space-y-6 lg:sticky lg:top-20 h-max min-w-0">
            <SectionCard title="Export Notes">
              <div className="space-y-3 text-sm text-white/60">
                <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
                  CSV export downloads the currently filtered transaction set.
                </div>
                <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
                  PDF export includes the visible table and the rendered sankey
                  chart when available.
                </div>
                <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
                  Imports will refresh the report view immediately after a
                  successful ingest.
                </div>
              </div>
            </SectionCard>

            <SectionCard title="Current Filter State">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between gap-3 text-white/60">
                  <span>Type</span>
                  <span className="text-white">{fType}</span>
                </div>
                <div className="flex justify-between gap-3 text-white/60">
                  <span>Account</span>
                  <span className="text-white">
                    {fAccountId === "ALL"
                      ? "All"
                      : accountsById.get(fAccountId)?.name || "—"}
                  </span>
                </div>
                <div className="flex justify-between gap-3 text-white/60">
                  <span>Category</span>
                  <span className="text-white">
                    {fCategoryId === "ALL"
                      ? "All"
                      : categoriesById.get(fCategoryId)?.name || "—"}
                  </span>
                </div>
                <div className="flex justify-between gap-3 text-white/60">
                  <span>Currency</span>
                  <span className="text-white">{fCurrency}</span>
                </div>
                <div className="flex justify-between gap-3 text-white/60">
                  <span>From</span>
                  <span className="text-white">{fStart || "—"}</span>
                </div>
                <div className="flex justify-between gap-3 text-white/60">
                  <span>To</span>
                  <span className="text-white">{fEnd || "—"}</span>
                </div>
                <div className="flex justify-between gap-3 text-white/60">
                  <span>Min</span>
                  <span className="text-white">{fMin || "—"}</span>
                </div>
                <div className="flex justify-between gap-3 text-white/60">
                  <span>Max</span>
                  <span className="text-white">{fMax || "—"}</span>
                </div>
              </div>
            </SectionCard>
          </aside>
        </div>
      </div>
    </div>
  );
}
