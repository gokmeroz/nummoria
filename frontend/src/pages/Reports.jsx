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

/* =========================== Money helpers =========================== */

const DATE_LANG = "en-US";

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

export default function Reports() {
  /* ---------- data ---------- */
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [accounts, setAccounts] = useState([]);

  /* ---------- UI state ---------- */
  const [loading, setLoading] = useState(true);
  const [initialDone, setInitialDone] = useState(false);
  const [err, setErr] = useState("");

  /* filters */
  const [fStart, setFStart] = useState("");
  const [fEnd, setFEnd] = useState("");
  const [fType, setFType] = useState("ALL");
  const [fAccountId, setFAccountId] = useState("ALL");
  const [fCategoryId, setFCategoryId] = useState("ALL");
  const [fCurrency, setFCurrency] = useState("USD");
  const [fMin, setFMin] = useState("");
  const [fMax, setFMax] = useState("");

  // ref for Sankey chart (for PDF export)
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
        e?.response?.data?.error || e.message || "Failed to load reports data"
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
    const catMap = new Map(); // name -> minor

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
          // eslint-disable-next-line no-alert
          alert(response.data.message || "CSV imported successfully");
          await loadAll();
        } catch (err) {
          // eslint-disable-next-line no-alert
          alert(
            err?.response?.data?.error || err.message || "Failed to import CSV"
          );
        } finally {
          setLoading(false);
        }
      };

      input.addEventListener("change", handleChange);
      document.body.appendChild(input);
      input.click();
    } catch (err) {
      // eslint-disable-next-line no-alert
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
          // eslint-disable-next-line no-alert
          alert(response.data.message || "PDF imported successfully");
          await loadAll();
        } catch (err) {
          // eslint-disable-next-line no-alert
          alert(
            err?.response?.data?.error || err.message || "Failed to import PDF"
          );
        } finally {
          setLoading(false);
        }
      };

      input.addEventListener("change", handleChange);
      document.body.appendChild(input);
      input.click();
    } catch (err) {
      // eslint-disable-next-line no-alert
      alert(err.message || "Failed to open file picker");
    }
  };

  // CSV EXPORT – web-only, creates a download in browser
  const handleDownloadCsv = async () => {
    try {
      if (!rows || rows.length === 0) {
        // eslint-disable-next-line no-alert
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
            .join(",")
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
      // eslint-disable-next-line no-alert
      alert(err.message || "Failed to download CSV");
    }
  };

  const handleDownloadPdf = async () => {
    try {
      if (!rows || rows.length === 0) {
        // eslint-disable-next-line no-alert
        alert("No transactions to export");
        return;
      }
      if (typeof window === "undefined" || typeof document === "undefined")
        return;

      // Grab the rendered Sankey SVG directly
      let sankeySvgHtml = "";
      try {
        if (sankeyRef.current) {
          const svg = sankeyRef.current.querySelector("svg");
          if (svg) {
            // clone to avoid live DOM mutations
            const cloned = svg.cloneNode(true);
            // Make sure it scales nicely in print
            cloned.removeAttribute("width");
            cloned.removeAttribute("height");
            sankeySvgHtml = cloned.outerHTML;
          }
        }
      } catch (e) {
        // fail softly; still generate table-only PDF
        sankeySvgHtml = "";
        // optional: console.error(e);
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
        // eslint-disable-next-line no-alert
        alert(
          "Popup blocked. Allow popups for this site to download the PDF (via print dialog)."
        );
        return;
      }
      win.document.open();
      win.document.write(html);
      win.document.close();
      win.focus();
      win.print();
    } catch (err) {
      // eslint-disable-next-line no-alert
      alert(err.message || "Failed to generate PDF");
    }
  };

  /* ---------- loading ---------- */
  if (!initialDone && loading) {
    return (
      <div className="min-h-[calc(100vh-80px)] flex items-center justify-center bg-[#f5f5f5]">
        <div className="text-center bg-white border border-gray-200 px-8 py-6 rounded-xl shadow">
          <div className="mx-auto mb-3 h-6 w-6 rounded-full border-2 border-gray-200 border-t-[#16a34a] animate-spin" />
          <div className="flex items-center justify-center gap-2 text-sm">
            <span>🪙</span>
            <span className="font-semibold text-[#16a34a]">Nummoria</span>
          </div>
          <p className="mt-1 text-xs text-gray-500">Loading your reports…</p>
        </div>
      </div>
    );
  }

  /* ============================= RENDER ============================= */

  return (
    <div className="min-h-screen bg-[#f5f5f5] text-[#111827] px-6 py-4">
      {/* FILTER BAR */}
      <div className="flex flex-wrap items-center gap-2 rounded border border-gray-300 bg-white px-2.5 py-2 mb-1.5">
        <button
          type="button"
          className="whitespace-nowrap rounded border border-gray-400 bg-gray-50 px-3 py-1 text-xs hover:bg-gray-200"
          onClick={resetFilters}
        >
          Reset filters
        </button>

        <input
          type="date"
          className="h-[30px] min-w-[120px] rounded border border-gray-300 bg-white px-2 text-xs text-gray-900 focus:outline-none focus:ring-1 focus:ring-[#16a34a]"
          value={fStart}
          onChange={(e) => setFStart(e.target.value)}
        />
        <input
          type="date"
          className="h-[30px] min-w-[120px] rounded border border-gray-300 bg-white px-2 text-xs text-gray-900 focus:outline-none focus:ring-1 focus:ring-[#16a34a]"
          value={fEnd}
          onChange={(e) => setFEnd(e.target.value)}
        />

        <select
          className="h-[30px] min-w-[120px] rounded border border-gray-300 bg-white px-2 text-xs text-gray-900 focus:outline-none focus:ring-1 focus:ring-[#16a34a]"
          value={fType}
          onChange={(e) => setFType(e.target.value)}
        >
          <option value="ALL">All types</option>
          <option value="income">Income</option>
          <option value="expense">Expense</option>
          <option value="investment">Investment</option>
        </select>

        <select
          className="h-[30px] min-w-[120px] rounded border border-gray-300 bg-white px-2 text-xs text-gray-900 focus:outline-none focus:ring-1 focus:ring-[#16a34a]"
          value={fAccountId}
          onChange={(e) => setFAccountId(e.target.value)}
        >
          <option value="ALL">All accounts</option>
          {accounts.map((a) => (
            <option key={a._id} value={a._id}>
              {a.name}
            </option>
          ))}
        </select>

        <select
          className="h-[30px] min-w-[120px] rounded border border-gray-300 bg-white px-2 text-xs text-gray-900 focus:outline-none focus:ring-1 focus:ring-[#16a34a]"
          value={fCategoryId}
          onChange={(e) => setFCategoryId(e.target.value)}
        >
          <option value="ALL">All categories</option>
          {categories.map((c) => (
            <option key={c._id} value={c._id}>
              {c.name}
            </option>
          ))}
        </select>

        <select
          className="h-[30px] min-w-[80px] rounded border border-gray-300 bg-white px-2 text-xs text-gray-900 focus:outline-none focus:ring-1 focus:ring-[#16a34a]"
          value={fCurrency}
          onChange={(e) => setFCurrency(e.target.value)}
        >
          {currencies.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <input
          type="number"
          className="h-[30px] min-w-[120px] rounded border border-gray-300 bg-white px-2 text-xs text-gray-900 focus:outline-none focus:ring-1 focus:ring-[#16a34a]"
          placeholder="Min amount"
          value={fMin}
          onChange={(e) => setFMin(e.target.value)}
        />
        <input
          type="number"
          className="h-[30px] min-w-[120px] rounded border border-gray-300 bg-white px-2 text-xs text-gray-900 focus:outline-none focus:ring-1 focus:ring-[#16a34a]"
          placeholder="Max amount"
          value={fMax}
          onChange={(e) => setFMax(e.target.value)}
        />
      </div>

      {/* IMPORT / EXPORT ROW */}
      <div className="mb-2.5 mt-1.5 flex gap-2">
        <button
          type="button"
          className="whitespace-nowrap rounded-full border border-gray-400 bg-gray-50 px-3 py-1 text-xs text-gray-700 hover:bg-gray-200"
          onClick={handleImportCsv}
        >
          Import CSV
        </button>
        <button
          type="button"
          className="whitespace-nowrap rounded-full border border-gray-400 bg-gray-50 px-3 py-1 text-xs text-gray-700 hover:bg-gray-200"
          onClick={handleImportPdf}
        >
          Import PDF
        </button>
        <button
          type="button"
          className="whitespace-nowrap rounded-full border border-[#16a34a] bg-[#16a34a] px-3 py-1 text-xs font-semibold text-[#022c22] hover:bg-[#15803d] hover:border-[#15803d]"
          onClick={handleDownloadCsv}
        >
          Download CSV
        </button>
        <button
          type="button"
          className="whitespace-nowrap rounded-full border border-[#16a34a] bg-[#16a34a] px-3 py-1 text-xs font-semibold text-[#022c22] hover:bg-[#15803d] hover:border-[#15803d]"
          onClick={handleDownloadPdf}
        >
          Download PDF
        </button>
      </div>

      {err && (
        <div className="mt-2 mb-2 rounded border border-red-900 bg-red-900/5 px-2.5 py-2 text-xs text-red-800">
          {err}
        </div>
      )}

      {/* TOTALS CARD */}
      <section className="mb-3 rounded border border-gray-300 bg-white px-3 py-2.5">
        <h3 className="mb-2 text-sm font-semibold">Totals / Money Flow</h3>
        {totalsByCurrency.length === 0 ? (
          <div className="py-2 text-xs text-gray-500">
            No transactions match these filters.
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {totalsByCurrency.map((t) => {
              const netUp = t.netMinor >= 0;
              return (
                <div
                  key={t.currency}
                  className="min-w-[220px] rounded border border-gray-300 bg-white px-3 py-2 text-xs"
                >
                  <div className="mb-1 font-semibold">{t.currency}</div>
                  <div className="my-[1px]">
                    Income:{" "}
                    <span className="font-medium">
                      {fmtMoneyUI(t.incomeMinor, t.currency)}
                    </span>
                  </div>
                  <div className="my-[1px]">
                    Outflow:{" "}
                    <span className="font-medium">
                      {fmtMoneyUI(t.outMinor, t.currency)}
                    </span>
                  </div>
                  <div
                    className={`mt-1 font-semibold ${
                      netUp ? "text-[#16a34a]" : "text-[#b91c1c]"
                    }`}
                  >
                    Net: {fmtMoneyUI(t.netMinor, t.currency)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* SANKEY CARD */}
      <section className="mb-3 rounded border border-gray-300 bg-white px-3 py-2.5">
        <div className="mb-1.5 flex items-center justify-between">
          <h3 className="text-sm font-semibold">
            Cash-Flow (Sankey) · {fCurrency}
          </h3>
        </div>

        <div ref={sankeyRef} className="h-[420px]">
          {!sankeyData ? (
            <div className="flex h-full items-center justify-center text-xs text-gray-500">
              Not enough data to display cash-flow for {fCurrency}.
            </div>
          ) : (
            <ResponsiveSankey
              data={sankeyData}
              margin={{ top: 20, right: 180, bottom: 20, left: 40 }}
              align="justify"
              colors={{ scheme: "paired" }}
              nodeOpacity={1}
              nodeThickness={12}
              nodeInnerPadding={2}
              nodeSpacing={16}
              nodeBorderWidth={1}
              nodeBorderColor={{ from: "color", modifiers: [["darker", 0.2]] }}
              nodeBorderRadius={0}
              linkOpacity={0.45}
              linkBlendMode="multiply"
              enableLinkGradient
              labelPosition="outside"
              labelOrientation="horizontal"
              labelPadding={8}
              labelTextColor={{ from: "color", modifiers: [["darker", 1.2]] }}
              animate
              motionConfig="gentle"
            />
          )}
        </div>
      </section>

      {/* TABLE */}
      <section className="mt-2 rounded border border-gray-300 bg-white px-3 pb-3 pt-2.5">
        <div className="mb-1.5 flex items-baseline justify-between">
          <h3 className="text-sm font-semibold">All Transactions</h3>
          <span className="text-[11px] text-gray-500">
            ({rows.length} result{rows.length === 1 ? "" : "s"})
          </span>
        </div>

        {rows.length === 0 ? (
          <div className="py-2 text-xs text-gray-500">
            No transactions found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border-t border-gray-200 px-2 py-1 text-left text-[11px] font-semibold text-gray-700">
                    Date
                  </th>
                  <th className="border-t border-gray-200 px-2 py-1 text-left text-[11px] font-semibold text-gray-700">
                    Account
                  </th>
                  <th className="border-t border-gray-200 px-2 py-1 text-left text-[11px] font-semibold text-gray-700">
                    Category
                  </th>
                  <th className="border-t border-gray-200 px-2 py-1 text-left text-[11px] font-semibold text-gray-700">
                    Type
                  </th>
                  <th className="border-t border-gray-200 px-2 py-1 text-left text-[11px] font-semibold text-gray-700">
                    Description
                  </th>
                  <th className="border-t border-gray-200 px-2 py-1 text-right text-[11px] font-semibold text-gray-700">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((tx, idx) => {
                  const accName = accountsById.get(tx.accountId)?.name || "—";
                  const catName =
                    categoriesById.get(tx.categoryId)?.name || "—";
                  const isIncome = tx.type === "income";
                  let val = minorToMajor(tx.amountMinor, tx.currency);
                  if (!isIncome) val = -Math.abs(val);

                  return (
                    <tr
                      key={tx._id}
                      className={idx % 2 === 1 ? "bg-gray-50" : "bg-white"}
                    >
                      <td className="border-t border-gray-200 px-2 py-1">
                        {fmtDate(tx.date)}
                      </td>
                      <td className="border-t border-gray-200 px-2 py-1">
                        {accName}
                      </td>
                      <td className="border-t border-gray-200 px-2 py-1">
                        {catName}
                      </td>
                      <td className="border-t border-gray-200 px-2 py-1">
                        {tx.type}
                      </td>
                      <td className="border-t border-gray-200 px-2 py-1">
                        {tx.description || ""}
                      </td>
                      <td className="border-t border-gray-200 px-2 py-1 text-right">
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
      </section>
    </div>
  );
}
