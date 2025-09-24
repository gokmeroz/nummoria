/* eslint-disable no-empty */
/* eslint-disable no-unused-vars */
// src/pages/Reports.jsx
import React, { useEffect, useMemo, useState, useCallback } from "react";
import api from "../lib/api";

// [BRAND] logo (Vite resolves this URL at build time)
const logoUrl = new URL("../assets/nummora_logo.png", import.meta.url).href;

// [BRAND] App name
const APP_NAME = "Nummora";

/* ------------------------------ Money helpers ------------------------------ */
// UI formatter (kept as-is; uses user's locale)
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
const fmtMoneyUI = (minor, cur = "USD") =>
  new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: cur || "USD",
  }).format(
    Number(minor || 0) / Math.pow(10, decimalsForCurrency(cur || "USD"))
  );

// PDF-safe formatter (ASCII only, avoids NBSP & exotic symbols)
const fmtMoneyPDF = (minor, cur = "USD") => {
  const val =
    Number(minor || 0) / Math.pow(10, decimalsForCurrency(cur || "USD"));
  let s = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: cur || "USD",
    currencyDisplay: "symbol",
  }).format(val);
  s = s
    .replace(/\u00A0|\u202F/g, " ") // NBSP / NNBSP → space
    .replace(/\u2212/g, "-") // Unicode minus → ASCII
    .replace(/[^\x20-\x7E]/g, ""); // strip non-ASCII
  return s;
};

