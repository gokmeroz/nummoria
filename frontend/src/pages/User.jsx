/* eslint-disable no-unused-vars */
/* eslint-disable no-redeclare */
/* eslint-disable no-undef */
/* eslint-disable no-empty */
// frontend/src/pages/User.jsx

import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import api from "../lib/api";

const ACCOUNT_TYPES = ["checking", "savings", "credit", "cash", "other"];
const CURRENCIES = [
  { code: "USD", name: "US Dollar", symbol: "$" },
  { code: "EUR", name: "Euro", symbol: "€" },
  { code: "TRY", name: "Turkish Lira", symbol: "₺" },
  { code: "GBP", name: "British Pound Sterling", symbol: "£" },
  { code: "JPY", name: "Japanese Yen", symbol: "¥" },
  { code: "AUD", name: "Australian Dollar", symbol: "A$" },
  { code: "CAD", name: "Canadian Dollar", symbol: "C$" },
  { code: "CHF", name: "Swiss Franc", symbol: "CHF" },
  { code: "CNY", name: "Chinese Yuan", symbol: "¥" },
  { code: "HKD", name: "Hong Kong Dollar", symbol: "HK$" },
  { code: "NZD", name: "New Zealand Dollar", symbol: "NZ$" },
  { code: "SEK", name: "Swedish Krona", symbol: "kr" },
  { code: "NOK", name: "Norwegian Krone", symbol: "kr" },
  { code: "DKK", name: "Danish Krone", symbol: "kr" },
  { code: "PLN", name: "Polish Złoty", symbol: "zł" },
  { code: "CZK", name: "Czech Koruna", symbol: "Kč" },
  { code: "HUF", name: "Hungarian Forint", symbol: "Ft" },
  { code: "RON", name: "Romanian Leu", symbol: "lei" },
  { code: "BGN", name: "Bulgarian Lev", symbol: "лв" },
  { code: "HRK", name: "Croatian Kuna", symbol: "kn" },
  { code: "RSD", name: "Serbian Dinar", symbol: "дин." },
  { code: "RUB", name: "Russian Ruble", symbol: "₽" },
  { code: "UAH", name: "Ukrainian Hryvnia", symbol: "₴" },
  { code: "AED", name: "UAE Dirham", symbol: "د.إ" },
  { code: "SAR", name: "Saudi Riyal", symbol: "﷼" },
  { code: "QAR", name: "Qatari Riyal", symbol: "﷼" },
  { code: "KWD", name: "Kuwaiti Dinar", symbol: "د.ك" },
  { code: "BHD", name: "Bahraini Dinar", symbol: ".د.ب" },
  { code: "OMR", name: "Omani Rial", symbol: "﷼" },
  { code: "JOD", name: "Jordanian Dinar", symbol: "د.ا" },
  { code: "ILS", name: "Israeli New Shekel", symbol: "₪" },
  { code: "EGP", name: "Egyptian Pound", symbol: "E£" },
  { code: "ZAR", name: "South African Rand", symbol: "R" },
  { code: "NGN", name: "Nigerian Naira", symbol: "₦" },
  { code: "KES", name: "Kenyan Shilling", symbol: "KSh" },
  { code: "GHS", name: "Ghanaian Cedi", symbol: "₵" },
  { code: "MAD", name: "Moroccan Dirham", symbol: "د.م." },
  { code: "TND", name: "Tunisian Dinar", symbol: "د.ت" },
  { code: "INR", name: "Indian Rupee", symbol: "₹" },
  { code: "PKR", name: "Pakistani Rupee", symbol: "₨" },
  { code: "BDT", name: "Bangladeshi Taka", symbol: "৳" },
  { code: "LKR", name: "Sri Lankan Rupee", symbol: "₨" },
  { code: "NPR", name: "Nepalese Rupee", symbol: "₨" },
  { code: "KRW", name: "South Korean Won", symbol: "₩" },
  { code: "SGD", name: "Singapore Dollar", symbol: "S$" },
  { code: "MYR", name: "Malaysian Ringgit", symbol: "RM" },
  { code: "THB", name: "Thai Baht", symbol: "฿" },
  { code: "IDR", name: "Indonesian Rupiah", symbol: "Rp" },
  { code: "PHP", name: "Philippine Peso", symbol: "₱" },
  { code: "VND", name: "Vietnamese Dong", symbol: "₫" },
  { code: "TWD", name: "New Taiwan Dollar", symbol: "NT$" },
  { code: "MXN", name: "Mexican Peso", symbol: "$" },
  { code: "BRL", name: "Brazilian Real", symbol: "R$" },
  { code: "ARS", name: "Argentine Peso", symbol: "$" },
  { code: "CLP", name: "Chilean Peso", symbol: "$" },
  { code: "COP", name: "Colombian Peso", symbol: "$" },
  { code: "PEN", name: "Peruvian Sol", symbol: "S/" },
  { code: "UYU", name: "Uruguayan Peso", symbol: "$U" },
  { code: "BOB", name: "Bolivian Boliviano", symbol: "Bs." },
  { code: "CRC", name: "Costa Rican Colón", symbol: "₡" },
  { code: "DOP", name: "Dominican Peso", symbol: "RD$" },
  { code: "GTQ", name: "Guatemalan Quetzal", symbol: "Q" },
  { code: "HNL", name: "Honduran Lempira", symbol: "L" },
  { code: "JMD", name: "Jamaican Dollar", symbol: "J$" },
  { code: "ISK", name: "Icelandic Króna", symbol: "kr" },
  { code: "ALL", name: "Albanian Lek", symbol: "L" },
  { code: "MKD", name: "Macedonian Denar", symbol: "ден" },
  { code: "GEL", name: "Georgian Lari", symbol: "₾" },
  { code: "AZN", name: "Azerbaijani Manat", symbol: "₼" },
  { code: "KZT", name: "Kazakhstani Tenge", symbol: "₸" },
];

