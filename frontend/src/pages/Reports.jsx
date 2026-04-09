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

/* ─────────────────────────────────────────────────────────────
   CONSTANTS & THEME
───────────────────────────────────────────────────────────── */
const BG = "#030508";
const MINT = "#00ff87";
const CYAN = "#00d4ff";
const VIOLET = "#a78bfa";
const DATE_LANG = "en-US";

/* =========================== Money helpers =========================== */

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
  new Intl.NumberFormat(DATE_LANG, {
    style: "currency",
    currency: cur || "USD",
    maximumFractionDigits: decimalsForCurrency(cur || "USD"),
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

function Field({ label, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-bold tracking-wider text-white/80 uppercase">
        {label}
      </label>
      {children}
    </div>
  );
}

function Chip({ label, selected, onClick, accent = CYAN }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 border px-3 py-1 transition-colors flex-shrink-0 ${
        selected
          ? "bg-black/40 text-white"
          : "bg-white/[0.02] border-white/10 text-white/70 hover:bg-white/[0.05] hover:text-white"
      }`}
      style={{ borderColor: selected ? `${accent}88` : undefined }}
    >
      {selected && (
        <span
          className="w-1.5 h-1.5 rounded-full"
          style={{ backgroundColor: accent }}
        />
      )}
      <span className="text-xs font-bold tracking-wider uppercase">
        {label}
      </span>
    </button>
  );
}

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
      bg: "rgba(167,139,250,0.02)",
      bd: "rgba(167,139,250,0.2)",
    },
    cyan: {
      col: CYAN,
      bg: "rgba(0,212,255,0.02)",
      bd: "rgba(0,212,255,0.2)",
    },
    mint: {
      col: MINT,
      bg: "rgba(0,255,135,0.02)",
      bd: "rgba(0,255,135,0.2)",
    },
  }[accent] || {
    col: VIOLET,
    bg: "rgba(167,139,250,0.02)",
    bd: "rgba(167,139,250,0.2)",
  };

  return (
    <div
      className={`relative border p-4 md:p-5 flex flex-col h-full ${className}`}
      style={{ backgroundColor: AC.bg, borderColor: AC.bd }}
    >
      <Brackets color={AC.col} size="10px" thick="1.5px" />
      <div
        className="absolute top-0 inset-x-[15%] h-[1px] opacity-40"
        style={{ backgroundColor: AC.col }}
      />
      {(title || right) && (
        <div className="mb-4 flex items-start justify-between gap-4">
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
      <div className="flex-1 min-h-0">{children}</div>
    </div>
  );
}

function MetricCard({ label, value, tone = "neutral", accent = "cyan" }) {
  const color = {
    positive: MINT,
    negative: "#f87171",
    neutral: { violet: VIOLET, cyan: CYAN, mint: MINT }[accent] || CYAN,
  }[tone];

  return (
    <div className="border border-white/10 bg-black/40 p-4 relative overflow-hidden h-full flex flex-col justify-center">
      <Brackets color={color} size="6px" thick="1px" />
      <div className="text-[10px] font-bold uppercase tracking-wider text-white/70 mb-1">
        {label}
      </div>
      <div
        className="text-lg md:text-xl font-extrabold tracking-tight truncate"
        style={{ color }}
        title={value}
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
      subtitle="Summarized from the currently filtered transaction set"
      accent="cyan"
      className="mb-5"
    >
      {totals.length === 0 ? (
        <div className="border border-white/10 bg-black/20 p-6 text-sm text-white/55">
          No transactions match these filters.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {totals.map((t) => {
            const netUp = t.netMinor >= 0;
            return (
              <div
                key={t.currency}
                className="border border-white/10 bg-black/20 p-4 relative"
              >
                <Brackets
                  color={netUp ? MINT : "#f87171"}
                  size="6px"
                  thick="1px"
                />

                <div className="mb-3 flex items-center justify-between">
                  <div className="text-sm font-extrabold tracking-wider text-white uppercase">
                    {t.currency}
                  </div>
                  <span className="border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] text-white/60 uppercase tracking-wider">
                    Currency
                  </span>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between gap-3 text-white/65">
                    <span>Income</span>
                    <span className="font-mono font-bold text-white">
                      {fmtMoneyUI(t.incomeMinor, t.currency)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3 text-white/65">
                    <span>Outflow</span>
                    <span className="font-mono font-bold text-white">
                      {fmtMoneyUI(t.outMinor, t.currency)}
                    </span>
                  </div>
                  <div className="h-px bg-white/8" />
                  <div
                    className={`flex items-center justify-between gap-3 font-extrabold ${
                      netUp ? "text-[#00ff87]" : "text-red-300"
                    }`}
                  >
                    <span>Net</span>
                    <span className="font-mono">
                      {fmtMoneyUI(t.netMinor, t.currency)}
                    </span>
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
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [accounts, setAccounts] = useState([]);

  const [loading, setLoading] = useState(true);
  const [initialDone, setInitialDone] = useState(false);
  const [err, setErr] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const [fStart, setFStart] = useState("");
  const [fEnd, setFEnd] = useState("");
  const [fType, setFType] = useState("ALL");
  const [fAccountId, setFAccountId] = useState("ALL");
  const [fCategoryId, setFCategoryId] = useState("ALL");
  const [fCurrency, setFCurrency] = useState("USD");
  const [fMin, setFMin] = useState("");
  const [fMax, setFMax] = useState("");

  const sankeyRef = useRef(null);

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
      nodes.push({ id: "Savings" });
      links.push({
        source: "Income",
        target: "Savings",
        value: minorToMajor(net, cur),
      });
    }

    return { nodes, links };
  }, [rows, fCurrency, categoriesById]);

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

          const formattedAmount = new Intl.NumberFormat(DATE_LANG, {
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

  if (!initialDone && loading) {
    return (
      <div className="min-h-dvh grid place-items-center bg-[#030508] px-4">
        <div className="flex flex-col items-center">
          <Brackets color={VIOLET} size="20px" thick="2px" />
          <div className="w-16 h-16 border border-[#a78bfa]/30 flex items-center justify-center mb-4 bg-[#a78bfa]/10">
            <div className="w-8 h-8 rounded-full border-t-2 border-[#a78bfa] animate-spin" />
          </div>
          <div className="text-[11px] font-extrabold tracking-[0.3em] text-white/90 uppercase">
            Loading Reports...
          </div>
        </div>
      </div>
    );
  }

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

      <div className="mx-auto max-w-screen-2xl w-full px-4 sm:px-6 lg:px-8 py-6 flex flex-col gap-5">
        <div className="relative border border-[#a78bfa]/20 bg-[#a78bfa]/[0.03] p-5 md:p-6 overflow-hidden">
          <Brackets color={VIOLET} size="12px" thick="1.5px" />
          <div
            className="absolute top-0 inset-x-[10%] h-[1px] opacity-40"
            style={{ backgroundColor: VIOLET }}
          />

          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 border border-white/10 bg-black/40 px-3 py-1 mb-4">
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: MINT }}
                />
                <span className="text-[11px] font-extrabold tracking-wider text-white/80 uppercase">
                  Reports Center
                </span>
              </div>

              <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-white leading-none">
                Reports
              </h1>

              <p className="mt-3 max-w-2xl text-base text-white/80 leading-relaxed">
                Analyze transactions, filter cash flow, export records, and
                visualize how income moves through spending categories.
              </p>

              <ScanLine color={VIOLET} className="mt-6 w-full max-w-md" />
            </div>

            <div className="flex flex-wrap items-center gap-3 lg:justify-end">
              <button
                type="button"
                onClick={() => setShowFilters((v) => !v)}
                className="inline-flex items-center gap-2 border border-white/10 bg-black/40 px-4 py-2 hover:bg-white/5 transition-colors"
              >
                <span className="text-xs font-bold tracking-wider text-white/90 uppercase">
                  Filters
                </span>
              </button>

              <button
                type="button"
                onClick={loadAll}
                className="inline-flex items-center border border-white/10 bg-black/40 px-4 py-2 hover:bg-white/5 transition-colors"
              >
                <span className="text-xs font-bold tracking-wider text-white/80 uppercase">
                  Refresh
                </span>
              </button>

              <button
                type="button"
                onClick={handleImportCsv}
                className="inline-flex items-center gap-2 border border-[#00d4ff]/30 bg-black/40 px-4 py-2 hover:bg-white/5 transition-colors"
              >
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: CYAN }}
                />
                <span className="text-xs font-bold tracking-wider text-[#00d4ff] uppercase">
                  Import CSV
                </span>
              </button>

              <button
                type="button"
                onClick={handleImportPdf}
                className="inline-flex items-center gap-2 border border-[#00d4ff]/30 bg-black/40 px-4 py-2 hover:bg-white/5 transition-colors"
              >
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: CYAN }}
                />
                <span className="text-xs font-bold tracking-wider text-[#00d4ff] uppercase">
                  Import PDF
                </span>
              </button>

              <button
                type="button"
                onClick={handleDownloadCsv}
                className="inline-flex items-center px-4 py-2 hover:opacity-80 transition-opacity"
                style={{ backgroundColor: MINT }}
              >
                <span className="text-xs font-extrabold tracking-wider text-[#030508] uppercase">
                  Download CSV
                </span>
              </button>

              <button
                type="button"
                onClick={handleDownloadPdf}
                className="inline-flex items-center px-4 py-2 hover:opacity-80 transition-opacity"
                style={{ backgroundColor: VIOLET }}
              >
                <span className="text-xs font-extrabold tracking-wider text-[#030508] uppercase">
                  Download PDF
                </span>
              </button>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <Chip
              label={`All (${transactions.length})`}
              selected={fType === "ALL"}
              onClick={() => setFType("ALL")}
              accent={CYAN}
            />
            <Chip
              label={`Income (${typeCounts.income})`}
              selected={fType === "income"}
              onClick={() => setFType("income")}
              accent={MINT}
            />
            <Chip
              label={`Expenses (${typeCounts.expense})`}
              selected={fType === "expense"}
              onClick={() => setFType("expense")}
              accent={VIOLET}
            />
            <Chip
              label={`Investments (${typeCounts.investment})`}
              selected={fType === "investment"}
              onClick={() => setFType("investment")}
              accent={CYAN}
            />
          </div>

          {showFilters && (
            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 border border-white/10 bg-black/40 p-5">
              <Field label="From">
                <input
                  type="date"
                  className="w-full border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-bold tracking-wider text-white outline-none uppercase"
                  value={fStart}
                  onChange={(e) => setFStart(e.target.value)}
                />
              </Field>

              <Field label="To">
                <input
                  type="date"
                  className="w-full border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-bold tracking-wider text-white outline-none uppercase"
                  value={fEnd}
                  onChange={(e) => setFEnd(e.target.value)}
                />
              </Field>

              <Field label="Account">
                <select
                  className="w-full border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-bold tracking-wider text-white outline-none uppercase"
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
                  className="w-full border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-bold tracking-wider text-white outline-none uppercase"
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
                  className="w-full border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-bold tracking-wider text-white outline-none uppercase"
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

              <Field label="Min Amount">
                <input
                  type="number"
                  placeholder="e.g. 50"
                  className="w-full border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-bold tracking-wider text-white placeholder:text-white/50 outline-none uppercase"
                  value={fMin}
                  onChange={(e) => setFMin(e.target.value)}
                />
              </Field>

              <Field label="Max Amount">
                <input
                  type="number"
                  placeholder="e.g. 1000"
                  className="w-full border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-bold tracking-wider text-white placeholder:text-white/50 outline-none uppercase"
                  value={fMax}
                  onChange={(e) => setFMax(e.target.value)}
                />
              </Field>

              <div className="flex items-end">
                <button
                  type="button"
                  className="w-full border border-white/10 bg-white/[0.03] px-4 py-2 text-[11px] font-bold tracking-wider text-white/80 hover:bg-white/5 uppercase"
                  onClick={resetFilters}
                >
                  Reset filters
                </button>
              </div>
            </div>
          )}

          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <MetricCard
              label="Visible Rows"
              value={String(rows.length)}
              accent="cyan"
            />
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
              accent="violet"
            />
            <MetricCard
              label="This Net"
              value={fmtMoneyUI(reportKpis.thisNet, fCurrency)}
              tone={reportKpis.thisNet >= 0 ? "positive" : "negative"}
            />
          </div>
        </div>

        {err && (
          <div className="flex gap-3 border border-red-400/30 bg-red-400/10 p-4">
            <div className="font-bold text-red-300">[!]</div>
            <div className="text-sm text-red-100">{err}</div>
          </div>
        )}

        <TotalsCard totals={totalsByCurrency} />

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px] gap-5 items-start">
          <div className="space-y-5 min-w-0">
            <SectionCard
              title={`Cash-Flow (Sankey) · ${fCurrency}`}
              subtitle="Visual breakdown of current filtered income into top expense categories"
              accent="violet"
            >
              <div
                ref={sankeyRef}
                className="h-[520px] min-w-0 border border-white/10 bg-[#05070b] relative overflow-hidden"
              >
                <div className="absolute inset-0 opacity-[0.08] pointer-events-none bg-[linear-gradient(to_right,rgba(255,255,255,0.10)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.10)_1px,transparent_1px)] bg-[size:28px_28px]" />
                {!sankeyData ? (
                  <div className="flex h-full items-center justify-center text-sm text-white/50 uppercase tracking-wider relative z-10">
                    Not enough data to display cash-flow for {fCurrency}.
                  </div>
                ) : (
                  <div className="absolute inset-0 z-10">
                    <ResponsiveSankey
                      data={sankeyData}
                      margin={{ top: 30, right: 220, bottom: 30, left: 80 }}
                      align="justify"
                      colors={({ id }) => {
                        if (id === "Income") return "#b9e6ff";
                        if (id === "Savings") return "#fca5a5";
                        if (id === "Rent") return "#38bdf8";
                        if (id === "Travel") return "#a3e635";
                        if (id === "Other") return "#c084fc";
                        return "#22c55e";
                      }}
                      theme={{
                        background: "transparent",
                        text: {
                          fill: "rgba(255,255,255,0.92)",
                          fontSize: 14,
                          fontWeight: 700,
                        },
                        tooltip: {
                          container: {
                            background: "#0b0f0b",
                            color: "#ffffff",
                            fontSize: 12,
                            borderRadius: 12,
                            border: "1px solid rgba(255,255,255,0.10)",
                            boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
                          },
                        },
                      }}
                      nodeOpacity={1}
                      nodeThickness={18}
                      nodeInnerPadding={6}
                      nodeSpacing={18}
                      nodeBorderWidth={1}
                      nodeBorderColor={{
                        from: "color",
                        modifiers: [["brighter", 0.3]],
                      }}
                      nodeBorderRadius={0}
                      linkOpacity={0.85}
                      linkHoverOpacity={0.95}
                      linkContract={2}
                      linkBlendMode="normal"
                      enableLinkGradient
                      labelPosition="outside"
                      labelOrientation="horizontal"
                      labelPadding={14}
                      labelTextColor={{ from: "color", modifiers: [] }}
                      animate
                      motionConfig="gentle"
                    />
                  </div>
                )}
              </div>
            </SectionCard>

            <SectionCard
              title="All Transactions"
              subtitle={`${rows.length} visible transaction${rows.length === 1 ? "" : "s"} after current filters`}
              right={
                <span className="border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] text-white/60 uppercase tracking-wider">
                  {fCurrency}
                </span>
              }
              accent="mint"
            >
              {rows.length === 0 ? (
                <div className="py-12 text-center text-xs tracking-wider text-white/70 uppercase">
                  No transactions found.
                </div>
              ) : (
                <div className="overflow-x-auto border border-white/10 bg-black/20 custom-scrollbar">
                  <table className="min-w-full border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-white/8 bg-white/[0.03] text-left">
                        <th className="px-4 py-3 text-[11px] font-bold tracking-wider text-white/70 uppercase">
                          Date
                        </th>
                        <th className="px-4 py-3 text-[11px] font-bold tracking-wider text-white/70 uppercase">
                          Account
                        </th>
                        <th className="px-4 py-3 text-[11px] font-bold tracking-wider text-white/70 uppercase">
                          Category
                        </th>
                        <th className="px-4 py-3 text-[11px] font-bold tracking-wider text-white/70 uppercase">
                          Type
                        </th>
                        <th className="px-4 py-3 text-[11px] font-bold tracking-wider text-white/70 uppercase">
                          Description
                        </th>
                        <th className="px-4 py-3 text-right text-[11px] font-bold tracking-wider text-white/70 uppercase">
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
                            <td className="px-4 py-3 text-white/78 font-mono">
                              {fmtDate(tx.date)}
                            </td>
                            <td className="px-4 py-3 text-white/72">
                              {accName}
                            </td>
                            <td className="px-4 py-3 text-white/72">
                              {catName}
                            </td>
                            <td className="px-4 py-3">
                              <span className="inline-flex border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] text-white/65 uppercase tracking-wider">
                                {tx.type}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-white/60">
                              {tx.description || ""}
                            </td>
                            <td
                              className={`px-4 py-3 text-right font-mono font-bold ${
                                val >= 0 ? "text-[#00ff87]" : "text-red-300"
                              }`}
                            >
                              {new Intl.NumberFormat(DATE_LANG, {
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

          <aside className="space-y-5 lg:sticky lg:top-6 h-max min-w-0">
            <SectionCard title="Export Notes" accent="cyan">
              <div className="space-y-3 text-sm text-white/60">
                <div className="border border-white/8 bg-black/20 p-4">
                  CSV export downloads the currently filtered transaction set.
                </div>
                <div className="border border-white/8 bg-black/20 p-4">
                  PDF export includes the visible table and the rendered sankey
                  chart when available.
                </div>
                <div className="border border-white/8 bg-black/20 p-4">
                  Imports will refresh the report view immediately after a
                  successful ingest.
                </div>
              </div>
            </SectionCard>

            <SectionCard title="Current Filter State" accent="violet">
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
