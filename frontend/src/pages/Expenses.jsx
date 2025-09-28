/* eslint-disable no-undef */
/* eslint-disable no-empty */
/* eslint-disable react-hooks/rules-of-hooks */
/* eslint-disable no-unused-vars */
import React, {
  useEffect,
  useMemo,
  useState,
  useRef,
  useCallback,
} from "react";
import api from "../lib/api";

/* --------------------------- Expense-only categories --------------------------- */
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
const DATE_LANG = "en-US";

/* ----------------------------- Weekday helpers ------------------------------ */
const WEEKDAY_OPTS = [
  { label: "Sun", val: 0 },
  { label: "Mon", val: 1 },
  { label: "Tue", val: 2 },
  { label: "Wed", val: 3 },
  { label: "Thu", val: 4 },
  { label: "Fri", val: 5 },
  { label: "Sat", val: 6 },
];

/* ---------------------------------- Screen ---------------------------------- */
export default function ExpensesScreen({ accountId }) {
  // data
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [accounts, setAccounts] = useState([]);

  // ui
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // search + filters
  const [q, setQ] = useState("");
  const [fStartISO, setFStartISO] = useState("");
  const [fEndISO, setFEndISO] = useState("");
  const [fAccountId, setFAccountId] = useState("ALL");
  const [fCategoryId, setFCategoryId] = useState("ALL");
  const [fCurrency, setFCurrency] = useState("ALL");
  const [fMin, setFMin] = useState("");
  const [fMax, setFMax] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const [sortKey, setSortKey] = useState("date_desc");

  // modal state (create / edit)
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  // form seeds
  const [form, setForm] = useState({
    amount: "",
    currency: "USD",
    date: new Date().toISOString().slice(0, 10),
    categoryId: "",
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
  const rows = useMemo(() => {
    const start = fStartISO ? new Date(`${fStartISO}T00:00:00`) : null;
    const end = fEndISO ? new Date(`${fEndISO}T23:59:59.999`) : null;

    const minNum = fMin !== "" ? Number(fMin) : null;
    const maxNum = fMax !== "" ? Number(fMax) : null;
    const needle = q.trim().toLowerCase();

    const filtered = transactions.filter((t) => {
      if ((t.type || "") !== "expense") return false;

      // Hide recurrence templates from the list; show only real instances
      if (t.recurrence && t.recurrence.isTemplate === true) return false;

      if (fAccountId !== "ALL" && t.accountId !== fAccountId) return false;
      if (fCategoryId !== "ALL" && t.categoryId !== fCategoryId) return false;

      const cur = t.currency || "USD";
      if (fCurrency !== "ALL" && cur !== fCurrency) return false;

      const dt = new Date(t.date);
      if (start && dt < start) return false;
      if (end && dt > end) return false;

      const major =
        Number(t.amountMinor || 0) / Math.pow(10, decimalsForCurrency(cur));
      if (minNum !== null && major < minNum) return false;
      if (maxNum !== null && major > maxNum) return false;

      if (needle) {
        const cat = categoriesById.get(t.categoryId)?.name || "";
        the;
        const acc = accountsById.get(t.accountId)?.name || "";
        const hay = `${t.description || ""} ${t.notes || ""} ${cat} ${acc} ${(
          t.tags || []
        ).join(" ")}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }

      return true;
    });

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
        case "date_desc":
        default:
          return new Date(b.date) - new Date(a.date);
      }
    });

    return filtered;
  }, [
    transactions,
    q,
    fStartISO,
    fEndISO,
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
      // robust compare + server refresh (keeps totals/filters right)
      setTransactions((prev) =>
        prev.filter((t) => String(t._id) !== String(tx._id))
      );
      await loadAll();
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
  async function runRecurring() {
    try {
      await api.post("/transactions/recurrence/run", { aheadDays: 7 });
      await loadAll();
    } catch (e) {
      window.alert(e?.response?.data?.error || e.message || "Run failed");
    }
  }

  function Header() {
    return (
      <div className="space-y-3 p-4 border-b bg-white">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Expenses</h1>

          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setShowFilters((v) => !v)}
              className="inline-flex items-center gap-1 text-[#4f772d] hover:text-[#3f5f24]"
              title="Show filters"
            >
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
              </select>
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search description, notes, account, category or #tags"
            className="flex-1 border rounded-lg px-3 py-2"
          />
        </div>

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

            <div className="flex flex-col gap-1">
              <label className="text-sm text-gray-600">From</label>
              <input
                type="date"
                lang={DATE_LANG}
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
                lang={DATE_LANG}
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
                  setFStartISO("");
                  setFEndISO("");
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
          <button
            type="button"
            onClick={runRecurring}
            className="px-3 py-2 rounded-xl border"
            title="Materialize upcoming recurring expenses (7 days)"
          >
            Run recurring (7 days)
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
    const isRecurringInstance = !!(item.recurrence && item.recurrence.parentId);

    return (
      <div className="p-4 border-b bg-white">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="font-semibold flex items-center gap-2">
              <span>{catName}</span>
              {isRecurringInstance && (
                <span className="text-[11px] px-2 py-0.5 rounded-full border border-dashed text-[#2f5d1d]">
                  Recurring
                </span>
              )}
            </div>
            <div className="text-xs text-gray-500 mb-1">
              <span className="inline-block px-2 py-0.5 rounded-full border">
                {accName}
              </span>
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
  function ExpenseModal() {
    // Refs MUST be declared before any conditional return
    const amountRef = useRef(null);
    const currencyRef = useRef(null);
    const dateRef = useRef(null);
    const categoryRef = useRef(null);
    const descRef = useRef(null);
    const tagsRef = useRef(null);
    const accountRef = useRef(null);

    // Recurrence UI state
    const [repeatOn, setRepeatOn] = useState(false);
    const [frequency, setFrequency] = useState("none"); // none|daily|weekly|monthly|yearly
    const [interval, setInterval] = useState(1);
    const [startDate, setStartDate] = useState(form.date);
    const [byMonthDay, setByMonthDay] = useState("");
    const [byWeekday, setByWeekday] = useState([]); // array of numbers 0..6
    const [autopost, setAutopost] = useState("post"); // post|preview
    // Option B: end by date
    const [endISO, setEndISO] = useState(""); // YYYY-MM-DD

    if (!modalOpen) return null;

    function toggleWeekday(val) {
      setByWeekday((prev) =>
        prev.includes(val) ? prev.filter((v) => v !== val) : [...prev, val]
      );
    }

    const submitFromRefs = async () => {
      const amount = amountRef.current?.value ?? "";
      const currency = (currencyRef.current?.value ?? "USD").toUpperCase();
      const date = dateRef.current?.value ?? "";
      const categoryId = categoryRef.current?.value ?? "";
      const description = (descRef.current?.value ?? "").trim();
      const tagsCsv = tagsRef.current?.value ?? "";
      const pickedAccountId = accountRef.current?.value ?? "";

      const amountMinor = majorToMinor(amount, currency);
      if (Number.isNaN(amountMinor)) return window.alert("Invalid amount");
      if (!categoryId) return window.alert("Pick a category");
      if (!pickedAccountId) return window.alert("Pick an account");

      const payload = {
        accountId: pickedAccountId,
        categoryId,
        type: "expense",
        amountMinor,
        currency,
        date: new Date(date).toISOString(),
        description: description || null,
        tags: tagsCsv
          .split(",")
          .map((s) => s.trim())
          .filter((s) => s.length > 0),
      };

      // Recurrence template branch (Option B adds endDate)
      if (repeatOn && frequency !== "none") {
        const rule = {
          isTemplate: true,
          frequency,
          interval: Math.max(1, Number(interval || 1)),
          startDate: new Date(startDate || date).toISOString(),
          autopost,
        };
        if (frequency === "monthly" && byMonthDay) {
          const n = Number(byMonthDay);
          if (Number.isNaN(n) || n < 1 || n > 31)
            return window.alert("byMonthDay must be 1..31");
          rule.byMonthDay = n;
        }
        if (frequency === "weekly" && byWeekday.length > 0) {
          rule.byWeekday = byWeekday.slice().sort();
        }
        // ---- Option B: fixed end date ----
        if (endISO) {
          const d = new Date(endISO);
          if (Number.isNaN(d.getTime()))
            return window.alert("Invalid end date");
          rule.endDate = d.toISOString(); // inclusive stop on backend side
        }
        payload.recurrence = rule;
      }

      try {
        if (!editing) {
          const { data } = await api.post("/transactions", payload);

          // If a template was created, best-effort: materialize due now
          if (data?.recurrence?.isTemplate === true) {
            try {
              await api.post("/transactions/recurrence/run", { aheadDays: 0 });
            } catch {}
            await loadAll();
          } else {
            setTransactions((prev) => [data, ...prev]);
          }
        } else {
          // Editing an existing instance
          const { data } = await api.put(
            `/transactions/${editing._id}`,
            payload
          );
          setTransactions((prev) =>
            prev.map((t) => (String(t._id) === String(data._id) ? data : t))
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
              <label className="font-semibold text-sm">Amount</label>
              <input
                ref={amountRef}
                defaultValue={form.amount}
                placeholder="e.g., 120.00"
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

          <div className="space-y-1 w-full">
            <label className="font-semibold text-sm">Date</label>
            <input
              ref={dateRef}
              defaultValue={form.date}
              type="date"
              lang={DATE_LANG}
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
              placeholder="groceries, reimbursement"
              className="w-full border rounded-lg px-3 py-2 bg-white placeholder-gray-400 outline-none focus:ring-2 focus:ring-[#90a955]"
            />
          </div>

          {/* --------------------------- Recurrence UI --------------------------- */}
          {!editing && (
            <div className="mt-2 border-t pt-3">
              <div className="flex items-center justify-between">
                <div className="font-semibold">Repeat</div>
                <label className="inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={repeatOn}
                    onChange={(e) => setRepeatOn(e.target.checked)}
                  />
                  <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:bg-[#4f772d] relative">
                    <div className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition peer-checked:translate-x-5" />
                  </div>
                </label>
              </div>

              {repeatOn && (
                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-sm text-gray-600">Frequency</label>
                    <select
                      className="w-full border rounded-lg px-3 py-2 bg-white"
                      value={frequency}
                      onChange={(e) => setFrequency(e.target.value)}
                    >
                      <option value="none">—</option>
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                      <option value="yearly">Yearly</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-sm text-gray-600">Every</label>
                    <input
                      type="number"
                      min={1}
                      value={interval}
                      onChange={(e) => setInterval(e.target.value)}
                      className="w-full border rounded-lg px-3 py-2 bg-white"
                      placeholder="e.g., 1"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-sm text-gray-600">Start date</label>
                    <input
                      type="date"
                      lang={DATE_LANG}
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full border rounded-lg px-3 py-2 bg-white"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-sm text-gray-600">Autopost</label>
                    <select
                      className="w-full border rounded-lg px-3 py-2 bg-white"
                      value={autopost}
                      onChange={(e) => setAutopost(e.target.value)}
                    >
                      <option value="post">Post automatically</option>
                      <option value="preview">Preview only</option>
                    </select>
                  </div>

                  {frequency === "monthly" && (
                    <div className="space-y-1 md:col-span-2">
                      <label className="text-sm text-gray-600">
                        On day of month
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={31}
                        value={byMonthDay}
                        onChange={(e) => setByMonthDay(e.target.value)}
                        className="w-full border rounded-lg px-3 py-2 bg-white"
                        placeholder="1..31"
                      />
                      <div className="text-xs text-gray-500">
                        We’ll clamp to the last day for shorter months.
                      </div>
                    </div>
                  )}

                  {frequency === "weekly" && (
                    <div className="space-y-1 md:col-span-2">
                      <label className="text-sm text-gray-600">
                        Days of week
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {WEEKDAY_OPTS.map((w) => (
                          <button
                            type="button"
                            key={w.val}
                            onClick={() => toggleWeekday(w.val)}
                            className={`px-3 py-1.5 rounded-full border text-sm ${
                              byWeekday.includes(w.val)
                                ? "border-[#4f772d] bg-[#e8f5e9] text-[#2f5d1d]"
                                : "border-gray-300 bg-white text-gray-800"
                            }`}
                          >
                            {w.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Option B: End date */}
                  <div className="space-y-1 md:col-span-2">
                    <label className="text-sm text-gray-600">
                      End date (inclusive)
                    </label>
                    <input
                      type="date"
                      lang={DATE_LANG}
                      value={endISO}
                      onChange={(e) => setEndISO(e.target.value)}
                      className="w-full border rounded-lg px-3 py-2 bg-white"
                      placeholder="YYYY-MM-DD"
                    />
                    <div className="text-xs text-gray-500">
                      The series will stop once a due date is after this day.
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

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

      <CategoryManager />

      {err ? (
        <div className="mx-4 mb-4 p-3 bg-red-50 text-red-700 border rounded-xl">
          {err}
        </div>
      ) : null}

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
      <ExpenseModal />
    </div>
  );
}
