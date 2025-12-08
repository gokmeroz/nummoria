/* eslint-disable no-unused-vars */

import React, { useCallback, useEffect, useMemo, useState } from "react";
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

/* =============================== Component =============================== */

const REPORTS_STYLE_ID = "reports-page-styles";

export default function Reports() {
  /* ---------- inject CSS once ---------- */
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (document.getElementById(REPORTS_STYLE_ID)) return;

    const style = document.createElement("style");
    style.id = REPORTS_STYLE_ID;
    style.innerHTML = reportsCss;
    document.head.appendChild(style);
  }, []);

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

      // grab current sankey SVG (if rendered)
      let sankeySvgHtml = "";
      const svgEl = document.querySelector(".reports-sankey-wrapper svg");
      if (svgEl) {
        sankeySvgHtml = svgEl.outerHTML;
      }

      // Build a simple HTML table (same columns as screen)
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

      const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Transactions Report</title>
  <style>
    body { font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; padding: 24px; }
    h1 { font-size: 18px; margin-bottom: 12px; }
    h2 { font-size: 14px; margin: 18px 0 8px; }
    table { border-collapse: collapse; width: 100%; font-size: 12px; }
    th, td { border: 1px solid #d1d5db; padding: 6px 8px; text-align: left; }
    th { background: #f3f4f6; font-weight: 600; }
    td:last-child, th:last-child { text-align: right; }
    .sankey-container { margin-bottom: 20px; }
    .sankey-container svg { width: 100%; height: auto; }
  </style>
</head>
<body>
  <h1>Nummoria – Transactions Report</h1>
  ${
    sankeySvgHtml
      ? `<h2>Cash-Flow (Sankey) · ${fCurrency}</h2>
  <div class="sankey-container">
    ${sankeySvgHtml}
  </div>`
      : ""
  }
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
      // user can choose "Save as PDF" in print dialog
      win.print();
    } catch (err) {
      // eslint-disable-next-line no-alert
      alert(err.message || "Failed to generate PDF");
    }
  };

  /* ---------- loading ---------- */
  if (!initialDone && loading) {
    return (
      <div className="reports-loading">
        <div className="reports-loading-inner">
          <div className="spinner" />
          <div className="brand">
            <span>🪙</span>
            <span>Nummoria</span>
          </div>
          <p>Loading your reports…</p>
        </div>
      </div>
    );
  }

  /* ============================= RENDER ============================= */

  return (
    <div className="reports-page">
      {/* FILTER BAR (top row like screenshot) */}
      <div className="reports-filters-bar">
        <button
          type="button"
          className="reports-reset-btn"
          onClick={resetFilters}
        >
          Reset filters
        </button>

        <input
          type="date"
          className="reports-filter-input"
          value={fStart}
          onChange={(e) => setFStart(e.target.value)}
        />
        <input
          type="date"
          className="reports-filter-input"
          value={fEnd}
          onChange={(e) => setFEnd(e.target.value)}
        />

        <select
          className="reports-filter-input"
          value={fType}
          onChange={(e) => setFType(e.target.value)}
        >
          <option value="ALL">All types</option>
          <option value="income">Income</option>
          <option value="expense">Expense</option>
          <option value="investment">Investment</option>
        </select>

        <select
          className="reports-filter-input"
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
          className="reports-filter-input"
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
          className="reports-filter-input"
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
          className="reports-filter-input"
          placeholder="Min amount"
          value={fMin}
          onChange={(e) => setFMin(e.target.value)}
        />
        <input
          type="number"
          className="reports-filter-input"
          placeholder="Max amount"
          value={fMax}
          onChange={(e) => setFMax(e.target.value)}
        />
      </div>

      {/* IMPORT / EXPORT ROW (small buttons under filters) */}
      <div className="reports-ie-row">
        <button
          type="button"
          className="reports-ie-btn reports-ie-btn-outline"
          onClick={handleImportCsv}
        >
          Import CSV
        </button>
        <button
          type="button"
          className="reports-ie-btn reports-ie-btn-outline"
          onClick={handleImportPdf}
        >
          Import PDF
        </button>
        <button
          type="button"
          className="reports-ie-btn reports-ie-btn-solid"
          onClick={handleDownloadCsv}
        >
          Download CSV
        </button>
        <button
          type="button"
          className="reports-ie-btn reports-ie-btn-solid"
          onClick={handleDownloadPdf}
        >
          Download PDF
        </button>
      </div>

      {err && (
        <div className="reports-error">
          <span>{err}</span>
        </div>
      )}

      {/* TOTALS CARD (top white box) */}
      <section className="reports-totals-section">
        <h3>Totals / Money Flow</h3>
        {totalsByCurrency.length === 0 ? (
          <div className="reports-totals-empty">
            No transactions match these filters.
          </div>
        ) : (
          totalsByCurrency.map((t) => {
            const netUp = t.netMinor >= 0;
            return (
              <div key={t.currency} className="reports-totals-card">
                <div className="totals-currency">{t.currency}</div>
                <div className="totals-line">
                  Income: <span>{fmtMoneyUI(t.incomeMinor, t.currency)}</span>
                </div>
                <div className="totals-line">
                  Outflow: <span>{fmtMoneyUI(t.outMinor, t.currency)}</span>
                </div>
                <div
                  className={
                    "totals-net " +
                    (netUp ? "totals-net-up" : "totals-net-down")
                  }
                >
                  Net: {fmtMoneyUI(t.netMinor, t.currency)}
                </div>
              </div>
            );
          })
        )}
      </section>

      {/* SANKEY CARD */}
      <section className="reports-sankey-section">
        <div className="reports-sankey-header">
          <h3>Cash-Flow (Sankey) · {fCurrency}</h3>
        </div>

        <div className="reports-sankey-wrapper">
          {!sankeyData ? (
            <div className="reports-totals-empty">
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
      <section className="reports-table-section">
        <div className="reports-table-header">
          <h3>All Transactions</h3>
          <span className="results-count">
            ({rows.length} result{rows.length === 1 ? "" : "s"})
          </span>
        </div>

        {rows.length === 0 ? (
          <div className="reports-totals-empty">No transactions found.</div>
        ) : (
          <div className="reports-table-wrapper">
            <table className="reports-table">
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
                {rows.map((tx) => {
                  const accName = accountsById.get(tx.accountId)?.name || "—";
                  const catName =
                    categoriesById.get(tx.categoryId)?.name || "—";
                  const isIncome = tx.type === "income";
                  let val = minorToMajor(tx.amountMinor, tx.currency);
                  if (!isIncome) val = -Math.abs(val);

                  return (
                    <tr key={tx._id}>
                      <td>{fmtDate(tx.date)}</td>
                      <td>{accName}</td>
                      <td>{catName}</td>
                      <td>{tx.type}</td>
                      <td>{tx.description || ""}</td>
                      <td>
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

/* =============================== CSS =============================== */

const reportsCss = `
.reports-page {
  padding: 16px 24px 40px;
  background: #f5f5f5;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI",
    sans-serif;
  color: #111827;
}

/* loading */
.reports-loading {
  min-height: calc(100vh - 80px);
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f5f5;
}

.reports-loading-inner {
  text-align: center;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  padding: 24px 32px;
  border-radius: 10px;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.1);
}

.reports-loading-inner .brand {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-top: 4px;
}

.reports-loading-inner .brand span:last-child {
  font-weight: 600;
  color: #16a34a;
}

.reports-loading-inner p {
  margin: 4px 0 0;
  font-size: 13px;
  color: #6b7280;
}

.spinner {
  width: 24px;
  height: 24px;
  border-radius: 9999px;
  border: 3px solid #e5e7eb;
  border-top-color: #16a34a;
  margin: 0 auto;
  animation: reports-spin 0.8s linear infinite;
}

@keyframes reports-spin {
  to { transform: rotate(360deg); }
}

/* error box */
.reports-error {
  margin-top: 10px;
  margin-bottom: 8px;
  padding: 8px 10px;
  border-radius: 4px;
  background: rgba(127, 29, 29, 0.08);
  border: 1px solid #7f1d1d;
  color: #991b1b;
  font-size: 12px;
}

/* top filters bar */
.reports-filters-bar {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  background: #ffffff;
  border: 1px solid #d4d4d4;
  border-radius: 4px;
  margin-bottom: 6px;
}

.reports-filter-input {
  height: 30px;
  padding: 4px 8px;
  border-radius: 4px;
  border: 1px solid #d1d5db;
  font-size: 12px;
  color: #111827;
  background: #ffffff;
  min-width: 120px;
}

.reports-filter-input:focus {
  outline: none;
  border-color: #16a34a;
  box-shadow: 0 0 0 1px rgba(22, 163, 74, 0.3);
}

.reports-reset-btn {
  padding: 4px 10px;
  font-size: 12px;
  border-radius: 4px;
  border: 1px solid #9ca3af;
  background: #f9fafb;
  cursor: pointer;
  white-space: nowrap;
}

.reports-reset-btn:hover {
  background: #e5e7eb;
}

/* import/export row */
.reports-ie-row {
  margin-top: 6px;
  margin-bottom: 10px;
  display: flex;
  gap: 8px;
}

.reports-ie-btn {
  padding: 4px 10px;
  font-size: 12px;
  border-radius: 999px;
  cursor: pointer;
  border-width: 1px;
  border-style: solid;
  white-space: nowrap;
}

.reports-ie-btn-outline {
  border-color: #9ca3af;
  background: #f9fafb;
  color: #374151;
}

.reports-ie-btn-outline:hover {
  background: #e5e7eb;
}

.reports-ie-btn-solid {
  border-color: #16a34a;
  background: #16a34a;
  color: #022c22;
  font-weight: 600;
}

.reports-ie-btn-solid:hover {
  background: #15803d;
  border-color: #15803d;
}

/* totals section */
.reports-totals-section {
  background: #ffffff;
  border: 1px solid #d4d4d4;
  border-radius: 4px;
  padding: 10px 12px;
  margin-bottom: 12px;
}

.reports-totals-section h3 {
  margin: 0 0 8px;
  font-size: 13px;
  font-weight: 600;
}

.reports-totals-empty {
  padding: 8px 4px;
  font-size: 12px;
  color: #6b7280;
}

.reports-totals-card {
  display: inline-block;
  vertical-align: top;
  min-width: 220px;
  padding: 10px 12px;
  margin-right: 10px;
  border-radius: 4px;
  border: 1px solid #d1d5db;
  background: #ffffff;
  font-size: 12px;
}

.totals-currency {
  font-weight: 600;
  margin-bottom: 4px;
}

.totals-line {
  margin: 1px 0;
}

.totals-line span {
  font-weight: 500;
}

.totals-net {
  margin-top: 4px;
  font-weight: 600;
}

.totals-net-up { color: #16a34a; }
.totals-net-down { color: #b91c1c; }

/* sankey section */
.reports-sankey-section {
  background: #ffffff;
  border: 1px solid #d4d4d4;
  border-radius: 4px;
  padding: 10px 12px;
  margin-bottom: 12px;
}

.reports-sankey-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.reports-sankey-header h3 {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
}

.reports-sankey-wrapper {
  height: 420px;
}

/* table section */
.reports-table-section {
  background: #ffffff;
  border: 1px solid #d4d4d4;
  border-radius: 4px;
  padding: 10px 12px 12px;
  margin-top: 8px;
}

.reports-table-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 6px;
}

.reports-table-header h3 {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
}

.results-count {
  font-size: 11px;
  color: #6b7280;
}

.reports-table-wrapper {
  overflow-x: auto;
}

.reports-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.reports-table thead tr {
  background: #f3f4f6;
}

.reports-table th,
.reports-table td {
  border-top: 1px solid #e5e7eb;
  padding: 6px 8px;
  text-align: left;
}

.reports-table th {
  font-weight: 600;
  font-size: 11px;
  color: #374151;
}

.reports-table tbody tr:nth-child(even) {
  background: #fafafa;
}

.reports-table tbody tr:hover {
  background: #eef2ff;
}

.reports-table th:last-child,
.reports-table td:last-child {
  text-align: right;
}
`;
