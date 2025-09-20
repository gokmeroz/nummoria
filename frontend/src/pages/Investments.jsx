// src/pages/Investments.jsx
import React, {
  useEffect,
  useMemo,
  useState,
  useRef,
  useCallback,
} from "react";
import api from "../lib/api";

/* --------------------------- investment-only categories --------------------------- */
const INVESTMENT_CATEGORY_OPTIONS = [
  "Stock Market",
  "Crypto Currency Exchange",
  "Foreign Currency Exchange",
  "Gold",
  "Real Estate Investments",
  "Land Investments",
  "Other Investments",
];

async function createInvestmentCategory(name) {
  return api.post("/categories", { name, kind: "investment" });
}

/* ---------------------------------- Screen ---------------------------------- */
export default function InvestmentsScreen({ accountId }) {
  // data
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // performance (from /investments/performance)
  const [holdings, setHoldings] = useState([]);

  // ui state
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [search, setSearch] = useState("");
  const [sortDesc, setSortDesc] = useState(true);

  // modal state (create / edit)
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null); // transaction object or null

  // form seeds for the modal (used as defaultValue only)
  const [form, setForm] = useState({
    amount: "",
    currency: "USD",
    date: new Date().toISOString().slice(0, 10),
    categoryId: "",
    assetSymbol: "",
    units: "",
    description: "",
    tagsCsv: "",
  });

  /* ------------------------------ Money helpers ------------------------------ */
  function decimalsForCurrency(code) {
    const zero = new Set(["JPY", "KRW", "CLP", "VND"]);
    const three = new Set(["BHD", "IQD", "JOD", "KWD", "OMR", "TND"]);
    if (zero.has(code)) return 0;
    if (three.has(code)) return 3;
    return 2;
  }
  function majorToMinor(amountStr, currency) {
    const decimals = decimalsForCurrency(currency);
    const n = Number(String(amountStr).replace(",", "."));
    if (Number.isNaN(n)) return NaN;
    return Math.round(n * Math.pow(10, decimals));
  }
  function minorToMajor(minor, currency) {
    const decimals = decimalsForCurrency(currency);
    return (minor / Math.pow(10, decimals)).toFixed(decimals);
  }
  const fmtMoney = (minor, cur = "USD") =>
    new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: cur,
    }).format((minor || 0) / Math.pow(10, decimalsForCurrency(cur)));
  const pct = (num) =>
    Number.isFinite(num) ? `${(num * 100).toFixed(2)}%` : "—";

  /* --------------------------------- Derived -------------------------------- */
  const filtered = useMemo(() => {
    let rows = transactions.filter((t) => t.type === "investment");
    if (selectedCategory !== "ALL") {
      rows = rows.filter((t) => t.categoryId === selectedCategory);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter(
        (t) =>
          (t.description || "").toLowerCase().includes(q) ||
          (t.notes || "").toLowerCase().includes(q) ||
          (t.assetSymbol || "").toLowerCase().includes(q) ||
          (t.tags || []).some((tag) => (tag || "").toLowerCase().includes(q))
      );
    }
    rows.sort((a, b) =>
      sortDesc
        ? new Date(b.date) - new Date(a.date)
        : new Date(a.date) - new Date(b.date)
    );
    return rows;
  }, [transactions, selectedCategory, search, sortDesc]);

  const totals = useMemo(() => {
    const byCur = {};
    for (const t of filtered) {
      byCur[t.currency] = (byCur[t.currency] || 0) + t.amountMinor;
    }
    return Object.entries(byCur).map(([cur, minor]) => ({
      cur,
      major: minorToMajor(minor, cur),
    }));
  }, [filtered]);

  // Map symbol -> plMinor (unrealized P/L)
  const plBySymbol = useMemo(() => {
    const m = new Map();
    for (const h of holdings) {
      if (h && h.symbol) m.set(h.symbol.toUpperCase(), h.plMinor);
    }
    return m;
  }, [holdings]);

  /* ---------------------------------- Data ---------------------------------- */
  const loadAll = useCallback(async () => {
    try {
      setLoading(true);
      setErr("");
      const [txRes, catRes, perfRes] = await Promise.all([
        api.get("/transactions"),
        api.get("/categories"),
        api
          .get("/investments/performance")
          .catch(() => ({ data: { holdings: [] } })),
      ]);
      const cats = (catRes.data || []).filter(
        (c) => c.kind === "investment" && !c.isDeleted
      );
      setCategories(cats);
      setTransactions(txRes.data || []);
      setHoldings(perfRes.data?.holdings || []);
    } catch (e) {
      setErr(e?.response?.data?.error || e.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  /* --------------------------------- CRUD Tx -------------------------------- */
  function openCreate() {
    setEditing(null);
    setForm({
      amount: "",
      currency: filtered[0]?.currency || "USD",
      date: new Date().toISOString().slice(0, 10),
      categoryId: categories[0]?._id || "",
      assetSymbol: "",
      units: "",
      description: "",
      tagsCsv: "",
    });
    setModalOpen(true);
  }
  function openEdit(tx) {
    setEditing(tx);
    setForm({
      amount: minorToMajor(tx.amountMinor, tx.currency),
      currency: tx.currency,
      date: new Date(tx.date).toISOString().slice(0, 10),
      categoryId: tx.categoryId || "",
      assetSymbol: tx.assetSymbol || "",
      units: tx.units ?? "",
      description: tx.description || "",
      tagsCsv: (tx.tags || []).join(", "),
    });
    setModalOpen(true);
  }

  async function softDelete(tx) {
    if (!window.confirm("Delete investment?")) return;
    try {
      await api.delete(`/transactions/${tx._id}`);
      setTransactions((prev) => prev.filter((t) => t._id !== tx._id));
    } catch (e) {
      window.alert(e?.response?.data?.error || e.message || "Error");
    }
  }

  /* ------------------------------ UI Primitives ----------------------------- */
  function Chip({ label, selected, onClick }) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`px-3 py-1.5 rounded-full border text-sm ${
          selected
            ? "border-[#4f772d] bg-[#e8f5e9] text-[#2f5d1d]"
            : "border-gray-300 bg-white text-gray-800"
        }`}
      >
        {label}
      </button>
    );
  }

  /* --------------------------------- Header -------------------------------- */
  function Header() {
    return (
      <div className="space-y-3 p-4 border-b bg-white">
        <h1 className="text-2xl font-bold">Investments</h1>

        <div className="flex gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search symbol, description, notes or #tags"
            className="flex-1 border rounded-lg px-3 py-2"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Sort:</span>
          <button
            type="button"
            onClick={() => setSortDesc(true)}
            className={`px-3 py-1.5 rounded-lg border text-sm ${
              sortDesc ? "bg-gray-100 border-gray-300" : "border-transparent"
            }`}
          >
            Newest
          </button>
          <button
            type="button"
            onClick={() => setSortDesc(false)}
            className={`px-3 py-1.5 rounded-lg border text-sm ${
              !sortDesc ? "bg-gray-100 border-gray-300" : "border-transparent"
            }`}
          >
            Oldest
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          <Chip
            label="All"
            selected={selectedCategory === "ALL"}
            onClick={() => setSelectedCategory("ALL")}
          />
          {categories.map((c) => (
            <Chip
              key={c._id}
              label={c.name}
              selected={selectedCategory === c._id}
              onClick={() => setSelectedCategory(c._id)}
            />
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-4 text-sm">
          {totals.map(({ cur, major }) => (
            <span key={cur} className="font-semibold">
              Total Cost {cur}: {major}
            </span>
          ))}
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center px-4 py-2 rounded-xl bg-[#4f772d] text-white font-bold hover:bg-[#3f5f24]"
          >
            + New investment
          </button>
          <button
            type="button"
            onClick={loadAll}
            className="px-3 py-2 rounded-xl border"
            title="Refresh"
          >
            Refresh
          </button>
        </div>
      </div>
    );
  }

  /* ----------------------------- Holdings Summary ---------------------------- */
  function HoldingsSummary({ data }) {
    if (!data?.length) return null;

    const sum = data.reduce(
      (acc, h) => {
        acc.costMinor += h.costMinor || 0;
        acc.valueMinor += h.currentValueMinor ?? 0;
        acc.plMinor += h.plMinor ?? 0;
        return acc;
      },
      { costMinor: 0, valueMinor: 0, plMinor: 0 }
    );

    const cur = data[0]?.currency || "USD";
    const fmt = (minor) => fmtMoney(minor ?? 0, cur);

    return (
      <div className="m-4 rounded-xl border bg-white p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Holdings</h2>
          <div className="text-sm text-gray-500">
            Total Cost:{" "}
            <span className="font-medium">{fmt(sum.costMinor)}</span> · Value:{" "}
            <span className="font-medium">{fmt(sum.valueMinor)}</span> · P/L:{" "}
            <span
              className={`font-semibold ${
                sum.plMinor >= 0 ? "text-green-700" : "text-red-700"
              }`}
            >
              {fmt(sum.plMinor)} (
              {pct(sum.costMinor ? sum.plMinor / sum.costMinor : NaN)})
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-gray-600">
              <tr>
                <th className="py-2 pr-4">Symbol</th>
                <th className="py-2 pr-4">Units</th>
                <th className="py-2 pr-4">Avg Cost</th>
                <th className="py-2 pr-4">Price</th>
                <th className="py-2 pr-4">Value</th>
                <th className="py-2">P/L</th>
              </tr>
            </thead>
            <tbody>
              {data.map((h) => {
                const price = h.quote ?? null; // per-unit major
                const value = h.currentValueMinor ?? null;
                const pl = h.plMinor ?? null;
                const plPct = h.costMinor ? pl / h.costMinor : NaN;
                const perUnit = (v) =>
                  Number.isFinite(v)
                    ? new Intl.NumberFormat(undefined, {
                        style: "currency",
                        currency: h.currency || "USD",
                      }).format(v)
                    : "—";

                return (
                  <tr key={h.symbol} className="border-t">
                    <td className="py-2 pr-4 font-medium">{h.symbol}</td>
                    <td className="py-2 pr-4">{h.units}</td>
                    <td className="py-2 pr-4">{perUnit(h.avgCostPerUnit)}</td>
                    <td className="py-2 pr-4">
                      {price != null ? perUnit(price) : "—"}
                    </td>
                    <td className="py-2 pr-4">
                      {value != null
                        ? fmtMoney(value, h.currency || "USD")
                        : "—"}
                    </td>
                    <td
                      className={`py-2 ${
                        pl != null
                          ? pl >= 0
                            ? "text-green-700"
                            : "text-red-700"
                          : "text-gray-500"
                      }`}
                    >
                      {pl != null ? fmtMoney(pl, h.currency || "USD") : "—"}{" "}
                      <span className="text-gray-500">({pct(plPct)})</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  /* ----------------------------- Category Manager ---------------------------- */
  function CategoryManager() {
    const [selected, setSelected] = useState(INVESTMENT_CATEGORY_OPTIONS[0]);
    const [busy, setBusy] = useState(false);
    const existingNames = new Set(categories.map((c) => c.name));

    async function addOne() {
      try {
        setBusy(true);
        if (existingNames.has(selected)) {
          window.alert(`Category "${selected}" already exists.`);
          return;
        }
        await createInvestmentCategory(selected);
        await loadAll();
      } catch (e) {
        window.alert(
          e?.response?.data?.error || e.message || "Failed to create category"
        );
      } finally {
        setBusy(false);
      }
    }

    async function seedAll() {
      try {
        if (!window.confirm("Seed all standard investment categories?")) return;
        setBusy(true);
        for (const name of INVESTMENT_CATEGORY_OPTIONS) {
          if (!existingNames.has(name)) {
            await createInvestmentCategory(name);
          }
        }
        await loadAll();
      } catch (e) {
        window.alert(e?.response?.data?.error || e.message || "Seeding failed");
      } finally {
        setBusy(false);
      }
    }

    return (
      <div className="p-4 bg-white border rounded-xl space-y-3 m-4">
        <div className="font-semibold">Categories (investment only)</div>
        <div className="flex flex-wrap gap-2 items-center">
          <select
            className="border rounded-lg px-3 py-2"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
          >
            {INVESTMENT_CATEGORY_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={addOne}
            disabled={busy}
            className="px-4 py-2 rounded-lg bg-[#4f772d] text-white font-semibold disabled:opacity-60"
          >
            Add category
          </button>
          <button
            type="button"
            onClick={seedAll}
            disabled={busy}
            className="px-4 py-2 rounded-lg border font-semibold disabled:opacity-60"
          >
            Seed all investment categories
          </button>
        </div>
        <div className="text-sm text-gray-600">
          Existing:{" "}
          {categories.length === 0 ? (
            <span>none</span>
          ) : (
            <span>{categories.map((c) => c.name).join(", ")}</span>
          )}
        </div>
      </div>
    );
  }

  /* --------------------------------- Rows ---------------------------------- */
  function Row({ item }) {
    const catName =
      categories.find((c) => c._id === item.categoryId)?.name || "—";
    const symbol = (item.assetSymbol || "").toUpperCase();
    const plMinor =
      symbol && plBySymbol.has(symbol) ? plBySymbol.get(symbol) : null;
    const sign = plMinor != null && plMinor >= 0 ? "+" : "";
    const plClass =
      plMinor == null
        ? "text-gray-400"
        : plMinor >= 0
        ? "text-green-700"
        : "text-red-700";

    return (
      <div className="p-4 border-b bg-white">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="font-semibold">
              {symbol ? `${symbol} • ${catName}` : catName}
            </div>
            <div className="text-sm text-gray-600 truncate">
              {item.description || "No description"}
            </div>
            <div className="text-xs text-gray-400">
              {new Date(item.date).toLocaleDateString()}
              {item.units ? ` • ${item.units} units` : ""}
            </div>
            {item.tags?.length ? (
              <div className="text-sm text-[#90a955] mt-1">
                #{item.tags.join("  #")}
              </div>
            ) : null}
          </div>

          <div className="text-right">
            <div className="font-bold">
              {fmtMoney(item.amountMinor, item.currency)}{" "}
              {plMinor != null && (
                <span className={`ml-1 ${plClass}`}>
                  ({sign}
                  {fmtMoney(plMinor, item.currency)})
                </span>
              )}
            </div>
            <div className="mt-2 flex justify-end">
              <button
                type="button"
                onClick={() => openEdit(item)}
                className="px-3 py-1 border rounded-lg mr-2"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => softDelete(item)}
                className="px-3 py-1 border rounded-lg text-red-700 border-red-200"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* --------------------------------- Modal --------------------------------- */
  function InvestmentModal() {
    // Refs MUST be declared before any conditional return to satisfy hook rules
    const amountRef = useRef(null);
    const currencyRef = useRef(null);
    const dateRef = useRef(null);
    const categoryRef = useRef(null);
    const symbolRef = useRef(null);
    const unitsRef = useRef(null);
    const descRef = useRef(null);
    const tagsRef = useRef(null);

    if (!modalOpen) return null;

    const submitFromRefs = async () => {
      const amount = amountRef.current?.value ?? "";
      const currency = (currencyRef.current?.value ?? "USD").toUpperCase();
      const date = dateRef.current?.value ?? "";
      const categoryId = categoryRef.current?.value ?? "";
      const assetSymbol = (symbolRef.current?.value ?? "").toUpperCase().trim();
      const units = Number(unitsRef.current?.value ?? 0);
      const description = (descRef.current?.value ?? "").trim();
      const tagsCsv = tagsRef.current?.value ?? "";

      const amountMinor = majorToMinor(amount, currency);
      if (Number.isNaN(amountMinor)) return window.alert("Invalid amount");
      if (!categoryId) return window.alert("Pick a category");
      if (!assetSymbol) return window.alert("Asset symbol required");
      if (!units || Number.isNaN(units) || units <= 0)
        return window.alert("Units must be a positive number");
      if (!accountId && !editing) {
        return window.alert(
          "Missing account: pass an accountId to add investments."
        );
      }

      const payload = {
        accountId: editing ? editing.accountId : accountId,
        categoryId,
        type: "investment",
        amountMinor,
        currency,
        date: new Date(date).toISOString(),
        assetSymbol,
        units,
        description: description || null,
        tags: tagsCsv
          .split(",")
          .map((s) => s.trim())
          .filter((s) => s.length > 0),
      };

      try {
        if (!editing) {
          const { data } = await api.post("/transactions", payload);
          setTransactions((prev) => [data, ...prev]);
        } else {
          const { data } = await api.put(
            `/transactions/${editing._id}`,
            payload
          );
          setTransactions((prev) =>
            prev.map((t) => (t._id === data._id ? data : t))
          );
        }
        setModalOpen(false);
        // refresh perf so P/L updates
        const perf = await api.get("/investments/performance");
        setHoldings(perf.data?.holdings || []);
      } catch (e) {
        window.alert(e?.response?.data?.error || e.message || "Error");
      }
    };

    return (
      <div
        className="fixed inset-0 z-50 grid place-items-center bg-black/40"
        onKeyDown={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="w-full max-w-xl bg-white rounded-2xl p-5 space-y-4">
          <div className="text-lg font-bold">
            {editing ? "Edit Investment" : "New Investment"}
          </div>

          <div className="flex gap-3">
            <div className="space-y-1 w-full">
              <label className="font-semibold text-sm">Total Cost</label>
              <input
                ref={amountRef}
                defaultValue={form.amount}
                placeholder="e.g., 1500.00"
                inputMode="decimal"
                className="w-full border rounded-lg px-3 py-2 bg-white placeholder-gray-400 outline-none focus:ring-2 focus:ring-[#90a955]"
              />
            </div>
            <div className="space-y-1 w-28">
              <label className="font-semibold text-sm">Currency</label>
              <input
                ref={currencyRef}
                defaultValue={form.currency}
                maxLength={3}
                className="w-full border rounded-lg px-3 py-2 bg-white placeholder-gray-400 outline-none focus:ring-2 focus:ring-[#90a955]"
                onBlur={(e) => (e.target.value = e.target.value.toUpperCase())}
              />
            </div>
          </div>

          <div className="flex gap-3">
            <div className="space-y-1 w-full">
              <label className="font-semibold text-sm">Asset Symbol</label>
              <input
                ref={symbolRef}
                defaultValue={form.assetSymbol}
                placeholder="e.g., AAPL, BTC-USD, VOO"
                className="w-full border rounded-lg px-3 py-2 bg-white placeholder-gray-400 outline-none focus:ring-2 focus:ring-[#90a955]"
                onBlur={(e) => (e.target.value = e.target.value.toUpperCase())}
              />
              <p className="text-xs text-gray-500">
                Use Yahoo-style symbols (AAPL, VOO, BTC-USD…)
              </p>
            </div>
            <div className="space-y-1 w-36">
              <label className="font-semibold text-sm">Units</label>
              <input
                ref={unitsRef}
                defaultValue={form.units}
                placeholder="e.g., 2.5"
                inputMode="decimal"
                className="w-full border rounded-lg px-3 py-2 bg-white placeholder-gray-400 outline-none focus:ring-2 focus:ring-[#90a955]"
              />
            </div>
          </div>

          <div className="space-y-1 w-full">
            <label className="font-semibold text-sm">Date</label>
            <input
              ref={dateRef}
              defaultValue={form.date}
              placeholder="YYYY-MM-DD"
              className="w-full border rounded-lg px-3 py-2 bg-white placeholder-gray-400 outline-none focus:ring-2 focus:ring-[#90a955]"
            />
          </div>

          <div className="space-y-1 w-full">
            <label className="font-semibold text-sm">Category</label>
            <select
              ref={categoryRef}
              defaultValue={form.categoryId ?? ""}
              className="w-full border rounded-lg px-3 py-2 bg-white"
            >
              {categories.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1 w-full">
            <label className="font-semibold text-sm">Description</label>
            <input
              ref={descRef}
              defaultValue={form.description}
              placeholder="Optional memo"
              className="w-full border rounded-lg px-3 py-2 bg-white placeholder-gray-400 outline-none focus:ring-2 focus:ring-[#90a955]"
            />
          </div>

          <div className="space-y-1 w-full">
            <label className="font-semibold text-sm">
              Tags (comma-separated)
            </label>
            <input
              ref={tagsRef}
              defaultValue={form.tagsCsv}
              placeholder="long-term, dividend"
              className="w-full border rounded-lg px-3 py-2 bg-white placeholder-gray-400 outline-none focus:ring-2 focus:ring-[#90a955]"
            />
          </div>

          <div className="flex gap-3 justify-end pt-2">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 border rounded-xl"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={submitFromRefs}
              className="px-4 py-2 rounded-xl bg-[#4f772d] text-white font-semibold"
            >
              {editing ? "Save" : "Add"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* --------------------------------- Layout -------------------------------- */
  if (loading) {
    return (
      <div className="grid place-items-center h-[60vh]">
        <div className="text-center">
          <div className="animate-pulse text-gray-600">Loading…</div>
          {err ? <div className="mt-2 text-red-700">{err}</div> : null}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-[#f8faf8]">
      <Header />

      {/* NEW: Holdings summary */}
      <HoldingsSummary data={holdings} />

      {/* Step 1: Manage categories (investment-only) */}
      <CategoryManager />

      {err ? (
        <div className="mx-4 mb-4 p-3 bg-red-50 text-red-700 border rounded-xl">
          {err}
        </div>
      ) : null}

      {/* Step 2: Use those categories to add/list investments */}
      {filtered.length === 0 ? (
        <div className="p-6 text-center text-gray-600">
          No investments yet. Add your first one.
        </div>
      ) : (
        <div>
          {filtered.map((item) => (
            <Row key={item._id} item={item} />
          ))}
        </div>
      )}

      <InvestmentModal />
    </div>
  );
}
