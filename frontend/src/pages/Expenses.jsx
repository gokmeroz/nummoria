/* eslint-disable react-hooks/rules-of-hooks */
/* eslint-disable no-unused-vars */
// src/pages/expenses.jsx
import React, {
  useEffect,
  useMemo,
  useState,
  useRef,
  useCallback,
} from "react";
import api from "../lib/api";

/* --------------------------- expense-only categories --------------------------- */
const EXPENSE_CATEGORY_OPTIONS = [
  "Rent",
  "Housing Payments & Maintenance",
  "Debt Payments",
  "Transportation",
  "Health & Medical",
  "Utilities",
  "Groceries",
  "Dining Out",
  "Education",
  "Miscellaneous",
  "Entertainment",
  "Travel",
  "Gifts & Donations",
  "Personal Care",
  "Shopping",
  "Subscriptions",
  "Taxes",
  "Insurance",
  "Business Expenses",
  "Other Expense",
];

const main = "#4f772d";
const secondary = "#90a955";

// Keep kind lowercase to match API/DB
async function createExpenseCategory(name) {
  return api.post("/categories", { name, kind: "expense" });
}

/* ------------------------------ Locale control ------------------------------ */
/* HERE CHANGED: force the date pickers to English.
   - "en-US" => month-first UI
   - "en-GB" => day-first UI
*/
const DATE_LANG = "en-US"; // change to "en-GB" if you prefer DD/MM/YYYY