// General text sanitization for PDF (keep it ASCII)
const toPdfText = (s) =>
  String(s || "")
    .replace(/\u00A0|\u202F/g, " ")
    .replace(/[^\x20-\x7E]/g, "");

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
function ReportsView() {
  // data
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [accounts, setAccounts] = useState([]);

  // ui
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");
  const [downloading, setDownloading] = useState(false);

  //TODO THE FILTERING: filter state (copy to other pages as needed)
  const [fStart, setFStart] = useState(""); // YYYY-MM-DD
  const [fEnd, setFEnd] = useState(""); // YYYY-MM-DD
  const [fType, setFType] = useState("ALL"); // ALL | income | expense | investment
  const [fAccountId, setFAccountId] = useState("ALL"); // ALL or account _id
  const [fCategoryId, setFCategoryId] = useState("ALL"); // ALL or category _id
  const [fCurrency, setFCurrency] = useState("ALL"); // ALL or currency code
  const [fMin, setFMin] = useState(""); // number (major)
  const [fMax, setFMax] = useState(""); // number (major)

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

  // unique currencies for the filter dropdown
  const currencies = useMemo(() => {
    const s = new Set(transactions.map((t) => t.currency || "USD"));
    return ["ALL", ...Array.from(s)];
  }, [transactions]);

  /* ------------------------------- Filtering -------------------------------- */
  //TODO THE FILTERING: core filtering logic (copy to other pages and adapt)
  const rows = useMemo(() => {
    // Prepare date bounds (end is inclusive)
    const start = fStart ? new Date(`${fStart}T00:00:00`) : null;
    const end = fEnd ? new Date(`${fEnd}T23:59:59.999`) : null;

    const minNum = fMin !== "" ? Number(fMin) : null; // in MAJOR
    const maxNum = fMax !== "" ? Number(fMax) : null; // in MAJOR

    const needle = q.trim().toLowerCase();

    const filtered = transactions.filter((t) => {
      // type
      if (fType !== "ALL" && (t.type || "").toLowerCase() !== fType)
        return false;

      // account
      if (fAccountId !== "ALL" && t.accountId !== fAccountId) return false;

      // category
      if (fCategoryId !== "ALL" && t.categoryId !== fCategoryId) return false;

      // currency
      const cur = t.currency || "USD";
      if (fCurrency !== "ALL" && cur !== fCurrency) return false;

      // date range
      const dt = new Date(t.date);
      if (start && dt < start) return false;
      if (end && dt > end) return false;

      // amount range (compare in MAJOR to be currency-agnostic)
      const major =
        Number(t.amountMinor || 0) / Math.pow(10, decimalsForCurrency(cur));
      if (minNum !== null && major < minNum) return false;
      if (maxNum !== null && major > maxNum) return false;

      // free-text search
      if (needle) {
        const cat = categoriesById.get(t.categoryId)?.name || "";
        const acc = accountsById.get(t.accountId)?.name || "";
        const hay = `${t.description || ""} ${t.notes || ""} ${
          t.type || ""
        } ${cat} ${acc} ${(t.tags || []).join(" ")}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }

      return true;
    });

    // sort newest first
    filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
    return filtered;
  }, [
    transactions,
    q,
    fStart,
    fEnd,
    fType,
    fAccountId,
    fCategoryId,
    fCurrency,
    fMin,
    fMax,
    categoriesById,
    accountsById,
  ]);

  /* ------------------------------ Money flow ------------------------------- */
  const totalsByCurrency = useMemo(() => {
    const map = new Map();
    for (const t of rows) {
      const cur = t.currency || "USD";
      const bucket = map.get(cur) || { incomeMinor: 0, outMinor: 0 };
      if (t.type === "income") bucket.incomeMinor += Number(t.amountMinor || 0);
      else bucket.outMinor += Number(t.amountMinor || 0); // expenses + investments = outflow
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

  /* ----------------------------- PDF Generation ----------------------------- */
  async function handleDownloadPdf() {
    if (downloading) return;
    setDownloading(true);
    try {
      const [{ default: JsPDF }, { default: autoTable }] = await Promise.all([
        import("jspdf"),
        import("jspdf-autotable"),
      ]);

      const doc = new JsPDF({ unit: "pt", format: "a4" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 36; // match header margins
      const printable = pageWidth - margin * 2;

      // ---------- Header (brand) ----------
      try {
        const logoData = await urlToDataURL(logoUrl);
        doc.addImage(logoData, "PNG", margin, 24, 32, 32);
      } catch {}
      doc.setFont("helvetica", "normal"); // keep default but explicit
      doc.setFontSize(18);
      doc.setTextColor(0);
      doc.text(toPdfText(APP_NAME), margin + 40, 46);
      doc.setFontSize(12);
      doc.setTextColor(100);
      doc.text("Transactions Report", margin, 80);
      doc.setDrawColor(200);
      doc.line(margin, 90, pageWidth - margin, 90);

      // ---------- Optional: show active filters in PDF ----------
      //TODO THE FILTERING: export the current filter chips to the PDF subtitle
      const activeFilters = [];
      if (fStart) activeFilters.push(`from ${fStart}`);
      if (fEnd) activeFilters.push(`to ${fEnd}`);
      if (fType !== "ALL") activeFilters.push(`type=${fType}`);
      if (fAccountId !== "ALL")
        activeFilters.push(
          `account=${toPdfText(accountsById.get(fAccountId)?.name || "")}`
        );
      if (fCategoryId !== "ALL")
        activeFilters.push(
          `category=${toPdfText(categoriesById.get(fCategoryId)?.name || "")}`
        );
      if (fCurrency !== "ALL") activeFilters.push(`currency=${fCurrency}`);
      if (fMin !== "") activeFilters.push(`min=${fMin}`);
      if (fMax !== "") activeFilters.push(`max=${fMax}`);
      if (activeFilters.length) {
        doc.setFontSize(10);
        doc.setTextColor(80);
        doc.text(
          `Filters: ${toPdfText(activeFilters.join(" · "))}`,
          margin,
          104
        );
      }

      // ---------- Table (dynamic widths that always fit) ----------
      // Columns: Date, Account, Category, Type, Description, Amount
      const colW = {
        date: 70,
        account: 95,
        category: 95,
        type: 55,
        amount: 85, // keep amount readable
      };
      // whatever remains goes to Description
      colW.desc =
        printable -
        (colW.date + colW.account + colW.category + colW.type + colW.amount);

      // rows for PDF (ASCII-safe + clear sign formatting)
      const tableBody = rows.map((t) => {
        const date = new Date(t.date).toISOString().slice(0, 10);
        const acc = accountsById.get(t.accountId)?.name || "—";
        const cat = categoriesById.get(t.categoryId)?.name || "—";
        const desc = t.description || "";
        const isIncome = t.type === "income";
        const signedAmount = `${isIncome ? "+" : "-"}${fmtMoneyPDF(
          t.amountMinor,
          t.currency
        )}`;
        return [
          toPdfText(date),
          toPdfText(acc),
          toPdfText(cat),
          toPdfText(t.type),
          toPdfText(desc),
          toPdfText(signedAmount),
        ];
      });

      autoTable(doc, {
        startY: 110 + (activeFilters.length ? 16 : 0),
        margin: { left: margin, right: margin },
        head: [
          ["Date", "Account", "Category", "Type", "Description", "Amount"].map(
            toPdfText
          ),
        ],
        body: tableBody,
        styles: {
          font: "helvetica",
          fontSize: 9,
          cellPadding: 4,
          overflow: "linebreak",
          halign: "left",
        },
        headStyles: { fillColor: [79, 119, 45], textColor: 255 },
        columnStyles: {
          0: { cellWidth: colW.date }, // Date
          1: { cellWidth: colW.account }, // Account
          2: { cellWidth: colW.category }, // Category
          3: { cellWidth: colW.type }, // Type
          4: { cellWidth: colW.desc }, // Description
          5: { cellWidth: colW.amount, halign: "right" }, // Amount
        },
        didDrawPage: () => {
          const str = `Page ${doc.internal.getNumberOfPages()}`;
          doc.setFontSize(9);
          doc.setTextColor(120);
          doc.text(
            str,
            pageWidth - margin,
            doc.internal.pageSize.getHeight() - 18,
            {
              align: "right",
            }
          );
        },
      });

      // ---------- Totals / Money Flow ----------
      let y = (doc.lastAutoTable?.finalY ?? 110) + 24;

      doc.setTextColor(0);
      doc.setFontSize(13);
      doc.text("Totals / Money Flow", margin, y);
      y += 10;
      doc.setDrawColor(200);
      doc.line(margin, y, pageWidth - margin, y);
      y += 18;

      totalsByCurrency.forEach((row) => {
        const { currency, incomeMinor, outMinor, netMinor } = row;
        const income = fmtMoneyPDF(incomeMinor, currency);
        const out = fmtMoneyPDF(outMinor, currency);
        const net = fmtMoneyPDF(netMinor, currency);

        // ASCII-only line (no bullets)
        const prefix = `- ${currency}   Income: ${income}   Outflow: ${out}   Net: `;
        doc.setTextColor(0);
        doc.text(toPdfText(prefix), margin + 4, y);

        // color the NET value only
        const netX = margin + 4 + doc.getTextWidth(toPdfText(prefix));
        if (netMinor >= 0) doc.setTextColor(34, 139, 34);
        else doc.setTextColor(200, 0, 0);
        doc.text(toPdfText(net), netX, y);

        y += 18;
      });

      // ---------- Save ----------
      const ts = new Date().toISOString().slice(0, 10);
      doc.save(`${APP_NAME}_Report_${ts}.pdf`);
    } catch (err) {
      console.error("PDF generation error:", err);
      alert(
        "Could not generate the PDF. Check the console for details. If needed, try the browser's Print > Save as PDF."
      );
    } finally {
      setDownloading(false);
    }
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
            <img src={logoUrl} alt="logo" className="w-8 h-8 rounded" />
            <h1 className="text-2xl font-bold">Reports</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={downloading}
              className="px-4 py-2 rounded-lg bg-[#4f772d] text-white font-semibold hover:bg-[#3f5f24] disabled:opacity-60"
              title="Download a PDF report"
            >
              {downloading ? "Generating…" : "Download PDF"}
            </button>
          </div>
        </div>

        {/* Quick search */}
        <div className="mt-3 flex gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search description, notes, type, category, account, #tags"
            className="flex-1 border rounded-lg px-3 py-2"
          />
        </div>

        {/* ========================= FILTER BAR (reusable) ========================= */}
        {/*TODO THE FILTERING: filter inputs UI (copy to other pages and adapt) */}
        <div className="mt-3 grid grid-cols-1 xl:grid-cols-6 gap-2">
          {/* Date range */}
          <div className="flex gap-2">
            <input
              type="date"
              value={fStart}
              onChange={(e) => setFStart(e.target.value)}
              className="border rounded-lg px-3 py-2 w-full"
              title="From date"
            />
            <input
              type="date"
              value={fEnd}
              onChange={(e) => setFEnd(e.target.value)}
              className="border rounded-lg px-3 py-2 w-full"
              title="To date"
            />
          </div>

          {/* Type */}
          <select
            value={fType}
            onChange={(e) => setFType(e.target.value)}
            className="border rounded-lg px-3 py-2"
            title="Type"
          >
            <option value="ALL">All types</option>
            <option value="income">Income</option>
            <option value="expense">Expense</option>
            <option value="investment">Investment</option>
          </select>

          {/* Account */}
          <select
            value={fAccountId}
            onChange={(e) => setFAccountId(e.target.value)}
            className="border rounded-lg px-3 py-2"
            title="Account"
          >
            <option value="ALL">All accounts</option>
            {accounts.map((a) => (
              <option key={a._id} value={a._id}>
                {a.name}
              </option>
            ))}
          </select>

          {/* Category */}
          <select
            value={fCategoryId}
            onChange={(e) => setFCategoryId(e.target.value)}
            className="border rounded-lg px-3 py-2"
            title="Category"
          >
            <option value="ALL">All categories</option>
            {categories.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name}
              </option>
            ))}
          </select>

          {/* Currency */}
          <select
            value={fCurrency}
            onChange={(e) => setFCurrency(e.target.value)}
            className="border rounded-lg px-3 py-2"
            title="Currency"
          >
            {currencies.map((c) => (
              <option key={c} value={c}>
                {c === "ALL" ? "All currencies" : c}
              </option>
            ))}
          </select>

          {/* Amount range (major units) */}
          <div className="flex gap-2">
            <input
              type="number"
              inputMode="decimal"
              value={fMin}
              onChange={(e) => setFMin(e.target.value)}
              placeholder="Min amount"
              className="border rounded-lg px-3 py-2 w-full"
            />
            <input
              type="number"
              inputMode="decimal"
              value={fMax}
              onChange={(e) => setFMax(e.target.value)}
              placeholder="Max amount"
              className="border rounded-lg px-3 py-2 w-full"
            />
          </div>
        </div>

        {/* Reset filters */}
        <div className="mt-2">
          <button
            type="button"
            onClick={() => {
              //TODO THE FILTERING: reset filters
              setFStart("");
              setFEnd("");
              setFType("ALL");
              setFAccountId("ALL");
              setFCategoryId("ALL");
              setFCurrency("ALL");
              setFMin("");
              setFMax("");
            }}
            className="px-3 py-1.5 text-sm rounded border"
          >
            Reset filters
          </button>
        </div>
      </div>

      {/* =============================== Totals bar =============================== */}
      <div className="p-4">
        <div className="rounded-lg border bg-white p-4">
          <div className="font-semibold mb-2">Totals / Money Flow</div>
          {totalsByCurrency.length === 0 ? (
            <div className="text-gray-600">
              No transactions match these filters.
            </div>
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
                        {fmtMoneyUI(t.incomeMinor, t.currency)}
                      </span>
                    </div>
                    <div className="text-sm text-gray-600">
                      Outflow:{" "}
                      <span className="font-medium">
                        {fmtMoneyUI(t.outMinor, t.currency)}
                      </span>
                    </div>
                    <div
                      className={`text-sm font-semibold ${
                        netUp ? "text-green-700" : "text-red-700"
                      }`}
                    >
                      Net: {fmtMoneyUI(t.netMinor, t.currency)}
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
          <div className="p-4 font-semibold border-b">
            All Transactions{" "}
            <span className="text-gray-500 font-normal">
              ({rows.length} result{rows.length === 1 ? "" : "s"})
            </span>
          </div>
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
                        {fmtMoneyUI(t.amountMinor, t.currency)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="text-xs text-gray-500 mt-2">
          Tip: If the PDF download doesn’t start, use “Save as PDF” from the
          print dialog.
        </div>
      </div>
    </div>
  );
}

// Export both ways
export const ReportsPage = React.memo(ReportsView);
export default ReportsPage;
