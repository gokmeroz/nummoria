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
function startOfMonthUTC(dateLike) {
  const d = new Date(dateLike);
  return startOfUTC(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)));
}
function endOfMonthUTC(dateLike) {
  const d = new Date(dateLike);
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0, 23, 59, 59, 999)
  );
}
function addMonthsUTC(dateLike, n) {
  const d = new Date(dateLike);
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, d.getUTCDate())
  );
}
function fmtDateUTC(dateLike) {
  const d = new Date(dateLike);
  return d.toLocaleDateString(DATE_LANG, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

/* ---------------------------- Tiny Toast System ---------------------------- */
function useToasts() {
  const [toasts, setToasts] = useState([]);
  const push = useCallback((t) => {
    const id = Math.random().toString(36).slice(2);
    const toast = { id, type: t.type || "info", msg: t.msg || String(t) };
    setToasts((prev) => [...prev, toast]);
    // auto-dismiss after 3.5s
    setTimeout(() => {
      setToasts((prev) => prev.filter((x) => x.id !== id));
    }, 3500);
  }, []);
  const remove = useCallback((id) => {
    setToasts((prev) => prev.filter((x) => x.id !== id));
  }, []);
  return { toasts, push, remove };
}

function Toasts({ toasts, onClose }) {
  const color = (type) => {
    switch (type) {
      case "success":
        return "border-green-300 bg-green-50 text-green-900";
      case "error":
        return "border-red-300 bg-red-50 text-red-900";
      case "warning":
        return "border-yellow-300 bg-yellow-50 text-yellow-900";
      default:
        return "border-slate-300 bg-white text-slate-900";
    }
  };
  return (
    <div className="fixed bottom-4 right-4 z-[60] space-y-2 w-[92vw] max-w-sm">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`border rounded-xl shadow-md px-3 py-2 text-sm flex items-start gap-3 ${color(
            t.type
          )}`}
        >
          <div className="mt-0.5 font-medium capitalize">{t.type}</div>
          <div className="flex-1">{t.msg}</div>
          <button
            className="opacity-60 hover:opacity-100"
            onClick={() => onClose(t.id)}
            title="Dismiss"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

/* -------------------------- Promise-based Confirm -------------------------- */
function useConfirm() {
  const [state, setState] = useState({
    open: false,
    message: "",
    resolve: null,
  });

  const ask = useCallback((message) => {
    return new Promise((resolve) => {
      setState({ open: true, message, resolve });
    });
  }, []);

  const onCancel = () => {
    state.resolve?.(false);
    setState((s) => ({ ...s, open: false, resolve: null }));
  };
  const onOk = () => {
    state.resolve?.(true);
    setState((s) => ({ ...s, open: false, resolve: null }));
  };

  const Dialog = () =>
    !state.open ? null : (
      <div className="fixed inset-0 z-[55] grid place-items-center bg-black/40">
        <div className="w-full max-w-sm bg-white rounded-2xl p-5">
          <div className="text-base font-semibold mb-2">Please confirm</div>
          <div className="text-sm text-gray-700 mb-4">{state.message}</div>
          <div className="flex justify-end gap-2">
            <button
              onClick={onCancel}
              className="px-3 py-1.5 border rounded-lg"
            >
              Cancel
            </button>
            <button
              onClick={onOk}
              className="px-3 py-1.5 rounded-lg text-white"
              style={{ background: main }}
            >
              Confirm
            </button>
          </div>
        </div>
      </div>
    );

  return { ask, ConfirmDialog: Dialog };
}

/* ---------------------------------- Screen ---------------------------------- */
export default function InvestmentsScreen({ accountId }) {
  // toasts & confirm
  const { toasts, push, remove } = useToasts();
  const { ask, ConfirmDialog } = useConfirm();

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

  // form seeds
  const [form, setForm] = useState({
    amount: "",
    currency: "USD",
    date: new Date().toISOString().slice(0, 10),
    nextDate: "",
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
      push({
        type: "error",
        msg: e?.response?.data?.error || e.message || "Failed to load data",
      });
    } finally {
      setLoading(false);
    }
  }, [push]);

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
      const cur = t.currency || "USD";
      byCur[cur] = (byCur[cur] || 0) + Number(t.amountMinor || 0);
    }
    return Object.entries(byCur).map(([cur, minor]) => ({
      cur,
      major: (Number(minor) / Math.pow(10, decimalsForCurrency(cur))).toFixed(
        decimalsForCurrency(cur)
      ),
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

    const map = new Map();
    for (const t of transactions) {
      if (t.type !== "investment") continue;
      const dt = new Date(t.date);
      if (dt > today) map.set(keyOf(t), { ...t, __kind: "actual" });
    }
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

  /* --------------------------- Insights (KPI + Charts) --------------------------- */
  const { statsCurrency, kpis, monthCats, pieData, noteMixedCurrency } =
    useMemo(() => {
      // Working currency: user-picked or first seen
      const chosen =
        fCurrency !== "ALL" ? fCurrency : rows[0]?.currency || "USD";
      const filteredByCur = rows.filter((r) =>
        chosen ? r.currency === chosen : true
      );

      const now = new Date();
      const thisStart = startOfMonthUTC(now);
      const thisEnd = endOfMonthUTC(now);
      const lastStart = startOfMonthUTC(addMonthsUTC(now, -1));
      const lastEnd = endOfMonthUTC(addMonthsUTC(now, -1));

      const minorSum = (arr) =>
        arr.reduce((acc, t) => acc + Number(t.amountMinor || 0), 0);

      const within = (arr, s, e) =>
        arr.filter((t) => {
          const d = new Date(t.date);
          return d >= s && d <= e;
        });

      const thisMonth = within(filteredByCur, thisStart, thisEnd);
      const lastMonth = within(filteredByCur, lastStart, lastEnd);

      // Yearly average (to current month)
      const monthsPassed = now.getUTCMonth() + 1;
      let yearMinor = 0;
      for (let m = 0; m < monthsPassed; m++) {
        const s = startOfMonthUTC(
          new Date(Date.UTC(now.getUTCFullYear(), m, 1))
        );
        const e = endOfMonthUTC(new Date(Date.UTC(now.getUTCFullYear(), m, 1)));
        yearMinor += minorSum(within(filteredByCur, s, e));
      }

      const k = {
        last: minorSum(lastMonth),
        this: minorSum(thisMonth),
        yearlyAvg: monthsPassed ? Math.round(yearMinor / monthsPassed) : 0,
      };

      // Bar: ALL categories this month
      const catMap = new Map();
      for (const t of thisMonth) {
        const key = t.categoryId || "—";
        catMap.set(key, (catMap.get(key) || 0) + Number(t.amountMinor || 0));
      }
      const monthCats = Array.from(catMap.entries())
        .map(([cid, minor]) => ({
          name: categoriesById.get(cid)?.name || "—",
          minor,
        }))
        .sort((a, b) => b.minor - a.minor);

      // Pie: distribution across filtered range
      const pieMap = new Map();
      for (const t of filteredByCur) {
        const key = t.categoryId || "—";
        pieMap.set(key, (pieMap.get(key) || 0) + Number(t.amountMinor || 0));
      }
      const total = Array.from(pieMap.values()).reduce((a, b) => a + b, 0) || 1;
      const pieData = Array.from(pieMap.entries())
        .map(([cid, minor]) => ({
          name: categoriesById.get(cid)?.name || "—",
          minor,
          pct: minor / total,
        }))
        .sort((a, b) => b.minor - a.minor);

      return {
        statsCurrency: chosen,
        kpis: k,
        monthCats,
        pieData,
        noteMixedCurrency: fCurrency === "ALL",
      };
    }, [rows, fCurrency, categoriesById]);

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
      assetSymbol: "", // <-- empty by default
      units: "", // <-- empty by default
      description: "",
      tagsCsv: "",
      accountId: defaultAccId,
    });
    setModalOpen(true);
  }
  function openCreateSeed(seed) {
    setEditing(null);
    setForm({
      amount: minorToMajor(seed.amountMinor, seed.currency),
      currency: seed.currency,
      date: new Date(seed.date).toISOString().slice(0, 10),
      nextDate: "",
      categoryId: seed.categoryId || "",
      assetSymbol: (seed.assetSymbol || "").toUpperCase(), // <-- keep or empty
      units: seed.units ?? "", // <-- keep or empty
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
      assetSymbol: (tx.assetSymbol || "").toUpperCase(), // <-- keep or empty
      units: tx.units ?? "", // <-- keep or empty
      description: tx.description || "",
      tagsCsv: (tx.tags || []).join(", "),
      accountId: tx.accountId || accountId || accounts[0]?._id || "",
    });
    setModalOpen(true);
  }

  async function softDelete(tx) {
    const ok = await ask("Delete this investment?");
    if (!ok) return;
    try {
      await api.delete(`/transactions/${tx._id}`);
      setTransactions((prev) =>
        prev.filter((t) => String(t._id) !== String(tx._id))
      );
      await loadAll();
      push({ type: "success", msg: "Investment deleted." });
    } catch (e) {
      push({
        type: "error",
        msg: e?.response?.data?.error || e.message || "Delete failed",
      });
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

  /* -------- Mini Charts (pure SVG) -------- */
  function BarChart({ data, currency }) {
    const pad = 36;
    const perBar = 60; // px per category
    const width = Math.max(540, pad * 2 + data.length * perBar);
    const height = 240;
    const max = Math.max(1, ...data.map((d) => d.minor));
    const bw = (width - pad * 2) / Math.max(1, data.length);
    const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => Math.round(t * max));

    return (
      <div className="overflow-x-auto">
        <svg
          width={width}
          height={height}
          className="rounded-xl border bg-white"
        >
          {ticks.map((val, i) => {
            const y = height - pad - (val / max) * (height - pad * 2);
            return (
              <g key={i}>
                <line x1={pad} y1={y} x2={width - pad} y2={y} stroke="#eee" />
                <text
                  x={pad - 8}
                  y={y + 4}
                  textAnchor="end"
                  fontSize="11"
                  fill="#8a8a8a"
                >
                  {fmtMoney(val, currency)}
                </text>
              </g>
            );
          })}
          <line
            x1={pad}
            y1={height - pad}
            x2={width - pad}
            y2={height - pad}
            stroke="#ddd"
          />
          {data.map((d, i) => {
            const h = (d.minor / max) * (height - pad * 2);
            const x = pad + i * bw + bw * 0.18;
            const y = height - pad - h;
            const w = bw * 0.64;
            return (
              <g key={i}>
                <rect
                  x={x}
                  y={y}
                  width={w}
                  height={h}
                  rx="8"
                  ry="8"
                  fill={secondary}
                  opacity="0.95"
                >
                  <title>{`${d.name}: ${fmtMoney(d.minor, currency)}`}</title>
                </rect>
                <text
                  x={x + w / 2}
                  y={height - pad + 18}
                  textAnchor="middle"
                  fontSize="12"
                  fill="#555"
                >
                  {d.name.length > 12 ? d.name.slice(0, 12) + "…" : d.name}
                </text>
                <text
                  x={x + w / 2}
                  y={y - 6}
                  textAnchor="middle"
                  fontSize="12"
                  fill="#222"
                  fontWeight="600"
                >
                  {fmtMoney(d.minor, currency)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    );
  }

  function PieChart({ data, currency }) {
    const size = 320,
      r = 120,
      hole = 62,
      cx = size / 2,
      cy = size / 2;
    const total = Math.max(
      1,
      data.reduce((a, d) => a + d.minor, 0)
    );
    let angle = -Math.PI / 2;

    const segs = data.map((d, i) => {
      const a0 = angle;
      const a1 = angle + (d.minor / total) * Math.PI * 2;
      angle = a1;
      const large = a1 - a0 > Math.PI ? 1 : 0;
      const x0 = cx + r * Math.cos(a0);
      const y0 = cy + r * Math.sin(a0);
      const x1 = cx + r * Math.cos(a1);
      const y1 = cy + r * Math.sin(a1);
      const xi0 = cx + hole * Math.cos(a0);
      const yi0 = cy + hole * Math.sin(a0);
      const xi1 = cx + hole * Math.cos(a1);
      const yi1 = cy + hole * Math.sin(a1);
      return {
        d,
        color: `hsl(${(i * 36) % 360} 65% 58%)`,
        path: `M ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1} L ${xi1} ${yi1} A ${hole} ${hole} 0 ${large} 0 ${xi0} ${yi0} Z`,
        pct: d.pct ?? d.minor / total,
      };
    });

    return (
      <div className="flex items-start gap-6">
        <svg width={size} height={size} className="border rounded-xl bg-white">
          {segs.map((s, i) => (
            <path
              key={i}
              d={s.path}
              fill={s.color}
              stroke="#fff"
              strokeWidth="1.5"
            >
              <title>{`${s.d.name}: ${fmtMoney(
                s.d.minor,
                currency
              )} (${Math.round(s.pct * 100)}%)`}</title>
            </path>
          ))}
          <circle cx={cx} cy={cy} r={hole - 6} fill="#fff" />
          <text x={cx} y={cy - 4} textAnchor="middle" fontSize="13" fill="#666">
            Total
          </text>
          <text
            x={cx}
            y={cy + 16}
            textAnchor="middle"
            fontSize="14"
            fill="#111"
            fontWeight="700"
          >
            {fmtMoney(total, currency)}
          </text>
        </svg>

        <div className="text-sm space-y-2 min-w-[200px]">
          {data.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <span
                className="inline-block w-3.5 h-3.5 rounded-sm"
                style={{ background: `hsl(${(i * 36) % 360} 65% 58%)` }}
              />
              <span className="truncate max-w-[150px]" title={s.name}>
                {s.name}
              </span>
              <span className="ml-auto font-medium">
                {fmtMoney(s.minor, currency)}
              </span>
              <span className="ml-1 text-xs text-gray-500">
                {Math.round((s.pct ?? 0) * 100)}%
              </span>
            </div>
          ))}
        </div>
      </div>
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
          push({ type: "info", msg: `Category "${selected}" already exists.` });
          return;
        }
        await createInvestmentCategory(selected);
        await loadAll();
        push({ type: "success", msg: `Category "${selected}" created.` });
      } catch (e) {
        push({
          type: "error",
          msg:
            e?.response?.data?.error ||
            e.message ||
            "Failed to create category",
        });
      } finally {
        setBusy(false);
      }
    }

    async function seedAll() {
      const ok = await ask("Seed all standard investment categories?");
      if (!ok) return;
      try {
        setBusy(true);
        for (const name of INVESTMENT_CATEGORY_OPTIONS) {
          if (!existingNames.has(name)) {
            await createInvestmentCategory(name);
          }
        }
        await loadAll();
        push({ type: "success", msg: "Investment categories seeded." });
      } catch (e) {
        push({
          type: "error",
          msg: e?.response?.data?.error || e.message || "Seeding failed",
        });
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
        push({ type: "success", msg: "Planned investment added." });
      } catch (e) {
        push({
          type: "error",
          msg: e?.response?.data?.error || e.message || "Add failed",
        });
      }
    }

    async function deleteOne(item) {
      if (item.__kind === "virtual") {
        const ok = await ask(
          "Remove the planned date (nextDate) from its parent?"
        );
        if (!ok) return;
        try {
          await api.put(`/transactions/${item.__parentId}`, { nextDate: null });
          await loadAll();
          push({ type: "success", msg: "Planned item removed." });
        } catch (e) {
          push({
            type: "error",
            msg: e?.response?.data?.error || e.message || "Delete failed",
          });
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
    const nextDateRef = useRef(null);
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
      const nextDate = nextDateRef.current?.value ?? "";
      const categoryId = categoryRef.current?.value ?? "";
      const rawSymbol = (symbolRef.current?.value ?? "").toUpperCase().trim();
      const rawUnitsStr = (unitsRef.current?.value ?? "").trim();
      const rawUnits = rawUnitsStr === "" ? NaN : Number(rawUnitsStr);
      const description = (descRef.current?.value ?? "").trim();
      const tagsCsv = tagsRef.current?.value ?? "";
      const pickedAccountId = accountRef.current?.value ?? "";

      const amountMinor = majorToMinor(amount, currency);
      if (Number.isNaN(amountMinor)) {
        push({ type: "warning", msg: "Invalid amount." });
        return;
      }
      if (!categoryId) {
        push({ type: "warning", msg: "Pick a category." });
        return;
      }
      if (!pickedAccountId) {
        push({ type: "warning", msg: "Pick an account." });
        return;
      }

      const category = categoriesById.get(categoryId);
      const isStockOrCrypto =
        !!category &&
        (category.name === "Stock Market" ||
          category.name === "Crypto Currency Exchange");

      // Validate ONLY for Stock/Crypto
      if (isStockOrCrypto) {
        if (!rawSymbol) {
          push({
            type: "warning",
            msg: "Asset symbol is required for this category.",
          });
          return;
        }
        if (!(Number.isFinite(rawUnits) && rawUnits > 0)) {
          push({
            type: "warning",
            msg: "Units must be a positive number for this category.",
          });
          return;
        }
      }

      // Base payload (without symbol/units)
      const payload = {
        accountId: pickedAccountId,
        categoryId,
        type: "investment",
        amountMinor,
        currency,
        date: new Date(date).toISOString(),
        description: description || null,
        tags: tagsCsv
          .split(",")
          .map((s) => s.trim())
          .filter((s) => s.length > 0),
      };

      // Include symbol/units if required or provided
      if (isStockOrCrypto || rawSymbol) {
        payload.assetSymbol = rawSymbol;
      }
      if (isStockOrCrypto || (Number.isFinite(rawUnits) && rawUnits > 0)) {
        payload.units = Number(rawUnits);
      }

      if (nextDate) payload.nextDate = new Date(nextDate).toISOString();

      try {
        if (!editing) {
          const { data } = await api.post("/transactions", payload);
          const createdArr = Array.isArray(data?.created)
            ? data.created
            : [data];
          setTransactions((prev) => [...createdArr, ...prev]);
          push({ type: "success", msg: "Investment added." });
        } else {
          const { data } = await api.put(
            `/transactions/${editing._id}`,
            payload
          );
          setTransactions((prev) =>
            prev.map((t) => (String(t._id) === String(data._id) ? data : t))
          );
          push({ type: "success", msg: "Investment saved." });
        }
        setModalOpen(false);
        await loadAll();
      } catch (e) {
        push({
          type: "error",
          msg: e?.response?.data?.error || e.message || "Error",
        });
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
            <div className="space-y-1 w_full w-full">
              <label className="font-semibold text_sm">Total Cost</label>
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
      <CategoryManager />

      {err ? (
        <div className="mx-4 mb-4 p-3 bg-red-50 text-red-700 border rounded-xl">
          {err}
        </div>
      ) : null}

      {/* === TWO-PANE LAYOUT 50/50 WITH VERTICAL DIVIDER === */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1px_1fr] gap-4 mx-4">
        {/* Left: list */}
        <div className="rounded-xl overflow-hidden border">
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
        </div>

        {/* Vertical divider */}
        <div className="hidden lg:block border-l border-gray-300" />

        {/* Right: Insights */}
        <aside className="lg:sticky lg:top-20 min-w-0 h-max space-y-4">
          <div className="p-4 bg-white border rounded-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">Insights</h2>
              <span className="text-xs px-2 py-0.5 rounded-full border text-gray-600">
                {(fCurrency !== "ALL" ? fCurrency : rows[0]?.currency) || "—"}
              </span>
            </div>
            {noteMixedCurrency && (
              <div className="mt-2 text-xs text-gray-500">
                KPIs/Charts use{" "}
                <span className="font-medium">{statsCurrency}</span>. Pick a
                currency in Filters to switch.
              </div>
            )}

            {/* KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
              <div className="p-3 rounded-lg border bg-[#fafdf9]">
                <div className="text-xs text-gray-600">Last Month</div>
                <div className="text-xl font-bold">
                  {fmtMoney(kpis.last, statsCurrency)}
                </div>
              </div>
              <div className="p-3 rounded-lg border bg-[#fafdf9]">
                <div className="text-xs text-gray-600">This Month</div>
                <div className="text-xl font-bold">
                  {fmtMoney(kpis.this, statsCurrency)}
                </div>
              </div>
              <div className="p-3 rounded-lg border bg-[#fafdf9]">
                <div className="text-xs text-gray-600">Yearly Average</div>
                <div className="text-xl font-bold">
                  {fmtMoney(kpis.yearlyAvg, statsCurrency)}
                </div>
              </div>
            </div>
          </div>

          {/* Bar: this month by category (ALL) */}
          <div className="p-4 bg-white border rounded-xl">
            <div className="flex items-center justify-between mb-2">
              <div className="font-semibold">This Month by Category</div>
              <div className="text-xs text-gray-500">
                {monthCats.length} categories
              </div>
            </div>
            {monthCats.length ? (
              <BarChart data={monthCats} currency={statsCurrency} />
            ) : (
              <div className="text-sm text-gray-500">
                No data for this month.
              </div>
            )}
          </div>

          {/* Pie: distribution (filtered range) */}
          <div className="p-4 bg-white border rounded-xl">
            <div className="font-semibold mb-2">Category Distribution</div>
            {pieData.length ? (
              <PieChart data={pieData} currency={statsCurrency} />
            ) : (
              <div className="text-sm text-gray-500">No data to visualize.</div>
            )}
          </div>
        </aside>
      </div>

      {/* Global UI helpers */}
      <Toasts toasts={toasts} onClose={remove} />
      <ConfirmDialog />
      <InvestmentModal />
    </div>
  );
}
