/* eslint-disable react-refresh/only-export-components */
/* eslint-disable no-unused-labels */
/* eslint-disable no-undef */
/* eslint-disable no-empty */
/* eslint-disable react-hooks/rules-of-hooks */
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
import "../assets/nummoria_logo.png";
import * as d3 from "d3";

/**
 * ============================================================================
 * ARCHITECTURAL REFACTOR: INVESTMENT MODULE
 * Optimized to match Expenses.jsx / Income.jsx structure pixel-for-pixel
 * while preserving investment-specific capabilities:
 * - asset symbol / units
 * - favorites for market view
 * - investment category seeding
 * - upcoming planned investments
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

const INVESTMENT_CATEGORY_OPTIONS = [
  "Stock Market",
  "Crypto Currency Exchange",
  "Foreign Currency Exchange",
  "Gold",
  "Real Estate Investments",
  "Land Investments",
  "Other Investments",
];

/* ─────────────────────────────────────────────────────────────
   UTILITIES
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

const isStockOrCryptoCategoryName = (name) =>
  name === "Stock Market" || name === "Crypto Currency Exchange";

/* ─────────────────────────────────────────────────────────────
   CUSTOM HOOKS
───────────────────────────────────────────────────────────── */
function useInvestmentData() {
  const [data, setData] = useState({
    transactions: [],
    categories: [],
    accounts: [],
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadAll = useCallback(async ({ silent = false } = {}) => {
    try {
      if (silent) setRefreshing(true);
      else setLoading(true);

      setError("");

      const [txRes, catRes, accRes] = await Promise.all([
        api.get("/transactions", { params: { type: "investment" } }),
        api.get("/categories"),
        api.get("/accounts"),
      ]);

      setData({
        transactions: txRes.data || [],
        categories: (catRes.data || []).filter(
          (c) => c.kind === "investment" && !c.isDeleted,
        ),
        accounts: (accRes.data || []).filter((a) => !a.isDeleted),
      });
    } catch (e) {
      setError(e?.response?.data?.error || e.message || "Failed to load data");
    } finally {
      if (silent) setRefreshing(false);
      else setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  return { ...data, loading, refreshing, error, refetch: loadAll };
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
   UI PRIMITIVES
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
        : "bg-white/[0.02] border-white/10 text-white/70 hover:bg-white/[0.05] hover:text-white"
    }`}
    style={{ borderColor: selected ? `${accent}88` : undefined }}
  >
    {selected && (
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ backgroundColor: accent }}
      />
    )}
    <span className="text-xs font-bold tracking-wider uppercase">{label}</span>
  </button>
));

const Field = React.memo(({ label, children }) => (
  <div className="flex flex-col gap-1.5">
    <label className="text-xs font-bold tracking-wider text-white/80 uppercase">
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
                <h2 className="text-base font-extrabold tracking-wider text-white uppercase">
                  {title}
                </h2>
              )}
              {subtitle && (
                <p className="mt-1 text-xs text-white/80 tracking-wider uppercase">
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
  const color = { violet: VIOLET, cyan: CYAN, mint: MINT }[accent] || VIOLET;
  return (
    <div className="border border-white/10 bg-black/40 p-4 relative overflow-hidden h-full flex flex-col justify-center">
      <Brackets color={color} size="6px" thick="1px" />
      <div className="text-[10px] font-bold uppercase tracking-wider text-white/70 mb-1">
        {label}
      </div>
      <div
        className="text-lg md:text-xl font-extrabold tracking-tight truncate"
        style={{ color }}
        title={value}
      >
        {value}
      </div>
    </div>
  );
});

/* ─────────────────────────────────────────────────────────────
   CHARTS (D3 Integrated)
───────────────────────────────────────────────────────────── */
const BarChart = React.memo(({ data, currency }) => {
  const contentRef = useRef(null);
  const [tooltip, setTooltip] = useState({
    show: false,
    x: 0,
    y: 0,
    data: null,
  });

  useEffect(() => {
    if (!contentRef.current || !data || data.length === 0) return;

    const pad = 40;
    const perBar = 60;
    const height = 220;
    const width = Math.max(480, pad * 2 + data.length * perBar);

    const content = d3.select(contentRef.current);
    content.selectAll("*").remove();

    const x = d3
      .scaleBand()
      .domain(data.map((d) => d.name))
      .range([pad, width - pad])
      .padding(0.3);

    const y = d3
      .scaleLinear()
      .domain([0, d3.max(data, (d) => d.minor) || 1])
      .nice()
      .range([height - pad, pad]);

    const yAxis = content
      .append("g")
      .attr("transform", `translate(${pad},0)`)
      .call(
        d3
          .axisLeft(y)
          .ticks(5)
          .tickSize(-(width - pad * 2)),
      )
      .call((g) => g.select(".domain").remove());

    yAxis
      .selectAll("line")
      .attr("stroke", "rgba(167,139,250,0.15)")
      .attr("stroke-dasharray", "2 4");

    yAxis
      .selectAll("text")
      .attr("fill", "rgba(167,139,250,0.8)")
      .style("font-size", "11px")
      .style("font-weight", "bold")
      .style("font-family", "monospace")
      .text((d) => fmtMoney(d, currency));

    content
      .append("g")
      .attr("transform", `translate(0,${height - pad})`)
      .call(d3.axisBottom(x).tickSize(0))
      .call((g) => g.select(".domain").attr("stroke", "rgba(167,139,250,0.5)"))
      .selectAll("text")
      .attr("y", 12)
      .attr("fill", "rgba(255,255,255,0.9)")
      .style("font-size", "11px")
      .style("font-weight", "bold")
      .style("text-transform", "uppercase")
      .text((d) => (d.length > 10 ? d.slice(0, 10) + "…" : d));

    const bars = content
      .selectAll(".bar-group")
      .data(data, (d) => d.name)
      .join("g")
      .attr("class", "bar-group");

    bars
      .append("rect")
      .attr("x", (d) => x(d.name))
      .attr("y", pad)
      .attr("width", x.bandwidth())
      .attr("height", height - pad * 2)
      .attr("fill", "rgba(167,139,250,0.03)")
      .attr("rx", 2);

    bars
      .append("rect")
      .attr("x", (d) => x(d.name))
      .attr("y", (d) => y(d.minor))
      .attr("width", x.bandwidth())
      .attr("height", (d) => height - pad - y(d.minor))
      .attr("fill", "url(#investmentBarGrad)")
      .attr("rx", 2);

    bars
      .append("rect")
      .attr("x", (d) => x(d.name))
      .attr("y", pad)
      .attr("width", x.bandwidth())
      .attr("height", height - pad * 2)
      .attr("fill", "transparent")
      .style("cursor", "crosshair")
      .on("mouseenter", function (event, d) {
        d3.select(this.parentNode)
          .select("rect:nth-child(2)")
          .attr("fill", VIOLET)
          .attr("filter", "brightness(1.2)");
        setTooltip({ show: true, x: event.clientX, y: event.clientY, data: d });
      })
      .on("mousemove", (event) => {
        setTooltip((prev) => ({ ...prev, x: event.clientX, y: event.clientY }));
      })
      .on("mouseleave", function () {
        d3.select(this.parentNode)
          .select("rect:nth-child(2)")
          .attr("fill", "url(#investmentBarGrad)")
          .attr("filter", null);
        setTooltip({ show: false, x: 0, y: 0, data: null });
      });
  }, [data, currency]);

  const width = Math.max(480, 40 * 2 + (data?.length || 0) * 60);

  return (
    <div className="overflow-x-auto border border-[#a78bfa]/20 bg-[#030508] h-full flex items-center custom-scrollbar relative shadow-[inset_0_0_20px_rgba(167,139,250,0.05)]">
      {tooltip.show && tooltip.data && (
        <div
          className="fixed z-50 pointer-events-none px-3 py-2 bg-[#030508] border shadow-2xl backdrop-blur-md transform -translate-x-1/2 -translate-y-[120%]"
          style={{ left: tooltip.x, top: tooltip.y, borderColor: "#a78bfa88" }}
        >
          <div className="text-xs font-extrabold uppercase tracking-wider mb-1 text-[#a78bfa]">
            {tooltip.data.name}
          </div>
          <div className="text-sm font-mono font-bold text-white">
            {fmtMoney(tooltip.data.minor, currency)}
          </div>
        </div>
      )}

      <svg width={width} height={220} className="block min-w-full">
        <defs>
          <linearGradient id="investmentBarGrad" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="#a78bfa" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#a78bfa" stopOpacity="1" />
          </linearGradient>
          <pattern
            id="investmentGrid"
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
        </defs>
        <rect width="100%" height="100%" fill="url(#investmentGrid)" />
        <g ref={contentRef} />
      </svg>
    </div>
  );
});

const PieChart = React.memo(({ data, currency }) => {
  const [hoveredIdx, setHoveredIdx] = useState(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

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

    return { d, path, color: d.color, pct: d.minor / total };
  });

  return (
    <div className="flex flex-col lg:flex-row items-center gap-6 w-full h-full justify-center p-2">
      {hoveredIdx !== null && mappedData[hoveredIdx] && (
        <div
          className="fixed z-50 pointer-events-none px-3 py-2 bg-[#030508] border shadow-2xl backdrop-blur-md transform -translate-x-1/2 -translate-y-[120%]"
          style={{
            left: mousePos.x,
            top: mousePos.y,
            borderColor: `${mappedData[hoveredIdx].color}88`,
          }}
        >
          <div
            className="text-xs font-extrabold uppercase tracking-wider mb-1"
            style={{ color: mappedData[hoveredIdx].color }}
          >
            {mappedData[hoveredIdx].name}
          </div>
          <div className="text-sm font-mono font-bold text-white">
            {fmtMoney(mappedData[hoveredIdx].minor, currency)}
          </div>
        </div>
      )}

      <div className="relative flex-shrink-0">
        <svg width={size} height={size} className="block relative z-10">
          <circle
            cx={cx}
            cy={cy}
            r={r + 8}
            fill="none"
            stroke={VIOLET}
            strokeOpacity="0.2"
            strokeWidth="1"
            strokeDasharray="4 4"
            className="hud-spin"
          />
          {segs.map((s, i) => (
            <path
              key={i}
              d={s.path}
              fill={s.color}
              stroke={BG}
              strokeWidth="4"
              className="transition-all duration-300 hover:brightness-125 hover:scale-[1.02] origin-center cursor-crosshair"
              onMouseEnter={(e) => {
                setHoveredIdx(i);
                setMousePos({ x: e.clientX, y: e.clientY });
              }}
              onMouseMove={(e) => setMousePos({ x: e.clientX, y: e.clientY })}
              onMouseLeave={() => setHoveredIdx(null)}
              style={{
                opacity: hoveredIdx === null || hoveredIdx === i ? 1 : 0.3,
              }}
            />
          ))}
          <text
            x={cx}
            y={cy + 6}
            textAnchor="middle"
            fontSize="14"
            fill="#ffffff"
            fontWeight="900"
            className="font-mono"
          >
            {fmtMoney(total, currency)}
          </text>
        </svg>
      </div>

      <div className="w-full flex-1 space-y-2 overflow-y-auto max-h-[220px] custom-scrollbar pr-2">
        {mappedData.map((s, i) => (
          <div
            key={i}
            onMouseEnter={() => setHoveredIdx(i)}
            onMouseLeave={() => setHoveredIdx(null)}
            className={`flex items-center border px-3 py-2 transition-all relative overflow-hidden ${
              hoveredIdx === i
                ? "bg-white/[0.08] border-white/30"
                : "bg-white/[0.02] border-white/5"
            }`}
          >
            <div
              className="absolute left-0 top-0 bottom-0 w-1"
              style={{ backgroundColor: s.color }}
            />
            <div className="flex-1 grid grid-cols-[1fr_auto] items-center gap-2 pl-2">
              <div className="truncate text-[11px] font-extrabold uppercase tracking-wider text-white/90">
                {s.name}
              </div>
              <div className="font-mono text-xs font-bold text-right text-white">
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
   MODALS
───────────────────────────────────────────────────────────── */
const InvestmentModal = React.memo(
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
      assetSymbol: "",
      units: "",
      description: "",
      tagsCsv: "",
      accountId: defaultAccountId || "",
    });
    const [submitting, setSubmitting] = useState(false);

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
            assetSymbol: (initialData.assetSymbol || "").toUpperCase(),
            units:
              initialData.units === 0 || initialData.units
                ? String(initialData.units)
                : "",
            description: initialData.description || "",
            tagsCsv: (initialData.tags || []).join(", "),
            accountId: initialData.accountId || defaultAccountId || "",
          });
        } else {
          const acc = accounts.find((a) => a._id === defaultAccountId);
          setForm({
            amount: "",
            currency: acc?.currency || "USD",
            date: new Date().toISOString().slice(0, 10),
            nextDate: "",
            categoryId: categories[0]?._id || "",
            assetSymbol: "",
            units: "",
            description: "",
            tagsCsv: "",
            accountId: defaultAccountId || "",
          });
        }
        setSubmitting(false);
      }
    }, [open, initialData, accounts, categories, defaultAccountId]);

    if (!open) return null;

    const selectedCategory = categories.find((c) => c._id === form.categoryId);
    const requiresAssetMeta = isStockOrCryptoCategoryName(
      selectedCategory?.name,
    );

    const handleSubmit = async () => {
      const amountMinor = majorToMinor(form.amount, form.currency);
      if (Number.isNaN(amountMinor)) return window.alert("Invalid amount");
      if (!form.categoryId) return window.alert("Pick a category");
      if (!form.accountId) return window.alert("Pick an account");
      if (submitting) return;

      const normalizedSymbol = String(form.assetSymbol || "")
        .toUpperCase()
        .trim();
      const normalizedUnits =
        String(form.units || "").trim() === "" ? null : Number(form.units);

      if (requiresAssetMeta && !normalizedSymbol) {
        return window.alert(
          "Asset symbol is required for Stock Market and Crypto Currency Exchange.",
        );
      }

      if (
        requiresAssetMeta &&
        (!Number.isFinite(normalizedUnits) || normalizedUnits <= 0)
      ) {
        return window.alert(
          "Units must be a positive number for Stock Market and Crypto Currency Exchange.",
        );
      }

      const payload = {
        accountId: form.accountId,
        categoryId: form.categoryId,
        type: "investment",
        amountMinor,
        currency: form.currency,
        date: new Date(form.date).toISOString(),
        description: form.description || null,
        tags: form.tagsCsv
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      };

      if (normalizedSymbol) payload.assetSymbol = normalizedSymbol;
      if (Number.isFinite(normalizedUnits) && normalizedUnits > 0) {
        payload.units = normalizedUnits;
      }
      if (form.nextDate) {
        payload.nextDate = new Date(form.nextDate).toISOString();
      }

      try {
        setSubmitting(true);

        const res = editing
          ? await api.put(`/transactions/${initialData._id}`, payload)
          : await api.post("/transactions", payload);

        onClose();

        Promise.resolve(onSuccess?.(res?.data)).catch((e) => {
          console.error("[INVESTMENT MODAL] onSuccess failed", e);
        });
      } catch (e) {
        console.error("[INVESTMENT MODAL] submit failed", e);
        window.alert(e?.response?.data?.error || e.message || "Error");
      } finally {
        setSubmitting(false);
      }
    };

    return (
      <div className="fixed inset-0 z-50 grid place-items-center bg-[#030508]/90 backdrop-blur-sm px-4">
        <div className="relative w-full max-w-xl bg-[#030508] border border-[#a78bfa]/30 text-[#e2e8f0] shadow-2xl p-6 max-h-[90vh] overflow-y-auto custom-scrollbar">
          <Brackets color={VIOLET} size="14px" thick="1.5px" />
          <h2 className="text-lg font-extrabold tracking-tight uppercase text-[#a78bfa] mb-6">
            {editing ? "EDIT INVESTMENT" : "NEW INVESTMENT"}
          </h2>
          <ScanLine color={VIOLET} className="mb-6" />

          <div className="space-y-4">
            <Field label="Account">
              <select
                value={form.accountId}
                onChange={(e) => {
                  const a = accounts.find((acc) => acc._id === e.target.value);
                  setForm({
                    ...form,
                    accountId: e.target.value,
                    currency: a?.currency || form.currency,
                  });
                }}
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
              <Field label="Total Cost">
                <input
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  placeholder="0.00"
                  inputMode="decimal"
                  className="w-full border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white outline-none focus:border-[#a78bfa]/50"
                />
              </Field>
              <Field label="CCY">
                <input
                  value={form.currency}
                  readOnly
                  className="w-full border border-white/10 bg-white/[0.03] px-3 py-2 text-sm opacity-60"
                />
              </Field>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-[1fr_140px] gap-4">
              <Field label="Asset Symbol">
                <input
                  value={form.assetSymbol}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      assetSymbol: e.target.value.toUpperCase(),
                    })
                  }
                  placeholder="AAPL, BTC, ETH, VOO..."
                  className="w-full border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white outline-none focus:border-[#a78bfa]/50"
                />
              </Field>
              <Field label="Units">
                <input
                  value={form.units}
                  onChange={(e) => setForm({ ...form, units: e.target.value })}
                  placeholder="2.5"
                  inputMode="decimal"
                  className="w-full border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white outline-none focus:border-[#a78bfa]/50"
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
              <Field label="Next Date">
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
                className="w-full border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white outline-none focus:border-[#a78bfa]/50"
              />
            </Field>

            <Field label="Tags (csv)">
              <input
                value={form.tagsCsv}
                onChange={(e) => setForm({ ...form, tagsCsv: e.target.value })}
                placeholder="long-term, dividend, growth"
                className="w-full border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white placeholder:text-white/50 outline-none focus:border-[#a78bfa]/50"
              />
            </Field>

            <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
              <button
                onClick={onClose}
                disabled={submitting}
                className="px-4 py-2 text-xs font-extrabold uppercase text-white/70 hover:text-white disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="px-4 py-2 text-xs font-extrabold uppercase text-[#030508] disabled:opacity-50"
                style={{ backgroundColor: VIOLET }}
              >
                {submitting
                  ? editing
                    ? "Saving..."
                    : "Adding..."
                  : editing
                    ? "Save"
                    : "Add"}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  },
);

/* ─────────────────────────────────────────────────────────────
   FEED ROW
───────────────────────────────────────────────────────────── */
const Row = React.memo(
  ({
    item,
    categories,
    accountsById,
    onEdit,
    onDelete,
    onToggleFavorite,
    isFavorite,
  }) => {
    const catName =
      categories.find((c) => c._id === item.categoryId)?.name || "—";
    const accName = accountsById.get(item.accountId)?.name || "—";
    const isFuture = new Date(item.date) > startOfUTC(new Date());
    const symbol = (item.assetSymbol || "").toUpperCase();
    const units = item.units ?? null;
    const showFavorite = isStockOrCryptoCategoryName(catName) && symbol;

    return (
      <div className="relative border-b border-white/5 p-4 hover:bg-white/[0.01] transition-colors">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <div
                className="border px-2 py-0.5 bg-black/40 flex items-center gap-2"
                style={{ borderColor: `${VIOLET}44` }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: VIOLET }}
                />
                <span className="text-[11px] font-extrabold uppercase text-[#a78bfa]">
                  {symbol ? `${symbol} • ${catName}` : catName}
                </span>
              </div>

              {showFavorite && (
                <button
                  type="button"
                  onClick={() => onToggleFavorite(symbol)}
                  className="border border-[#facc15]/30 bg-[#facc15]/10 px-2 py-0.5 text-[10px] font-bold uppercase"
                  style={{ color: isFavorite ? "#facc15" : "#e5e7eb" }}
                >
                  {isFavorite ? "★ FAV" : "☆ FAV"}
                </button>
              )}

              {isFuture && (
                <span className="border border-[#a78bfa]/30 bg-[#a78bfa]/10 px-2 py-0.5 text-[10px] font-bold text-[#a78bfa] uppercase">
                  UPCOMING
                </span>
              )}

              {units ? (
                <span className="border border-[#00ff87]/30 bg-[#00ff87]/10 px-2 py-0.5 text-[10px] font-bold text-[#00ff87] uppercase">
                  {units} UNITS
                </span>
              ) : null}
            </div>

            <div className="inline-block border border-white/10 bg-black/40 px-2 py-0.5 mb-2 text-[10px] text-white/80 uppercase">
              {accName}
            </div>

            <div className="text-sm text-white/90 mb-1 leading-relaxed">
              {item.description || "Investment Record"}
            </div>

            <div className="text-[11px] text-white/50 tracking-wider uppercase mb-2">
              {fmtDateUTC(item.date)}
            </div>

            {item.tags?.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {item.tags.map((tag) => (
                  <span
                    key={tag}
                    className="text-[11px] font-bold text-violet-400 uppercase"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="text-left lg:text-right">
            <div className="text-xl font-extrabold text-[#a78bfa] mb-3">
              -{minorToMajor(item.amountMinor, item.currency)}{" "}
              <span className="text-xs font-bold opacity-80">
                {item.currency}
              </span>
            </div>
            <div className="flex gap-2 lg:justify-end">
              <button
                onClick={() => onEdit(item)}
                className="border border-[#00d4ff]/30 bg-[#00d4ff]/10 px-3 py-1 text-[10px] font-bold text-[#00d4ff] uppercase"
              >
                EDIT
              </button>
              <button
                onClick={() => onDelete(item)}
                className="border border-red-500/30 bg-red-500/10 px-3 py-1 text-[10px] font-bold text-red-400 uppercase"
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
export default function InvestmentsScreen({ accountId }) {
  const {
    transactions,
    categories,
    accounts,
    loading,
    refreshing,
    error,
    refetch,
  } = useInvestmentData();

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

  const [barCurrency, setBarCurrency] = useState("");
  const [distCurrency, setDistCurrency] = useState("");
  const [kpiCurrency, setKpiCurrency] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingData, setEditingData] = useState(null);
  const [newCatName, setNewCatName] = useState("");

  const FAVORITES_KEY = "nummoria:favInvestments:v1";
  const [favoriteSymbols, setFavoriteSymbols] = useState(() => {
    try {
      const raw = localStorage.getItem(FAVORITES_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return new Set(
        (Array.isArray(arr) ? arr : [])
          .map((s) =>
            String(s || "")
              .toUpperCase()
              .trim(),
          )
          .filter(Boolean),
      );
    } catch {
      return new Set();
    }
  });

  const persistFavorites = useCallback((setVal) => {
    try {
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(Array.from(setVal)));
    } catch {}
  }, []);

  const toggleFavorite = useCallback(
    (symbol) => {
      const normalized = String(symbol || "")
        .toUpperCase()
        .trim();
      if (!normalized) return;

      setFavoriteSymbols((prev) => {
        const next = new Set(prev);
        if (next.has(normalized)) next.delete(normalized);
        else next.add(normalized);
        persistFavorites(next);
        return next;
      });
    },
    [persistFavorites],
  );

  const categoriesById = useMemo(
    () => new Map(categories.map((c) => [c._id, c])),
    [categories],
  );
  const accountsById = useMemo(
    () => new Map(accounts.map((a) => [a._id, a])),
    [accounts],
  );

  const distCurrencies = useMemo(() => {
    return [
      ...new Set(
        transactions
          .filter((t) => t.type === "investment")
          .map((t) => t.currency || "USD"),
      ),
    ];
  }, [transactions]);

  const currencies = useMemo(
    () => ["ALL", ...distCurrencies],
    [distCurrencies],
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
      if (t.type !== "investment") return false;
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
          `${t.description || ""} ${cat} ${acc} ${(t.tags || []).join(" ")} ${(t.assetSymbol || "").toUpperCase()} ${t.units || ""}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }

      return true;
    });

    filtered.sort((a, b) => {
      if (sortKey === "date_asc") return new Date(a.date) - new Date(b.date);
      if (sortKey === "amount_desc")
        return (b.amountMinor || 0) - (a.amountMinor || 0);
      if (sortKey === "amount_asc")
        return (a.amountMinor || 0) - (b.amountMinor || 0);
      if (sortKey === "symbol_asc")
        return String(a.assetSymbol || "").localeCompare(
          String(b.assetSymbol || ""),
        );
      if (sortKey === "symbol_desc")
        return String(b.assetSymbol || "").localeCompare(
          String(a.assetSymbol || ""),
        );
      return new Date(b.date) - new Date(a.date);
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

  const currentBarCurrency = barCurrency || distCurrencies[0] || "USD";
  const barChartData = useMemo(() => {
    const now = new Date();
    const s = startOfMonthUTC(now),
      e = endOfMonthUTC(now);
    const m = new Map();

    rows
      .filter(
        (r) =>
          (r.currency || "USD") === currentBarCurrency &&
          new Date(r.date) >= s &&
          new Date(r.date) <= e,
      )
      .forEach((t) =>
        m.set(
          t.categoryId,
          (m.get(t.categoryId) || 0) + Number(t.amountMinor || 0),
        ),
      );

    return Array.from(m.entries())
      .map(([cid, minor]) => ({
        name: categoriesById.get(cid)?.name || "—",
        minor,
      }))
      .sort((a, b) => b.minor - a.minor);
  }, [rows, currentBarCurrency, categoriesById]);

  const currentDistCurrency = distCurrency || distCurrencies[0] || "USD";
  const distributionData = useMemo(() => {
    const m = new Map();

    rows
      .filter((r) => (r.currency || "USD") === currentDistCurrency)
      .forEach((t) =>
        m.set(
          t.categoryId,
          (m.get(t.categoryId) || 0) + Number(t.amountMinor || 0),
        ),
      );

    const total = Array.from(m.values()).reduce((a, b) => a + b, 0) || 1;

    return Array.from(m.entries())
      .map(([cid, minor]) => ({
        name: categoriesById.get(cid)?.name || "—",
        minor,
        pct: minor / total,
      }))
      .sort((a, b) => b.minor - a.minor);
  }, [rows, currentDistCurrency, categoriesById]);

  const currentKpiCurrency =
    kpiCurrency ||
    (filters.fCurrency !== "ALL"
      ? filters.fCurrency
      : distCurrencies[0] || "USD");

  const insights = useMemo(() => {
    const cur = currentKpiCurrency;
    const curRows = rows.filter((r) => (r.currency || "USD") === cur);
    const now = new Date();
    const tStart = startOfMonthUTC(now),
      tEnd = endOfMonthUTC(now);
    const lStart = startOfMonthUTC(addMonthsUTC(now, -1)),
      lEnd = endOfMonthUTC(addMonthsUTC(now, -1));
    const minorSum = (arr) =>
      arr.reduce((acc, t) => acc + Number(t.amountMinor || 0), 0);
    const monthsPassed = now.getUTCMonth() + 1;

    return {
      kpis: {
        last: minorSum(
          curRows.filter(
            (t) => new Date(t.date) >= lStart && new Date(t.date) <= lEnd,
          ),
        ),
        this: minorSum(
          curRows.filter(
            (t) => new Date(t.date) >= tStart && new Date(t.date) <= tEnd,
          ),
        ),
        yearlyAvg: monthsPassed
          ? Math.round(minorSum(curRows) / monthsPassed)
          : 0,
      },
      statsCurrency: cur,
    };
  }, [rows, currentKpiCurrency]);

  const totals = useMemo(() => {
    const m = new Map();
    rows.forEach((t) =>
      m.set(t.currency, (m.get(t.currency) || 0) + Number(t.amountMinor || 0)),
    );
    return Array.from(m.entries()).map(([cur, min]) => ({
      cur,
      major: minorToMajor(min, cur),
    }));
  }, [rows]);

  const upcoming = useMemo(() => {
    const today = startOfUTC(new Date());
    const map = new Map();

    transactions
      .filter((t) => t.type === "investment" && new Date(t.date) > today)
      .forEach((t) => map.set(t._id, { ...t, __kind: "actual" }));

    transactions
      .filter(
        (t) =>
          t.type === "investment" && t.nextDate && new Date(t.nextDate) > today,
      )
      .forEach((t) => {
        const v = {
          ...t,
          _id: `v-${t._id}`,
          date: t.nextDate,
          __kind: "virtual",
        };
        if (!map.has(v._id)) map.set(v._id, v);
      });

    return Array.from(map.values()).sort(
      (a, b) => new Date(a.date) - new Date(b.date),
    );
  }, [transactions]);

  const handleModalSuccess = useCallback(() => {
    refetch({ silent: true }).catch((e) => {
      console.error("[INVESTMENTS] refetch failed", e);
    });
  }, [refetch]);

  const handleOpenCreate = useCallback(() => {
    setEditingData(null);
    setModalOpen(true);
  }, []);

  const handleOpenEdit = useCallback((tx) => {
    setEditingData(tx);
    setModalOpen(true);
  }, []);

  const handleDelete = useCallback(
    async (tx) => {
      if (!window.confirm("Delete investment?")) return;
      try {
        await api.delete(`/transactions/${tx._id}`);
        refetch({ silent: true });
      } catch (e) {
        window.alert(e?.response?.data?.error || e.message || "Error");
      }
    },
    [refetch],
  );

  const handleCreateCategory = async (e) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    try {
      await api.post("/categories", {
        name: newCatName.trim(),
        kind: "investment",
      });
      setNewCatName("");
      refetch({ silent: true });
    } catch (err) {
      window.alert(err?.response?.data?.error || "Error creating category");
    }
  };

  const handleSeedCategories = async () => {
    try {
      if (!window.confirm("Seed all standard investment categories?")) return;

      const existingNames = new Set(categories.map((c) => c.name));

      for (const name of INVESTMENT_CATEGORY_OPTIONS) {
        if (!existingNames.has(name)) {
          await api.post("/categories", { name, kind: "investment" });
        }
      }

      refetch({ silent: true });
    } catch (e) {
      window.alert(e?.response?.data?.error || "Error seeding categories");
    }
  };

  if (loading)
    return (
      <div className="min-h-dvh grid place-items-center bg-[#030508] text-[#a78bfa] font-bold uppercase animate-pulse">
        Initializing Investment Module...
      </div>
    );

  return (
    <div className="min-h-dvh bg-[#030508] text-[#e2e8f0] font-sans p-4 md:p-6 selection:bg-[#a78bfa]/30">
      <style
        dangerouslySetInnerHTML={{
          __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 4px; height: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: rgba(255,255,255,0.02); }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(167,139,250,0.25); border-radius: 4px; }
        @keyframes spin-slow { 100% { transform: rotate(360deg); } }
        .hud-spin { animation: spin-slow 20s linear infinite; transform-origin: center; }
      `,
        }}
      />

      <div className="mx-auto max-w-screen-2xl flex flex-col gap-6">
        {/* HEADER AREA */}
        <div className="relative border border-[#a78bfa]/20 bg-[#a78bfa]/[0.03] p-6 overflow-hidden">
          <Brackets color={VIOLET} size="12px" />
          <div className="flex flex-col lg:flex-row justify-between items-end gap-6">
            <div>
              <div className="inline-flex items-center gap-2 border border-white/10 bg-black/40 px-3 py-1 mb-4">
                <span className="w-1.5 h-1.5 rounded-full bg-[#a78bfa]" />
                <span className="text-[11px] font-extrabold uppercase">
                  Investment Ledger
                </span>
              </div>
              <h1 className="text-4xl md:text-5xl font-extrabold text-white leading-none">
                Investment Control
              </h1>
              <p className="mt-3 max-w-2xl text-base text-white/80">
                Track capital allocation, investment positions, and future
                purchase plans with precision.
              </p>
              <ScanLine color={VIOLET} className="mt-6 w-full max-w-md" />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="px-4 py-2 border border-white/10 bg-black/40 text-xs font-bold uppercase"
              >
                Filters
              </button>

              <a
                href={`/investments/performance?favorites=${encodeURIComponent(
                  Array.from(favoriteSymbols).join(","),
                )}`}
                className="px-4 py-2 border border-[#00d4ff]/30 bg-black/40 text-xs font-bold uppercase text-[#00d4ff]"
              >
                View Market
              </a>

              <button
                onClick={handleOpenCreate}
                className="px-4 py-2 bg-[#00ff87] text-[#030508] text-xs font-extrabold uppercase"
              >
                + New Investment
              </button>

              {refreshing && (
                <div className="inline-flex items-center border border-white/10 bg-black/40 px-3 py-2">
                  <span className="text-xs font-bold tracking-wider text-white/60 uppercase">
                    Refreshing...
                  </span>
                </div>
              )}

              <button
                onClick={() => refetch({ silent: true })}
                className="px-3 py-2 border border-white/10 bg-black/40"
              >
                Refresh
              </button>
            </div>
          </div>

          <div className="mt-8 flex flex-col xl:flex-row gap-4">
            <div className="relative flex-1 flex items-center border border-white/10 bg-black/40 px-4 py-2">
              <span className="w-1.5 h-1.5 rounded-full mr-3 bg-[#a78bfa]" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="SEARCH SYMBOL, INVESTMENTS, ACCOUNTS, OR #TAGS"
                className="w-full bg-transparent text-xs font-bold uppercase outline-none"
              />
            </div>

            <div className="flex items-center gap-3 border border-white/10 bg-black/40 px-4 py-2">
              <span className="text-xs font-bold uppercase text-white/50">
                Sort
              </span>
              <select
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value)}
                className="bg-transparent text-xs font-bold uppercase outline-none"
              >
                <option value="date_desc">Newest</option>
                <option value="date_asc">Oldest</option>
                <option value="amount_desc">Amount ↓</option>
                <option value="amount_asc">Amount ↑</option>
                <option value="symbol_asc">Symbol A-Z</option>
                <option value="symbol_desc">Symbol Z-A</option>
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
                  className="w-full border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-bold uppercase text-white outline-none"
                >
                  <option value="ALL">All Accounts</option>
                  {accounts.map((a) => (
                    <option key={a._id} value={a._id}>
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
                  className="w-full border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-bold uppercase text-white outline-none"
                >
                  {currencies.map((c) => (
                    <option key={c} value={c}>
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
                  className="w-full border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-bold uppercase text-white outline-none"
                />
              </Field>

              <Field label="To Date">
                <input
                  type="date"
                  value={filters.fEndISO}
                  onChange={(e) =>
                    setFilters((f) => ({ ...f, fEndISO: e.target.value }))
                  }
                  className="w-full border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-bold uppercase text-white outline-none"
                />
              </Field>

              <Field label="Min Amount">
                <input
                  type="number"
                  value={filters.fMin}
                  onChange={(e) =>
                    setFilters((f) => ({ ...f, fMin: e.target.value }))
                  }
                  className="w-full border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-bold uppercase text-white outline-none"
                />
              </Field>

              <Field label="Max Amount">
                <input
                  type="number"
                  value={filters.fMax}
                  onChange={(e) =>
                    setFilters((f) => ({ ...f, fMax: e.target.value }))
                  }
                  className="w-full border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-bold uppercase text-white outline-none"
                />
              </Field>

              <div className="col-span-full flex justify-end gap-3 pt-2">
                <button
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
                  className="px-4 py-2 border border-white/10 bg-black/40 text-xs font-bold uppercase"
                >
                  Clear
                </button>
                <button
                  onClick={() => setShowFilters(false)}
                  className="px-4 py-2 bg-[#00ff87] text-black text-xs font-extrabold uppercase"
                >
                  Apply
                </button>
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {/* TOP LAYER BENTO */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
          <SectionCard
            title="KPIs"
            accent="cyan"
            className="lg:col-span-3 overflow-hidden"
            right={
              <select
                value={currentKpiCurrency}
                onChange={(e) => setKpiCurrency(e.target.value)}
                className="bg-black/40 border border-[#00d4ff]/30 text-[#00d4ff] px-2 py-0.5 text-[10px] font-bold outline-none"
              >
                {distCurrencies.map((c) => (
                  <option key={c} value={c} className="text-black">
                    {c}
                  </option>
                ))}
              </select>
            }
          >
            <div className="flex flex-col h-full justify-around gap-2">
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
            title="Capital Allocation"
            subtitle="Current Month"
            accent="violet"
            className="lg:col-span-6"
            right={
              <select
                value={currentBarCurrency}
                onChange={(e) => setBarCurrency(e.target.value)}
                className="bg-black/40 border border-violet-400/30 text-violet-400 px-2 py-0.5 text-[10px] font-bold outline-none"
              >
                {distCurrencies.map((c) => (
                  <option key={c} value={c} className="text-black">
                    {c}
                  </option>
                ))}
              </select>
            }
          >
            {barChartData.length ? (
              <BarChart data={barChartData} currency={currentBarCurrency} />
            ) : (
              <div className="h-full flex items-center justify-center text-xs uppercase opacity-50">
                No Data
              </div>
            )}
          </SectionCard>

          <SectionCard
            title="Distribution"
            accent="mint"
            className="lg:col-span-3"
            right={
              <select
                value={currentDistCurrency}
                onChange={(e) => setDistCurrency(e.target.value)}
                className="bg-black/40 border border-mint-400/30 text-mint-400 px-2 py-0.5 text-[10px] font-bold outline-none"
              >
                {distCurrencies.map((c) => (
                  <option key={c} value={c} className="text-black">
                    {c}
                  </option>
                ))}
              </select>
            }
          >
            {distributionData.length ? (
              <PieChart
                data={distributionData}
                currency={currentDistCurrency}
              />
            ) : (
              <div className="h-full flex items-center justify-center text-xs uppercase opacity-50">
                No Data
              </div>
            )}
          </SectionCard>
        </div>

        {/* BOTTOM LAYER */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          <div className="lg:col-span-8 flex flex-col gap-5">
            <div className="flex gap-2 flex-wrap">
              {totals.map((t) => (
                <div
                  key={t.cur}
                  className="border border-[#a78bfa]/30 bg-black/40 px-3 py-1 text-[11px] font-bold text-[#a78bfa] uppercase"
                >
                  Total {t.cur}: <span className="text-white">{t.major}</span>
                </div>
              ))}
            </div>

            <SectionCard
              title="Investment Feed"
              subtitle={`${rows.length} records active`}
              accent="mint"
            >
              <div className="border border-white/10 bg-black/20 max-h-[800px] overflow-y-auto custom-scrollbar">
                {rows.length ? (
                  rows.map((item) => (
                    <Row
                      key={item._id}
                      item={item}
                      categories={categories}
                      accountsById={accountsById}
                      onEdit={handleOpenEdit}
                      onDelete={handleDelete}
                      onToggleFavorite={toggleFavorite}
                      isFavorite={favoriteSymbols.has(
                        String(item.assetSymbol || "").toUpperCase(),
                      )}
                    />
                  ))
                ) : (
                  <div className="p-12 text-center opacity-50 uppercase text-xs">
                    No records found
                  </div>
                )}
              </div>
            </SectionCard>
          </div>

          <div className="lg:col-span-4 flex flex-col gap-5 lg:sticky lg:top-6">
            <SectionCard
              title={`Scheduled Flow (${upcoming.length})`}
              accent="violet"
            >
              <div className="relative pl-5 space-y-4 max-h-[400px] overflow-y-auto custom-scrollbar pr-2 py-1">
                <div className="absolute left-[7px] top-2 bottom-2 w-[1px] bg-white/10" />
                {upcoming.length ? (
                  upcoming.map((u) => {
                    const isVirtual = u.__kind === "virtual";
                    const ac = isVirtual ? CYAN : VIOLET;
                    const catName =
                      categoriesById.get(u.categoryId)?.name || "—";
                    const symbol = (u.assetSymbol || "").toUpperCase();

                    return (
                      <div key={u._id} className="relative group">
                        <div
                          className="absolute -left-[22px] top-3.5 w-2 h-2 rounded-full ring-[3px] ring-[#030508] z-10"
                          style={{
                            backgroundColor: ac,
                            boxShadow: `0 0 8px ${ac}`,
                          }}
                        />
                        <div className="relative border border-white/5 bg-gradient-to-r from-white/[0.02] to-transparent p-3 pl-4">
                          <div
                            className="absolute left-0 top-0 bottom-0 w-[2px]"
                            style={{ backgroundColor: ac }}
                          />
                          <div className="flex justify-between items-start mb-1.5 gap-2">
                            <span
                              className="text-[10px] font-extrabold uppercase"
                              style={{ color: ac }}
                            >
                              {symbol ? `${symbol} • ${catName}` : catName}
                            </span>
                            <span className="text-[9px] font-bold px-1.5 bg-white/5 text-white/70">
                              {isVirtual ? "PLANNED" : "POSTED"}
                            </span>
                          </div>
                          <div className="text-sm text-white/80 line-clamp-2">
                            {u.description || "Recurring Investment"}
                          </div>
                          <div className="mt-3 flex justify-between items-end border-t border-white/5 pt-2 gap-2">
                            <div className="text-[10px] font-mono opacity-50">
                              {fmtDateUTC(u.date)}
                              {u.units ? ` · ${u.units} units` : ""}
                            </div>
                            <div className="text-sm font-extrabold text-[#a78bfa]">
                              -{minorToMajor(u.amountMinor, u.currency)}{" "}
                              <span className="text-[10px]">{u.currency}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-xs uppercase opacity-50">
                    Nothing upcoming
                  </div>
                )}
              </div>
            </SectionCard>

            <SectionCard title="Categorization" accent="cyan">
              <form onSubmit={handleCreateCategory} className="flex gap-2 mb-4">
                <input
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  placeholder="NEW LABEL"
                  className="flex-1 border border-white/10 bg-black/40 px-3 py-1.5 text-xs font-bold outline-none uppercase"
                />
                <button className="px-3 bg-[#00d4ff] text-[#030508] text-[10px] font-extrabold uppercase">
                  Add
                </button>
              </form>

              <button
                onClick={handleSeedCategories}
                className="w-full mb-4 border border-white/10 bg-black/40 px-4 py-2 text-[11px] font-bold text-white/80 uppercase hover:bg-white/5"
              >
                Seed Standard Categories
              </button>

              <div className="flex flex-wrap gap-1.5 max-h-[120px] overflow-y-auto custom-scrollbar">
                {categories.map((c) => (
                  <span
                    key={c._id}
                    className="border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-bold uppercase"
                  >
                    {c.name}
                  </span>
                ))}
              </div>
            </SectionCard>
          </div>
        </div>
      </div>

      <InvestmentModal
        open={modalOpen}
        editing={!!editingData}
        initialData={editingData}
        accounts={accounts}
        categories={categories}
        defaultAccountId={accountId || accounts[0]?._id}
        onClose={() => setModalOpen(false)}
        onSuccess={handleModalSuccess}
      />
    </div>
  );
}