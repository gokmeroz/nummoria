/* eslint-disable no-unused-vars */
/* eslint-disable no-redeclare */
/* eslint-disable no-undef */
/* eslint-disable no-empty */
// src/pages/User.jsx
import { useEffect, useRef, useState } from "react";
import api from "../lib/api";
// HERE CHANGED: import fallback avatar via bundler (reliable path in Vite)
import defaultAvatar from "../assets/avatar.jpg";

const ACCOUNT_TYPES = ["checking", "savings", "credit", "cash", "other"];
const CURRENCIES = ["USD", "EUR", "TRY", "GBP"];

export default function UserPage() {
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  // avatar upload
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileRef = useRef(null);

  // profile fields
  const [name, setName] = useState("");
  const [profession, setProfession] = useState("");
  const [baseCurrency, setBaseCurrency] = useState("");
  const [tz, setTz] = useState("");

  // accounts
  const [accounts, setAccounts] = useState([]);
  const [accErr, setAccErr] = useState("");
  const [accBusy, setAccBusy] = useState(false);
  const [accModalOpen, setAccModalOpen] = useState(false);
  const [editingAcc, setEditingAcc] = useState(null);

  const main = "#4f772d";
  const secondary = "#90a955";

  // HERE CHANGED: cache-bust with avatarVersion/updatedAt and robust fallback
  const avatarVersion = me?.avatarVersion || me?.updatedAt || 0;
  const avatarSrc = me?.avatarUrl
    ? `${me.avatarUrl}${
        me.avatarUrl.includes("?") ? "&" : "?"
      }v=${encodeURIComponent(avatarVersion)}`
    : defaultAvatar;

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setErr("");
        const [{ data: meData }, { data: accs }] = await Promise.all([
          api.get("/me"),
          api.get("/accounts"),
        ]);
        setMe(meData);
        setName(meData?.name || "");
        setProfession(meData?.profession || "");
        setBaseCurrency(meData?.baseCurrency || "USD");
        setTz(meData?.tz || "UTC");
        setAccounts(
          (Array.isArray(accs) ? accs : []).filter((a) => !a.isDeleted)
        );
      } catch (e) {
        setErr(e.response?.data?.error || "Failed to load profile");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function refreshAccounts() {
    try {
      setAccErr("");
      const { data } = await api.get("/accounts");
      setAccounts(
        (Array.isArray(data) ? data : []).filter((a) => !a.isDeleted)
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
        name,
        profession,
        baseCurrency,
        tz,
      });
      // merge so we don't drop avatar fields
      setMe((prev) => ({ ...(prev || {}), ...(data || {}) }));
      setMsg("Profile updated");
    } catch (e) {
      setErr(e.response?.data?.error || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  }

  // --- Avatar uploading (POST /me/avatar) ---
  function extractErr(e) {
    const status = e?.response?.status;
    const msg =
      e?.response?.data?.error ||
      e?.response?.data?.message ||
      e?.message ||
      "Unknown error";
    return { status, msg };
  }

  // HERE CHANGED: ensure toBlob polyfill safety & compress
  async function compressImage(file, maxW = 1024, maxH = 1024, quality = 0.85) {
    const img = document.createElement("img");
    const blobUrl = URL.createObjectURL(file);
    await new Promise((res, rej) => {
      img.onload = res;
      img.onerror = rej;
      img.src = blobUrl;
    });
    let { width, height } = img;
    const ratio = Math.min(maxW / width, maxH / height, 1);
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0, width, height);
    URL.revokeObjectURL(blobUrl);

    // Safari/older toBlob fallback
    const blob = await new Promise((res) => {
      if (canvas.toBlob) {
        canvas.toBlob(res, "image/jpeg", quality);
      } else {
        const dataUrl = canvas.toDataURL("image/jpeg", quality);
        const byteString = atob(dataUrl.split(",")[1]);
        const mimeString = dataUrl.split(",")[0].split(":")[1].split(";")[0];
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        for (let i = 0; i < byteString.length; i++)
          ia[i] = byteString.charCodeAt(i);
        res(new Blob([ab], { type: mimeString }));
      }
    });

    return new File([blob], file.name.replace(/\.\w+$/, ".jpg"), {
      type: "image/jpeg",
      lastModified: Date.now(),
    });
  }

  // HERE CHANGED: robust upload with optimistic preview + error fallback
  async function uploadAvatar(file) {
    if (!file) return;
    if (!file.type?.startsWith?.("image/")) {
      setErr("Please select an image file.");
      return;
    }

    let workFile = file;
    // compress >600KB
    if (file.size > 600 * 1024) {
      try {
        workFile = await compressImage(file);
      } catch {
        workFile = file; // fallback
      }
    }

    setUploadingAvatar(true);
    setErr("");
    setMsg("");

    // optimistic preview (object URL) — will be replaced by final URL once upload succeeds
    const previewUrl = URL.createObjectURL(workFile);
    setMe((prev) => ({
      ...(prev || {}),
      avatarUrl: previewUrl,
      avatarVersion: Date.now(),
    }));

    try {
      const fd = new FormData();
      // IMPORTANT: field name must match backend. Keep 'avatar'.
      fd.append("avatar", workFile, workFile.name || "avatar.jpg");

      const { data } = await api.post("/me/avatar", fd, {
        headers: { "Content-Type": "multipart/form-data" },
        withCredentials: true, // in case your backend uses cookies
      });

      // Expect backend to return { avatarUrl, avatarVersion? }
      setMe((prev) => ({
        ...(prev || {}),
        ...(data || {}),
        avatarVersion: data?.avatarVersion ?? Date.now(),
      }));
      setMsg("Profile photo updated");
    } catch (e) {
      const { status, msg: m } = extractErr(e);
      setErr(`Upload failed (${status || "?"}): ${m}`);

      // revert optimistic preview to previous or fallback
      setMe((prev) => ({
        ...(prev || {}),
        avatarUrl:
          prev?.avatarUrl && !prev.avatarUrl.startsWith("blob:")
            ? prev.avatarUrl
            : undefined,
        avatarVersion: Date.now(),
      }));
    } finally {
      setUploadingAvatar(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  if (loading) {
    return (
      <div className="min-h-dvh grid place-items-center">
        <div className="text-gray-600">Loading…</div>
      </div>
    );
  }

  const initials =
    (me?.name || me?.email || "U")
      .split(" ")
      .map((p) => p[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "U";

  return (
    <div className="min-h-dvh bg-gray-50">
      {/* HERO */}
      <section className="relative">
        <div
          className="h-60 md:h-72 w-full bg-cover bg-center"
          style={{
            backgroundImage:
              "linear-gradient(120deg, rgba(79,119,45,0.92), rgba(144,169,85,0.92)), url('/hero.jpg')",
          }}
        />
        <div className="absolute inset-0 flex items-end">
          <div className="mx-auto max-w-7xl w-full px-4 sm:px-6 lg:px-8">
            <div className="pb-6 md:pb-8 text-white">
              <h1 className="text-3xl md:text-4xl font-bold">
                Hello {me?.name ? me.name.split(" ")[0] : "there"}
              </h1>
              <p className="mt-1 opacity-90 max-w-2xl">
                Manage your profile and financial accounts.
              </p>
              <button
                onClick={saveProfile}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg font-semibold shadow-sm transition"
                style={{ backgroundColor: "#fff", color: main }}
              >
                Edit profile
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* CONTENT */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 -mt-12 md:-mt-16 pb-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: form + accounts */}
          <div className="lg:col-span-2 space-y-6">
            {/* Profile form */}
            <div
              className="bg-white rounded-xl shadow border"
              style={{ borderColor: secondary }}
            >
              <div className="px-5 py-4 border-b text-sm font-semibold text-gray-700 flex items-center justify-between">
                <span>My account</span>
                <span className="text-xs text-gray-500">Settings</span>
              </div>

              <form onSubmit={saveProfile} className="p-5 space-y-4">
                {msg && <div className="text-sm text-[#4f772d]">{msg}</div>}
                {err && <div className="text-sm text-red-600">{err}</div>}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Labeled label="Email address">
                    <input
                      className="w-full border rounded px-3 py-2 bg-gray-100 text-gray-600"
                      value={me?.email || ""}
                      readOnly
                    />
                  </Labeled>

                  <Labeled label="Name">
                    <input
                      className="w-full border rounded px-3 py-2 outline-none focus:ring-2 focus:ring-[#90a955]"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Full name"
                    />
                  </Labeled>

                  <Labeled label="Profession">
                    <input
                      className="w-full border rounded px-3 py-2 outline-none focus:ring-2 focus:ring-[#90a955]"
                      value={profession}
                      onChange={(e) => setProfession(e.target.value)}
                      placeholder="e.g., Software Engineer"
                    />
                  </Labeled>

                  <Labeled label="Time zone">
                    <input
                      className="w-full border rounded px-3 py-2 outline-none focus:ring-2 focus:ring-[#90a955]"
                      value={tz}
                      onChange={(e) => setTz(e.target.value)}
                      placeholder="e.g., Europe/Istanbul"
                    />
                  </Labeled>

                  <Labeled label="Base currency">
                    <select
                      className="w-full border rounded px-3 py-2 outline-none focus:ring-2 focus:ring-[#90a955]"
                      value={baseCurrency}
                      onChange={(e) => setBaseCurrency(e.target.value)}
                    >
                      {CURRENCIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </Labeled>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-5 py-2 rounded-lg text-white font-semibold transition disabled:opacity-60"
                    style={{ backgroundColor: main }}
                  >
                    {saving ? "Saving…" : "Save changes"}
                  </button>
                </div>
              </form>
            </div>

            {/* Accounts manager */}
            <div
              className="bg-white rounded-xl shadow border"
              style={{ borderColor: secondary }}
            >
              <div className="px-5 py-4 border-b flex items-center justify-between">
                <div className="font-semibold text-gray-700">
                  Financial Accounts
                </div>
                <button
                  onClick={() => {
                    setEditingAcc(null);
                    setAccModalOpen(true);
                  }}
                  className="px-3 py-1.5 rounded-lg text-white font-semibold"
                  style={{ backgroundColor: main }}
                >
                  + Add account
                </button>
              </div>

              <div className="p-5">
                {accErr && (
                  <div className="mb-3 text-sm text-red-600">{accErr}</div>
                )}

                {accounts.length === 0 ? (
                  <div className="text-gray-600">
                    No accounts yet. Click “Add account”.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="text-left text-gray-600">
                        <tr>
                          <th className="py-2 pr-4">Name</th>
                          <th className="py-2 pr-4">Type</th>
                          <th className="py-2 pr-4">Currency</th>
                          <th className="py-2 pr-4">Balance</th>
                          <th className="py-2 pr-4">Institution</th>
                          <th className="py-2 pr-4">Last4</th>
                          <th className="py-2">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {accounts.map((a) => (
                          <tr key={a._id} className="border-t">
                            <td className="py-2 pr-4 font-medium">{a.name}</td>
                            <td className="py-2 pr-4 capitalize">{a.type}</td>
                            <td className="py-2 pr-4">{a.currency}</td>
                            <td className="py-2 pr-4">
                              {new Intl.NumberFormat(undefined, {
                                style: "currency",
                                currency: a.currency || "USD",
                              }).format((a.balance || 0) / 100)}
                            </td>
                            <td className="py-2 pr-4">
                              {a.institution || "—"}
                            </td>
                            <td className="py-2 pr-4">{a.last4 || "—"}</td>
                            <td className="py-2">
                              <div className="flex gap-2">
                                <button
                                  className="px-2 py-1 rounded border"
                                  onClick={() => {
                                    setEditingAcc(a);
                                    setAccModalOpen(true);
                                  }}
                                >
                                  Edit
                                </button>
                                <button
                                  className="px-2 py-1 rounded border text-red-700 border-red-200"
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
              </div>
            </div>
          </div>

          {/* Right: Profile card with avatar edit */}
          <div>
            <div
              className="relative bg-white rounded-xl shadow border overflow-hidden"
              style={{ borderColor: secondary }}
            >
              <div
                className="h-24"
                style={{
                  background: `linear-gradient(120deg, ${main}, ${secondary})`,
                }}
              />
              <div className="px-5 pb-5">
                <div className="-mt-12 mb-3 relative inline-block">
                  {avatarSrc ? (
                    <img
                      key={String(avatarVersion)}
                      src={avatarSrc}
                      alt="Avatar"
                      className="w-24 h-24 rounded-full ring-4 ring-white object-cover shadow"
                      // HERE CHANGED: hard fallback if URL 404s/CORS breaks
                      onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = defaultAvatar;
                        // keep state clean so future uploads refresh
                        setMe((prev) => ({
                          ...(prev || {}),
                          avatarUrl: undefined,
                          avatarVersion: Date.now(),
                        }));
                      }}
                    />
                  ) : (
                    <div
                      className="w-24 h-24 rounded-full ring-4 ring-white grid place-items-center text-white text-2xl font-bold shadow"
                      style={{ backgroundColor: main }}
                    >
                      {initials}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploadingAvatar}
                    className="absolute -right-1 -bottom-1 p-2 rounded-full bg-white shadow ring-1 ring-black/10 hover:bg-gray-50 disabled:opacity-60"
                    title="Edit photo"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="w-4 h-4"
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
                {uploadingAvatar && (
                  <div className="text-xs text-gray-500 mt-1">
                    Uploading photo…
                  </div>
                )}
                {err && <div className="text-sm text-red-600 mt-1">{err}</div>}
                {msg && (
                  <div className="text-sm text-[#4f772d] mt-1">{msg}</div>
                )}

                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-gray-900">
                      {me?.name || "Your name"}
                    </div>
                    <div className="text-sm text-gray-500">
                      {me?.profession || "Add your profession"}
                    </div>
                    {uploadingAvatar && (
                      <div className="text-xs text-gray-500 mt-1">
                        Uploading photo…
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-3 gap-3 text-center">
                  <Stat label="Accounts" value={accounts.length.toString()} />
                  <Stat label="Base currency" value={baseCurrency} />
                  <Stat label="TZ" value={tz} />
                </div>
              </div>
            </div>

            <div
              className="mt-6 bg-white rounded-xl shadow border p-5"
              style={{ borderColor: secondary }}
            >
              <div className="font-semibold mb-3" style={{ color: main }}>
                Quick links
              </div>
              <div className="flex flex-col gap-2">
                <a href="/expenses" className="underline text-gray-700">
                  Expenses
                </a>
                <a href="/incomes" className="underline text-gray-700">
                  Incomes
                </a>
                <a href="/investments" className="underline text-gray-700">
                  Investments
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Account modal */}
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

  // ----- helpers: API actions -----
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
}

function Labeled({ label, children }) {
  return (
    <div>
      <label className="block text-sm mb-1 text-gray-700">{label}</label>
      {children}
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-lg border p-3 bg-white">
      <div className="text-2xl font-semibold text-gray-900">{value}</div>
      <div className="text-xs text-gray-500">{label}</div>
    </div>
  );
}

function AccountModal({ initial, onClose, onSubmit, busy }) {
  const [name, setName] = useState(initial?.name || "");
  const [type, setType] = useState(initial?.type || "checking");
  const [currency, setCurrency] = useState(initial?.currency || "USD");
  const [balanceMajor, setBalanceMajor] = useState(
    initial ? String((initial.balance || 0) / 100) : "0"
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
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40">
      <div className="w-full max-w-lg bg-white rounded-2xl p-5 space-y-4">
        <div className="text-lg font-bold">
          {initial ? "Edit account" : "Add account"}
        </div>

        <form className="space-y-3" onSubmit={submit}>
          <Labeled label="Account name">
            <input
              className="w-full border rounded px-3 py-2"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Main Checking"
            />
          </Labeled>

          <div className="grid grid-cols-2 gap-3">
            <Labeled label="Type">
              <select
                className="w-full border rounded px-3 py-2"
                value={type}
                onChange={(e) => setType(e.target.value)}
              >
                {ACCOUNT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </Labeled>
            <Labeled label="Currency">
              <select
                className="w-full border rounded px-3 py-2"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Labeled>
          </div>

          <Labeled label="Current balance">
            <input
              className="w-full border rounded px-3 py-2"
              inputMode="decimal"
              value={balanceMajor}
              onChange={(e) => setBalanceMajor(e.target.value)}
              placeholder="e.g., 1250.00"
            />
          </Labeled>

          <div className="grid grid-cols-2 gap-3">
            <Labeled label="Institution (optional)">
              <input
                className="w-full border rounded px-3 py-2"
                value={institution}
                onChange={(e) => setInstitution(e.target.value)}
                placeholder="Your bank"
              />
            </Labeled>
            <Labeled label="Last 4 (optional)">
              <input
                className="w-full border rounded px-3 py-2"
                value={last4}
                onChange={(e) => setLast4(e.target.value)}
                placeholder="1234"
                maxLength={4}
              />
            </Labeled>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="px-4 py-2 rounded-xl text-white font-semibold disabled:opacity-60"
              style={{ backgroundColor: "#4f772d" }}
            >
              {busy ? "Saving…" : initial ? "Save" : "Add"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
