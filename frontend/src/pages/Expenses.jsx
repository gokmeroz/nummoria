// src/pages/Expenses.jsx
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

async function createExpenseCategory(name) {
  return api.post("/categories", { name, kind: "expense" });
}

/* ---------------------------------- Screen ---------------------------------- */
export default function ExpensesScreen({ accountId }) {
  // data
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]); // expense-kind only
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // [ACCOUNT] NEW: accounts state for choose-account in modal
  const [accounts, setAccounts] = useState([]);

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
    description: "",
    tagsCsv: "",
    // [ACCOUNT] NEW: accountId seed used by the modal select
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

  /* --------------------------------- Derived -------------------------------- */
  const filtered = useMemo(() => {
    let rows = transactions.filter((t) => t.type === "expense");
    if (selectedCategory !== "ALL") {
      rows = rows.filter((t) => t.categoryId === selectedCategory);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter(
        (t) =>
          (t.description || "").toLowerCase().includes(q) ||
          (t.notes || "").toLowerCase().includes(q) ||
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

  // [ACCOUNT] NEW: quick map to show account names in list rows
  const accountsById = useMemo(() => {
    const m = new Map();
    for (const a of accounts) m.set(a._id, a);
    return m;
  }, [accounts]);

  /* ---------------------------------- Data ---------------------------------- */
  const loadAll = useCallback(async () => {
    try {
      setLoading(true);
      setErr("");
      // [ACCOUNT] MOD: also fetch /accounts so modal can list them
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
      // [ACCOUNT] NEW: filter out deleted and store
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

  /* --------------------------------- CRUD Tx -------------------------------- */
  function openCreate() {
    // [ACCOUNT] NEW: prefer the page prop accountId, else first account
    const defaultAccId = accountId || accounts[0]?._id || "";
    setEditing(null);
    setForm({
      amount: "",
      currency: filtered[0]?.currency || "USD",
      date: new Date().toISOString().slice(0, 10),
      categoryId: categories[0]?._id || "",
      description: "",
      tagsCsv: "",
      // [ACCOUNT] NEW
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
      // [ACCOUNT] NEW: carry the existing account (editable)
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
        <h1 className="text-2xl font-bold">Expenses</h1>

        <div className="flex gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search description, notes or #tags"
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
              Total {cur}: {major}
            </span>
          ))}
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center px-4 py-2 rounded-xl bg-[#4f772d] text-white font-bold hover:bg-[#3f5f24]"
          >
            + New Expense
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
    // [ACCOUNT] NEW: show the account name the expense belongs to
    const accName = accountsById.get(item.accountId)?.name || "—";

    return (
      <div className="p-4 border-b bg-white">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="font-semibold">{catName}</div>
            <div className="text-xs text-gray-500 mb-1">
              {/* [ACCOUNT] NEW: tiny badge with account */}
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
    // Refs MUST be declared before any conditional return to satisfy hook rules
    const amountRef = useRef(null);
    const currencyRef = useRef(null);
    const dateRef = useRef(null);
    const categoryRef = useRef(null);
    const descRef = useRef(null);
    const tagsRef = useRef(null);
    // [ACCOUNT] NEW: ref for the account select
    const accountRef = useRef(null);

    if (!modalOpen) return null;

    const submitFromRefs = async () => {
      const amount = amountRef.current?.value ?? "";
      const currency = (currencyRef.current?.value ?? "USD").toUpperCase();
      const date = dateRef.current?.value ?? "";
      const categoryId = categoryRef.current?.value ?? "";
      const description = (descRef.current?.value ?? "").trim();
      const tagsCsv = tagsRef.current?.value ?? "";
      // [ACCOUNT] NEW: selected account id from modal
      const pickedAccountId = accountRef.current?.value ?? "";

      const amountMinor = majorToMinor(amount, currency);
      if (Number.isNaN(amountMinor)) return window.alert("Invalid amount");
      if (!categoryId) return window.alert("Pick a category");
      // [ACCOUNT] MOD: require a chosen account (no dependency on page prop)
      if (!pickedAccountId) return window.alert("Pick an account");

      const payload = {
        // [ACCOUNT] MOD: always use the selected account id
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

    // compute default accountId value for the select
    const defaultAccId = form.accountId || accountId || accounts[0]?._id || "";

    return (
      <div
        className="fixed inset-0 z-50 grid place-items-center bg-black/40"
        onKeyDown={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="w-full max-w-xl bg-white rounded-2xl p-5 space-y-4">
          <div className="text-lg font-bold">
            {editing ? "Edit Expense" : "New Expense"}
          </div>

          {/* [ACCOUNT] NEW: Account selector goes first to nudge the user */}
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
                placeholder="e.g., 12.34"
                inputMode="decimal"
                className="w-full border rounded-lg px-3 py-2 bg-white placeholder-gray-400 outline-none focus:ring-2 focus:ring-[#90a955]"
              />
            </div>
            <div className="space-y-1 w-full">
              <label className="font-semibold text-sm">Currency</label>
              <input
                ref={currencyRef}
                defaultValue={form.currency}
                maxLength={3}
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
              placeholder="food, date-night"
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
      {filtered.length === 0 ? (
        <div className="p-6 text-center text-gray-600">
          No expenses yet. Add your first one.
        </div>
      ) : (
        <div>
          {filtered.map((item) => (
            <Row key={item._id} item={item} />
          ))}
        </div>
      )}

      <ExpenseModal />
    </div>
  );
}
