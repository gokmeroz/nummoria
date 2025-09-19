import { useEffect, useState } from "react";
import api from "../lib/api";

export default function UserPage() {
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  const main = "#4f772d";
  const secondary = "#90a955";

  // editable fields
  const [name, setName] = useState("");
  const [profession, setProfession] = useState("");
  const [baseCurrency, setBaseCurrency] = useState("");
  const [tz, setTz] = useState("");

  useEffect(() => {
    setLoading(true);
    api
      .get("/me")
      .then(({ data }) => {
        setMe(data);
        setName(data?.name || "");
        setProfession(data?.profession || "");
        setBaseCurrency(data?.baseCurrency || "USD");
        setTz(data?.tz || "UTC");
      })
      .catch((e) => setErr(e.response?.data?.error || "Failed to load /me"))
      .finally(() => setLoading(false));
  }, []);

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
      setMe(data);
      setMsg("Profile updated");
    } catch (e) {
      setErr(e.response?.data?.error || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-dvh grid place-items-center">
        <div className="text-gray-600">Loading profile…</div>
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
        {/* background image/gradient */}
        <div
          className="h-60 md:h-72 w-full bg-cover bg-center"
          style={{
            backgroundImage:
              "linear-gradient(120deg, rgba(79,119,45,0.92), rgba(144,169,85,0.92)), url('/hero.jpg')",
          }}
        />
        {/* header content */}
        <div className="absolute inset-0 flex items-end">
          <div className="mx-auto max-w-7xl w-full px-4 sm:px-6 lg:px-8">
            <div className="pb-6 md:pb-8 text-white">
              <h1 className="text-3xl md:text-4xl font-bold">
                Hello {me?.name ? me.name.split(" ")[0] : "there"}
              </h1>
              <p className="mt-1 opacity-90 max-w-2xl">
                This is your profile page. You can see your info and update your
                account settings.
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
          {/* Account form */}
          <div className="lg:col-span-2">
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
                  <div>
                    <label className="block text-sm mb-1 text-gray-700">
                      Email address
                    </label>
                    <input
                      className="w-full border rounded px-3 py-2 bg-gray-100 text-gray-600"
                      value={me?.email || ""}
                      readOnly
                    />
                  </div>
                  <div>
                    <label className="block text-sm mb-1 text-gray-700">
                      Name
                    </label>
                    <input
                      className="w-full border rounded px-3 py-2 outline-none focus:ring-2"
                      style={{ focusRing: secondary }}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Full name"
                    />
                  </div>

                  <div>
                    <label className="block text-sm mb-1 text-gray-700">
                      Profession
                    </label>
                    <input
                      className="w-full border rounded px-3 py-2 outline-none focus:ring-2 focus:ring-[#90a955]"
                      value={profession}
                      onChange={(e) => setProfession(e.target.value)}
                      placeholder="e.g., Software Engineer"
                    />
                  </div>

                  <div>
                    <label className="block text-sm mb-1 text-gray-700">
                      Time zone
                    </label>
                    <input
                      className="w-full border rounded px-3 py-2 outline-none focus:ring-2 focus:ring-[#90a955]"
                      value={tz}
                      onChange={(e) => setTz(e.target.value)}
                      placeholder="e.g., Europe/Istanbul"
                    />
                  </div>

                  <div>
                    <label className="block text-sm mb-1 text-gray-700">
                      Base currency
                    </label>
                    <select
                      className="w-full border rounded px-3 py-2 outline-none focus:ring-2 focus:ring-[#90a955]"
                      value={baseCurrency}
                      onChange={(e) => setBaseCurrency(e.target.value)}
                    >
                      {["USD", "EUR", "TRY", "GBP"].map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-5 py-2 rounded-lg text-white font-semibold transition disabled:opacity-60"
                    style={{ backgroundColor: main }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.backgroundColor = secondary)
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.backgroundColor = main)
                    }
                  >
                    {saving ? "Saving…" : "Save changes"}
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Profile card / stats */}
          <div>
            <div
              className="relative bg-white rounded-xl shadow border overflow-hidden"
              style={{ borderColor: secondary }}
            >
              {/* avatar overlaps like in the screenshot */}
              <div
                className="h-24"
                style={{
                  background: `linear-gradient(120deg, ${main}, ${secondary})`,
                }}
              />
              <div className="px-5 pb-5">
                <div className="-mt-12 mb-3">
                  <div
                    className="w-24 h-24 rounded-full ring-4 ring-white grid place-items-center text-white text-2xl font-bold shadow"
                    style={{ backgroundColor: main }}
                  >
                    {initials}
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-gray-900">
                      {me?.name || "Your name"}
                    </div>
                    <div className="text-sm text-gray-500">
                      {me?.profession || "Add your profession"}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      className="px-3 py-1 rounded-full text-sm text-white"
                      style={{ backgroundColor: secondary }}
                    >
                      Connect
                    </button>
                    <button
                      className="px-3 py-1 rounded-full text-sm border"
                      style={{ borderColor: main, color: main }}
                    >
                      Message
                    </button>
                  </div>
                </div>

                {/* quick stats (placeholders—wire to real data later) */}
                <div className="mt-5 grid grid-cols-3 gap-3 text-center">
                  <Stat label="Friends" value="22" />
                  <Stat label="Photos" value="10" />
                  <Stat label="Comments" value="89" />
                </div>
              </div>
            </div>

            {/* Secondary card: actions */}
            <div
              className="mt-6 bg-white rounded-xl shadow border p-5"
              style={{ borderColor: secondary }}
            >
              <div className="font-semibold mb-3" style={{ color: main }}>
                Quick actions
              </div>
              <div className="flex flex-col gap-2">
                <a href="/expenses" className="underline text-gray-700">
                  Go to Expenses
                </a>
                <a href="/income" className="underline text-gray-700">
                  Go to Income
                </a>
                <a href="/investments" className="underline text-gray-700">
                  Go to Investments
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>
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
