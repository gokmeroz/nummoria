/* eslint-disable no-unused-vars */
// src/pages/Reports.jsx
import React, { useEffect, useMemo, useState, useCallback } from "react";
import api from "../lib/api";
// [BRAND] import your logo; Vite will turn this into a URL we can use
const logoUrl = new URL("../assets/nummora_logo.png", import.meta.url).href;

/* ============================================================================
   Reports Page
   - Lists EVERY transaction (income, expense, investment).
   - Computes totals by currency and a "net money flow".
   - Exports a branded PDF (w/ app name + logo).
   - If jsPDF isn't installed, falls back to a Print-to-PDF flow.
   ============================================================================ */

// [BRAND] App name shown on the PDF
const APP_NAME = "Nummora";

/* ------------------------------ Money helpers ------------------------------ */
function decimalsForCurrency(code) {
  const zero = new Set(["JPY", "KRW", "CLP", "VND"]);
  const three = new Set(["BHD", "IQD", "JOD", "KWD", "OMR", "TND"]);
  if (zero.has(code)) return 0;
  if (three.has(code)) return 3;
  return 2;
}
function minorToMajor(minor, currency = "USD") {
  const d = decimalsForCurrency(currency || "USD");
  return (Number(minor || 0) / Math.pow(10, d)).toFixed(d);
}
const fmtMoney = (minor, cur = "USD") =>
  new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: cur || "USD",
  }).format(
    Number(minor || 0) / Math.pow(10, decimalsForCurrency(cur || "USD"))
  );

/* ----------------------------- Small utilities ----------------------------- */
// Load an <img> URL as a DataURL so jsPDF.addImage can embed it.
async function urlToDataURL(url) {
  const res = await fetch(url);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(blob);
  });
}

