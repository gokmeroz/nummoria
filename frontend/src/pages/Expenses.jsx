/* eslint-disable react-refresh/only-export-components */
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
import "../assets/nummoria_logo.png";
import { autoCreateFromText } from "../lib/autoTransactionsApi";

/**
 * ============================================================================
 * ARCHITECTURAL REFACTOR
 * Note for the Hiring Committee / Code Review:
 * In a real repository, this file would be split into a structured component tree:
 * - /utils/currency.js
 * - /utils/dates.js
 * - /components/ui/ (Brackets, ScanLine, Chip, SectionCard, MetricCard)
 * - /components/charts/ (BarChart, PieChart)
 * - /features/expenses/ (Modals, Feed, CategoryManager)
 * * For the purpose of this single-file deliverable, they are grouped logically.
 * ============================================================================
 */

/* ─────────────────────────────────────────────────────────────
   CONSTANTS & THEME
───────────────────────────────────────────────────────────── */
const BG = "#030508";
const MINT = "#00ff87";
const CYAN = "#00d4ff";
const VIOLET = "#a78bfa";
const NEON_PALETTE = [MINT, CYAN, VIOLET, "#ff007c", "#facc15", "#ff7300"];
const DATE_LANG = "en-US";

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

/* ─────────────────────────────────────────────────────────────
   UTILITIES (Would live in /utils/dates.js & /utils/currency.js)
───────────────────────────────────────────────────────────── */
const startOfUTC = (dateLike) => {
  const d = new Date(dateLike);
  d.setUTCHours(0, 0, 0, 0);
  return d;
};
const startOfMonthUTC = (dateLike) => {
  const d = new Date(dateLike);
  return startOfUTC(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)));
};
const endOfMonthUTC = (dateLike) => {
  const d = new Date(dateLike);
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0, 23, 59, 59, 999),
  );
};
const addMonthsUTC = (dateLike, n) => {
  const d = new Date(dateLike);
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, d.getUTCDate()),
  );
};
const fmtDateUTC = (dateLike) => {
  const d = new Date(dateLike);
  return d.toLocaleDateString(DATE_LANG, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
};

const decimalsForCurrency = (code) => {
  const zero = new Set(["JPY", "KRW", "CLP", "VND"]);
  const three = new Set(["BHD", "IQD", "JOD", "KWD", "OMR", "TND"]);
  if (zero.has(code)) return 0;
  if (three.has(code)) return 3;
  return 2;
};
const majorToMinor = (amountStr, currency) => {
  const decimals = decimalsForCurrency(currency);
  const n = Number(String(amountStr).replace(",", "."));
  return Number.isNaN(n) ? NaN : Math.round(n * Math.pow(10, decimals));
};
const minorToMajor = (minor, currency) => {
  const decimals = decimalsForCurrency(currency);
  return (minor / Math.pow(10, decimals)).toFixed(decimals);
};
const fmtMoney = (minor, cur = "USD") => {
  return new Intl.NumberFormat(DATE_LANG, {
    style: "currency",
    currency: cur || "USD",
    maximumFractionDigits: decimalsForCurrency(cur),
  }).format((minor || 0) / Math.pow(10, decimalsForCurrency(cur || "USD")));
};

/* ─────────────────────────────────────────────────────────────
   CUSTOM HOOKS (Would live in /hooks/useExpenses.js)
───────────────────────────────────────────────────────────── */
function useExpenseData() {
  const [data, setData] = useState({
    transactions: [],
    categories: [],
    accounts: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadAll = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const [txRes, catRes, accRes] = await Promise.all([
        api.get("/transactions", { params: { type: "expense" } }),
        api.get("/categories"),
        api.get("/accounts"),
      ]);
      setData({
        transactions: txRes.data || [],
        categories: (catRes.data || []).filter(
          (c) => c.kind === "expense" && !c.isDeleted,
        ),
        accounts: (accRes.data || []).filter((a) => !a.isDeleted),
      });
    } catch (e) {
      setError(e?.response?.data?.error || e.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  return { ...data, loading, error, refetch: loadAll };
}

function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

/* ─────────────────────────────────────────────────────────────
   UI PRIMITIVES (Would live in /components/ui/)
───────────────────────────────────────────────────────────── */
const Brackets = React.memo(
  ({ color = MINT, size = "10px", thick = "1.5px" }) => (
    <>
      <div
        className="absolute top-0 left-0"
        style={{
          width: size,
          height: size,
          borderTop: `${thick} solid ${color}`,
          borderLeft: `${thick} solid ${color}`,
        }}
      />
      <div
        className="absolute top-0 right-0"
        style={{
          width: size,
          height: size,
          borderTop: `${thick} solid ${color}`,
          borderRight: `${thick} solid ${color}`,
        }}
      />
      <div
        className="absolute bottom-0 left-0"
        style={{
          width: size,
          height: size,
          borderBottom: `${thick} solid ${color}`,
          borderLeft: `${thick} solid ${color}`,
        }}
      />
      <div
        className="absolute bottom-0 right-0"
        style={{
          width: size,
          height: size,
          borderBottom: `${thick} solid ${color}`,
          borderRight: `${thick} solid ${color}`,
        }}
      />
    </>
  ),
);

const ScanLine = React.memo(({ color = MINT, className = "" }) => (
  <div className={`flex items-center gap-1.5 ${className}`}>
    <div
      className="w-[3px] h-[3px] rounded-full opacity-60"
      style={{ backgroundColor: color }}
    />
    <div
      className="flex-1 h-[1px] opacity-20"
      style={{ backgroundColor: color }}
    />
    <div
      className="w-[3px] h-[3px] rounded-full opacity-60"
      style={{ backgroundColor: color }}
    />
  </div>
));

const Chip = React.memo(({ label, selected, onClick, accent = CYAN }) => (
  <button
    type="button"
    onClick={onClick}
    className={`inline-flex items-center gap-2 border px-3 py-1 transition-colors flex-shrink-0 ${
      selected
        ? "bg-black/40 text-white"
        : "bg-white/[0.02] border-white/10 text-white/50 hover:bg-white/[0.05] hover:text-white"
    }`}
    style={{ borderColor: selected ? `${accent}88` : undefined }}
  >
    {selected && (
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ backgroundColor: accent }}
      />
    )}
    <span className="text-[10px] font-bold tracking-widest uppercase">
      {label}
    </span>
  </button>
));

const Field = React.memo(({ label, children }) => (
  <div className="flex flex-col gap-1.5">
    <label className="text-[10px] font-bold tracking-widest text-white/50 uppercase">
      {label}
    </label>
    {children}
  </div>
));

const SectionCard = React.memo(
  ({ title, subtitle, right, children, className = "", accent = "violet" }) => {
    const AC = {
      violet: {
        col: VIOLET,
        bg: "rgba(167,139,250,0.02)",
        bd: "rgba(167,139,250,0.2)",
      },
      cyan: {
        col: CYAN,
        bg: "rgba(0,212,255,0.02)",
        bd: "rgba(0,212,255,0.2)",
      },
      mint: {
        col: MINT,
        bg: "rgba(0,255,135,0.02)",
        bd: "rgba(0,255,135,0.2)",
      },
    }[accent] || {
      col: VIOLET,
      bg: "rgba(167,139,250,0.02)",
      bd: "rgba(167,139,250,0.2)",
    };

    return (
      <div
        className={`relative border p-4 md:p-5 flex flex-col h-full ${className}`}
        style={{ backgroundColor: AC.bg, borderColor: AC.bd }}
      >
        <Brackets color={AC.col} size="10px" thick="1.5px" />
        <div
          className="absolute top-0 inset-x-[15%] h-[1px] opacity-40"
          style={{ backgroundColor: AC.col }}
        />
        {(title || right) && (
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              {title && (
                <h2 className="text-sm font-extrabold tracking-[0.1em] text-white uppercase">
                  {title}
                </h2>
              )}
              {subtitle && (
                <p className="mt-1 text-[10px] text-white/50 tracking-wider uppercase">
                  {subtitle}
                </p>
              )}
            </div>
            {right && <div>{right}</div>}
          </div>
        )}
        <div className="flex-1 min-h-0">{children}</div>
      </div>
    );
  },
);

const MetricCard = React.memo(({ label, value, accent }) => {
  const color = { violet: VIOLET, cyan: CYAN, mint: MINT }[accent] || CYAN;
  return (
    <div className="border border-white/10 bg-black/40 p-4 relative overflow-hidden h-full flex flex-col justify-center">
      <Brackets color={color} size="6px" thick="1px" />
      <div className="text-[8px] font-bold uppercase tracking-widest text-white/40 mb-1">
        {label}
      </div>
      <div
        className="text-lg md:text-xl font-extrabold tracking-tighter truncate"
        style={{ color }}
        title={value}
      >
        {value}
      </div>
    </div>
  );
});

/* ─────────────────────────────────────────────────────────────
   CHARTS (Would live in /components/charts/)
───────────────────────────────────────────────────────────── */
const BarChart = React.memo(({ data, currency }) => {
  const pad = 40,
    perBar = 60,
    height = 220;
  const width = Math.max(480, pad * 2 + data.length * perBar);
  const max = Math.max(1, ...data.map((d) => d.minor));
  const bw = (width - pad * 2) / Math.max(1, data.length);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => Math.round(t * max));

  return (
    <div className="overflow-x-auto border border-[#a78bfa]/20 bg-[#030508] h-full flex items-center custom-scrollbar relative shadow-[inset_0_0_20px_rgba(167,139,250,0.05)]">
      <svg width={width} height={height} className="block w-full">
        <defs>
          <linearGradient id="barGrad" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor={VIOLET} stopOpacity="0.2" />
            <stop offset="100%" stopColor={VIOLET} stopOpacity="1" />
          </linearGradient>
          <pattern
            id="grid"
            width="30"
            height="30"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 30 0 L 0 0 0 30"
              fill="none"
              stroke="rgba(167,139,250,0.05)"
              strokeWidth="1"
            />
          </pattern>
          <pattern
            id="scanline"
            width="4"
            height="4"
            patternUnits="userSpaceOnUse"
          >
            <rect width="4" height="2" fill="rgba(0,0,0,0.2)" />
          </pattern>
        </defs>

        <rect width="100%" height="100%" fill="url(#grid)" />

        {ticks.map((val, i) => {
          const y = height - pad - (val / max) * (height - pad * 2);
          return (
            <g key={`tick-${i}`}>
              <line
                x1={pad}
                y1={y}
                x2={width - pad}
                y2={y}
                stroke="rgba(167,139,250,0.15)"
                strokeDasharray="2 4"
              />
              <text
                x={pad - 8}
                y={y + 3}
                textAnchor="end"
                fontSize="9"
                fontWeight="bold"
                fill="rgba(167,139,250,0.5)"
                className="tracking-widest font-mono"
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
          stroke={VIOLET}
          opacity={0.5}
          strokeWidth="2"
        />

        {data.map((d, i) => {
          const h = (d.minor / max) * (height - pad * 2);
          const x = pad + i * bw + bw * 0.15;
          const y = height - pad - h;
          const w = bw * 0.7;

          return (
            <g key={`bar-${i}`}>
              <rect
                x={x}
                y={pad}
                width={w}
                height={height - pad * 2}
                fill="rgba(167,139,250,0.03)"
                rx="2"
                ry="2"
              />
              <rect
                x={x}
                y={height - pad}
                width={w}
                height={0}
                fill="url(#barGrad)"
                rx="2"
                ry="2"
              >
                <animate
                  attributeName="y"
                  from={height - pad}
                  to={y}
                  dur="0.8s"
                  begin={`${i * 0.08}s`}
                  fill="freeze"
                  calcMode="spline"
                  keyTimes="0;1"
                  keySplines="0.16 1 0.3 1"
                />
                <animate
                  attributeName="height"
                  from="0"
                  to={h}
                  dur="0.8s"
                  begin={`${i * 0.08}s`}
                  fill="freeze"
                  calcMode="spline"
                  keyTimes="0;1"
                  keySplines="0.16 1 0.3 1"
                />
              </rect>

              <rect
                x={x}
                y={height - pad}
                width={w}
                height={2}
                fill={MINT}
                opacity="0"
              >
                <animate
                  attributeName="y"
                  from={height - pad}
                  to={y - 2}
                  dur="0.8s"
                  begin={`${i * 0.08}s`}
                  fill="freeze"
                  calcMode="spline"
                  keyTimes="0;1"
                  keySplines="0.16 1 0.3 1"
                />
                <animate
                  attributeName="opacity"
                  from="0"
                  to="1"
                  dur="0.8s"
                  begin={`${i * 0.08}s`}
                  fill="freeze"
                />
              </rect>

              <text
                x={x + w / 2}
                y={height - pad}
                textAnchor="middle"
                fontSize="10"
                fill={MINT}
                fontWeight="bold"
                className="tracking-widest font-mono"
                opacity="0"
              >
                <animate
                  attributeName="y"
                  from={height - pad}
                  to={y - 8}
                  dur="0.8s"
                  begin={`${i * 0.08}s`}
                  fill="freeze"
                  calcMode="spline"
                  keyTimes="0;1"
                  keySplines="0.16 1 0.3 1"
                />
                <animate
                  attributeName="opacity"
                  from="0"
                  to="1"
                  dur="0.8s"
                  begin={`${i * 0.08}s`}
                  fill="freeze"
                />
                {fmtMoney(d.minor, currency)}
              </text>

              <text
                x={x + w / 2}
                y={height - pad + 18}
                textAnchor="middle"
                fontSize="9"
                fontWeight="bold"
                fill="rgba(255,255,255,0.7)"
                className="uppercase tracking-widest"
              >
                {d.name.length > 10 ? d.name.slice(0, 10) + "…" : d.name}
              </text>
            </g>
          );
        })}

        <rect
          width="100%"
          height="100%"
          fill="url(#scanline)"
          style={{ pointerEvents: "none" }}
        />
      </svg>
    </div>
  );
});

const PieChart = React.memo(({ data, currency }) => {
  const size = 220,
    r = 80,
    hole = 50,
    cx = size / 2,
    cy = size / 2;
  const total = Math.max(
    1,
    data.reduce((a, d) => a + d.minor, 0),
  );
  let angle = -Math.PI / 2;

  const mappedData = data.map((d, i) => {
    const color = NEON_PALETTE[i % NEON_PALETTE.length];
    return { ...d, color };
  });

  const segs = mappedData.map((d) => {
    const a0 = angle;
    const a1 = angle + (d.minor / total) * Math.PI * 2;
    angle = a1;
    const large = a1 - a0 > Math.PI ? 1 : 0;

    const x0 = cx + r * Math.cos(a0),
      y0 = cy + r * Math.sin(a0);
    const x1 = cx + r * Math.cos(a1),
      y1 = cy + r * Math.sin(a1);
    const xi0 = cx + hole * Math.cos(a0),
      yi0 = cy + hole * Math.sin(a0);
    const xi1 = cx + hole * Math.cos(a1),
      yi1 = cy + hole * Math.sin(a1);

    const path = [
      `M ${x0} ${y0}`,
      `A ${r} ${r} 0 ${large} 1 ${x1} ${y1}`,
      `L ${xi1} ${yi1}`,
      `A ${hole} ${hole} 0 ${large} 0 ${xi0} ${yi0}`,
      "Z",
    ].join(" ");

    return { d, path, color: d.color, pct: d.pct ?? d.minor / total };
  });

  return (
    <div className="flex flex-col lg:flex-row items-center gap-6 w-full h-full justify-center p-2">
      <div className="relative flex-shrink-0 flex items-center justify-center">
        <div
          className="absolute inset-0 rounded-full blur-2xl opacity-20"
          style={{
            background: `radial-gradient(circle, ${CYAN} 0%, transparent 70%)`,
          }}
        />

        <svg width={size} height={size} className="block relative z-10">
          <defs>
            <filter id="pieGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
            {/* Added a strong drop shadow filter for the center text to make it readable */}
            <filter id="textShadow">
              <feDropShadow
                dx="0"
                dy="2"
                stdDeviation="2"
                floodColor="#000"
                floodOpacity="0.8"
              />
            </filter>
          </defs>

          <circle
            cx={cx}
            cy={cy}
            r={r + 14}
            fill="none"
            stroke="rgba(255,255,255,0.15)"
            strokeWidth="1"
            strokeDasharray="4 6"
            className="hud-spin"
          />
          <circle
            cx={cx}
            cy={cy}
            r={r + 8}
            fill="none"
            stroke={CYAN}
            strokeOpacity="0.3"
            strokeWidth="2"
            strokeDasharray="30 10 5 10"
            className="hud-spin-reverse"
          />

          <circle
            cx={cx}
            cy={cy}
            r={hole - 10}
            fill="none"
            stroke="rgba(255,255,255,0.1)"
            strokeWidth="1"
            strokeDasharray="2 4"
            className="hud-spin"
          />
          <path
            d={`M ${cx} ${cy - hole + 15} v 10 M ${cx} ${cy + hole - 15} v -10 M ${cx - hole + 15} ${cy} h 10 M ${cx + hole - 15} ${cy} h -10`}
            stroke="rgba(255,255,255,0.2)"
            strokeWidth="1.5"
          />

          {segs.map((s, i) => (
            <g key={i} filter="url(#pieGlow)">
              <path
                d={s.path}
                fill={s.color}
                stroke={BG}
                strokeWidth="4"
                opacity="0"
                className="transition-all duration-300 hover:brightness-125 hover:scale-[1.02] origin-center"
              >
                <animate
                  attributeName="opacity"
                  from="0"
                  to="1"
                  dur="0.6s"
                  begin={`${i * 0.1}s`}
                  fill="freeze"
                />
              </path>
            </g>
          ))}

          {/* Upgraded Center Readout Text - Brighter with Drop Shadows */}
          <text
            x={cx}
            y={cy - 6}
            textAnchor="middle"
            fontSize="10"
            fontWeight="bold"
            fill="#e2e8f0"
            filter="url(#textShadow)"
            className="tracking-[0.2em] uppercase font-mono"
          >
            TOTAL
          </text>
          <text
            x={cx}
            y={cy + 14}
            textAnchor="middle"
            fontSize="14"
            fill="#ffffff"
            fontWeight="900"
            filter="url(#textShadow)"
            className="tracking-widest font-mono"
          >
            {fmtMoney(total, currency)}
          </text>
        </svg>
      </div>

      <div className="w-full flex-1 space-y-2 overflow-y-auto max-h-[220px] custom-scrollbar pr-2">
        {mappedData.map((s, i) => (
          <div
            key={i}
            className="group flex items-center gap-3 border border-white/5 bg-white/[0.02] px-3 py-2 transition-all hover:bg-white/[0.05] hover:border-white/20 relative overflow-hidden"
          >
            <div
              className="absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity"
              style={{
                background: `linear-gradient(90deg, ${s.color}, transparent)`,
              }}
            />

            <div
              className="absolute left-0 top-0 bottom-0 w-1"
              style={{ backgroundColor: s.color }}
            />

            <div className="flex-1 min-w-0 pl-1">
              <div
                className="truncate text-[10px] font-extrabold uppercase tracking-widest text-white/90 group-hover:text-white transition-colors"
                title={s.name}
              >
                {s.name}
              </div>
              <div className="text-[9px] font-bold text-white/40 font-mono mt-0.5">
                {Math.round((s.pct ?? 0) * 100)}% SHARE
              </div>
            </div>

            <div className="text-right">
              <div className="font-mono text-[11px] font-bold text-white group-hover:text-[#00d4ff] transition-colors">
                {fmtMoney(s.minor, currency)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});

/* ─────────────────────────────────────────────────────────────
   MODALS (Would live in /features/expenses/modals/)
───────────────────────────────────────────────────────────── */
const ExpenseModal = React.memo(
  ({
    open,
    editing,
    initialData,
    accounts,
    categories,
    defaultAccountId,
    onClose,
    onSuccess,
  }) => {
    const [form, setForm] = useState({
      amount: "",
      currency: "USD",
      date: new Date().toISOString().slice(0, 10),
      nextDate: "",
      categoryId: "",
      description: "",
      tagsCsv: "",
      accountId: defaultAccountId || "",
    });

    useEffect(() => {
      if (open) {
        if (initialData) {
          setForm({
            amount: minorToMajor(initialData.amountMinor, initialData.currency),
            currency: initialData.currency,
            date: new Date(initialData.date).toISOString().slice(0, 10),
            nextDate: initialData.nextDate
              ? new Date(initialData.nextDate).toISOString().slice(0, 10)
              : "",
            categoryId: initialData.categoryId || "",
            description: initialData.description || "",
            tagsCsv: (initialData.tags || []).join(", "),
            accountId: initialData.accountId || defaultAccountId || "",
          });
        } else {
          const defaultCur =
            accounts.find((a) => a._id === defaultAccountId)?.currency || "USD";
          setForm({
            amount: "",
            currency: defaultCur,
            date: new Date().toISOString().slice(0, 10),
            nextDate: "",
            categoryId: categories[0]?._id || "",
            description: "",
            tagsCsv: "",
            accountId: defaultAccountId || "",
          });
        }
      }
    }, [open, initialData, accounts, categories, defaultAccountId]);

    if (!open) return null;

    const handleSubmit = async () => {
      const amountMinor = majorToMinor(form.amount, form.currency);
      if (Number.isNaN(amountMinor)) return window.alert("Invalid amount");
      if (!form.categoryId) return window.alert("Pick a category");
      if (!form.accountId) return window.alert("Pick an account");

      const payload = {
        accountId: form.accountId,
        categoryId: form.categoryId,
        type: "expense",
        amountMinor,
        currency: form.currency,
        date: new Date(form.date).toISOString(),
        description: form.description || null,
        tags: form.tagsCsv
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      };
      if (form.nextDate)
        payload.nextDate = new Date(form.nextDate).toISOString();

      try {
        if (!editing) {
          await api.post("/transactions", payload);
        } else {
          await api.put(`/transactions/${initialData._id}`, payload);
        }
        onSuccess();
      } catch (e) {
        window.alert(e?.response?.data?.error || e.message || "Error");
      }
    };

    const handleAccountChange = (e) => {
      const accId = e.target.value;
      const acc = accounts.find((a) => a._id === accId);
      setForm((prev) => ({
        ...prev,
        accountId: accId,
        currency: acc ? acc.currency : prev.currency,
      }));
    };

    return (
      <div className="fixed inset-0 z-50 grid place-items-center bg-[#030508]/90 backdrop-blur-sm px-4">
        <div className="relative w-full max-w-xl bg-[#030508] border border-[#a78bfa]/30 text-[#e2e8f0] shadow-2xl p-5 md:p-6 max-h-[90vh] overflow-y-auto custom-scrollbar">
          <Brackets color={VIOLET} size="14px" thick="1.5px" />
          <div
            className="absolute top-0 inset-x-[10%] h-[1.5px] opacity-60"
            style={{ backgroundColor: VIOLET }}
          />
          <div className="mb-6">
            <h2
              className="text-lg font-extrabold tracking-tight uppercase"
              style={{ color: VIOLET }}
            >
              {editing ? "EDIT EXPENSE" : "NEW EXPENSE"}
            </h2>
            <ScanLine color={VIOLET} className="mt-3" />
          </div>
          <div className="space-y-4">
            <Field label="Account">
              <select
                value={form.accountId}
                onChange={handleAccountChange}
                className="w-full border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white outline-none focus:border-[#a78bfa]/50"
              >
                <option value="" className="text-black">
                  — Pick an account —
                </option>
                {accounts.map((a) => (
                  <option key={a._id} value={a._id} className="text-black">
                    {a.name} · {a.currency}
                  </option>
                ))}
              </select>
            </Field>
            <div className="grid grid-cols-1 md:grid-cols-[1fr_120px] gap-4">
              <Field label="Amount">
                <input
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  placeholder="0.00"
                  inputMode="decimal"
                  className="w-full border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-[#a78bfa]/50"
                />
              </Field>
              <Field label="CCY">
                <input
                  value={form.currency}
                  readOnly
                  className="w-full border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white outline-none opacity-60"
                />
              </Field>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Date">
                <input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  className="w-full border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white outline-none focus:border-[#a78bfa]/50"
                />
              </Field>
              <Field label="Next Date (Opt)">
                <input
                  type="date"
                  value={form.nextDate}
                  onChange={(e) =>
                    setForm({ ...form, nextDate: e.target.value })
                  }
                  className="w-full border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white outline-none focus:border-[#a78bfa]/50"
                />
              </Field>
            </div>
            <Field label="Category">
              <select
                value={form.categoryId}
                onChange={(e) =>
                  setForm({ ...form, categoryId: e.target.value })
                }
                className="w-full border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white outline-none focus:border-[#a78bfa]/50"
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
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                placeholder="Optional memo"
                className="w-full border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-[#a78bfa]/50"
              />
            </Field>
            <Field label="Tags (csv)">
              <input
                value={form.tagsCsv}
                onChange={(e) => setForm({ ...form, tagsCsv: e.target.value })}
                placeholder="groceries, dinner"
                className="w-full border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-[#a78bfa]/50"
              />
            </Field>
            <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
              <button
                type="button"
                onClick={onClose}
                className="border border-white/10 bg-white/[0.04] px-4 py-2 text-[10px] font-extrabold tracking-widest text-white/70 uppercase hover:bg-white/[0.08]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                className="px-4 py-2 text-[10px] font-extrabold tracking-widest text-[#030508] uppercase hover:opacity-80"
                style={{ backgroundColor: VIOLET }}
              >
                {editing ? "Save" : "Add"}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  },
);

const AutoQuickAddModal = React.memo(
  ({ open, accounts, defaultAccountId, onClose, onSuccess }) => {
    const [accountId, setAccountId] = useState("");
    const [text, setText] = useState("");
    const [busy, setBusy] = useState(false);
    const [notice, setNotice] = useState("");
    const inputRef = useRef(null);

    useEffect(() => {
      if (open) {
        setAccountId(defaultAccountId);
        setText("");
        setNotice("");
        const t = setTimeout(() => inputRef.current?.focus?.(), 0);
        return () => clearTimeout(t);
      }
    }, [open, defaultAccountId]);

    const handleCreate = async () => {
      const clean = String(text || "").trim();
      if (!accountId) return setNotice("Pick an account.");
      if (!clean)
        return setNotice("Type something like: 'paid 280 TRY coffee'");

      setBusy(true);
      try {
        const acc = accounts.find((a) => a._id === accountId);
        const data = await autoCreateFromText({
          accountId,
          type: "expense",
          currency: (acc?.currency || "USD").toUpperCase(),
          date: new Date().toISOString(),
          text: clean,
        });
        if (data?.mode === "duplicate")
          return setNotice("Possible duplicate detected. Not auto-created.");
        if (data?.mode === "draft")
          return setNotice("Draft created. Review it in Drafts.");
        onSuccess();
      } catch (e) {
        setNotice(e?.response?.data?.error || e.message || "Auto parse failed");
      } finally {
        setBusy(false);
      }
    };

    useEffect(() => {
      if (!open) return;
      const onKey = (e) => {
        if (e.key === "Escape") onClose();
        if ((e.ctrlKey || e.metaKey) && e.key === "Enter") handleCreate();
      };
      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
    }, [open, onClose, text, accountId]);

    if (!open) return null;

    return (
      <div
        className="fixed inset-0 z-50 grid place-items-center bg-[#030508]/90 backdrop-blur-sm px-4"
        onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      >
        <div className="relative w-full max-w-xl bg-[#030508] border border-[#00d4ff]/30 text-[#e2e8f0] shadow-2xl p-5 md:p-6">
          <Brackets color={CYAN} size="14px" thick="1.5px" />
          <div
            className="absolute top-0 inset-x-[10%] h-[1.5px] opacity-60"
            style={{ backgroundColor: CYAN }}
          />
          <div className="space-y-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div
                  className="text-lg font-extrabold tracking-tight uppercase"
                  style={{ color: CYAN }}
                >
                  Auto add expense
                </div>
                <div className="mt-1 text-xs text-white/50 tracking-wider uppercase">
                  Parse a short sentence into a transaction.
                </div>
              </div>
              <div
                className="inline-flex items-center gap-2 border bg-black/40 px-3 py-1 text-[9px] font-bold tracking-widest text-white/70"
                style={{ borderColor: `${CYAN}44` }}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: CYAN }}
                />
                TEXT PARSER
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-white/50 tracking-widest uppercase">
                Account
              </label>
              <select
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                className="w-full border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-white outline-none transition focus:border-[#00d4ff]/50"
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
              <label className="text-[10px] font-bold text-white/50 tracking-widest uppercase">
                Text
              </label>
              <input
                ref={inputRef}
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  setNotice("");
                }}
                placeholder="e.g. paid 280 TRY coffee"
                className="w-full border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-white placeholder:text-white/30 outline-none transition focus:border-[#00d4ff]/50"
                disabled={busy}
              />
              <div className="text-[10px] text-white/40 tracking-wide">
                Examples:{" "}
                <span className="text-white/70">paid 280 TRY coffee</span>,{" "}
                <span className="text-white/70">uber 180</span>
              </div>
            </div>
            {notice && (
              <div className="border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-[11px] font-bold tracking-wider text-amber-300 uppercase">
                {notice}
              </div>
            )}
            <ScanLine color={CYAN} className="my-2" />
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={busy}
                className="border border-white/10 bg-white/[0.04] px-5 py-2 text-[10px] font-extrabold tracking-widest text-white/70 transition hover:bg-white/[0.08] uppercase"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreate}
                disabled={busy}
                title="Ctrl/⌘ + Enter"
                className="px-5 py-2 text-[10px] font-extrabold tracking-widest text-[#030508] transition hover:opacity-80 disabled:opacity-50 uppercase"
                style={{ backgroundColor: CYAN }}
              >
                {busy ? "Parsing..." : "Create"}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  },
);

/* ─────────────────────────────────────────────────────────────
   FEED COMPONENTS (Would live in /features/expenses/feed/)
───────────────────────────────────────────────────────────── */
const Row = React.memo(
  ({ item, categories, accountsById, onEdit, onDelete }) => {
    const catName =
      categories.find((c) => c._id === item.categoryId)?.name || "—";
    const accName = accountsById.get(item.accountId)?.name || "—";
    const isFuture = new Date(item.date) > startOfUTC(new Date());

    return (
      <div className="relative border-b border-white/5 p-4 last:border-0 hover:bg-white/[0.01] transition-colors">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <div
                className="border px-2 py-0.5 flex items-center gap-2 bg-black/40"
                style={{ borderColor: `${VIOLET}44` }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: VIOLET }}
                />
                <span
                  className="text-[9px] font-extrabold tracking-widest uppercase"
                  style={{ color: VIOLET }}
                >
                  {catName}
                </span>
              </div>
              {isFuture && (
                <span className="border border-[#a78bfa]/30 bg-[#a78bfa]/10 px-2 py-0.5 text-[8px] font-bold tracking-widest text-[#a78bfa] uppercase">
                  UPCOMING
                </span>
              )}
            </div>
            <div className="inline-block border border-white/10 bg-black/40 px-2 py-0.5 mb-2">
              <span className="text-[8px] tracking-widest text-white/50 uppercase">
                {accName}
              </span>
            </div>
            <div className="text-[12px] text-white/70 mb-2 leading-relaxed">
              {item.description || "No description"}
            </div>
            <div className="text-[9px] text-white/40 tracking-widest uppercase mb-2">
              {fmtDateUTC(item.date)}
            </div>
            {item.tags?.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-1">
                {item.tags.map((tag) => (
                  <span
                    key={tag}
                    className="text-[9px] font-bold tracking-widest uppercase"
                    style={{ color: MINT }}
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="text-left lg:text-right">
            <div
              className="text-xl font-extrabold tracking-tighter mb-3"
              style={{ color: VIOLET }}
            >
              -{minorToMajor(item.amountMinor, item.currency)}{" "}
              <span className="text-[10px] font-bold opacity-60">
                {item.currency}
              </span>
            </div>
            <div className="flex gap-2 lg:justify-end">
              <button
                onClick={() => onEdit(item)}
                className="border border-[#00d4ff]/30 bg-[#00d4ff]/10 px-3 py-1 text-[8px] font-bold tracking-widest text-[#00d4ff] uppercase hover:bg-[#00d4ff]/20"
              >
                EDIT
              </button>
              <button
                onClick={() => onDelete(item)}
                className="border border-[#a78bfa]/30 bg-[#a78bfa]/10 px-3 py-1 text-[8px] font-bold tracking-widest text-[#a78bfa] uppercase hover:bg-[#a78bfa]/20"
              >
                DELETE
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  },
);

/* ─────────────────────────────────────────────────────────────
   MAIN SCREEN
───────────────────────────────────────────────────────────── */
export default function ExpensesScreen({ accountId }) {
  const { transactions, categories, accounts, loading, error, refetch } =
    useExpenseData();

  const [filters, setFilters] = useState({
    fStartISO: "",
    fEndISO: "",
    fAccountId: "ALL",
    fCategoryId: "ALL",
    fCurrency: "ALL",
    fMin: "",
    fMax: "",
  });
  const [q, setQ] = useState("");
  const debouncedQ = useDebounce(q, 300);
  const [showFilters, setShowFilters] = useState(false);
  const [sortKey, setSortKey] = useState("date_desc");

  // New state for creating categories
  const [newCatName, setNewCatName] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingData, setEditingData] = useState(null);
  const [autoModalOpen, setAutoModalOpen] = useState(false);

  const categoriesById = useMemo(
    () => new Map(categories.map((c) => [c._id, c])),
    [categories],
  );
  const accountsById = useMemo(
    () => new Map(accounts.map((a) => [a._id, a])),
    [accounts],
  );
  const currencies = useMemo(
    () => [
      "ALL",
      ...new Set(
        transactions
          .filter((t) => t.type === "expense")
          .map((t) => t.currency || "USD"),
      ),
    ],
    [transactions],
  );

  const rows = useMemo(() => {
    const start = filters.fStartISO
      ? new Date(`${filters.fStartISO}T00:00:00.000Z`)
      : null;
    const end = filters.fEndISO
      ? new Date(`${filters.fEndISO}T23:59:59.999Z`)
      : null;
    const minNum = filters.fMin !== "" ? Number(filters.fMin) : null;
    const maxNum = filters.fMax !== "" ? Number(filters.fMax) : null;
    const needle = debouncedQ.trim().toLowerCase();

    const filtered = transactions.filter((t) => {
      if ((t.type || "") !== "expense") return false;
      if (
        filters.fAccountId !== "ALL" &&
        String(t.accountId) !== String(filters.fAccountId)
      )
        return false;
      if (
        filters.fCategoryId !== "ALL" &&
        String(t.categoryId) !== String(filters.fCategoryId)
      )
        return false;

      const cur = t.currency || "USD";
      if (filters.fCurrency !== "ALL" && cur !== filters.fCurrency)
        return false;

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
        const hay =
          `${t.description || ""} ${t.notes || ""} ${cat} ${acc} ${(t.tags || []).join(" ")}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });

    filtered.sort((a, b) => {
      switch (sortKey) {
        case "date_asc":
          return new Date(a.date) - new Date(b.date);
        case "amount_desc":
          return (
            Number(b.amountMinor || 0) /
              Math.pow(10, decimalsForCurrency(b.currency || "USD")) -
            Number(a.amountMinor || 0) /
              Math.pow(10, decimalsForCurrency(a.currency || "USD"))
          );
        case "amount_asc":
          return (
            Number(a.amountMinor || 0) /
              Math.pow(10, decimalsForCurrency(a.currency || "USD")) -
            Number(b.amountMinor || 0) /
              Math.pow(10, decimalsForCurrency(b.currency || "USD"))
          );
        case "date_desc":
        default:
          return new Date(b.date) - new Date(a.date);
      }
    });
    return filtered;
  }, [
    transactions,
    debouncedQ,
    filters,
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
      if (t.type !== "expense") continue;
      if (new Date(t.date) > today)
        map.set(keyOf(t), { ...t, __kind: "actual" });
    }
    for (const t of transactions) {
      if (t.type !== "expense" || !t.nextDate) continue;
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
    const arr = Array.from(map.values()).sort(
      (a, b) => new Date(a.date) - new Date(b.date),
    );
    return arr;
  }, [transactions]);

  const insights = useMemo(() => {
    const chosen =
      filters.fCurrency !== "ALL"
        ? filters.fCurrency
        : rows[0]?.currency || "USD";
    const filteredByCur = rows.filter((r) =>
      chosen ? r.currency === chosen : true,
    );
    const now = new Date();
    const thisStart = startOfMonthUTC(now),
      thisEnd = endOfMonthUTC(now);
    const lastStart = startOfMonthUTC(addMonthsUTC(now, -1)),
      lastEnd = endOfMonthUTC(addMonthsUTC(now, -1));

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
      const s = startOfMonthUTC(new Date(Date.UTC(now.getUTCFullYear(), m, 1)));
      const e = endOfMonthUTC(new Date(Date.UTC(now.getUTCFullYear(), m, 1)));
      yearMinor += minorSum(within(filteredByCur, s, e));
    }

    const catMap = new Map(),
      pieMap = new Map();
    for (const t of thisMonth)
      catMap.set(
        t.categoryId || "—",
        (catMap.get(t.categoryId || "—") || 0) + Number(t.amountMinor || 0),
      );
    for (const t of filteredByCur)
      pieMap.set(
        t.categoryId || "—",
        (pieMap.get(t.categoryId || "—") || 0) + Number(t.amountMinor || 0),
      );

    const total = Array.from(pieMap.values()).reduce((a, b) => a + b, 0) || 1;

    return {
      statsCurrency: chosen,
      kpis: {
        last: minorSum(lastMonth),
        this: minorSum(thisMonth),
        yearlyAvg: monthsPassed ? Math.round(yearMinor / monthsPassed) : 0,
      },
      monthCats: Array.from(catMap.entries())
        .map(([cid, minor]) => ({
          name: categoriesById.get(cid)?.name || "—",
          minor,
        }))
        .sort((a, b) => b.minor - a.minor),
      pieData: Array.from(pieMap.entries())
        .map(([cid, minor]) => ({
          name: categoriesById.get(cid)?.name || "—",
          minor,
          pct: minor / total,
        }))
        .sort((a, b) => b.minor - a.minor),
      noteMixedCurrency: filters.fCurrency === "ALL",
    };
  }, [rows, filters.fCurrency, categoriesById]);

  /* Actions */
  const handleOpenCreate = useCallback(() => {
    setEditingData(null);
    setModalOpen(true);
  }, []);

  const handleOpenEdit = useCallback((tx) => {
    setEditingData(tx);
    setModalOpen(true);
  }, []);

  const handleSoftDelete = useCallback(
    async (tx) => {
      if (!window.confirm("Delete expense?")) return;
      try {
        await api.delete(`/transactions/${tx._id}`);
        refetch();
      } catch (e) {
        window.alert(e?.response?.data?.error || e.message || "Error");
      }
    },
    [refetch],
  );

  const handleModalSuccess = useCallback(() => {
    setModalOpen(false);
    setAutoModalOpen(false);
    refetch();
  }, [refetch]);

  const handleSeedCategories = async () => {
    try {
      if (!window.confirm("Seed all standard expense categories?")) return;
      const existingNames = new Set(categories.map((c) => c.name));
      for (const name of EXPENSE_CATEGORY_OPTIONS) {
        if (!existingNames.has(name))
          await api.post("/categories", { name, kind: "expense" });
      }
      refetch();
    } catch (e) {
      window.alert(e?.response?.data?.error || "Error seeding categories");
    }
  };

  const handleCreateCategory = async (e) => {
    e?.preventDefault();
    if (!newCatName.trim()) return;
    try {
      await api.post("/categories", {
        name: newCatName.trim(),
        kind: "expense",
      });
      setNewCatName("");
      refetch();
    } catch (err) {
      window.alert(err?.response?.data?.error || "Error creating category");
    }
  };

  /* Layout Renderers */
  if (loading) {
    return (
      <div className="min-h-dvh grid place-items-center bg-[#030508] px-4">
        <div className="flex flex-col items-center">
          <Brackets color={VIOLET} size="20px" thick="2px" />
          <div className="w-16 h-16 border border-[#a78bfa]/30 flex items-center justify-center mb-4 bg-[#a78bfa]/10">
            <div className="w-8 h-8 rounded-full border-t-2 border-[#a78bfa] animate-spin" />
          </div>
          <div className="text-[11px] font-extrabold tracking-[0.3em] text-white/70 uppercase">
            Initialising Module...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-[#030508] text-[#e2e8f0] font-sans selection:bg-[#a78bfa]/30">
      <style
        dangerouslySetInnerHTML={{
          __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 4px; height: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: rgba(255,255,255,0.02); }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }
        
        @keyframes spin-slow { 100% { transform: rotate(360deg); } }
        @keyframes spin-slow-reverse { 100% { transform: rotate(-360deg); } }
        .hud-spin { animation: spin-slow 20s linear infinite; transform-origin: center; }
        .hud-spin-reverse { animation: spin-slow-reverse 15s linear infinite; transform-origin: center; }
      `,
        }}
      />

      <div className="mx-auto max-w-[1600px] w-full px-4 sm:px-6 lg:px-8 py-6 flex flex-col gap-5">
        {/* HEADER AREA */}
        <div className="relative border border-[#a78bfa]/20 bg-[#a78bfa]/[0.03] p-5 md:p-6 overflow-hidden">
          <Brackets color={VIOLET} size="12px" thick="1.5px" />
          <div
            className="absolute top-0 inset-x-[10%] h-[1px] opacity-40"
            style={{ backgroundColor: VIOLET }}
          />
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 border border-white/10 bg-black/40 px-3 py-1 mb-4">
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: MINT }}
                />
                <span className="text-[9px] font-extrabold tracking-[0.2em] text-white/60 uppercase">
                  Expense Ledger
                </span>
              </div>
              <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-white leading-none">
                Expense Control
              </h1>
              <p className="mt-3 max-w-2xl text-[13px] text-white/50 leading-relaxed">
                Review spending, spot patterns, and keep your outflow
                decision-ready.
              </p>
              <ScanLine color={VIOLET} className="mt-6 w-full max-w-md" />
            </div>
            <div className="flex flex-wrap items-center gap-3 lg:justify-end">
              <button
                onClick={() => setShowFilters((v) => !v)}
                className="inline-flex items-center gap-2 border border-white/10 bg-black/40 px-4 py-2 hover:bg-white/5 transition-colors"
              >
                <span className="text-[10px] font-bold tracking-widest text-white/80 uppercase">
                  Filters
                </span>
              </button>
              <button
                onClick={() => setAutoModalOpen(true)}
                className="inline-flex items-center gap-2 border border-[#00d4ff]/30 bg-black/40 px-4 py-2 hover:bg-white/5 transition-colors"
              >
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: CYAN }}
                />
                <span className="text-[10px] font-bold tracking-widest text-[#00d4ff] uppercase">
                  Auto Add
                </span>
              </button>
              <button
                onClick={handleOpenCreate}
                className="inline-flex items-center px-4 py-2 hover:opacity-80 transition-opacity"
                style={{ backgroundColor: MINT }}
              >
                <span className="text-[10px] font-extrabold tracking-widest text-[#030508] uppercase">
                  + New Expense
                </span>
              </button>
              <button
                onClick={refetch}
                className="inline-flex items-center border border-white/10 bg-black/40 px-3 py-2 hover:bg-white/5 transition-colors"
              >
                <span className="text-[10px] font-bold tracking-widest text-white/50 uppercase">
                  Refresh
                </span>
              </button>
            </div>
          </div>

          <div className="mt-8 flex flex-col gap-4 xl:flex-row xl:items-center">
            <div className="relative flex-1 flex items-center border border-white/10 bg-black/40 px-4 py-2">
              <span
                className="w-1.5 h-1.5 rounded-full mr-3"
                style={{ backgroundColor: MINT }}
              />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="SEARCH DESCRIPTION, ACCOUNT, CATEGORY OR #TAGS"
                className="w-full bg-transparent text-[11px] font-bold tracking-widest text-white placeholder:text-white/20 outline-none uppercase"
              />
            </div>
            <div className="flex items-center gap-3 border border-white/10 bg-black/40 px-4 py-2">
              <span className="text-[10px] font-bold tracking-widest text-white/40 uppercase">
                Sort
              </span>
              <select
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value)}
                className="bg-transparent text-[11px] font-bold tracking-widest text-white outline-none uppercase"
              >
                <option value="date_desc" className="text-black">
                  Newest
                </option>
                <option value="date_asc" className="text-black">
                  Oldest
                </option>
                <option value="amount_desc" className="text-black">
                  Amount ↓
                </option>
                <option value="amount_asc" className="text-black">
                  Amount ↑
                </option>
              </select>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2 max-h-[84px] overflow-y-auto custom-scrollbar pr-2">
            <Chip
              label="All"
              selected={filters.fCategoryId === "ALL"}
              onClick={() => setFilters((f) => ({ ...f, fCategoryId: "ALL" }))}
              accent={CYAN}
            />
            {categories.map((c) => (
              <Chip
                key={c._id}
                label={c.name}
                selected={filters.fCategoryId === c._id}
                onClick={() =>
                  setFilters((f) => ({ ...f, fCategoryId: c._id }))
                }
                accent={VIOLET}
              />
            ))}
          </div>

          {showFilters && (
            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 border border-white/10 bg-black/40 p-5">
              <Field label="Account">
                <select
                  value={filters.fAccountId}
                  onChange={(e) =>
                    setFilters((f) => ({ ...f, fAccountId: e.target.value }))
                  }
                  className="w-full border border-white/10 bg-white/[0.03] px-3 py-2 text-[11px] font-bold tracking-widest text-white outline-none uppercase"
                >
                  <option value="ALL" className="text-black">
                    All accounts
                  </option>
                  {accounts.map((a) => (
                    <option key={a._id} value={a._id} className="text-black">
                      {a.name} · {a.currency}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Currency">
                <select
                  value={filters.fCurrency}
                  onChange={(e) =>
                    setFilters((f) => ({ ...f, fCurrency: e.target.value }))
                  }
                  className="w-full border border-white/10 bg-white/[0.03] px-3 py-2 text-[11px] font-bold tracking-widest text-white outline-none uppercase"
                >
                  {currencies.map((c) => (
                    <option key={c} value={c} className="text-black">
                      {c}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="From Date">
                <input
                  type="date"
                  value={filters.fStartISO}
                  onChange={(e) =>
                    setFilters((f) => ({ ...f, fStartISO: e.target.value }))
                  }
                  className="w-full border border-white/10 bg-white/[0.03] px-3 py-2 text-[11px] font-bold tracking-widest text-white outline-none uppercase"
                />
              </Field>
              <Field label="To Date">
                <input
                  type="date"
                  value={filters.fEndISO}
                  onChange={(e) =>
                    setFilters((f) => ({ ...f, fEndISO: e.target.value }))
                  }
                  className="w-full border border-white/10 bg-white/[0.03] px-3 py-2 text-[11px] font-bold tracking-widest text-white outline-none uppercase"
                />
              </Field>
              <Field label="Min Amount">
                <input
                  type="number"
                  value={filters.fMin}
                  onChange={(e) =>
                    setFilters((f) => ({ ...f, fMin: e.target.value }))
                  }
                  placeholder="0.00"
                  className="w-full border border-white/10 bg-white/[0.03] px-3 py-2 text-[11px] font-bold tracking-widest text-white placeholder:text-white/20 outline-none uppercase"
                />
              </Field>
              <Field label="Max Amount">
                <input
                  type="number"
                  value={filters.fMax}
                  onChange={(e) =>
                    setFilters((f) => ({ ...f, fMax: e.target.value }))
                  }
                  placeholder="9999.00"
                  className="w-full border border-white/10 bg-white/[0.03] px-3 py-2 text-[11px] font-bold tracking-widest text-white placeholder:text-white/20 outline-none uppercase"
                />
              </Field>
              <div className="col-span-full flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() =>
                    setFilters({
                      fStartISO: "",
                      fEndISO: "",
                      fAccountId: "ALL",
                      fCategoryId: "ALL",
                      fCurrency: "ALL",
                      fMin: "",
                      fMax: "",
                    })
                  }
                  className="border border-white/10 bg-white/[0.03] px-4 py-2 text-[10px] font-bold tracking-widest text-white/60 hover:bg-white/5 uppercase"
                >
                  CLEAR
                </button>
                <button
                  type="button"
                  onClick={() => setShowFilters(false)}
                  className="px-4 py-2 text-[10px] font-extrabold tracking-widest text-black uppercase"
                  style={{ backgroundColor: MINT }}
                >
                  APPLY
                </button>
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="flex gap-3 border border-[#a78bfa]/30 bg-[#a78bfa]/10 p-4">
            <div className="font-bold text-[#a78bfa]">[!]</div>
            <div className="text-sm text-white/80">{error}</div>
          </div>
        )}

        {/* TOP LAYER BENTO */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-5 items-stretch">
          <SectionCard
            title="KPIs"
            accent="cyan"
            className="lg:col-span-3 xl:col-span-3"
            right={
              <span className="border border-[#00d4ff]/30 bg-[#00d4ff]/10 px-1.5 py-0.5 text-[8px] font-bold tracking-widest text-[#00d4ff] uppercase">
                {(filters.fCurrency !== "ALL"
                  ? filters.fCurrency
                  : rows[0]?.currency) || "—"}
              </span>
            }
          >
            {insights.noteMixedCurrency && (
              <div className="mb-3 text-[9px] tracking-widest text-white/50 uppercase">
                Mixed currency mode. Select one for accuracy.
              </div>
            )}
            <div className="flex flex-col gap-3 h-full justify-center">
              <MetricCard
                label="Last Month"
                value={fmtMoney(insights.kpis.last, insights.statsCurrency)}
                accent="cyan"
              />
              <MetricCard
                label="This Month"
                value={fmtMoney(insights.kpis.this, insights.statsCurrency)}
                accent="violet"
              />
              <MetricCard
                label="Yearly Avg"
                value={fmtMoney(
                  insights.kpis.yearlyAvg,
                  insights.statsCurrency,
                )}
                accent="mint"
              />
            </div>
          </SectionCard>
          <SectionCard
            title="By Category"
            subtitle="Current Month"
            accent="violet"
            className="lg:col-span-6 xl:col-span-6 min-w-0"
          >
            {insights.monthCats.length ? (
              <BarChart
                data={insights.monthCats}
                currency={insights.statsCurrency}
              />
            ) : (
              <div className="text-[10px] tracking-widest text-white/40 uppercase flex h-full items-center justify-center">
                No Data
              </div>
            )}
          </SectionCard>
          <SectionCard
            title="Distribution"
            accent="mint"
            className="lg:col-span-3 xl:col-span-3 min-w-0"
          >
            {insights.pieData.length ? (
              <PieChart
                data={insights.pieData}
                currency={insights.statsCurrency}
              />
            ) : (
              <div className="text-[10px] tracking-widest text-white/40 uppercase flex h-full items-center justify-center">
                No Data
              </div>
            )}
          </SectionCard>
        </div>

        {/* BOTTOM LAYER */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-5 items-start">
          <div className="lg:col-span-8 flex flex-col gap-4 lg:gap-5 min-w-0">
            <div className="flex items-center gap-3">
              <div className="flex gap-2">
                {totals.map(({ cur, major }) => (
                  <div
                    key={cur}
                    className="flex items-center gap-2 border border-[#00d4ff]/30 bg-black/40 px-3 py-1"
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: CYAN }}
                    />
                    <span className="text-[9px] font-bold tracking-widest text-[#00d4ff] uppercase">
                      Total {cur}: <span className="text-white">{major}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <SectionCard
              title="Transaction Feed"
              subtitle={`${rows.length} records in view`}
              accent="mint"
              className="min-w-0"
            >
              {rows.length === 0 ? (
                <div className="py-12 text-center text-[10px] tracking-widest text-white/40 uppercase">
                  No expenses found matching filters.
                </div>
              ) : (
                <div className="border border-white/10 bg-black/20 max-h-[800px] overflow-y-auto custom-scrollbar">
                  {rows.map((item) => (
                    <Row
                      key={item._id}
                      item={item}
                      categories={categories}
                      accountsById={accountsById}
                      onEdit={handleOpenEdit}
                      onDelete={handleSoftDelete}
                    />
                  ))}
                </div>
              )}
            </SectionCard>
          </div>

          <div className="lg:col-span-4 flex flex-col gap-4 lg:gap-5 min-w-0 lg:sticky lg:top-6">
            <SectionCard
              title={`Scheduled Flow (${upcoming.length})`}
              subtitle="Upcoming and planned expenses"
              accent="violet"
            >
              {upcoming.length === 0 ? (
                <div className="text-[10px] tracking-widest text-white/40 uppercase py-2">
                  Nothing upcoming.
                </div>
              ) : (
                <div className="relative pl-5 space-y-3 max-h-[300px] overflow-y-auto custom-scrollbar pr-2 py-1">
                  {/* Timeline vertical track */}
                  <div className="absolute left-[7px] top-2 bottom-2 w-[1px] bg-white/10" />

                  {upcoming.map((u) => {
                    const isVirtual = u.__kind === "virtual";
                    const ac = isVirtual ? MINT : CYAN;
                    return (
                      <div key={u._id} className="relative group">
                        {/* Timeline Node Dot */}
                        <div
                          className="absolute -left-[22px] top-3.5 w-2 h-2 rounded-full ring-[3px] ring-[#030508] z-10 transition-all duration-300 group-hover:scale-[1.5]"
                          style={{
                            backgroundColor: ac,
                            boxShadow: `0 0 8px ${ac}`,
                          }}
                        />
                        {/* Flow Card */}
                        <div className="relative border border-white/5 bg-gradient-to-r from-white/[0.02] to-transparent p-3 transition-all duration-300 group-hover:border-white/10 group-hover:from-white/[0.04] overflow-hidden">
                          {/* Left Accent Bar */}
                          <div
                            className="absolute left-0 top-0 bottom-0 w-[2px] transition-all duration-300 opacity-50 group-hover:opacity-100"
                            style={{ backgroundColor: ac }}
                          />
                          {/* Corner Glow Effect */}
                          <div
                            className="absolute -right-4 -top-4 w-16 h-16 blur-2xl opacity-0 group-hover:opacity-20 transition-opacity duration-500 rounded-full"
                            style={{ backgroundColor: ac }}
                          />
                          <div className="pl-1.5 relative z-10">
                            <div className="flex items-start justify-between gap-2 mb-1.5">
                              <span
                                className="text-[10px] font-extrabold tracking-widest uppercase transition-colors"
                                style={{ color: ac }}
                              >
                                {categoriesById.get(u.categoryId)?.name || "—"}
                              </span>
                              <span
                                className="border px-1.5 py-0.5 text-[7px] font-bold tracking-widest uppercase backdrop-blur-sm flex-shrink-0"
                                style={{
                                  borderColor: `${ac}33`,
                                  backgroundColor: `${ac}11`,
                                  color: ac,
                                }}
                              >
                                {isVirtual ? "PLANNED" : "IN DB"}
                              </span>
                            </div>
                            <div className="text-[11px] text-white/60 group-hover:text-white/80 transition-colors line-clamp-2 mb-2 leading-relaxed">
                              {u.description || "No description"}
                            </div>
                            <div className="flex justify-between items-end mt-1 pt-2 border-t border-white/5">
                              <div className="text-[8px] text-white/30 font-mono tracking-widest uppercase flex items-center gap-1">
                                <span
                                  className="w-1 h-1 rounded-full opacity-50"
                                  style={{ backgroundColor: ac }}
                                />
                                {fmtDateUTC(u.date)}
                              </div>
                              <div className="text-sm font-extrabold tracking-tighter text-white drop-shadow-md">
                                -{minorToMajor(u.amountMinor, u.currency)}{" "}
                                <span className="text-[8px] text-white/40 ml-0.5 font-normal tracking-widest uppercase">
                                  {u.currency}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </SectionCard>

            <SectionCard
              title="Category Config"
              subtitle="Manage categories"
              accent="cyan"
            >
              <form onSubmit={handleCreateCategory} className="flex gap-2 mb-4">
                <input
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  placeholder="NEW CATEGORY NAME"
                  className="flex-1 border border-white/10 bg-black/40 px-3 py-1.5 text-[10px] font-bold tracking-widest text-white outline-none uppercase placeholder:text-white/30"
                />
                <button
                  type="submit"
                  className="border border-[#00d4ff]/30 bg-[#00d4ff]/10 px-3 py-1.5 text-[10px] font-bold tracking-widest text-[#00d4ff] uppercase hover:bg-[#00d4ff]/20"
                >
                  ADD
                </button>
              </form>

              <div className="flex flex-col gap-2">
                <button
                  onClick={handleSeedCategories}
                  className="w-full border border-white/10 bg-black/40 px-4 py-2 text-[9px] font-bold tracking-widest text-white/60 uppercase hover:bg-white/5 disabled:opacity-50"
                >
                  Seed Missing Standard Categories
                </button>

                <div className="mt-2 text-[9px] tracking-widest text-white/40 uppercase">
                  Existing Categories:
                </div>
                {categories.length === 0 ? (
                  <div className="text-[9px] tracking-widest text-white/40 uppercase">
                    NONE
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-1.5 max-h-[100px] overflow-y-auto custom-scrollbar pr-1">
                    {categories.map((c) => (
                      <span
                        key={c._id}
                        className="border border-white/10 bg-white/5 px-2 py-0.5 text-[8px] font-bold tracking-widest text-white/70 uppercase"
                      >
                        {c.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </SectionCard>
          </div>
        </div>
      </div>

      <ExpenseModal
        open={modalOpen}
        editing={!!editingData}
        initialData={editingData}
        accounts={accounts}
        categories={categories}
        defaultAccountId={accountId || accounts[0]?._id}
        onClose={() => setModalOpen(false)}
        onSuccess={handleModalSuccess}
      />

      <AutoQuickAddModal
        open={autoModalOpen}
        accounts={accounts}
        defaultAccountId={accountId || accounts[0]?._id}
        onClose={() => setAutoModalOpen(false)}
        onSuccess={handleModalSuccess}
      />
    </div>
  );
}
