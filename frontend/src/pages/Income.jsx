/* eslint-disable react-refresh/only-export-components */
// frontend/src/pages/incomes.jsx
/* eslint-disable no-unused-labels */
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
import logoUrl from "../assets/nummoria_logo.png";
import { autoCreateFromText } from "../lib/autoTransactionsApi";

/* --------------------------- income-only categories --------------------------- */
const INCOME_CATEGORY_OPTIONS = [
  "Salary",
  "Rentals",
  "Business Income & Freelance",
  "Dividends",
  "Other Income",
];

const main = "#4f772d";
const secondary = "#90a955";

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
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0, 23, 59, 59, 999),
  );
}
function addMonthsUTC(dateLike, n) {
  const d = new Date(dateLike);
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, d.getUTCDate()),
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

/* -------------------------------------------------------------------------- */
/* ✅ Auto modal: kept at MODULE scope to avoid remounting on re-renders      */
/* -------------------------------------------------------------------------- */
const AutoQuickAddModal = React.memo(function AutoQuickAddModal({
  open,
  accounts,
  accountId,
  text,
  busy,
  notice,
  onChangeAccountId,
  onChangeText,
  onCancel,
  onCreate,
}) {
  const inputRef = React.useRef(null);

  React.useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus?.(), 0);
      return () => clearTimeout(t);
    }
  }, [open]);

  React.useEffect(() => {
    if (!open) return;

    const onKey = (e) => {
      if (e.key === "Escape") onCancel?.();
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") onCreate?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel, onCreate]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-sm px-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel?.();
      }}
    >
      <div className="relative w-full max-w-xl overflow-hidden rounded-3xl border border-white/10 bg-[#0B0F0B]/95 text-white shadow-2xl">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(600px_260px_at_15%_0%,rgba(19,226,67,0.10),transparent_55%),radial-gradient(500px_260px_at_85%_10%,rgba(153,23,70,0.12),transparent_55%)]" />
        <div className="relative p-6 space-y-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-lg font-semibold tracking-tight">
                Auto add income
              </div>
              <div className="mt-1 text-sm text-white/60">
                Parse a short sentence into a transaction.
              </div>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[11px] text-white/70">
              <span className="h-2 w-2 rounded-full bg-[#13e243]" />
              TEXT PARSER
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-white/80">Account</label>
            <select
              value={accountId}
              onChange={(e) => onChangeAccountId(e.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-white outline-none transition focus:border-white/20"
              disabled={busy}
            >
              <option value="" className="text-black">
                — Pick an account —
              </option>
              {accounts.map((a) => (
                <option key={a._id} value={a._id} className="text-black">
                  {a.name} · {a.type} · {a.currency}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-white/80">Text</label>
            <input
              ref={inputRef}
              value={text}
              onChange={(e) => onChangeText(e.target.value)}
              placeholder="salary 4000 USD"
              className="w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-white placeholder:text-white/30 outline-none transition focus:border-white/20"
              disabled={busy}
            />
            <div className="text-xs text-white/45">
              Examples: <span className="text-white/70">salary 4000 USD</span>,{" "}
              <span className="text-white/70">freelance 850 eur</span>,{" "}
              <span className="text-white/70">dividend 120</span>
            </div>
          </div>

          {notice ? (
            <div className="rounded-2xl border border-amber-400/20 bg-amber-300/10 px-4 py-3 text-sm text-amber-100">
              {notice}
            </div>
          ) : null}

          <div className="flex justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white/75 transition hover:bg-white/[0.07]"
              disabled={busy}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onCreate}
              className="rounded-2xl px-4 py-2.5 text-sm font-semibold text-white transition disabled:opacity-60"
              style={{
                background: "linear-gradient(135deg, #90a955, #4f772d)",
              }}
              disabled={busy}
              title="Ctrl/⌘ + Enter"
            >
              {busy ? "Parsing..." : "Create"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

/* ---------------------------------- Screen ---------------------------------- */
export default function IncomesScreen({ accountId }) {
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [accounts, setAccounts] = useState([]);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

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

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const [autoModalOpen, setAutoModalOpen] = useState(false);
  const [autoBusy, setAutoBusy] = useState(false);
  const [autoText, setAutoText] = useState("");
  const [autoAccountId, setAutoAccountId] = useState("");
  const [autoNotice, setAutoNotice] = useState("");

  const [form, setForm] = useState({
    amount: "",
    currency: "USD",
    date: new Date().toISOString().slice(0, 10),
    nextDate: "",
    categoryId: "",
    description: "",
    tagsCsv: "",
    accountId: "",
  });

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
        .filter((t) => t.type === "income")
        .map((t) => t.currency || "USD"),
    );
    return ["ALL", ...Array.from(s)];
  }, [transactions]);

  const loadAll = useCallback(async () => {
    try {
      setLoading(true);
      setErr("");
      const [txRes, catRes, accRes] = await Promise.all([
        api.get("/transactions", { params: { type: "income" } }),
        api.get("/categories"),
        api.get("/accounts"),
      ]);
      const cats = (catRes.data || []).filter(
        (c) => c.kind === "income" && !c.isDeleted,
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

  const rows = useMemo(() => {
    const start = fStartISO ? new Date(`${fStartISO}T00:00:00.000Z`) : null;
    const end = fEndISO ? new Date(`${fEndISO}T23:59:59.999Z`) : null;

    const minNum = fMin !== "" ? Number(fMin) : null;
    const maxNum = fMax !== "" ? Number(fMax) : null;
    const needle = q.trim().toLowerCase();

    const filtered = transactions.filter((t) => {
      if ((t.type || "") !== "income") return false;

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

  const totals = useMemo(() => {
    const byCur = {};
    for (const t of rows) {
      const cur = t.currency || "USD";
      byCur[cur] = (byCur[cur] || 0) + Number(t.amountMinor || 0);
    }
    return Object.entries(byCur).map(([cur, minor]) => ({
      cur,
      major: (Number(minor) / Math.pow(10, decimalsForCurrency(cur))).toFixed(
        decimalsForCurrency(cur),
      ),
    }));
  }, [rows]);

  const upcoming = useMemo(() => {
    const today = startOfUTC(new Date());
    const keyOf = (t) =>
      [
        t.accountId,
        t.categoryId,
        t.type,
        t.amountMinor,
        t.currency,
        startOfUTC(t.date).toISOString(),
        (t.description || "").trim(),
      ].join("|");

    const map = new Map();
    for (const t of transactions) {
      if (t.type !== "income") continue;
      const dt = new Date(t.date);
      if (dt > today) map.set(keyOf(t), { ...t, __kind: "actual" });
    }

    for (const t of transactions) {
      if (t.type !== "income" || !t.nextDate) continue;
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
        ).join(" ")}`.toLowerCase();
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

  const { statsCurrency, kpis, monthCats, pieData, noteMixedCurrency } =
    useMemo(() => {
      const chosen =
        fCurrency !== "ALL" ? fCurrency : rows[0]?.currency || "USD";

      const filteredByCur = rows.filter((r) =>
        chosen ? r.currency === chosen : true,
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

      const monthsPassed = now.getUTCMonth() + 1;
      let yearMinor = 0;
      for (let m = 0; m < monthsPassed; m++) {
        const s = startOfMonthUTC(
          new Date(Date.UTC(now.getUTCFullYear(), m, 1)),
        );
        const e = endOfMonthUTC(new Date(Date.UTC(now.getUTCFullYear(), m, 1)));
        yearMinor += minorSum(within(filteredByCur, s, e));
      }

      const k = {
        last: minorSum(lastMonth),
        this: minorSum(thisMonth),
        yearlyAvg: monthsPassed ? Math.round(yearMinor / monthsPassed) : 0,
      };

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
      description: "",
      tagsCsv: "",
      accountId: defaultAccId,
    });
    setModalOpen(true);
  }

  function openAuto() {
    const defaultAccId = accountId || accounts[0]?._id || "";
    if (!defaultAccId) {
      window.alert("Create an account first.");
      return;
    }
    setAutoAccountId(defaultAccId);
    setAutoText("");
    setAutoNotice("");
    setAutoModalOpen(true);
  }

  useEffect(() => {
    if (!autoModalOpen) return;
    setAutoNotice("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoModalOpen]);

  useEffect(() => {
    if (!autoModalOpen) return;
    setAutoNotice("");
  }, [autoText, autoAccountId, autoModalOpen]);

  function openCreateSeed(seed) {
    setEditing(null);
    setForm({
      amount: minorToMajor(seed.amountMinor, seed.currency),
      currency: seed.currency,
      date: new Date(seed.date).toISOString().slice(0, 10),
      nextDate: "",
      categoryId: seed.categoryId || "",
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
      description: tx.description || "",
      tagsCsv: (tx.tags || []).join(", "),
      accountId: tx.accountId || accountId || accounts[0]?._id || "",
    });
    setModalOpen(true);
  }

  async function softDelete(tx) {
    if (!window.confirm("Delete income?")) return;
    try {
      await api.delete(`/transactions/${tx._id}`);
      setTransactions((prev) =>
        prev.filter((t) => String(t._id) !== String(tx._id)),
      );
      await loadAll();
    } catch (e) {
      window.alert(e?.response?.data?.error || e.message || "Error");
    }
  }

  async function submitAutoText({ text, pickedAccountId }) {
    const clean = String(text || "").trim();
    if (!pickedAccountId) {
      setAutoNotice("Pick an account.");
      return;
    }
    if (!clean) {
      setAutoNotice("Type something like: 'paid 280 TRY coffee'");
      return;
    }

    setAutoBusy(true);
    try {
      const acc = accountsById.get(pickedAccountId);
      const currency = (acc?.currency || "USD").toUpperCase();
      const date = new Date().toISOString();

      const data = await autoCreateFromText({
        accountId: pickedAccountId,
        type: "income",
        currency,
        date,
        text: clean,
      });

      if (data?.mode === "posted") {
        setAutoModalOpen(false);
        setAutoText("");
        setAutoNotice("");
        await loadAll();
        return;
      }

      if (data?.mode === "duplicate") {
        setAutoNotice("Possible duplicate detected. Not auto-created.");
        return;
      }

      if (data?.mode === "draft") {
        setAutoNotice("Draft created. Review it in Drafts.");
        setAutoText("");
        await loadAll();
        return;
      }

      setAutoModalOpen(false);
      setAutoText("");
      setAutoNotice("");
      await loadAll();
    } catch (e) {
      setAutoNotice(
        e?.response?.data?.error || e.message || "Auto parse failed",
      );
    } finally {
      setAutoBusy(false);
    }
  }

  async function handleAutoCreate() {
    await submitAutoText({ text: autoText, pickedAccountId: autoAccountId });
  }

  function Chip({ label, selected, onClick }) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`rounded-full border px-3.5 py-2 text-sm transition ${
          selected
            ? "border-white/15 bg-white/[0.08] text-white"
            : "border-white/10 bg-white/[0.03] text-white/65 hover:bg-white/[0.05] hover:text-white"
        }`}
      >
        {label}
      </button>
    );
  }

  function BarChart({ data, currency }) {
    const pad = 36;
    const perBar = 60;
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
          className="rounded-2xl border border-white/10 bg-[#0b0f0b]"
        >
          {ticks.map((val, i) => {
            const y = height - pad - (val / max) * (height - pad * 2);
            return (
              <g key={i}>
                <line
                  x1={pad}
                  y1={y}
                  x2={width - pad}
                  y2={y}
                  stroke="rgba(255,255,255,0.08)"
                />
                <text
                  x={pad - 8}
                  y={y + 4}
                  textAnchor="end"
                  fontSize="11"
                  fill="rgba(255,255,255,0.45)"
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
            stroke="rgba(255,255,255,0.14)"
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
                  rx="10"
                  ry="10"
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
                  fill="rgba(255,255,255,0.55)"
                >
                  {d.name.length > 12 ? d.name.slice(0, 12) + "…" : d.name}
                </text>
                <text
                  x={x + w / 2}
                  y={y - 6}
                  textAnchor="middle"
                  fontSize="12"
                  fill="rgba(255,255,255,0.9)"
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
      data.reduce((a, d) => a + d.minor, 0),
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

      const path = [
        `M ${x0} ${y0}`,
        `A ${r} ${r} 0 ${large} 1 ${x1} ${y1}`,
        `L ${xi1} ${yi1}`,
        `A ${hole} ${hole} 0 ${large} 0 ${xi0} ${yi0}`,
        "Z",
      ].join(" ");

      return {
        d,
        path,
        color: `hsl(${(i * 36) % 360} 65% 58%)`,
        pct: d.pct ?? d.minor / total,
      };
    });

    return (
      <div className="flex flex-col xl:flex-row items-start gap-6">
        <svg
          width={size}
          height={size}
          className="rounded-2xl border border-white/10 bg-[#0b0f0b]"
        >
          {segs.map((s, i) => (
            <g key={i}>
              <path
                d={s.path}
                fill={s.color}
                stroke="#0b0f0b"
                strokeWidth="1.5"
              >
                <title>{`${s.d.name}: ${fmtMoney(
                  s.d.minor,
                  currency,
                )} (${Math.round(s.pct * 100)}%)`}</title>
              </path>
            </g>
          ))}
          <circle cx={cx} cy={cy} r={hole - 6} fill="#0b0f0b" />
          <text
            x={cx}
            y={cy - 4}
            textAnchor="middle"
            fontSize="13"
            fill="rgba(255,255,255,0.45)"
          >
            Total
          </text>
          <text
            x={cx}
            y={cy + 16}
            textAnchor="middle"
            fontSize="14"
            fill="rgba(255,255,255,0.92)"
            fontWeight="700"
          >
            {fmtMoney(total, currency)}
          </text>
        </svg>

        <div className="min-w-[200px] space-y-2 text-sm">
          {data.map((s, i) => (
            <div
              key={i}
              className="flex items-center gap-2 rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2"
            >
              <span
                className="inline-block h-3.5 w-3.5 rounded-sm"
                style={{ background: `hsl(${(i * 36) % 360} 65% 58%)` }}
              />
              <span
                className="max-w-[150px] truncate text-white/75"
                title={s.name}
              >
                {s.name}
              </span>
              <span className="ml-auto font-medium text-white">
                {fmtMoney(s.minor, currency)}
              </span>
              <span className="ml-1 text-xs text-white/45">
                {Math.round((s.pct ?? 0) * 100)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  function SectionCard({ title, subtitle, right, children, className = "" }) {
    return (
      <div
        className={`relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-md ${className}`}
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(500px_180px_at_10%_0%,rgba(19,226,67,0.06),transparent_60%),radial-gradient(420px_180px_at_90%_10%,rgba(153,23,70,0.08),transparent_60%)]" />
        <div className="relative p-5 md:p-6">
          {(title || right) && (
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                {title ? (
                  <h2 className="text-lg font-semibold tracking-tight text-white">
                    {title}
                  </h2>
                ) : null}
                {subtitle ? (
                  <p className="mt-1 text-sm text-white/55">{subtitle}</p>
                ) : null}
              </div>
              {right ? <div>{right}</div> : null}
            </div>
          )}
          {children}
        </div>
      </div>
    );
  }

  function Header() {
    return (
      <div className="mb-6 space-y-5">
        <SectionCard className="overflow-visible">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-white/60">
                <span className="h-2 w-2 rounded-full bg-[#13e243]" />
                income ledger
              </div>

              <div className="mt-4">
                <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-white">
                  Incomes
                </h1>
                <p className="mt-2 max-w-2xl text-sm md:text-base text-white/60">
                  Track salary, freelance work, dividends, rentals, and any
                  other inflow with the same decision-ready structure used
                  across Nummoria.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 lg:justify-end">
              <button
                type="button"
                onClick={() => setShowUpcoming((v) => !v)}
                className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white/80 transition hover:bg-white/[0.07]"
                title="Show upcoming (planned / future) incomes"
              >
                <span>Upcoming</span>
                <span className="rounded-full border border-white/10 bg-white/[0.06] px-2 py-0.5 text-[11px] text-white">
                  {upcoming.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setShowFilters((v) => !v)}
                className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white/80 transition hover:bg-white/[0.07]"
                title="Show filters"
              >
                <svg
                  className="h-4 w-4"
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
                <span>Filters</span>
              </button>

              <button
                type="button"
                onClick={openCreate}
                className="inline-flex items-center rounded-2xl px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-95"
                style={{
                  background: "linear-gradient(135deg, #90a955, #4f772d)",
                }}
              >
                + New income
              </button>

              <button
                type="button"
                onClick={openAuto}
                className="inline-flex items-center rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-semibold text-white/80 transition hover:bg-white/[0.07]"
                title="Quick add using text parsing"
              >
                Auto
              </button>

              <button
                type="button"
                onClick={loadAll}
                className="inline-flex items-center rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white/70 transition hover:bg-white/[0.07] hover:text-white"
                title="Refresh"
              >
                Refresh
              </button>
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-3 xl:flex-row xl:items-center">
            <div className="relative flex-1">
              <div className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-white/30">
                <svg
                  className="h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="11" cy="11" r="7" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </div>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search description, notes, account, category or #tags"
                className="w-full rounded-2xl border border-white/10 bg-white/[0.05] py-3 pl-11 pr-4 text-white placeholder:text-white/30 outline-none transition focus:border-white/20"
              />
            </div>

            <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2.5">
              <span className="text-sm text-white/50">Sorting</span>
              <select
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value)}
                className="bg-transparent text-sm text-white outline-none"
                title="Sorting"
              >
                <option value="date_desc" className="text-black">
                  Newest
                </option>
                <option value="date_asc" className="text-black">
                  Oldest
                </option>
                <option value="amount_desc" className="text-black">
                  Amount: High → Low
                </option>
                <option value="amount_asc" className="text-black">
                  Amount: Low → High
                </option>
              </select>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
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
            <div className="mt-5 grid grid-cols-1 gap-3 rounded-3xl border border-white/10 bg-black/20 p-4 md:grid-cols-2 xl:grid-cols-3">
              <Field label="Account">
                <select
                  value={fAccountId}
                  onChange={(e) => setFAccountId(e.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-white outline-none"
                >
                  <option value="ALL" className="text-black">
                    All accounts
                  </option>
                  {accounts.map((a) => (
                    <option key={a._id} value={a._id} className="text-black">
                      {a.name} · {a.type} · {a.currency}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Currency">
                <select
                  value={fCurrency}
                  onChange={(e) => setFCurrency(e.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-white outline-none"
                >
                  {currencies.map((c) => (
                    <option key={c} value={c} className="text-black">
                      {c === "ALL" ? "All currencies" : c}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="From">
                <input
                  type="date"
                  lang={DATE_LANG}
                  value={fStartISO}
                  onChange={(e) => setFStartISO(e.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-white outline-none"
                  title="From date"
                />
              </Field>

              <Field label="To">
                <input
                  type="date"
                  lang={DATE_LANG}
                  value={fEndISO}
                  onChange={(e) => setFEndISO(e.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-white outline-none"
                  title="To date"
                />
              </Field>

              <Field label="Min amount">
                <input
                  type="number"
                  inputMode="decimal"
                  placeholder="e.g., 50"
                  value={fMin}
                  onChange={(e) => setFMin(e.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-white placeholder:text-white/30 outline-none"
                />
              </Field>

              <Field label="Max amount">
                <input
                  type="number"
                  inputMode="decimal"
                  placeholder="e.g., 1000"
                  value={fMax}
                  onChange={(e) => setFMax(e.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-white placeholder:text-white/30 outline-none"
                />
              </Field>

              <div className="col-span-full flex flex-wrap justify-end gap-3 pt-2">
                <button
                  type="button"
                  className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white/75 transition hover:bg-white/[0.07]"
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
                  className="rounded-2xl px-4 py-2.5 text-sm font-semibold text-white"
                  style={{
                    background: "linear-gradient(135deg, #90a955, #4f772d)",
                  }}
                  onClick={() => setShowFilters(false)}
                >
                  Apply
                </button>
              </div>
            </div>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-2">
            {totals.map(({ cur, major }) => (
              <span
                key={cur}
                className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-sm font-medium text-white/80"
              >
                Total {cur}: <span className="text-white">{major}</span>
              </span>
            ))}
          </div>
        </SectionCard>
      </div>
    );
  }

  async function createincomeCategory(name) {
    return api.post("/categories", { name, kind: "income" });
  }

  function CategoryManager() {
    const [selected, setSelected] = useState(INCOME_CATEGORY_OPTIONS[0]);
    const [busy, setBusy] = useState(false);
    const existingNames = new Set(categories.map((c) => c.name));

    async function addOne() {
      try {
        setBusy(true);
        if (existingNames.has(selected)) {
          window.alert(`Category "${selected}" already exists.`);
          return;
        }
        await createincomeCategory(selected);
        await loadAll();
      } catch (e) {
        window.alert(
          e?.response?.data?.error || e.message || "Failed to create category",
        );
      } finally {
        setBusy(false);
      }
    }

    async function seedAll() {
      try {
        if (!window.confirm("Seed all standard income categories?")) return;
        setBusy(true);
        for (const name of INCOME_CATEGORY_OPTIONS) {
          if (!existingNames.has(name)) {
            await createincomeCategory(name);
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
      <SectionCard
        title="Categories"
        subtitle="Manage income-only categories for cleaner reporting."
        className="mb-6"
      >
        <div className="flex flex-wrap items-center gap-3">
          <select
            className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-white outline-none"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
          >
            {INCOME_CATEGORY_OPTIONS.map((n) => (
              <option key={n} value={n} className="text-black">
                {n}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={addOne}
            disabled={busy}
            className="rounded-2xl px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
            style={{
              background: "linear-gradient(135deg, #90a955, #4f772d)",
            }}
          >
            Add category
          </button>

          <button
            type="button"
            onClick={seedAll}
            disabled={busy}
            className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-white/80 transition hover:bg-white/[0.07] disabled:opacity-60"
          >
            Seed all income categories
          </button>
        </div>

        <div className="mt-4 text-sm text-white/55">
          Existing:{" "}
          {categories.length === 0 ? (
            <span>none</span>
          ) : (
            <span className="text-white/75">
              {categories.map((c) => c.name).join(", ")}
            </span>
          )}
        </div>
      </SectionCard>
    );
  }

  function UpcomingPanel() {
    if (!showUpcoming) return null;

    async function addVirtual(v) {
      try {
        const { data } = await api.post("/transactions", {
          accountId: v.accountId,
          categoryId: v.categoryId,
          type: "income",
          amountMinor: v.amountMinor,
          currency: v.currency,
          date: new Date(v.date).toISOString(),
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
            e?.response?.data?.error || e.message || "Delete failed",
          );
        }
      } else {
        await softDelete(item);
      }
    }

    return (
      <SectionCard
        title={`Upcoming incomes (${upcoming.length})`}
        subtitle="Future entries and planned recurrences within current filters."
        right={
          <button
            type="button"
            className="text-sm text-white/55 transition hover:text-white"
            onClick={() => setShowUpcoming(false)}
          >
            Close
          </button>
        }
        className="mb-6"
      >
        {upcoming.length === 0 ? (
          <div className="text-sm text-white/55">
            Nothing upcoming within your filters.
          </div>
        ) : (
          <div className="space-y-3">
            {upcoming.map((u) => {
              const catName =
                categories.find((c) => c._id === u.categoryId)?.name || "—";
              const accName = accountsById.get(u.accountId)?.name || "—";
              const badge =
                u.__kind === "virtual" ? (
                  <span className="rounded-full border border-dashed border-[#90a955]/40 bg-[#90a955]/10 px-2.5 py-1 text-[11px] text-[#dce8bf]">
                    Planned
                  </span>
                ) : (
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] text-white/60">
                    In database
                  </span>
                );

              return (
                <div
                  key={u._id}
                  className="rounded-2xl border border-white/8 bg-black/20 p-4"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="font-semibold text-white">
                          {catName}
                        </div>
                        {badge}
                      </div>

                      <div className="mt-2 flex flex-wrap gap-2">
                        <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs text-white/60">
                          {accName}
                        </span>
                      </div>

                      <div className="mt-3 text-sm text-white/60">
                        {u.description || "No description"}
                      </div>
                      <div className="mt-1 text-xs text-white/35">
                        Scheduled: {fmtDateUTC(u.date)}
                      </div>
                    </div>

                    <div className="text-left lg:text-right">
                      <div className="text-lg font-semibold text-white">
                        {minorToMajor(u.amountMinor, u.currency)} {u.currency}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2 lg:justify-end">
                        {u.__kind === "virtual" ? (
                          <>
                            <button
                              type="button"
                              onClick={() => addVirtual(u)}
                              className="rounded-xl px-3 py-2 text-sm font-medium text-white"
                              style={{
                                background:
                                  "linear-gradient(135deg, #90a955, #4f772d)",
                              }}
                            >
                              Add
                            </button>
                            <button
                              type="button"
                              onClick={() => openCreateSeed(u)}
                              className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white/75"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteOne(u)}
                              className="rounded-xl border border-red-400/20 bg-red-400/10 px-3 py-2 text-sm text-red-200"
                            >
                              Delete
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => openEdit(u)}
                              className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white/75"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteOne(u)}
                              className="rounded-xl border border-red-400/20 bg-red-400/10 px-3 py-2 text-sm text-red-200"
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>
    );
  }

  function Row({ item }) {
    const catName =
      categories.find((c) => c._id === item.categoryId)?.name || "—";
    const accName = accountsById.get(item.accountId)?.name || "—";
    const isFuture = new Date(item.date) > startOfUTC(new Date());

    return (
      <div className="border-b border-white/8 p-4 last:border-b-0">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-white">{catName}</span>
              {isFuture && (
                <span className="rounded-full border border-dashed border-[#90a955]/40 bg-[#90a955]/10 px-2.5 py-1 text-[11px] text-[#dce8bf]">
                  Upcoming
                </span>
              )}
            </div>

            <div className="mt-2">
              <span className="inline-block rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs text-white/60">
                {accName}
              </span>
            </div>

            <div className="mt-3 text-sm text-white/60">
              {item.description || "No description"}
            </div>
            <div className="mt-1 text-xs text-white/35">
              {fmtDateUTC(item.date)}
            </div>

            {item.tags?.length ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {item.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-white/8 bg-white/[0.03] px-2.5 py-1 text-xs text-[#dce8bf]"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            ) : null}
          </div>

          <div className="text-left lg:text-right">
            <div className="text-xl font-semibold text-white">
              {minorToMajor(item.amountMinor, item.currency)} {item.currency}
            </div>
            <div className="mt-3 flex flex-wrap gap-2 lg:justify-end">
              <button
                type="button"
                onClick={() => openEdit(item)}
                className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white/75"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => softDelete(item)}
                className="rounded-xl border border-red-400/20 bg-red-400/10 px-3 py-2 text-sm text-red-200"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  function IncomeModal() {
    const amountRef = useRef(null);
    const currencyRef = useRef(null);
    const dateRef = useRef(null);
    const nextDateRef = useRef(null);
    const categoryRef = useRef(null);
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
        type: "income",
        amountMinor,
        currency,
        date: new Date(date).toISOString(),
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
            payload,
          );
          setTransactions((prev) =>
            prev.map((t) => (String(t._id) === String(data._id) ? data : t)),
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
      <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-sm px-4">
        <div className="relative w-full max-w-xl overflow-hidden rounded-3xl border border-white/10 bg-[#0B0F0B]/95 text-white shadow-2xl">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(600px_260px_at_15%_0%,rgba(19,226,67,0.10),transparent_55%),radial-gradient(500px_260px_at_85%_10%,rgba(153,23,70,0.12),transparent_55%)]" />
          <div className="relative space-y-4 p-6">
            <div>
              <div className="text-lg font-semibold tracking-tight">
                {editing ? "Edit income" : "New income"}
              </div>
              <div className="mt-1 text-sm text-white/55">
                Keep structure clean so reporting and future automation stay
                reliable.
              </div>
            </div>

            <Field label="Account">
              <select
                ref={accountRef}
                defaultValue={defaultAccId}
                className="w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-white outline-none"
                onChange={(e) => {
                  const acc = accounts.find((a) => a._id === e.target.value);
                  if (acc && currencyRef.current) {
                    currencyRef.current.value = acc.currency;
                  }
                }}
              >
                <option value="" className="text-black">
                  — Pick an account —
                </option>
                {accounts.map((a) => (
                  <option key={a._id} value={a._id} className="text-black">
                    {a.name} · {a.type} · {a.currency}
                  </option>
                ))}
              </select>
            </Field>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_120px]">
              <Field label="Amount">
                <input
                  ref={amountRef}
                  defaultValue={form.amount}
                  placeholder="e.g., 1500.00"
                  inputMode="decimal"
                  className="w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-white placeholder:text-white/30 outline-none"
                />
              </Field>

              <Field label="Currency">
                <input
                  ref={currencyRef}
                  defaultValue={
                    accounts.find((a) => a._id === defaultAccId)?.currency ||
                    form.currency
                  }
                  maxLength={3}
                  readOnly
                  className="w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-white outline-none"
                />
              </Field>
            </div>

            <Field label="Date">
              <input
                ref={dateRef}
                defaultValue={form.date}
                type="date"
                lang={DATE_LANG}
                className="w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-white outline-none"
              />
            </Field>

            <Field label="Next date (optional)">
              <input
                ref={nextDateRef}
                defaultValue={form.nextDate || ""}
                type="date"
                lang={DATE_LANG}
                className="w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-white outline-none"
                placeholder="YYYY-MM-DD"
              />
              <div className="mt-1 text-xs text-white/40">
                If set, this shows up under{" "}
                <span className="text-white/70">Upcoming</span> as a planned
                item.
              </div>
            </Field>

            <Field label="Category">
              <select
                ref={categoryRef}
                defaultValue={form.categoryId ?? ""}
                className="w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-white outline-none"
              >
                {categories.map((c) => (
                  <option key={c._id} value={c._id} className="text-black">
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Description">
              <input
                ref={descRef}
                defaultValue={form.description}
                placeholder="Optional memo"
                className="w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-white placeholder:text-white/30 outline-none"
              />
            </Field>

            <Field label="Tags (comma-separated)">
              <input
                ref={tagsRef}
                defaultValue={form.tagsCsv}
                placeholder="salary, client, monthly"
                className="w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-white placeholder:text-white/30 outline-none"
              />
            </Field>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white/75 transition hover:bg-white/[0.07]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitFromRefs}
                className="rounded-2xl px-4 py-2.5 text-sm font-semibold text-white"
                style={{
                  background: "linear-gradient(135deg, #90a955, #4f772d)",
                }}
              >
                {editing ? "Save" : "Add"}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-[60vh] grid place-items-center bg-[#070A07] px-4">
        <div className="relative w-full max-w-sm">
          <div className="pointer-events-none absolute -inset-10 opacity-40">
            <div className="absolute left-4 top-6 h-40 w-40 rounded-full blur-3xl bg-[#13e243]/20" />
            <div className="absolute right-6 top-10 h-40 w-40 rounded-full blur-3xl bg-[#991746]/20" />
          </div>

          <div className="relative rounded-3xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <img
                src={logoUrl}
                alt="Nummoria logo"
                className="h-9 w-9 rounded-xl"
              />
              <div>
                <div className="text-lg font-semibold text-white">Nummoria</div>
                <div className="text-sm text-white/50">
                  Loading your incomes…
                </div>
              </div>
            </div>

            <div className="mt-5 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
              <div className="h-full w-1/3 animate-[incomeload_1.2s_ease-in-out_infinite] bg-white/30" />
            </div>

            <style>{`
              @keyframes incomeload {
                0% { transform: translateX(-120%); }
                100% { transform: translateX(320%); }
              }
            `}</style>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-[#070A07] text-white">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[#070A07]" />
        <div className="absolute inset-0 bg-[radial-gradient(1200px_800px_at_15%_0%,rgba(19,226,67,0.10),transparent_55%),radial-gradient(1000px_700px_at_85%_10%,rgba(153,23,70,0.10),transparent_55%),radial-gradient(900px_700px_at_50%_100%,rgba(255,255,255,0.04),transparent_60%)]" />
        <div className="absolute inset-0 opacity-[0.10] mix-blend-overlay bg-[linear-gradient(to_right,rgba(255,255,255,0.10)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.10)_1px,transparent_1px)] bg-[size:56px_56px]" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/35 to-black/70" />
      </div>

      <div className="mx-4 px-4 py-6 sm:px-6 lg:px-8">
        <Header />
        <UpcomingPanel />
        <CategoryManager />

        {err ? (
          <div className="mb-6 rounded-2xl border border-red-400/20 bg-red-400/10 p-4 text-red-100">
            {err}
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1px_1fr]">
          <SectionCard
            title="Income records"
            subtitle={`${rows.length} visible item${rows.length === 1 ? "" : "s"} based on current filters.`}
          >
            {rows.length === 0 ? (
              <div className="rounded-2xl border border-white/8 bg-black/20 p-10 text-center text-white/55">
                No incomes found. Add your first one or adjust filters.
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-white/8 bg-black/20">
                {rows.map((item) => (
                  <Row key={item._id} item={item} />
                ))}
              </div>
            )}
          </SectionCard>

          <div className="hidden lg:block border-l border-white/10" />

          <aside className="space-y-4 lg:sticky lg:top-20 min-w-0 h-max">
            <SectionCard
              title="Insights"
              right={
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] text-white/60">
                  {(fCurrency !== "ALL" ? fCurrency : rows[0]?.currency) || "—"}
                </span>
              }
            >
              {noteMixedCurrency && (
                <div className="mb-4 rounded-2xl border border-white/8 bg-black/20 px-4 py-3 text-xs text-white/50">
                  KPIs and charts are calculated in{" "}
                  <span className="font-medium text-white/75">
                    {statsCurrency}
                  </span>
                  . Pick a currency in Filters to switch.
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
                <MetricCard
                  label="Last Month"
                  value={fmtMoney(kpis.last, statsCurrency)}
                />
                <MetricCard
                  label="This Month"
                  value={fmtMoney(kpis.this, statsCurrency)}
                />
                <MetricCard
                  label="Yearly Average"
                  value={fmtMoney(kpis.yearlyAvg, statsCurrency)}
                />
              </div>
            </SectionCard>

            <SectionCard
              title="This Month by Category"
              right={
                <div className="text-xs text-white/45">
                  {monthCats.length} categories
                </div>
              }
              className="min-w-0"
            >
              {monthCats.length ? (
                <BarChart data={monthCats} currency={statsCurrency} />
              ) : (
                <div className="text-sm text-white/50">
                  No data for this month.
                </div>
              )}
            </SectionCard>

            <SectionCard title="Category Distribution" className="min-w-0">
              {pieData.length ? (
                <PieChart data={pieData} currency={statsCurrency} />
              ) : (
                <div className="text-sm text-white/50">
                  No data to visualize.
                </div>
              )}
            </SectionCard>
          </aside>
        </div>
      </div>

      <IncomeModal />

      <AutoQuickAddModal
        open={autoModalOpen}
        accounts={accounts}
        accountId={autoAccountId}
        text={autoText}
        busy={autoBusy}
        notice={autoNotice}
        onChangeAccountId={setAutoAccountId}
        onChangeText={setAutoText}
        onCancel={() => {
          if (autoBusy) return;
          setAutoModalOpen(false);
        }}
        onCreate={handleAutoCreate}
      />
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-white/75">{label}</label>
      {children}
    </div>
  );
}

function MetricCard({ label, value }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
      <div className="text-xs uppercase tracking-[0.18em] text-white/40">
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-tight text-white">
        {value}
      </div>
    </div>
  );
}