/* ---------------------------------- Page ---------------------------------- */
// NOTE: Define the component as a local function…
function ReportsView() {
  // All raw data to render and summarize
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [accounts, setAccounts] = useState([]);

  // basic UI
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // simple filters (optional convenience)
  const [q, setQ] = useState("");

  /* ---------------------------------- Load ---------------------------------- */
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
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  /* ---------------------------- Lookups / helpers --------------------------- */
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

  /* ------------------------------- Filtering -------------------------------- */
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const sorted = [...transactions].sort(
      (a, b) => new Date(b.date) - new Date(a.date)
    );
    if (!needle) return sorted;
    return sorted.filter((t) => {
      const cat = categoriesById.get(t.categoryId)?.name || "";
      const acc = accountsById.get(t.accountId)?.name || "";
      return (
        (t.description || "").toLowerCase().includes(needle) ||
        (t.notes || "").toLowerCase().includes(needle) ||
        (t.type || "").toLowerCase().includes(needle) ||
        cat.toLowerCase().includes(needle) ||
        acc.toLowerCase().includes(needle) ||
        (t.tags || []).some((tg) => (tg || "").toLowerCase().includes(needle))
      );
    });
  }, [transactions, q, categoriesById, accountsById]);

  /* ------------------------------ Money flow ------------------------------- */
  // Totals by currency: income vs outflow (expenses + investments)
  const totalsByCurrency = useMemo(() => {
    const map = new Map();
    for (const t of rows) {
      const cur = t.currency || "USD";
      const bucket = map.get(cur) || { incomeMinor: 0, outMinor: 0 };
      if (t.type === "income") bucket.incomeMinor += Number(t.amountMinor || 0);
      else bucket.outMinor += Number(t.amountMinor || 0); // expenses + investments count as outflow
      map.set(cur, bucket);
    }
    // massage for render
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

  /* ----------------------------- PDF Generation ----------------------------- */
  async function handleDownloadPdf() {
    // 1) Try to dynamically import jsPDF and autotable.
    let jsPDF, autoTable;
    try {
      ({ jsPDF } = await import("jspdf")); // npm i jspdf
      // jspdf-autotable exports a default plugin fn; we call it w/ doc + config
      autoTable = (await import("jspdf-autotable")).default; // npm i jspdf-autotable
    } catch {
      // 2) If user hasn't installed PDF libs, do a zero-error fallback.
      //    Open the print dialog so the user can "Save as PDF".
      window.print();
      return;
    }

    // 3) Create doc and add brand header (logo + app name)
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();

    try {
      const logoData = await urlToDataURL(logoUrl);
      // draw logo on the left
      doc.addImage(logoData, "PNG", 36, 24, 32, 32);
    } catch {
      // ignore logo failure silently, still produce the PDF
    }

    doc.setFontSize(18);
    doc.text(APP_NAME, 76, 46); // next to the logo
    doc.setFontSize(12);
    doc.setTextColor(100);
    doc.text("Transactions Report", 36, 80);
    doc.setDrawColor(200);
    doc.line(36, 90, pageWidth - 36, 90);

    // 4) Build transaction table rows for the PDF
    const tableBody = rows.map((t) => {
      const date = new Date(t.date).toISOString().slice(0, 10);
      const acc = accountsById.get(t.accountId)?.name || "—";
      const cat = categoriesById.get(t.categoryId)?.name || "—";
      const desc = t.description || "";
      // sign: income is +, everything else is -
      const sign = t.type === "income" ? "+" : "-";
      const amountStr = `${sign}${fmtMoney(t.amountMinor, t.currency)}`;
      return [date, acc, cat, t.type, desc, amountStr];
    });

    // 5) Render transactions table (autoTable handles page breaks)
    autoTable(doc, {
      startY: 110,
      head: [["Date", "Account", "Category", "Type", "Description", "Amount"]],
      body: tableBody,
      styles: { fontSize: 9, cellPadding: 4, overflow: "linebreak" },
      headStyles: { fillColor: [79, 119, 45] }, // Nummora green-ish
      columnStyles: {
        0: { cellWidth: 70 }, // Date
        1: { cellWidth: 110 }, // Account
        2: { cellWidth: 110 }, // Category
        3: { cellWidth: 70 }, // Type
        4: { cellWidth: 170 }, // Description
        5: { cellWidth: 90, halign: "right" }, // Amount
      },
      didDrawPage: (data) => {
        // footer page number
        const str = `Page ${doc.internal.getNumberOfPages()}`;
        doc.setFontSize(9);
        doc.setTextColor(120);
        doc.text(str, pageWidth - 36, doc.internal.pageSize.getHeight() - 18, {
          align: "right",
        });
      },
    });

    // 6) Add a "Totals / Money Flow" section after the table
    let y = doc.previousAutoTable ? doc.previousAutoTable.finalY + 24 : 120;

    doc.setTextColor(0);
    doc.setFontSize(13);
    doc.text("Totals / Money Flow", 36, y);
    y += 10;
    doc.setDrawColor(200);
    doc.line(36, y, pageWidth - 36, y);
    y += 18;

    // each currency: Income, Outflow, Net
    totalsByCurrency.forEach((row) => {
      const { currency, incomeMinor, outMinor, netMinor } = row;
      const line = [
        `• ${currency}`,
        `Income: ${fmtMoney(incomeMinor, currency)}`,
        `Outflow: ${fmtMoney(outMinor, currency)}`,
        `Net: ${fmtMoney(netMinor, currency)}`,
      ].join("    ");

      // highlight net +/- with color hint
      const netPositive = netMinor >= 0;
      doc.setTextColor(0);
      doc.text(line, 40, y);
      const netX =
        40 +
        doc.getTextWidth(
          `• ${currency}    Income: ${fmtMoney(
            incomeMinor,
            currency
          )}    Outflow: ${fmtMoney(outMinor, currency)}    Net: `
        );
      doc.setTextColor(netPositive ? [34, 139, 34] : [200, 0, 0]);
      doc.text(fmtMoney(netMinor, currency), netX, y);
      y += 18;
    });

    // 7) Save the PDF
    const ts = new Date().toISOString().slice(0, 10);
    doc.save(`${APP_NAME}_Report_${ts}.pdf`);
  }

  /* --------------------------------- Render --------------------------------- */
  if (loading) {
    return (
      <div className="min-h-[60vh] grid place-items-center">
        <div className="text-gray-600">Loading reports…</div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-[#f8faf8]">
      {/* ============================ Header / Controls ============================ */}
      <div className="p-4 border-b bg-white">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {/* [BRAND] logo + app name in the page header too */}
            <img src={logoUrl} alt="logo" className="w-8 h-8 rounded" />
            <h1 className="text-2xl font-bold">Reports</h1>
          </div>

          <div className="flex items-center gap-2">
            {/* [PDF] Main action — tries jsPDF; otherwise opens Print dialog */}
            <button
              onClick={handleDownloadPdf}
              className="px-4 py-2 rounded-lg bg-[#4f772d] text-white font-semibold hover:bg-[#3f5f24]"
              title="Download a PDF report"
            >
              Download PDF
            </button>
          </div>
        </div>

        {/* Quick search/filter (client-side) */}
        <div className="mt-3 flex gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search description, notes, type, category, account, #tags"
            className="flex-1 border rounded-lg px-3 py-2"
          />
        </div>
      </div>

      {/* =============================== Totals bar =============================== */}
      <div className="p-4">
        <div className="rounded-lg border bg-white p-4">
          <div className="font-semibold mb-2">Totals / Money Flow</div>
          {totalsByCurrency.length === 0 ? (
            <div className="text-gray-600">No transactions yet.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {totalsByCurrency.map((t) => {
                const netUp = t.netMinor >= 0;
                return (
                  <div key={t.currency} className="rounded border p-3">
                    <div className="font-semibold">{t.currency}</div>
                    <div className="text-sm text-gray-600">
                      Income:{" "}
                      <span className="font-medium">
                        {fmtMoney(t.incomeMinor, t.currency)}
                      </span>
                    </div>
                    <div className="text-sm text-gray-600">
                      Outflow:{" "}
                      <span className="font-medium">
                        {fmtMoney(t.outMinor, t.currency)}
                      </span>
                    </div>
                    <div
                      className={`text-sm font-semibold ${
                        netUp ? "text-green-700" : "text-red-700"
                      }`}
                    >
                      Net: {fmtMoney(t.netMinor, t.currency)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* =============================== Table list ============================== */}
      <div className="p-4">
        <div className="rounded-lg border bg-white overflow-x-auto">
          <div className="p-4 font-semibold border-b">All Transactions</div>
          <table className="min-w-full text-sm">
            <thead className="text-left text-gray-600">
              <tr>
                <th className="py-2 px-4">Date</th>
                <th className="py-2 px-4">Account</th>
                <th className="py-2 px-4">Category</th>
                <th className="py-2 px-4">Type</th>
                <th className="py-2 px-4">Description</th>
                <th className="py-2 px-4 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-4 px-4 text-gray-600">
                    No transactions found.
                  </td>
                </tr>
              ) : (
                rows.map((t) => {
                  const date = new Date(t.date).toISOString().slice(0, 10);
                  const acc = accountsById.get(t.accountId)?.name || "—";
                  const cat = categoriesById.get(t.categoryId)?.name || "—";
                  const sign = t.type === "income" ? "+" : "-";
                  return (
                    <tr key={t._id} className="border-t">
                      <td className="py-2 px-4">{date}</td>
                      <td className="py-2 px-4">{acc}</td>
                      <td className="py-2 px-4">{cat}</td>
                      <td className="py-2 px-4 capitalize">{t.type}</td>
                      <td className="py-2 px-4">{t.description || "—"}</td>
                      <td className="py-2 px-4 text-right">
                        {sign}
                        {fmtMoney(t.amountMinor, t.currency)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* [PRINT] Fallback hint: if jsPDF isn't installed, our button opens print */}
        <div className="text-xs text-gray-500 mt-2">
          Tip: If the PDF download doesn’t start, use “Save as PDF” from the
          print dialog.
        </div>
      </div>
    </div>
  );
}

// …then export it BOTH ways so you can import with either syntax.
// Named export:
export const ReportsPage = React.memo(ReportsView);
// Default export:
export default ReportsPage;
