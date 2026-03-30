/* eslint-disable no-unused-vars */
/* eslint-disable no-redeclare */
/* eslint-disable no-undef */
/* eslint-disable no-empty */
// frontend/src/pages/User.jsx
import { useEffect, useRef, useState } from "react";
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
const main = "#4f772d";

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

  function mergeMe(patch) {
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
  }

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
        if (meData?.avatarUrl)
          meData.avatarUrl = absolutizeAvatarUrl(meData.avatarUrl);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-white/[0.06] text-white font-semibold">
                N
              </div>
              <div>
                <div className="text-lg font-semibold text-white">Nummoria</div>
                <div className="text-sm text-white/50">
                  Loading your profile…
                </div>
              </div>
            </div>

            <div className="mt-5 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
              <div className="h-full w-1/3 animate-[userload_1.2s_ease-in-out_infinite] bg-white/30" />
            </div>

            <style>{`
              @keyframes userload {
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

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6">
          <SectionCard className="overflow-visible">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="min-w-0">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-white/60">
                  <span className="h-2 w-2 rounded-full bg-[#13e243]" />
                  user control center
                </div>

                <div className="mt-4">
                  <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-white">
                    {me?.name
                      ? `${me.name.split(" ")[0]}'s Profile`
                      : "Profile"}
                  </h1>
                  <p className="mt-2 max-w-2xl text-sm md:text-base text-white/60">
                    Manage your identity, profile photo, subscription details,
                    and financial accounts from a single control panel.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={saveProfile}
                  disabled={saving}
                  className="rounded-2xl px-4 py-3 text-sm font-semibold text-white transition disabled:opacity-60"
                  style={{
                    background: "linear-gradient(135deg, #90a955, #4f772d)",
                  }}
                >
                  {saving ? "Saving…" : "Save changes"}
                </button>

                <button
                  type="button"
                  disabled={deleting}
                  onClick={() => setConfirmOpen(true)}
                  className="rounded-2xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm font-semibold text-red-200 transition hover:bg-red-400/15 disabled:opacity-60"
                >
                  {deleting ? "Deleting…" : "Delete account"}
                </button>
              </div>
            </div>
          </SectionCard>
        </div>

        {(msg || err || accErr) && (
          <div className="mb-6 space-y-3">
            {msg ? (
              <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-emerald-100">
                {msg}
              </div>
            ) : null}
            {err ? (
              <div className="rounded-2xl border border-red-400/20 bg-red-400/10 p-4 text-red-100">
                {err}
              </div>
            ) : null}
            {accErr ? (
              <div className="rounded-2xl border border-red-400/20 bg-red-400/10 p-4 text-red-100">
                {accErr}
              </div>
            ) : null}
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
          <aside className="space-y-6">
            <SectionCard
              title="Identity"
              subtitle="Your public-facing account snapshot."
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
                      className="grid h-28 w-28 place-items-center rounded-full text-3xl font-bold text-white shadow-lg"
                      style={{ backgroundColor: main }}
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
                  <div className="text-xl font-semibold text-white">
                    {me?.name || "Your name"}
                  </div>
                  <div className="mt-1 text-sm text-white/55">
                    {me?.profession || "Add your profession"}
                  </div>
                  <div className="mt-1 text-sm text-white/40">
                    {me?.email || "No email"}
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploadingAvatar}
                    className="rounded-2xl px-4 py-2.5 text-sm font-semibold text-white transition disabled:opacity-60"
                    style={{
                      background: "linear-gradient(135deg, #90a955, #4f772d)",
                    }}
                  >
                    {uploadingAvatar ? "Uploading…" : "Change photo"}
                  </button>

                  <button
                    type="button"
                    onClick={removeAvatar}
                    disabled={uploadingAvatar}
                    className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-semibold text-white/75 transition hover:bg-white/[0.07] disabled:opacity-60"
                  >
                    Remove photo
                  </button>
                </div>
              </div>
            </SectionCard>

            <SectionCard
              title="Quick stats"
              subtitle="A snapshot of your setup."
            >
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 xl:grid-cols-1">
                <MetricCard label="Accounts" value={String(accounts.length)} />
                <MetricCard label="Base Currency" value={baseCurrency || "—"} />
                <MetricCard label="Time Zone" value={tz || "—"} />
              </div>
            </SectionCard>

            <SectionCard
              title="Quick links"
              subtitle="Move around your workspace faster."
            >
              <div className="grid grid-cols-1 gap-3">
                <QuickLink href="/expenses" label="Expenses" />
                <QuickLink href="/incomes" label="Incomes" />
                <QuickLink href="/investments" label="Investments" />
                <QuickLink
                  href="/subscriptions"
                  label="Subscription & Billing"
                />
              </div>
            </SectionCard>
          </aside>

          <div className="space-y-6">
            <SectionCard
              title="Profile settings"
              subtitle="Update the personal details used across your account."
            >
              <form onSubmit={saveProfile} className="space-y-5">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Field label="Email address">
                    <input
                      className="w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-white placeholder:text-white/30 outline-none transition focus:border-white/20"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </Field>

                  <Field label="Name">
                    <input
                      className="w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-white placeholder:text-white/30 outline-none transition focus:border-white/20"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Full name"
                    />
                  </Field>

                  <Field label="Profession">
                    <input
                      className="w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-white placeholder:text-white/30 outline-none transition focus:border-white/20"
                      value={profession}
                      onChange={(e) => setProfession(e.target.value)}
                      placeholder="e.g., Software Engineer"
                    />
                  </Field>

                  <Field label="Time zone">
                    <input
                      className="w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-white placeholder:text-white/30 outline-none transition focus:border-white/20"
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
                        onChange={(e) => setSubscription(e.target.value)}
                        className="w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-white/80 outline-none"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs uppercase tracking-[0.14em] text-white/35">
                        Active
                      </span>
                    </div>
                  </Field>

                  <Field label="Base currency">
                    <select
                      className="w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-white outline-none transition focus:border-white/20"
                      value={baseCurrency}
                      onChange={(e) => setBaseCurrency(e.target.value)}
                    >
                      {CURRENCIES.map((c) => (
                        <option key={c.code} value={c.code}>
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
                    className="rounded-2xl px-4 py-3 text-sm font-semibold text-white transition disabled:opacity-60"
                    style={{
                      background: "linear-gradient(135deg, #90a955, #4f772d)",
                    }}
                  >
                    {saving ? "Saving…" : "Save profile"}
                  </button>

                  <button
                    type="button"
                    disabled={deleting}
                    onClick={() => setConfirmOpen(true)}
                    className="rounded-2xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm font-semibold text-red-200 transition hover:bg-red-400/15 disabled:opacity-60"
                  >
                    {deleting ? "Deleting…" : "Delete account"}
                  </button>
                </div>
              </form>
            </SectionCard>

            <SectionCard
              title="Accounts"
              subtitle="Manage your checking, savings, credit, cash, and other account types."
              right={
                <button
                  onClick={() => {
                    setEditingAcc(null);
                    setAccModalOpen(true);
                  }}
                  className="rounded-2xl px-4 py-2.5 text-sm font-semibold text-white transition"
                  style={{
                    background: "linear-gradient(135deg, #90a955, #4f772d)",
                  }}
                >
                  + Add account
                </button>
              }
            >
              {accounts.length === 0 ? (
                <div className="rounded-2xl border border-white/8 bg-black/20 p-10 text-center text-white/55">
                  No accounts yet. Click “Add account”.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-white/8 bg-black/20">
                  <table className="min-w-full text-sm">
                    <thead className="border-b border-white/8 text-left text-white/65">
                      <tr>
                        <th className="py-3 px-4 pr-4 whitespace-nowrap">
                          Name
                        </th>
                        <th className="py-3 px-4 pr-4 whitespace-nowrap">
                          Type
                        </th>
                        <th className="py-3 px-4 pr-4 whitespace-nowrap">
                          Currency
                        </th>
                        <th className="py-3 px-4 pr-4 whitespace-nowrap">
                          Balance
                        </th>
                        <th className="py-3 px-4 pr-4 whitespace-nowrap">
                          Institution
                        </th>
                        <th className="py-3 px-4 pr-4 whitespace-nowrap">
                          Last4
                        </th>
                        <th className="py-3 px-4 whitespace-nowrap text-right">
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
                          <td className="py-4 px-4 pr-4 font-medium text-white whitespace-nowrap">
                            {a.name}
                          </td>
                          <td className="py-4 px-4 pr-4 capitalize text-white/75 whitespace-nowrap">
                            {a.type}
                          </td>
                          <td className="py-4 px-4 pr-4 text-white/75 whitespace-nowrap">
                            {a.currency}
                          </td>
                          <td className="py-4 px-4 pr-4 text-white whitespace-nowrap">
                            {new Intl.NumberFormat(undefined, {
                              style: "currency",
                              currency: a.currency || "USD",
                            }).format((a.balance || 0) / 100)}
                          </td>
                          <td className="py-4 px-4 pr-4 text-white/60 whitespace-nowrap">
                            {a.institution || "—"}
                          </td>
                          <td className="py-4 px-4 pr-4 text-white/60 whitespace-nowrap">
                            {a.last4 || "—"}
                          </td>
                          <td className="py-4 px-4">
                            <div className="flex justify-end gap-2">
                              <button
                                className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white/75 transition hover:bg-white/[0.07]"
                                onClick={() => {
                                  setEditingAcc(a);
                                  setAccModalOpen(true);
                                }}
                              >
                                Edit
                              </button>
                              <button
                                className="rounded-xl border border-red-400/20 bg-red-400/10 px-3 py-2 text-sm text-red-200 transition hover:bg-red-400/15"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setConfirmOpen(false)}
          />
          <div className="relative z-10 w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-[#0B0F0B]/95 text-white shadow-2xl">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(600px_260px_at_15%_0%,rgba(19,226,67,0.10),transparent_55%),radial-gradient(500px_260px_at_85%_10%,rgba(153,23,70,0.12),transparent_55%)]" />
            <div className="relative p-6">
              <h3 className="text-lg font-semibold">Delete your account?</h3>
              <p className="mt-2 text-sm text-white/60">
                This is a <b>soft delete</b>. Your account will be deactivated
                and hidden. You can contact support to restore it.
              </p>
              <div className="mt-5 flex justify-end gap-3">
                <button
                  type="button"
                  className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white/75 transition hover:bg-white/[0.07]"
                  onClick={() => setConfirmOpen(false)}
                  disabled={deleting}
                >
                  No, keep it
                </button>
                <button
                  type="button"
                  className="rounded-2xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-60"
                  onClick={deleteMe}
                  disabled={deleting}
                >
                  Yes, delete
                </button>
              </div>
            </div>
          </div>
        </div>
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

function QuickLink({ href, label }) {
  return (
    <a
      href={href}
      className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-medium text-white/80 transition hover:bg-white/[0.07] hover:text-white"
    >
      {label}
    </a>
  );
}

function AccountModal({ initial, onClose, onSubmit, busy }) {
  const [name, setName] = useState(initial?.name || "");
  const [type, setType] = useState(initial?.type || "checking");
  const [currency, setCurrency] = useState(initial?.currency || "USD");
  const [balanceMajor, setBalanceMajor] = useState(
    initial ? String((initial.balance || 0) / 100) : "0",
  );
  const [institution, setInstitution] = useState(initial?.institution || "");
  const [last4, setLast4] = useState(initial?.last4 || "");

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
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-sm px-4">
      <div className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-white/10 bg-[#0B0F0B]/95 text-white shadow-2xl">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(600px_260px_at_15%_0%,rgba(19,226,67,0.10),transparent_55%),radial-gradient(500px_260px_at_85%_10%,rgba(153,23,70,0.12),transparent_55%)]" />
        <div className="relative space-y-4 p-6">
          <div>
            <div className="text-lg font-semibold tracking-tight">
              {initial ? "Edit account" : "Add account"}
            </div>
            <div className="mt-1 text-sm text-white/55">
              Keep your account structure clean for better financial tracking.
            </div>
          </div>

          <form className="space-y-4" onSubmit={submit}>
            <Field label="Account name">
              <input
                className="w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-white placeholder:text-white/30 outline-none"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Main Checking"
              />
            </Field>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Field label="Type">
                <select
                  className="w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-white outline-none"
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
                  className="w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-white outline-none"
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

            <Field label="Current balance">
              <input
                className="w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-white placeholder:text-white/30 outline-none"
                inputMode="decimal"
                value={balanceMajor}
                onChange={(e) => setBalanceMajor(e.target.value)}
                placeholder="e.g., 1250.00"
              />
            </Field>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Field label="Institution (optional)">
                <input
                  className="w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-white placeholder:text-white/30 outline-none"
                  value={institution}
                  onChange={(e) => setInstitution(e.target.value)}
                  placeholder="Your bank"
                />
              </Field>

              <Field label="Last 4 (optional)">
                <input
                  className="w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-white placeholder:text-white/30 outline-none"
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
                className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white/75 transition hover:bg-white/[0.07]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy}
                className="rounded-2xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                style={{
                  background: "linear-gradient(135deg, #90a955, #4f772d)",
                }}
              >
                {busy ? "Saving…" : initial ? "Save" : "Add"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
