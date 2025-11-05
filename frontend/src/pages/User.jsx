/* eslint-disable no-unused-vars */
/* eslint-disable no-redeclare */
/* eslint-disable no-undef */
/* eslint-disable no-empty */
// frontend/src/pages/User.jsx
import { useEffect, useRef, useState } from "react";
import api from "../lib/api";
import { set } from "mongoose";

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
  const uploadIdRef = useRef(0); // prevent races

  // Local avatar override (preview or final URL)
  const [avatarOverride, setAvatarOverride] = useState(null); // { url, version }
  const [avatarBroken, setAvatarBroken] = useState(false); // avoid DOM remove errors

  // profile fields
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [profession, setProfession] = useState("");
  const [baseCurrency, setBaseCurrency] = useState("");
  const [subscription, setSubscription] = useState("free");
  const [tz, setTz] = useState("");

  // accounts
  const [accounts, setAccounts] = useState([]);
  const [accErr, setAccErr] = useState("");
  const [accBusy, setAccBusy] = useState(false);
  const [accModalOpen, setAccModalOpen] = useState(false);
  const [editingAcc, setEditingAcc] = useState(null);

  // delete account UI state
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const main = "#4f772d";
  const secondary = "#90a955";

  // ---------------- Version-aware merge + local override ----------------
  function mergeMe(patch) {
    setMe((prev) => {
      const next = { ...(prev || {}), ...(patch || {}) };

      // Prefer newer avatarVersion
      const prevVer = Number(prev?.avatarVersion || 0);
      const patchVer = Number(patch?.avatarVersion || 0);
      if (patchVer < prevVer) {
        next.avatarVersion = prevVer;
        if (prev?.avatarUrl) next.avatarUrl = prev.avatarUrl;
      }

      // If we have a local override and it's newer, keep it
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

  // Build avatar src from either override or server value. Never append ?v= to blob:
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

  // Reset the "broken" flag whenever the avatar URL or version changes
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
          (Array.isArray(accs) ? accs : []).filter((a) => !a.isDeleted)
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

  // ===== helpers to auto-detect the correct upload path (avoid /users/me/avatar) =====
  function absolutizeAvatarUrl(url) {
    if (!url) return url;
    // If backend accidentally sends relative, pin it to your Axios baseURL
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
    // Only try the two valid patterns your app is likely using.
    // Remove the bad `/users/me/avatar` to prevent noise.
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

  // ---------------- Avatar upload ----------------
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

    // Instant local preview & lock with override
    const previewUrl = URL.createObjectURL(file);
    const previewVer = Date.now();
    setAvatarOverride({ url: previewUrl, version: previewVer });
    mergeMe({ avatarUrl: previewUrl, avatarVersion: previewVer });

    try {
      // 🔧 AUTO-DETECT the correct path and upload
      const { res, tried } = await tryUploadEndpoints(file);

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
        // If backend doesn't send URL, refetch /me but keep override
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
            Number(previewVer || 0)
          );
          const netUrl = fresh?.avatarUrl || previewUrl;
          const final = { url: netUrl, version: ver };
          setAvatarOverride(final);
          mergeMe({ ...(fresh || {}), avatarUrl: netUrl, avatarVersion: ver });
        } catch {
          // keep preview; override ensures no revert
        }
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
        }): ${info.dataMsg || "No server message"}${triedNote}`
      );

      // Revert override to previous network avatar if any, else clear
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
      // try both common delete endpoints as well
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

  if (loading) {
    return (
      <div className="min-h-dvh grid place-items-center">
        <div className="text-gray-600">Loading…</div>
      </div>
    );
  }
  return (
    <div className="min-h-dvh bg-gray-50">
      {/* HERO */}
      <section className="relative mb-10 md:mb-16">
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

      {/* PAGE CONTENT */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 -mt-12 md:-mt-16 pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          {/* LEFT COLUMN */}
          <div className="lg:col-span-2 space-y-12">
            {/* ====== SECTION: EDIT PROFILE ====== */}
            <div>
              {/* Big section header */}
              <div className="mb-3 flex items-center gap-3">
                {/* <div className="h-8 w-2 rounded bg-emerald-600" /> */}
                {/* <h2 className="text-lg font-extrabold tracking-wide text-emerald-800">
                  EDIT PROFILE
                </h2> */}
              </div>

              {/* Card */}
              <div className="rounded-2xl bg-white shadow-md border-2 border-emerald-600 outline outline-2 outline-emerald-200/50 overflow-hidden">
                <div className="px-180 py-3 bg-emerald-50 border-b-2 border-emerald-600 flex items-center justify-between">
                  <span className="text-sm font-semibold text-emerald-800">
                    Settings
                  </span>
                </div>

                <form onSubmit={saveProfile} className="p-5 space-y-4">
                  {msg && <div className="text-sm text-emerald-700">{msg}</div>}
                  {err && <div className="text-sm text-red-600">{err}</div>}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Labeled label="Email address">
                      <input
                        className="w-full border rounded px-3 py-2 outline-none focus:ring-2 focus:ring-[#90a955]"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
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
                    <Labeled label="Subscription Plan">
                      <div className="relative">
                        <input
                          type="text"
                          readOnly
                          value={subscription}
                          onChange={(e) => setSubscription(e.target.value)}
                          className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-gray-700 font-medium cursor-default select-none focus:outline-none focus:ring-2 focus:ring-[#90a955]/40 transition-all"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                          Active
                        </span>
                      </div>
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

                  <div className="pt-2 flex items-center gap-3">
                    <button
                      type="submit"
                      disabled={saving}
                      className="px-5 py-2 rounded-lg text-white font-semibold transition disabled:opacity-60"
                      style={{ backgroundColor: main }}
                    >
                      {saving ? "Saving…" : "Save changes"}
                    </button>

                    <button
                      type="button"
                      disabled={deleting}
                      onClick={() => setConfirmOpen(true)}
                      className="px-4 py-2 rounded-lg font-semibold border border-red-600 text-red-700 hover:bg-red-50 disabled:opacity-60"
                    >
                      {deleting ? "Deleting…" : "Delete account"}
                    </button>
                  </div>

                  {confirmOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center">
                      <div
                        className="absolute inset-0 bg-black/40"
                        onClick={() => setConfirmOpen(false)}
                      />
                      <div className="relative z-10 w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
                        <h3 className="text-lg font-semibold mb-2">
                          Delete your account?
                        </h3>
                        <p className="text-sm text-gray-600 mb-5">
                          This is a <b>soft delete</b>. Your account will be
                          deactivated and hidden. You can contact support to
                          restore it.
                        </p>
                        <div className="flex justify-end gap-3">
                          <button
                            type="button"
                            className="px-4 py-2 rounded-lg border hover:bg-gray-50"
                            onClick={() => setConfirmOpen(false)}
                            disabled={deleting}
                          >
                            No, keep it
                          </button>
                          <button
                            type="button"
                            className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-60"
                            onClick={deleteMe}
                            disabled={deleting}
                          >
                            Yes, delete
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </form>
              </div>
            </div>

            {/* ====== SECTION: CONTENT ====== */}
            <div>
              {/* Big section header */}
              <div className="mb-3 flex items-center gap-3">
                {/* <div className="h-8 w-2 rounded bg-sky-600" /> */}
                {/* <h2 className="text-lg font-extrabold tracking-wide text-sky-800">
                  CONTENT
                </h2> */}
              </div>

              {/* Card */}
              <div className="rounded-2xl bg-white shadow-md border-2 border-sky-600 outline outline-2 outline-sky-200/60 overflow-hidden">
                <div className="px-5 py-3 bg-sky-50 border-b-2 border-sky-600 flex items-center justify-between">
                  <span className="text-sm font-semibold text-sky-800">
                    Accounts
                  </span>
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
                        <thead className="text-left text-gray-700 border-b">
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
                        <tbody className="divide-y divide-gray-200">
                          {accounts.map((a) => (
                            <tr key={a._id}>
                              <td className="py-2 pr-4 font-medium">
                                {a.name}
                              </td>
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
          </div>

          {/* RIGHT COLUMN */}
          <div>
            <div
              className="relative bg-white rounded-xl shadow border overflow-hidden"
              style={{ borderColor: secondary }}
            >
              <div
                className="h-24 shadow-inner"
                style={{
                  background: `linear-gradient(120deg, ${main}, ${secondary})`,
                }}
              />
              <div className="px-5 pb-5">
                <div className="-mt-12 mb-3 relative inline-block">
                  {avatarSrc && !avatarBroken ? (
                    <img
                      key={String(effectiveVersion)}
                      src={avatarSrc}
                      alt="Avatar"
                      className="w-24 h-24 rounded-full ring-4 ring-white object-cover shadow"
                      onError={() => setAvatarBroken(true)}
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
            <div
              className="mt-6 bg-white rounded-xl shadow border p-5"
              style={{ borderColor: secondary }}
            >
              <div className="font-semibold mb-3" style={{ color: main }}>
                Manage Your Subscription
              </div>
              <a href="/subscriptions" className="underline text-grey-700">
                Subscription & Billing
              </a>
            </div>
          </div>
        </div>
      </section>

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
  const [email, setEmail] = useState(initial?.email || "");
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
