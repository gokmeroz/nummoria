/* eslint-disable no-empty */
/* eslint-disable no-unused-vars */
// src/pages/Investments.jsx
import React, {
  useEffect,
  useMemo,
  useState,
  useRef,
  useCallback,
} from "react";
import api from "../lib/api";

/* --------------------------- Investment-only categories --------------------------- */
const INVESTMENT_CATEGORY_OPTIONS = [
  "Stock Market",
  "Crypto Currency Exchange",
  "Foreign Currency Exchange",
  "Gold",
  "Real Estate Investments",
  "Land Investments",
  "Other Investments",
];

const main = "#4f772d";
const secondary = "#90a955";

// Keep kind lowercase to match API/DB
async function createInvestmentCategory(name) {
  return api.post("/categories", { name, kind: "investment" });
}

/* ------------------------------ Locale control ------------------------------ */
const DATE_LANG = "en-US";

/* ----------------------------- Date helpers -------------------------------- */
function startOfUTC(dateLike) {
  const d = new Date(dateLike);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}
function fmtDateUTC(dateLike) {
  const d = new Date(dateLike);
  return d.toLocaleDateString(DATE_LANG, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

/* ---------------------------------- Screen ---------------------------------- */
export default function InvestmentsScreen({ accountId }) {
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
  const [showUpcoming, setShowUpcoming] = useState(false);

  // modal state (create / edit)
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  // form seeds for the modal (used as defaultValue only)
  const [form, setForm] = useState({
    amount: "",
    currency: "USD",
    date: new Date().toISOString().slice(0, 10),
    nextDate: "", // NEW
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
    new Intl.NumberFormat(DATE_LANG, {
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
        .filter((t) => t.type === "investment")
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
        api.get("/transactions", { params: { type: "investment" } }),
        api.get("/categories"),
        api.get("/accounts"),
      ]);
      const cats = (catRes.data || []).filter(
        (c) => c.kind === "investment" && !c.isDeleted
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
    const start = fStartISO ? new Date(`${fStartISO}T00:00:00.000Z`) : null;
    const end = fEndISO ? new Date(`${fEndISO}T23:59:59.999Z`) : null;

    const minNum = fMin !== "" ? Number(fMin) : null; // major
    const maxNum = fMax !== "" ? Number(fMax) : null; // major
    const needle = q.trim().toLowerCase();

    const filtered = transactions.filter((t) => {
      if ((t.type || "") !== "investment") return false;

      if (fAccountId !== "ALL" && String(t.accountId) !== String(fAccountId))
        return false;
      if (fCategoryId !== "ALL" && String(t.categoryId) !== String(fCategoryId))
        return false;

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
        const acc = accountsById.get(t.accountId)?.name || "";
        const hay = `${t.description || ""} ${t.notes || ""} ${cat} ${acc} ${(
          t.tags || []
        ).join(" ")} ${(t.assetSymbol || "").toUpperCase()}`.toLowerCase();
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

  /* --------------------------- Upcoming (planned) --------------------------- */
  const upcoming = useMemo(() => {
    const today = startOfUTC(new Date());
    const keyOf = (t) =>
      [
        t.accountId,
        t.categoryId,
        t.type,
        t.amountMinor,
        t.currency,
        (t.assetSymbol || "").toUpperCase(),
        t.units ?? "",
        startOfUTC(t.date).toISOString(),
        (t.description || "").trim(),
      ].join("|");

    // Actual future rows from DB
    const map = new Map();
    for (const t of transactions) {
      if (t.type !== "investment") continue;
      const dt = new Date(t.date);
      if (dt > today) {
        map.set(keyOf(t), { ...t, __kind: "actual" });
      }
    }

    // Virtual rows from nextDate (not yet added)
    for (const t of transactions) {
      if (t.type !== "investment" || !t.nextDate) continue;
      const nd = new Date(t.nextDate);
      if (nd <= today) continue;

      const v = {
        ...t,
        _id: `virtual-${t._id}`,
        date: nd.toISOString(),
        __kind: "virtual",
        __parentId: t._id,
      };
      const k = keyOf(v);
      if (!map.has(k)) map.set(k, v);
    }

    // Apply filters
    const arr = Array.from(map.values()).filter((t) => {
      if (fAccountId !== "ALL" && String(t.accountId) !== String(fAccountId))
        return false;
      if (fCategoryId !== "ALL" && String(t.categoryId) !== String(fCategoryId))
        return false;
      const cur = t.currency || "USD";
      if (fCurrency !== "ALL" && cur !== fCurrency) return false;

      const minNum = fMin !== "" ? Number(fMin) : null;
      const maxNum = fMax !== "" ? Number(fMax) : null;
      const major =
        Number(t.amountMinor || 0) / Math.pow(10, decimalsForCurrency(cur));
      if (minNum !== null && major < minNum) return false;
      if (maxNum !== null && major > maxNum) return false;

      const needle = q.trim().toLowerCase();
      if (needle) {
        const cat = categoriesById.get(t.categoryId)?.name || "";
        const acc = accountsById.get(t.accountId)?.name || "";
        const hay = `${t.description || ""} ${t.notes || ""} ${cat} ${acc} ${(
          t.tags || []
        ).join(" ")} ${(t.assetSymbol || "").toUpperCase()}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }

      const start = fStartISO ? new Date(`${fStartISO}T00:00:00.000Z`) : null;
      const end = fEndISO ? new Date(`${fEndISO}T23:59:59.999Z`) : null;
      const dt = new Date(t.date);
      if (start && dt < start) return false;
      if (end && dt > end) return false;

      return true;
    });

    arr.sort((a, b) => new Date(a.date) - new Date(b.date));
    return arr;
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
  ]);

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
      nextDate: "",
      categoryId: categories[0]?._id || "",
      assetSymbol: "",
      units: "",
      description: "",
      tagsCsv: "",
      accountId: defaultAccId,
    });
    setModalOpen(true);
  }

  // Seed "create" from a planned row (virtual)
  function openCreateSeed(seed) {
    setEditing(null);
    setForm({
      amount: minorToMajor(seed.amountMinor, seed.currency),
      currency: seed.currency,
      date: new Date(seed.date).toISOString().slice(0, 10),
      nextDate: "",
      categoryId: seed.categoryId || "",
      assetSymbol: (seed.assetSymbol || "").toUpperCase(),
      units: seed.units ?? "",
      description: seed.description || "",
      tagsCsv: (seed.tags || []).join(", "),
      accountId: seed.accountId || accountId || accounts[0]?._id || "",
    });
    setModalOpen(true);
  }

  function openEdit(tx) {
    setEditing(tx);
    setForm({
      amount: minorToMajor(tx.amountMinor, tx.currency),
      currency: tx.currency,
      date: new Date(tx.date).toISOString().slice(0, 10),
      nextDate: tx.nextDate
        ? new Date(tx.nextDate).toISOString().slice(0, 10)
        : "",
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
    if (!window.confirm("Delete investment?")) return;
    try {
      await api.delete(`/transactions/${tx._id}`);
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
  function Header() {
    return (
      <div className="space-y-3 p-4 border-b bg-white">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Investments</h1>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowUpcoming((v) => !v)}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border"
              title="Show upcoming (planned / future) investments"
            >
              <span>Upcoming</span>
              <span className="text-xs rounded-full px-2 py-0.5 bg-[#e8f5e9] text-[#2f5d1d] border">
                {upcoming.length}
              </span>
            </button>

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
                <option value="symbol_asc">Symbol: A → Z</option>
                <option value="symbol_desc">Symbol: Z → A</option>
              </select>
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search symbol, description, notes, account, category or #tags"
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
            + New Investment
          </button>
          <button
            type="button"
            onClick={loadAll}
            className="px-3 py-2 rounded-xl border"
            title="Refresh"
          >
            Refresh
          </button>

          <a
            href="/investments/performance"
            className="px-3 py-2 rounded-xl border"
            style={{ borderColor: secondary, color: "white", background: main }}
          >
            VIEW MARKET
          </a>
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

  /* --------------------------------- Upcoming ------------------------------- */
  function UpcomingPanel() {
    if (!showUpcoming) return null;

    async function addVirtual(v) {
      try {
        const { data } = await api.post("/transactions", {
          accountId: v.accountId,
          categoryId: v.categoryId,
          type: "investment",
          amountMinor: v.amountMinor,
          currency: v.currency,
          date: new Date(v.date).toISOString(),
          assetSymbol: v.assetSymbol,
          units: v.units,
          description: v.description || null,
          tags: v.tags || [],
        });

        if (v.__kind === "virtual" && v.__parentId) {
          try {
            await api.put(`/transactions/${v.__parentId}`, { nextDate: null });
          } catch {}
        }

        const createdArr = Array.isArray(data?.created) ? data.created : [data];
        setTransactions((prev) => [...createdArr, ...prev]);
        await loadAll();
      } catch (e) {
        window.alert(e?.response?.data?.error || e.message || "Add failed");
      }
    }

    async function deleteOne(item) {
      if (item.__kind === "virtual") {
        try {
          await api.put(`/transactions/${item.__parentId}`, { nextDate: null });
          await loadAll();
        } catch (e) {
          window.alert(
            e?.response?.data?.error || e.message || "Delete failed"
          );
        }
      } else {
        await softDelete(item);
      }
    }

    return (
      <div className="m-4 p-4 border rounded-xl bg-white">
        <div className="flex items-center justify-between mb-3">
          <div className="font-semibold">
            Upcoming investments ({upcoming.length})
          </div>
          <button
            type="button"
            className="text-sm underline"
            onClick={() => setShowUpcoming(false)}
          >
            Close
          </button>
        </div>

        {upcoming.length === 0 ? (
          <div className="text-gray-600 text-sm">
            Nothing upcoming within your filters.
          </div>
        ) : (
          <div className="divide-y">
            {upcoming.map((u) => {
              const catName =
                categories.find((c) => c._id === u.categoryId)?.name || "—";
              const accName = accountsById.get(u.accountId)?.name || "—";
              const badge =
                u.__kind === "virtual" ? (
                  <span className="text-[11px] px-2 py-0.5 rounded-full border border-dashed text-[#2f5d1d]">
                    Planned (not added)
                  </span>
                ) : (
                  <span className="text-[11px] px-2 py-0.5 rounded-full border text-gray-600">
                    In database
                  </span>
                );
              const symbol = (u.assetSymbol || "").toUpperCase();

              return (
                <div
                  key={u._id}
                  className="py-3 flex items-start justify-between gap-4"
                >
                  <div className="min-w-0">
                    <div className="font-semibold flex items-center gap-2">
                      <span>{symbol ? `${symbol} • ${catName}` : catName}</span>
                      {badge}
                    </div>
                    <div className="text-xs text-gray-500 mb-1">
                      <span className="inline-block px-2 py-0.5 rounded-full border">
                        {accName}
                      </span>
                      {u.units ? (
                        <span className="ml-2 text-gray-500">
                          {u.units} units
                        </span>
                      ) : null}
                    </div>
                    <div className="text-sm text-gray-600 truncate">
                      {u.description || "No description"}
                    </div>
                    <div className="text-xs text-gray-400">
                      Scheduled: {fmtDateUTC(u.date)}
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="font-bold">
                      -{minorToMajor(u.amountMinor, u.currency)} {u.currency}
                    </div>
                    <div className="mt-2 flex flex-wrap justify-end gap-2">
                      {u.__kind === "virtual" ? (
                        <>
                          <button
                            type="button"
                            onClick={() => addVirtual(u)}
                            className="px-3 py-1 rounded-lg bg-[#4f772d] text-white"
                          >
                            Add
                          </button>
                          <button
                            type="button"
                            onClick={() => openCreateSeed(u)}
                            className="px-3 py-1 border rounded-lg"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteOne(u)}
                            className="px-3 py-1 border rounded-lg text-red-700 border-red-200"
                          >
                            Delete
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => openEdit(u)}
                            className="px-3 py-1 border rounded-lg"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteOne(u)}
                            className="px-3 py-1 border rounded-lg text-red-700 border-red-200"
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
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
    const isFuture = new Date(item.date) > startOfUTC(new Date());

    return (
      <div className="p-4 border-b bg-white">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="font-semibold flex items-center gap-2">
              <span>{symbol ? `${symbol} • ${catName}` : catName}</span>
              {isFuture && (
                <span className="text-[11px] px-2 py-0.5 rounded-full border border-dashed text-[#2f5d1d]">
                  Upcoming
                </span>
              )}
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
            <div className="text-xs text-gray-400">{fmtDateUTC(item.date)}</div>
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
  function InvestmentModal() {
    const amountRef = useRef(null);
    const currencyRef = useRef(null);
    const dateRef = useRef(null);
    const nextDateRef = useRef(null); // NEW
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
      const nextDate = nextDateRef.current?.value ?? ""; // NEW
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

      if (nextDate) payload.nextDate = new Date(nextDate).toISOString();

      try {
        if (!editing) {
          const { data } = await api.post("/transactions", payload);
          const createdArr = Array.isArray(data?.created)
            ? data.created
            : [data];
          setTransactions((prev) => [...createdArr, ...prev]);
        } else {
          const { data } = await api.put(
            `/transactions/${editing._id}`,
            payload
          );
          setTransactions((prev) =>
            prev.map((t) => (String(t._id) === String(data._id) ? data : t))
          );
        }
        setModalOpen(false);
        await loadAll();
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
            {editing ? "Edit Investment" : "New Investment"}
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
              type="date"
              lang={DATE_LANG}
              className="w-full border rounded-lg px-3 py-2 bg-white placeholder-gray-400 outline-none focus:ring-2 focus:ring-[#90a955]"
            />
          </div>

          <div className="space-y-1 w-full">
            <label className="font-semibold text-sm">
              Next date (optional)
            </label>
            <input
              ref={nextDateRef}
              defaultValue={form.nextDate || ""}
              type="date"
              lang={DATE_LANG}
              className="w-full border rounded-lg px-3 py-2 bg-white placeholder-gray-400 outline-none focus:ring-2 focus:ring-[#90a955]"
              placeholder="YYYY-MM-DD"
            />
            <div className="text-xs text-gray-500">
              If set, this shows up under{" "}
              <span className="font-semibold">Upcoming</span> as a planned item.
            </div>
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

      <UpcomingPanel />

      {/* Step 1: Manage categories (investment-only) */}
      <CategoryManager />

      {err ? (
        <div className="mx-4 mb-4 p-3 bg-red-50 text-red-700 border rounded-xl">
          {err}
        </div>
      ) : null}

      {/* Step 2: Use those categories to add/list investments */}
      {rows.length === 0 ? (
        <div className="p-6 text-center text-gray-600">
          No investments found. Add your first one or adjust filters.
        </div>
      ) : (
        <div>
          {rows.map((item) => (
            <Row key={item._id} item={item} />
          ))}
        </div>
      )}
      <InvestmentModal />
    </div>
  );
}