/* ---------------------------------- Screen ---------------------------------- */
export default function expensesScreen({ accountId }) {
  // data
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [accounts, setAccounts] = useState([]);

  // ui
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  //TODO THE FILTERING: unified search + filters
  const [q, setQ] = useState("");

  // HERE CHANGED: store ISO strings from <input type="date"> (YYYY-MM-DD)
  const [fStartISO, setFStartISO] = useState(""); // e.g. "2025-01-01"
  const [fEndISO, setFEndISO] = useState(""); // e.g. "2025-12-31"

  const [fAccountId, setFAccountId] = useState("ALL");
  const [fCategoryId, setFCategoryId] = useState("ALL");
  const [fCurrency, setFCurrency] = useState("ALL");
  const [fMin, setFMin] = useState("");
  const [fMax, setFMax] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  // HERE CHANGED: sorting options
  const [sortKey, setSortKey] = useState("date_desc");

  // modal state (create / edit)
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);

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
    accountId: "",
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
      currency: cur || "USD",
    }).format((minor || 0) / Math.pow(10, decimalsForCurrency(cur || "USD")));

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

  const currencies = useMemo(() => {
    const s = new Set(
      transactions
        .filter((t) => t.type === "expense")
        .map((t) => t.currency || "USD")
    );
    return ["ALL", ...Array.from(s)];
  }, [transactions]);

  /* ---------------------------------- Data ---------------------------------- */
  const loadAll = useCallback(async () => {
    try {
      setLoading(true);
      setErr("");
      const [txRes, catRes, accRes] = await Promise.all([
        api.get("/transactions"),
        api.get("/categories"),
        api.get("/accounts"),
      ]);
      const cats = (catRes.data || []).filter(
        (c) => c.kind === "expense" && !c.isDeleted
      );
      setCategories(cats);
      setTransactions(txRes.data || []);
      setAccounts((accRes.data || []).filter((a) => !a.isDeleted));
    } catch (e) {
      setErr(e?.response?.data?.error || e.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  /* ------------------------------- Filtering -------------------------------- */
  //TODO THE FILTERING: central filtering (always limit to expense rows)
  const rows = useMemo(() => {
    // HERE CHANGED: convert ISO strings to Date; end is inclusive to end-of-day
    const start = fStartISO ? new Date(`${fStartISO}T00:00:00`) : null;
    const end = fEndISO ? new Date(`${fEndISO}T23:59:59.999`) : null;

    const minNum = fMin !== "" ? Number(fMin) : null; // major
    const maxNum = fMax !== "" ? Number(fMax) : null; // major
    const needle = q.trim().toLowerCase();

    const filtered = transactions.filter((t) => {
      if ((t.type || "") !== "expense") return false;

      // account
      if (fAccountId !== "ALL" && t.accountId !== fAccountId) return false;

      // category
      if (fCategoryId !== "ALL" && t.categoryId !== fCategoryId) return false;

      // currency
      const cur = t.currency || "USD";
      if (fCurrency !== "ALL" && cur !== fCurrency) return false;

      // dates
      const dt = new Date(t.date);
      if (start && dt < start) return false;
      if (end && dt > end) return false;

      // amount (major)
      const major =
        Number(t.amountMinor || 0) / Math.pow(10, decimalsForCurrency(cur));
      if (minNum !== null && major < minNum) return false;
      if (maxNum !== null && major > maxNum) return false;

      // free text
      if (needle) {
        const cat = categoriesById.get(t.categoryId)?.name || "";
        const acc = accountsById.get(t.accountId)?.name || "";
        const hay = `${t.description || ""} ${t.notes || ""} ${cat} ${acc} ${(
          t.tags || []
        ).join(" ")} ${(t.assetSymbol || "").toUpperCase()}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }

      return true;
    });

    // HERE CHANGED: new sort engine
    filtered.sort((a, b) => {
      switch (sortKey) {
        case "date_asc":
          return new Date(a.date) - new Date(b.date);
        case "amount_desc": {
          const aMaj =
            Number(a.amountMinor || 0) /
            Math.pow(10, decimalsForCurrency(a.currency || "USD"));
          const bMaj =
            Number(b.amountMinor || 0) /
            Math.pow(10, decimalsForCurrency(b.currency || "USD"));
          return bMaj - aMaj;
        }
        case "amount_asc": {
          const aMaj =
            Number(a.amountMinor || 0) /
            Math.pow(10, decimalsForCurrency(a.currency || "USD"));
          const bMaj =
            Number(b.amountMinor || 0) /
            Math.pow(10, decimalsForCurrency(b.currency || "USD"));
          return aMaj - bMaj;
        }
        case "symbol_asc":
          return (a.assetSymbol || "").localeCompare(b.assetSymbol || "");
        case "symbol_desc":
          return (b.assetSymbol || "").localeCompare(a.assetSymbol || "");
        case "date_desc":
        default:
          return new Date(b.date) - new Date(a.date);
      }
    });

    return filtered;
  }, [
    transactions,
    q,
    fStartISO, // HERE CHANGED
    fEndISO, // HERE CHANGED
    fAccountId,
    fCategoryId,
    fCurrency,
    fMin,
    fMax,
    categoriesById,
    accountsById,
    sortKey,
  ]);

  /* --------------------------------- Totals --------------------------------- */
  const totals = useMemo(() => {
    const byCur = {};
    for (const t of rows) {
      byCur[t.currency] = (byCur[t.currency] || 0) + Number(t.amountMinor || 0);
    }
    return Object.entries(byCur).map(([cur, minor]) => ({
      cur,
      major: minorToMajor(minor, cur),
    }));
  }, [rows]);

  /* --------------------------------- CRUD Tx -------------------------------- */
  function openCreate() {
    const defaultAccId = accountId || accounts[0]?._id || "";
    const defaultCur =
      accounts.find((a) => a._id === defaultAccId)?.currency || "USD";

    setEditing(null);
    setForm({
      amount: "",
      currency: defaultCur,
      date: new Date().toISOString().slice(0, 10),
      categoryId: categories[0]?._id || "",
      assetSymbol: "",
      units: "",
      description: "",
      tagsCsv: "",
      accountId: defaultAccId,
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
      assetSymbol: (tx.assetSymbol || "").toUpperCase(),
      units: tx.units ?? "",
      description: tx.description || "",
      tagsCsv: (tx.tags || []).join(", "),
      accountId: tx.accountId || accountId || accounts[0]?._id || "",
    });
    setModalOpen(true);
  }

  async function softDelete(tx) {
    if (!window.confirm("Delete expense?")) return;
    try {
      await api.delete(`/transactions/${tx._id}`);
      setTransactions((prev) => prev.filter((t) => t._id !== tx._id));
    } catch (e) {
      window.alert(e?.response?.data?.error || e.message || "Error");
    }
  }

  /* --------------------------------- UI Bits -------------------------------- */
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
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">expenses</h1>

          {/* HERE CHANGED: Filters toggle + Sorting dropdown */}
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setShowFilters((v) => !v)}
              className="inline-flex items-center gap-1 text-[#4f772d] hover:text-[#3f5f24]"
              title="Show filters"
            >
              {/* simple sliders icon */}
              <svg
                className="w-4 h-4"
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
              <span className="font-medium">Filters</span>
            </button>

            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Sorting</span>
              <select
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value)}
                className="border rounded-lg px-3 py-1.5"
                title="Sorting"
              >
                <option value="date_desc">Newest</option>
                <option value="date_asc">Oldest</option>
                <option value="amount_desc">Amount: High → Low</option>
                <option value="amount_asc">Amount: Low → High</option>
                <option value="symbol_asc">Symbol: A → Z</option>
                <option value="symbol_desc">Symbol: Z → A</option>
              </select>
            </div>
          </div>
        </div>

        {/*TODO THE FILTERING: unified search box */}
        <div className="flex gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search symbol, description, notes, account, category or #tags"
            className="flex-1 border rounded-lg px-3 py-2"
          />
        </div>

        {/*TODO THE FILTERING: quick category chips feed fCategoryId */}
        <div className="flex flex-wrap gap-2">
          <Chip
            label="All categories"
            selected={fCategoryId === "ALL"}
            onClick={() => setFCategoryId("ALL")}
          />
          {categories.map((c) => (
            <Chip
              key={c._id}
              label={c.name}
              selected={fCategoryId === c._id}
              onClick={() => setFCategoryId(c._id)}
            />
          ))}
        </div>

        {/* HERE CHANGED: collapsible filter panel with EN-native date pickers */}
        {showFilters && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 p-3 border rounded-xl bg-[#fafdf9]">
            <div className="flex flex-col gap-1">
              <label className="text-sm text-gray-600">Account</label>
              <select
                value={fAccountId}
                onChange={(e) => setFAccountId(e.target.value)}
                className="border rounded-lg px-3 py-2"
              >
                <option value="ALL">All accounts</option>
                {accounts.map((a) => (
                  <option key={a._id} value={a._id}>
                    {a.name} · {a.type} · {a.currency}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm text-gray-600">Currency</label>
              <select
                value={fCurrency}
                onChange={(e) => setFCurrency(e.target.value)}
                className="border rounded-lg px-3 py-2"
              >
                {currencies.map((c) => (
                  <option key={c} value={c}>
                    {c === "ALL" ? "All currencies" : c}
                  </option>
                ))}
              </select>
            </div>

            {/* HERE CHANGED: native date picker in English */}
            <div className="flex flex-col gap-1">
              <label className="text-sm text-gray-600">From</label>
              <input
                type="date"
                lang={DATE_LANG} // <-- forces English UI, no Turkish text
                value={fStartISO}
                onChange={(e) => setFStartISO(e.target.value)}
                className="border rounded-lg px-3 py-2"
                title="From date"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm text-gray-600">To</label>
              <input
                type="date"
                lang={DATE_LANG} // <-- forces English UI, no Turkish text
                value={fEndISO}
                onChange={(e) => setFEndISO(e.target.value)}
                className="border rounded-lg px-3 py-2"
                title="To date"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm text-gray-600">Min amount</label>
              <input
                type="number"
                inputMode="decimal"
                placeholder="e.g., 50"
                value={fMin}
                onChange={(e) => setFMin(e.target.value)}
                className="border rounded-lg px-3 py-2"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm text-gray-600">Max amount</label>
              <input
                type="number"
                inputMode="decimal"
                placeholder="e.g., 1000"
                value={fMax}
                onChange={(e) => setFMax(e.target.value)}
                className="border rounded-lg px-3 py-2"
              />
            </div>

            <div className="col-span-full flex gap-2 justify-end">
              <button
                type="button"
                className="px-3 py-2 border rounded-lg"
                onClick={() => {
                  setFAccountId("ALL");
                  setFCategoryId("ALL");
                  setFCurrency("ALL");
                  setFStartISO(""); // HERE CHANGED
                  setFEndISO(""); // HERE CHANGED
                  setFMin("");
                  setFMax("");
                }}
              >
                Clear filters
              </button>
              <button
                type="button"
                className="px-3 py-2 rounded-lg text-white"
                style={{ background: main }}
                onClick={() => setShowFilters(false)}
              >
                Apply
              </button>
            </div>
          </div>
        )}

        {/* Totals */}
        <div className="flex flex-wrap items-center gap-4 text-sm">
          {totals.map(({ cur, major }) => (
            <span key={cur} className="font-semibold">
              Total {cur}: {major}
            </span>
          ))}
        </div>

        {/* Actions */}
        <div className="flex gap-3 items-center flex-wrap">
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center px-4 py-2 rounded-xl bg-[#4f772d] text-white font-bold hover:bg-[#3f5f24]"
          >
            + New expense
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

  /* ----------------------------- Category Manager ---------------------------- */
  function CategoryManager() {
    const [selected, setSelected] = useState(EXPENSE_CATEGORY_OPTIONS[0]);
    const [busy, setBusy] = useState(false);
    const existingNames = new Set(categories.map((c) => c.name));

    async function addOne() {
      try {
        setBusy(true);
        if (existingNames.has(selected)) {
          window.alert(`Category "${selected}" already exists.`);
          return;
        }
        await createExpenseCategory(selected);
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
        if (!window.confirm("Seed all standard expense categories?")) return;
        setBusy(true);
        for (const name of EXPENSE_CATEGORY_OPTIONS) {
          if (!existingNames.has(name)) {
            await createExpenseCategory(name);
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
        <div className="font-semibold">Categories (expense only)</div>
        <div className="flex flex-wrap gap-2 items-center">
          <select
            className="border rounded-lg px-3 py-2"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
          >
            {EXPENSE_CATEGORY_OPTIONS.map((n) => (
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
            Seed all expense categories
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
    const accName = accountsById.get(item.accountId)?.name || "—";
    const symbol = (item.assetSymbol || "").toUpperCase();
    const units = item.units ?? null;

    return (
      <div className="p-4 border-b bg-white">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="font-semibold">
              {symbol ? `${symbol} • ${catName}` : catName}
            </div>
            <div className="text-xs text-gray-500 mb-1">
              <span className="inline-block px-2 py-0.5 rounded-full border">
                {accName}
              </span>
              {units ? (
                <span className="ml-2 text-gray-500">{units} units</span>
              ) : null}
            </div>
            <div className="text-sm text-gray-600 truncate">
              {item.description || "No description"}
            </div>
            <div className="text-xs text-gray-400">
              {new Date(item.date).toLocaleDateString()}
            </div>
            {item.tags?.length ? (
              <div className="text-sm text-[#90a955] mt-1">
                #{item.tags.join("  #")}
              </div>
            ) : null}
          </div>

          <div className="text-right">
            <div className="font-bold">
              -{minorToMajor(item.amountMinor, item.currency)} {item.currency}
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
  function expenseModal() {
    // Refs MUST be declared before any conditional return to satisfy hook rules
    const amountRef = useRef(null);
    const currencyRef = useRef(null);
    const dateRef = useRef(null);
    const categoryRef = useRef(null);
    const symbolRef = useRef(null);
    const unitsRef = useRef(null);
    const descRef = useRef(null);
    const tagsRef = useRef(null);
    const accountRef = useRef(null);

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
      const pickedAccountId = accountRef.current?.value ?? "";

      const amountMinor = majorToMinor(amount, currency);
      if (Number.isNaN(amountMinor)) return window.alert("Invalid amount");
      if (!categoryId) return window.alert("Pick a category");
      if (!pickedAccountId) return window.alert("Pick an account");
      if (!assetSymbol) return window.alert("Asset symbol required");
      if (!units || Number.isNaN(units) || units <= 0)
        return window.alert("Units must be a positive number");

      const payload = {
        accountId: pickedAccountId,
        categoryId,
        type: "expense",
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
      } catch (e) {
        window.alert(e?.response?.data?.error || e.message || "Error");
      }
    };

    const defaultAccId = form.accountId || accountId || accounts[0]?._id || "";

    return (
      <div
        className="fixed inset-0 z-50 grid place-items-center bg-black/40"
        onKeyDown={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="w-full max-w-xl bg-white rounded-2xl p-5 space-y-4">
          <div className="text-lg font-bold">
            {editing ? "Edit expense" : "New expense"}
          </div>

          {/* Account */}
          <div className="space-y-1 w-full">
            <label className="font-semibold text-sm">Account</label>
            <select
              ref={accountRef}
              defaultValue={defaultAccId}
              className="w-full border rounded-lg px-3 py-2 bg-white"
            >
              <option value="">— Pick an account —</option>
              {accounts.map((a) => (
                <option key={a._id} value={a._id}>
                  {a.name} · {a.type} · {a.currency}
                </option>
              ))}
            </select>
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

      {/* Step 1: Manage categories (expense-only) */}
      <CategoryManager />

      {err ? (
        <div className="mx-4 mb-4 p-3 bg-red-50 text-red-700 border rounded-xl">
          {err}
        </div>
      ) : null}

      {/* Step 2: Use those categories to add/list expenses */}
      {rows.length === 0 ? (
        <div className="p-6 text-center text-gray-600">
          No expenses found. Add your first one or adjust filters.
        </div>
      ) : (
        <div>
          {rows.map((item) => (
            <Row key={item._id} item={item} />
          ))}
        </div>
      )}
      <expenseModal />
    </div>
  );
}