const BG = "#030508";
const MINT = "#00ff87";
const CYAN = "#00d4ff";
const VIOLET = "#a78bfa";

/* ─────────────────────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────────────────────── */
function decimalsForCurrency(code) {
  const zero = new Set(["JPY", "KRW", "CLP", "VND"]);
  const three = new Set(["BHD", "IQD", "JOD", "KWD", "OMR", "TND"]);
  if (zero.has(code)) return 0;
  if (three.has(code)) return 3;
  return 2;
}

function majorToMinor(amountStr, cur) {
  const decimals = decimalsForCurrency(cur);
  const n = Number(String(amountStr).replace(",", "."));
  if (Number.isNaN(n)) return NaN;
  return Math.round(n * Math.pow(10, decimals));
}

function minorToMajor(minor, currency = "USD") {
  const d = decimalsForCurrency(currency || "USD");
  return Number(Number(minor || 0) / Math.pow(10, d));
}

function formatMoney(minor, cur = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: cur || "USD",
    maximumFractionDigits: decimalsForCurrency(cur || "USD"),
  }).format(minorToMajor(minor, cur));
}

/* ─────────────────────────────────────────────────────────────
   HUD UI
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

function SectionCard({
  title,
  subtitle,
  right,
  children,
  className = "",
  accent = "violet",
}) {
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
}

function Field({ label, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-bold tracking-wider text-white/80 uppercase">
        {label}
      </label>
      {children}
    </div>
  );
}

function MetricCard({ label, value, accent = "cyan" }) {
  const color = { violet: VIOLET, cyan: CYAN, mint: MINT }[accent] || CYAN;
  return (
    <div className="border border-white/10 bg-black/40 p-4 relative overflow-hidden h-full flex flex-col justify-center">
      <Brackets color={color} size="6px" thick="1px" />
      <div className="text-[10px] font-bold uppercase tracking-wider text-white/70 mb-1">
        {label}
      </div>
      <div
        className="text-lg md:text-xl font-extrabold tracking-tight truncate"
        style={{ color }}
        title={String(value)}
      >
        {value}
      </div>
    </div>
  );
}

function QuickLink({ href, label, accent = "cyan" }) {
  const color = { violet: VIOLET, cyan: CYAN, mint: MINT }[accent] || CYAN;

  return (
    <a
      href={href}
      className="relative border border-white/10 bg-black/40 px-4 py-3 text-sm font-bold tracking-wider text-white/85 uppercase transition hover:bg-white/[0.05]"
      style={{ boxShadow: `inset 0 0 0 1px ${color}22` }}
    >
      <Brackets color={color} size="6px" thick="1px" />
      {label}
    </a>
  );
}

/* ─────────────────────────────────────────────────────────────
   MAIN PAGE
───────────────────────────────────────────────────────────── */
export default function UserPage() {
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileRef = useRef(null);
  const uploadIdRef = useRef(0);

  const [avatarOverride, setAvatarOverride] = useState(null);
  const [avatarBroken, setAvatarBroken] = useState(false);

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [profession, setProfession] = useState("");
  const [baseCurrency, setBaseCurrency] = useState("");
  const [subscription, setSubscription] = useState("free");
  const [tz, setTz] = useState("");

  const [accounts, setAccounts] = useState([]);
  const [accErr, setAccErr] = useState("");
  const [accBusy, setAccBusy] = useState(false);
  const [accModalOpen, setAccModalOpen] = useState(false);
  const [editingAcc, setEditingAcc] = useState(null);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const mergeMe = useCallback(
    (patch) => {
      setMe((prev) => {
        const next = { ...(prev || {}), ...(patch || {}) };

        const prevVer = Number(prev?.avatarVersion || 0);
        const patchVer = Number(patch?.avatarVersion || 0);
        if (patchVer < prevVer) {
          next.avatarVersion = prevVer;
          if (prev?.avatarUrl) next.avatarUrl = prev.avatarUrl;
        }

        if (
          avatarOverride &&
          Number(avatarOverride.version || 0) >= Number(next.avatarVersion || 0)
        ) {
          next.avatarUrl = avatarOverride.url;
          next.avatarVersion = avatarOverride.version;
        }

        return next;
      });
    },
    [avatarOverride],
  );

  const effectiveUrl = avatarOverride?.url ?? me?.avatarUrl;
  const effectiveVersion =
    avatarOverride?.version ?? me?.avatarVersion ?? me?.updatedAt ?? 0;

  const isBlob = effectiveUrl?.startsWith?.("blob:");
  const avatarSrc =
    effectiveUrl &&
    (isBlob
      ? effectiveUrl
      : `${effectiveUrl}${
          effectiveUrl.includes("?") ? "&" : "?"
        }v=${encodeURIComponent(effectiveVersion)}`);

  useEffect(() => {
    setAvatarBroken(false);
  }, [effectiveUrl, effectiveVersion]);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setErr("");

        const [{ data: meData }, { data: accs }] = await Promise.all([
          api.get("/me"),
          api.get("/accounts"),
        ]);

        if (meData?.avatarUrl) {
          meData.avatarUrl = absolutizeAvatarUrl(meData.avatarUrl);
        }

        mergeMe(meData || {});
        setEmail(meData?.email || "");
        setName(meData?.name || "");
        setProfession(meData?.profession || "");
        setSubscription(meData?.subscription || "Standard");
        setBaseCurrency(meData?.baseCurrency || "USD");
        setTz(meData?.tz || "UTC");
        setAccounts(
          (Array.isArray(accs) ? accs : []).filter((a) => !a.isDeleted),
        );
      } catch (e) {
        setErr(e.response?.data?.error || "Failed to load profile");
      } finally {
        setLoading(false);
      }
    })();
  }, [mergeMe]);

  async function refreshAccounts() {
    try {
      setAccErr("");
      const { data } = await api.get("/accounts");
      setAccounts(
        (Array.isArray(data) ? data : []).filter((a) => !a.isDeleted),
      );
    } catch (e) {
      setAccErr(e.response?.data?.error || "Failed to load accounts");
    }
  }

  async function saveProfile(e) {
    e?.preventDefault();
    setErr("");
    setMsg("");
    setSaving(true);

    try {
      const { data } = await api.put("/me", {
        email,
        name,
        profession,
        baseCurrency,
        tz,
      });
      mergeMe(data || {});
      setMsg("Profile updated");
    } catch (e) {
      setErr(e.response?.data?.error || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  }

  function extractErr(e) {
    const status = e?.response?.status;
    const msg =
      e?.response?.data?.error ||
      e?.response?.data?.message ||
      e?.message ||
      "Unknown error";
    return { status, msg };
  }

  function absolutizeAvatarUrl(url) {
    if (!url) return url;
    if (url.startsWith("/uploads")) {
      const base = api?.defaults?.baseURL?.replace(/\/+$/, "") || "";
      return `${base}${url}`;
    }
    return url;
  }

  function describeAxiosError(e) {
    const status = e?.response?.status;
    const statusText = e?.response?.statusText;
    const dataMsg =
      e?.response?.data?.error ||
      e?.response?.data?.message ||
      (typeof e?.response?.data === "string" ? e.response.data : "");
    const method = e?.config?.method?.toUpperCase?.();
    const url = e?.config?.url;
    const baseURL = e?.config?.baseURL || api?.defaults?.baseURL || "";
    return { status, statusText, dataMsg, method, url, baseURL };
  }

  async function tryUploadEndpoints(file) {
    const candidates = ["/me/avatar", "/api/me/avatar"];
    const tried = [];
    let lastErr = null;

    for (const path of candidates) {
      tried.push(path);
      try {
        const fd = new FormData();
        fd.append("avatar", file, file.name || "avatar");
        const res = await api.post(path, fd, {
          headers: { "Content-Type": "multipart/form-data" },
          withCredentials: true,
        });
        return { res, tried };
      } catch (e) {
        lastErr = e;
        const status = e?.response?.status;
        if (status !== 404 && status !== 405) {
          e._tried = tried.slice();
          throw e;
        }
      }
    }
    if (lastErr) {
      lastErr._tried = tried;
      throw lastErr;
    }
    throw new Error("All upload endpoints failed");
  }

  const MAX_BYTES = 5 * 1024 * 1024;

  async function uploadAvatar(file) {
    if (!file) return;
    if (!file.type?.startsWith?.("image/")) {
      setErr("Please select an image file.");
      fileRef.current && (fileRef.current.value = "");
      return;
    }
    if (file.size > MAX_BYTES) {
      setErr("Image is too large. Max 5MB.");
      fileRef.current && (fileRef.current.value = "");
      return;
    }

    const myUploadId = ++uploadIdRef.current;
    setUploadingAvatar(true);
    setErr("");
    setMsg("");

    const previewUrl = URL.createObjectURL(file);
    const previewVer = Date.now();
    setAvatarOverride({ url: previewUrl, version: previewVer });
    mergeMe({ avatarUrl: previewUrl, avatarVersion: previewVer });

    try {
      const { res } = await tryUploadEndpoints(file);

      if (myUploadId !== uploadIdRef.current) return;

      const data = res?.data || {};
      const serverUrl = absolutizeAvatarUrl(data?.avatarUrl);
      const serverVer = data?.avatarVersion ?? Date.now();

      if (serverUrl) {
        try {
          URL.revokeObjectURL(previewUrl);
        } catch {}
        const final = { url: serverUrl, version: serverVer };
        setAvatarOverride(final);
        mergeMe({ avatarUrl: serverUrl, avatarVersion: serverVer });
      } else {
        try {
          const { data: fresh } = await api.get("/me", {
            params: { _: Date.now() },
            withCredentials: true,
          });
          try {
            URL.revokeObjectURL(previewUrl);
          } catch {}
          const ver = Math.max(
            Number(fresh?.avatarVersion || 0),
            Number(previewVer || 0),
          );
          const netUrl = fresh?.avatarUrl || previewUrl;
          const final = { url: netUrl, version: ver };
          setAvatarOverride(final);
          mergeMe({ ...(fresh || {}), avatarUrl: netUrl, avatarVersion: ver });
        } catch {}
      }

      setMsg("Profile photo updated");
    } catch (e) {
      if (myUploadId !== uploadIdRef.current) return;
      const info = describeAxiosError(e);
      const triedNote = e?._tried?.length
        ? `; tried: ${e._tried.join(", ")}`
        : "";

      setErr(
        `Upload failed (${info.status || "?"}${
          info.statusText ? " " + info.statusText : ""
        }) at ${info.method || "POST"} ${info.url || "(unknown)"} (base ${
          info.baseURL || "n/a"
        }): ${info.dataMsg || "No server message"}${triedNote}`,
      );

      try {
        URL.revokeObjectURL(previewUrl);
      } catch {}

      const priorUrl =
        me?.avatarUrl && !String(me.avatarUrl).startsWith("blob:")
          ? me.avatarUrl
          : undefined;
      const priorVer = Number(me?.avatarVersion || 0) || Date.now() - 1;

      if (priorUrl) {
        const final = { url: priorUrl, version: priorVer };
        setAvatarOverride(final);
        mergeMe({ avatarUrl: priorUrl, avatarVersion: priorVer });
      } else {
        setAvatarOverride(null);
        mergeMe({ avatarUrl: undefined, avatarVersion: Date.now() });
      }
    } finally {
      setUploadingAvatar(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function removeAvatar() {
    try {
      setErr("");
      setMsg("");
      setUploadingAvatar(true);

      try {
        await api.delete("/me/avatar", { withCredentials: true });
      } catch (e) {
        if (e?.response?.status === 404) {
          await api.delete("/api/me/avatar", { withCredentials: true });
        } else {
          throw e;
        }
      }

      setAvatarOverride({ url: undefined, version: Date.now() });
      mergeMe({ avatarUrl: undefined, avatarVersion: Date.now() });
      setMsg("Profile photo removed");
    } catch (e) {
      const { status, msg: m } = extractErr(e);
      setErr(`Remove failed (${status || "?"}): ${m}`);
    } finally {
      setUploadingAvatar(false);
    }
  }

  const initials =
    (me?.name || me?.email || "U")
      .split(" ")
      .map((p) => p[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "U";

  async function deleteMe() {
    try {
      setErr("");
      setMsg("");
      setDeleting(true);
      await api.delete("/me");
      localStorage.removeItem("token");
      window.location.href = "/goodbye";
    } catch (e) {
      setErr(e?.response?.data?.error || "Failed to delete account");
      setConfirmOpen(false);
    } finally {
      setDeleting(false);
    }
  }

  async function saveAccount(payload) {
    try {
      setAccBusy(true);
      setAccErr("");

      if (payload._id) {
        const { _id, ...rest } = payload;
        await api.put(`/accounts/${_id}`, rest);
      } else {
        await api.post("/accounts", payload);
      }

      setAccModalOpen(false);
      await refreshAccounts();
    } catch (e) {
      setAccErr(e.response?.data?.error || "Failed to save account");
    } finally {
      setAccBusy(false);
    }
  }

  async function deleteAccount(a) {
    if (!window.confirm(`Delete account "${a.name}"?`)) return;
    try {
      setAccBusy(true);
      await api.delete(`/accounts/${a._id}`);
      await refreshAccounts();
    } catch (e) {
      setAccErr(e.response?.data?.error || "Delete failed");
    } finally {
      setAccBusy(false);
    }
  }

  const totalBalanceMinor = useMemo(() => {
    return accounts
      .filter((a) => a.currency === baseCurrency)
      .reduce((sum, a) => sum + Number(a.balance || 0), 0);
  }, [accounts, baseCurrency]);

  if (loading) {
    return (
      <div className="min-h-dvh grid place-items-center bg-[#030508] px-4">
        <div className="flex flex-col items-center">
          <Brackets color={VIOLET} size="20px" thick="2px" />
          <div className="w-16 h-16 border border-[#a78bfa]/30 flex items-center justify-center mb-4 bg-[#a78bfa]/10">
            <div className="w-8 h-8 rounded-full border-t-2 border-[#a78bfa] animate-spin" />
          </div>
          <div className="text-[11px] font-extrabold tracking-[0.3em] text-white/90 uppercase">
            Loading Profile...
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
            .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 4px; }
            .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.4); }
          `,
        }}
      />

      <div className="mx-auto max-w-screen-2xl w-full px-4 sm:px-6 lg:px-8 py-6 flex flex-col gap-5">
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
                <span className="text-[11px] font-extrabold tracking-wider text-white/80 uppercase">
                  User Control Center
                </span>
              </div>

              <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-white leading-none">
                {me?.name ? `${me.name.split(" ")[0]}'s Profile` : "Profile"}
              </h1>

              <p className="mt-3 max-w-2xl text-base text-white/80 leading-relaxed">
                Manage identity, profile photo, subscription details, and
                financial accounts from a single command center.
              </p>

              <ScanLine color={VIOLET} className="mt-6 w-full max-w-md" />
            </div>

            <div className="flex flex-wrap items-center gap-3 lg:justify-end">
              <button
                onClick={saveProfile}
                disabled={saving}
                className="inline-flex items-center px-4 py-2 hover:opacity-80 transition-opacity disabled:opacity-60"
                style={{ backgroundColor: MINT }}
              >
                <span className="text-xs font-extrabold tracking-wider text-[#030508] uppercase">
                  {saving ? "Saving..." : "Save Changes"}
                </span>
              </button>

              <button
                type="button"
                disabled={deleting}
                onClick={() => setConfirmOpen(true)}
                className="inline-flex items-center border border-red-400/30 bg-red-400/10 px-4 py-2 hover:bg-red-400/15 transition-colors disabled:opacity-60"
              >
                <span className="text-xs font-bold tracking-wider text-red-200 uppercase">
                  {deleting ? "Deleting..." : "Delete Account"}
                </span>
              </button>
            </div>
          </div>
        </div>

        {(msg || err || accErr) && (
          <div className="space-y-3">
            {msg ? (
              <div className="flex gap-3 border border-emerald-400/30 bg-emerald-400/10 p-4">
                <div className="font-bold text-emerald-300">[+]</div>
                <div className="text-sm text-emerald-100">{msg}</div>
              </div>
            ) : null}
            {err ? (
              <div className="flex gap-3 border border-red-400/30 bg-red-400/10 p-4">
                <div className="font-bold text-red-300">[!]</div>
                <div className="text-sm text-red-100">{err}</div>
              </div>
            ) : null}
            {accErr ? (
              <div className="flex gap-3 border border-red-400/30 bg-red-400/10 p-4">
                <div className="font-bold text-red-300">[!]</div>
                <div className="text-sm text-red-100">{accErr}</div>
              </div>
            ) : null}
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-[380px_minmax(0,1fr)] gap-5 items-start">
          <aside className="space-y-5">
            <SectionCard
              title="Identity"
              subtitle="Your public-facing account snapshot"
              accent="cyan"
            >
              <div className="flex flex-col items-start">
                <div className="relative">
                  {avatarSrc && !avatarBroken ? (
                    <img
                      key={String(effectiveVersion)}
                      src={avatarSrc}
                      alt="Avatar"
                      className="h-28 w-28 rounded-full border border-white/10 object-cover shadow-lg"
                      onError={() => setAvatarBroken(true)}
                    />
                  ) : (
                    <div
                      className="grid h-28 w-28 place-items-center rounded-full text-3xl font-bold text-white shadow-lg border border-white/10"
                      style={{ backgroundColor: "#102018" }}
                    >
                      {initials}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploadingAvatar}
                    className="absolute -right-1 -bottom-1 grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white text-black shadow-lg transition hover:bg-gray-100 disabled:opacity-60"
                    title="Edit photo"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-4 w-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3l2-3h8l2 3h3a2 2 0 0 1 2 2z" />
                      <circle cx="12" cy="13" r="4" />
                    </svg>
                  </button>

                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => uploadAvatar(e.target.files?.[0])}
                  />
                </div>

                <div className="mt-4">
                  <div className="text-xl font-extrabold tracking-tight text-white">
                    {me?.name || "Your name"}
                  </div>
                  <div className="mt-1 text-sm text-white/60">
                    {me?.profession || "Add your profession"}
                  </div>
                  <div className="mt-1 text-sm text-white/45">
                    {me?.email || "No email"}
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploadingAvatar}
                    className="px-4 py-2 text-xs font-extrabold tracking-wider text-[#030508] uppercase transition-opacity disabled:opacity-60"
                    style={{ backgroundColor: CYAN }}
                  >
                    {uploadingAvatar ? "Uploading..." : "Change Photo"}
                  </button>

                  <button
                    type="button"
                    onClick={removeAvatar}
                    disabled={uploadingAvatar}
                    className="border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-bold tracking-wider text-white/85 uppercase hover:bg-white/[0.08] disabled:opacity-60"
                  >
                    Remove Photo
                  </button>
                </div>
              </div>
            </SectionCard>

            <SectionCard
              title="Quick Stats"
              subtitle="A snapshot of your setup"
              accent="mint"
            >
              <div className="grid grid-cols-1 gap-3">
                <MetricCard
                  label="Accounts"
                  value={String(accounts.length)}
                  accent="cyan"
                />
                <MetricCard
                  label="Base Currency"
                  value={baseCurrency || "—"}
                  accent="violet"
                />
                <MetricCard label="Time Zone" value={tz || "—"} accent="mint" />
                <MetricCard
                  label={`Balance (${baseCurrency || "USD"} only)`}
                  value={formatMoney(totalBalanceMinor, baseCurrency || "USD")}
                  accent="cyan"
                />
              </div>
            </SectionCard>

            <SectionCard
              title="Quick Links"
              subtitle="Move around your workspace faster"
              accent="violet"
            >
              <div className="grid grid-cols-1 gap-3">
                <QuickLink href="/expenses" label="Expenses" accent="violet" />
                <QuickLink href="/incomes" label="Incomes" accent="cyan" />
                <QuickLink
                  href="/investments"
                  label="Investments"
                  accent="mint"
                />
                <QuickLink
                  href="/subscriptions"
                  label="Subscription & Billing"
                  accent="violet"
                />
              </div>
            </SectionCard>
          </aside>

          <div className="space-y-5">
            <SectionCard
              title="Profile Settings"
              subtitle="Update the personal details used across your account"
              accent="mint"
            >
              <form onSubmit={saveProfile} className="space-y-5">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Field label="Email Address">
                    <input
                      className="w-full border border-white/10 bg-white/[0.03] px-4 py-3 text-white placeholder:text-white/30 outline-none transition focus:border-white/20"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </Field>

                  <Field label="Name">
                    <input
                      className="w-full border border-white/10 bg-white/[0.03] px-4 py-3 text-white placeholder:text-white/30 outline-none transition focus:border-white/20"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Full name"
                    />
                  </Field>

                  <Field label="Profession">
                    <input
                      className="w-full border border-white/10 bg-white/[0.03] px-4 py-3 text-white placeholder:text-white/30 outline-none transition focus:border-white/20"
                      value={profession}
                      onChange={(e) => setProfession(e.target.value)}
                      placeholder="e.g., Software Engineer"
                    />
                  </Field>

                  <Field label="Time Zone">
                    <input
                      className="w-full border border-white/10 bg-white/[0.03] px-4 py-3 text-white placeholder:text-white/30 outline-none transition focus:border-white/20"
                      value={tz}
                      onChange={(e) => setTz(e.target.value)}
                      placeholder="e.g., Europe/Istanbul"
                    />
                  </Field>

                  <Field label="Subscription Plan">
                    <div className="relative">
                      <input
                        type="text"
                        readOnly
                        value={subscription}
                        className="w-full border border-white/10 bg-white/[0.03] px-4 py-3 text-white/80 outline-none"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] uppercase tracking-[0.14em] text-white/35">
                        Active
                      </span>
                    </div>
                  </Field>

                  <Field label="Base Currency">
                    <select
                      className="w-full border border-white/10 bg-white/[0.03] px-4 py-3 text-white outline-none transition focus:border-white/20"
                      value={baseCurrency}
                      onChange={(e) => setBaseCurrency(e.target.value)}
                    >
                      {CURRENCIES.map((c) => (
                        <option
                          key={c.code}
                          value={c.code}
                          className="text-black"
                        >
                          {c.code} — {c.name} ({c.symbol})
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-4 py-2 text-xs font-extrabold tracking-wider text-[#030508] uppercase transition-opacity disabled:opacity-60"
                    style={{ backgroundColor: MINT }}
                  >
                    {saving ? "Saving..." : "Save Profile"}
                  </button>

                  <button
                    type="button"
                    disabled={deleting}
                    onClick={() => setConfirmOpen(true)}
                    className="border border-red-400/30 bg-red-400/10 px-4 py-2 text-xs font-bold tracking-wider text-red-200 uppercase hover:bg-red-400/15 disabled:opacity-60"
                  >
                    {deleting ? "Deleting..." : "Delete Account"}
                  </button>
                </div>
              </form>
            </SectionCard>

            <SectionCard
              title="Accounts"
              subtitle="Manage checking, savings, credit, cash, and other account types"
              accent="cyan"
              right={
                <button
                  onClick={() => {
                    setEditingAcc(null);
                    setAccModalOpen(true);
                  }}
                  className="px-4 py-2 text-xs font-extrabold tracking-wider text-[#030508] uppercase transition-opacity"
                  style={{ backgroundColor: CYAN }}
                >
                  + Add Account
                </button>
              }
            >
              {accounts.length === 0 ? (
                <div className="py-12 text-center text-xs tracking-wider text-white/70 uppercase">
                  No accounts yet. Click “Add account”.
                </div>
              ) : (
                <div className="overflow-x-auto border border-white/10 bg-black/20 custom-scrollbar">
                  <table className="min-w-full text-sm">
                    <thead className="border-b border-white/8 text-left text-white/65 bg-white/[0.03]">
                      <tr>
                        <th className="py-3 px-4 whitespace-nowrap text-[11px] font-bold tracking-wider uppercase">
                          Name
                        </th>
                        <th className="py-3 px-4 whitespace-nowrap text-[11px] font-bold tracking-wider uppercase">
                          Type
                        </th>
                        <th className="py-3 px-4 whitespace-nowrap text-[11px] font-bold tracking-wider uppercase">
                          Currency
                        </th>
                        <th className="py-3 px-4 whitespace-nowrap text-[11px] font-bold tracking-wider uppercase">
                          Balance
                        </th>
                        <th className="py-3 px-4 whitespace-nowrap text-[11px] font-bold tracking-wider uppercase">
                          Institution
                        </th>
                        <th className="py-3 px-4 whitespace-nowrap text-[11px] font-bold tracking-wider uppercase">
                          Last4
                        </th>
                        <th className="py-3 px-4 whitespace-nowrap text-right text-[11px] font-bold tracking-wider uppercase">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/8">
                      {accounts.map((a) => (
                        <tr
                          key={a._id}
                          className="hover:bg-white/[0.03] transition"
                        >
                          <td className="py-4 px-4 font-medium text-white whitespace-nowrap">
                            {a.name}
                          </td>
                          <td className="py-4 px-4 capitalize text-white/75 whitespace-nowrap">
                            {a.type}
                          </td>
                          <td className="py-4 px-4 text-white/75 whitespace-nowrap">
                            {a.currency}
                          </td>
                          <td className="py-4 px-4 text-white whitespace-nowrap font-mono">
                            {formatMoney(a.balance || 0, a.currency || "USD")}
                          </td>
                          <td className="py-4 px-4 text-white/60 whitespace-nowrap">
                            {a.institution || "—"}
                          </td>
                          <td className="py-4 px-4 text-white/60 whitespace-nowrap">
                            {a.last4 || "—"}
                          </td>
                          <td className="py-4 px-4">
                            <div className="flex justify-end gap-2">
                              <button
                                className="border border-white/10 bg-white/[0.04] px-3 py-2 text-[11px] font-bold tracking-wider text-white/75 uppercase transition hover:bg-white/[0.07]"
                                onClick={() => {
                                  setEditingAcc(a);
                                  setAccModalOpen(true);
                                }}
                              >
                                Edit
                              </button>
                              <button
                                className="border border-red-400/20 bg-red-400/10 px-3 py-2 text-[11px] font-bold tracking-wider text-red-200 uppercase transition hover:bg-red-400/15"
                                onClick={() => deleteAccount(a)}
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </SectionCard>
          </div>
        </div>
      </div>

      {confirmOpen && (
        <DeleteConfirmModal
          deleting={deleting}
          onClose={() => setConfirmOpen(false)}
          onConfirm={deleteMe}
        />
      )}

      {accModalOpen && (
        <AccountModal
          initial={editingAcc}
          onClose={() => setAccModalOpen(false)}
          onSubmit={saveAccount}
          busy={accBusy}
        />
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   DELETE MODAL
───────────────────────────────────────────────────────────── */
function DeleteConfirmModal({ deleting, onClose, onConfirm }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div
        className="absolute inset-0 bg-[#030508]/80 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-md bg-[#030508] border border-red-400/30 text-white shadow-2xl p-6">
        <Brackets color="#f87171" size="12px" thick="1.5px" />
        <div className="mb-5">
          <div className="text-lg font-extrabold tracking-tight uppercase text-red-200">
            Delete Your Account?
          </div>
          <ScanLine color="#f87171" className="mt-3" />
        </div>

        <p className="text-sm text-white/70 leading-relaxed">
          This is a soft delete. Your account will be deactivated and hidden.
          You can contact support later to restore it.
        </p>

        <div className="mt-5 flex justify-end gap-3">
          <button
            type="button"
            className="border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-bold tracking-wider text-white/85 uppercase hover:bg-white/[0.08]"
            onClick={onClose}
            disabled={deleting}
          >
            No, Keep It
          </button>
          <button
            type="button"
            className="px-4 py-2 text-xs font-extrabold tracking-wider text-white uppercase bg-red-600 hover:bg-red-500 disabled:opacity-60"
            onClick={onConfirm}
            disabled={deleting}
          >
            {deleting ? "Deleting..." : "Yes, Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   ACCOUNT MODAL
───────────────────────────────────────────────────────────── */
function AccountModal({ initial, onClose, onSubmit, busy }) {
  const [name, setName] = useState(initial?.name || "");
  const [type, setType] = useState(initial?.type || "checking");
  const [currency, setCurrency] = useState(initial?.currency || "USD");
  const [balanceMajor, setBalanceMajor] = useState(
    initial
      ? String(minorToMajor(initial.balance || 0, initial.currency || "USD"))
      : "0",
  );
  const [institution, setInstitution] = useState(initial?.institution || "");
  const [last4, setLast4] = useState(initial?.last4 || "");

  const submit = (e) => {
    e?.preventDefault();
    const balance = majorToMinor(balanceMajor || "0", currency);

    if (Number.isNaN(balance)) return window.alert("Invalid balance amount");
    if (!name.trim()) return window.alert("Name is required");

    onSubmit({
      ...(initial?._id ? { _id: initial._id } : {}),
      name: name.trim(),
      type,
      currency,
      balance,
      institution: institution.trim() || undefined,
      last4: last4.trim() || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#030508]/80 backdrop-blur-sm px-4">
      <div className="relative w-full max-w-lg bg-[#030508] border border-[#00d4ff]/30 text-white shadow-2xl p-6">
        <Brackets color={CYAN} size="12px" thick="1.5px" />
        <div className="mb-5">
          <div className="text-lg font-extrabold tracking-tight uppercase text-[#00d4ff]">
            {initial ? "Edit Account" : "Add Account"}
          </div>
          <div className="mt-1 text-xs text-white/70 tracking-wider uppercase">
            Keep your account structure clean for better financial tracking
          </div>
          <ScanLine color={CYAN} className="mt-3" />
        </div>

        <form className="space-y-4" onSubmit={submit}>
          <Field label="Account Name">
            <input
              className="w-full border border-white/10 bg-white/[0.03] px-4 py-3 text-white placeholder:text-white/30 outline-none"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Main Checking"
            />
          </Field>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Field label="Type">
              <select
                className="w-full border border-white/10 bg-white/[0.03] px-4 py-3 text-white outline-none"
                value={type}
                onChange={(e) => setType(e.target.value)}
              >
                {ACCOUNT_TYPES.map((t) => (
                  <option key={t} value={t} className="text-black">
                    {t}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Currency">
              <select
                className="w-full border border-white/10 bg-white/[0.03] px-4 py-3 text-white outline-none"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
              >
                {CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code} className="text-black">
                    {c.code} — {c.name} ({c.symbol})
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Current Balance">
            <input
              className="w-full border border-white/10 bg-white/[0.03] px-4 py-3 text-white placeholder:text-white/30 outline-none"
              inputMode="decimal"
              value={balanceMajor}
              onChange={(e) => setBalanceMajor(e.target.value)}
              placeholder="e.g., 1250.00"
            />
          </Field>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Field label="Institution (Optional)">
              <input
                className="w-full border border-white/10 bg-white/[0.03] px-4 py-3 text-white placeholder:text-white/30 outline-none"
                value={institution}
                onChange={(e) => setInstitution(e.target.value)}
                placeholder="Your bank"
              />
            </Field>

            <Field label="Last 4 (Optional)">
              <input
                className="w-full border border-white/10 bg-white/[0.03] px-4 py-3 text-white placeholder:text-white/30 outline-none"
                value={last4}
                onChange={(e) => setLast4(e.target.value)}
                placeholder="1234"
                maxLength={4}
              />
            </Field>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-bold tracking-wider text-white/85 uppercase hover:bg-white/[0.08]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="px-4 py-2 text-xs font-extrabold tracking-wider text-[#030508] uppercase disabled:opacity-60"
              style={{ backgroundColor: CYAN }}
            >
              {busy ? "Saving..." : initial ? "Save" : "Add"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
