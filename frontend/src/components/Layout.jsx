/* eslint-disable no-unused-vars */
// frontend/src/components/Layout.jsx
import { useEffect, useState } from "react";
import api from "../lib/api";

import { Link, Outlet } from "react-router-dom";
import Footer from "./Footer";
import logo from "../assets/nummoria_logo.png";

export default function Layout({ onLogout }) {
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const main = "#4f772d";
  const secondary = "#90a955";

  useEffect(() => {
    async function fetchMe() {
      try {
        const { data } = await api.get("/me"); // backend route
        setMe(data);
      } catch (e) {
        setErr(e.response?.data?.error || "Failed to fetch user");
      } finally {
        setLoading(false);
      }
    }
    fetchMe();
  }, []);

  const initials =
    (me?.name || me?.email || "U")
      .split(" ")
      .map((p) => p[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "U";

  if (loading) {
    return (
      <div className="min-h-dvh bg-[#070A07] text-white grid place-items-center">
        <div className="relative w-full max-w-sm px-4">
          <div className="pointer-events-none absolute -inset-10 opacity-40">
            <div className="absolute left-4 top-6 h-40 w-40 rounded-full blur-3xl bg-[#13e243]/20" />
            <div className="absolute right-6 top-10 h-40 w-40 rounded-full blur-3xl bg-[#991746]/20" />
          </div>

          <div className="relative rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-md p-5">
            <div className="flex items-center gap-3">
              <span className="relative inline-block w-5 h-5">
                <span className="absolute inset-0 rounded-full border-2 border-white/15" />
                <span className="absolute inset-0 rounded-full border-2 border-transparent border-t-white/80 animate-spin" />
              </span>
              <div>
                <div className="text-sm font-medium text-white">
                  Loading workspace…
                </div>
                <div className="mt-1 text-xs text-white/60">
                  Preparing your dashboard shell.
                </div>
              </div>
            </div>

            <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
              <div className="h-full w-1/3 animate-[layoutbar_1.2s_ease-in-out_infinite] bg-white/30" />
            </div>

            <style>{`
              @keyframes layoutbar {
                0% { transform: translateX(-120%); }
                100% { transform: translateX(320%); }
              }
            `}</style>
          </div>
        </div>
      </div>
    );
  }

  if (err) {
    return (
      <div className="min-h-dvh bg-[#070A07] text-white grid place-items-center px-4">
        <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-md p-5 md:p-6">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 h-10 w-10 rounded-xl border border-[#991746]/30 bg-[#991746]/15 grid place-items-center text-white">
              !
            </div>
            <div>
              <div className="text-sm font-medium text-white">
                Failed to load user
              </div>
              <div className="mt-1 text-sm text-white/65">{err}</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh flex flex-col bg-[#070A07] text-white">
      {/* GLOBAL BACKGROUND */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[#070A07]" />
        <div className="absolute inset-0 bg-[radial-gradient(1200px_800px_at_15%_0%,rgba(19,226,67,0.10),transparent_55%),radial-gradient(1000px_700px_at_85%_10%,rgba(153,23,70,0.10),transparent_55%),radial-gradient(900px_600px_at_50%_100%,rgba(255,255,255,0.04),transparent_60%)]" />
        <div className="absolute inset-0 opacity-[0.10] mix-blend-overlay bg-[linear-gradient(to_right,rgba(255,255,255,0.10)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.10)_1px,transparent_1px)] bg-[size:56px_56px]" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/35 to-black/70" />
      </div>

      {/* NAVBAR */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#070A07]/70 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* Logo + Brand */}
          <Link
            to="/dashboard"
            className="group flex items-center gap-3 min-w-0 select-none"
          >
            {/* Logo */}
            <div className="relative shrink-0">
              {/* glow */}
              <div className="absolute -inset-4 blur-2xl opacity-50 bg-[radial-gradient(circle,rgba(19,226,67,0.45),transparent_70%)] transition group-hover:opacity-80" />

              <img
                src={logo}
                alt="Nummoria Logo"
                className="relative h-10 w-10 object-contain transition duration-300 group-hover:scale-105"
              />
            </div>

            {/* Brand */}
            <div className="leading-tight">
              <span className="block text-[18px] font-semibold tracking-tight text-white">
                Nummoria
              </span>

              <span className="block text-[10px] uppercase tracking-[0.18em] text-white/40">
                Financial Intelligence
              </span>
            </div>
          </Link>

          {/* Links */}
          <nav className="hidden md:flex items-center gap-2 text-sm">
            <NavLink to="/ai/financial-helper">Financial Helper</NavLink>
            <NavLink to="/expenses">Expenses</NavLink>
            <NavLink to="/incomes">Income</NavLink>
            <NavLink to="/investments">Investments</NavLink>
            <NavLink to="/reports">Reports</NavLink>
            <NavLink to="/support">Support</NavLink>
          </nav>

          {/* Right side */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={onLogout}
              className="hidden sm:inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2 text-sm text-white/80 backdrop-blur-md transition hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.07] hover:text-white"
            >
              Logout
            </button>

            <Link
              to="/user"
              className="group flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-2.5 py-1.5 backdrop-blur-md transition hover:border-white/20 hover:bg-white/[0.06]"
            >
              <div className="relative w-9 h-9 rounded-full overflow-hidden shrink-0">
                <div className="absolute inset-0 rounded-full ring-1 ring-white/10" />
                {me?.avatarUrl ? (
                  <img
                    src={me.avatarUrl}
                    alt="User Avatar"
                    className="h-9 w-9 object-cover"
                  />
                ) : (
                  <div
                    className="w-9 h-9 rounded-full grid place-items-center text-white text-sm font-bold shadow"
                    style={{
                      background: `linear-gradient(135deg, ${secondary}, ${main})`,
                    }}
                  >
                    {initials}
                  </div>
                )}
              </div>

              <div className="hidden sm:block min-w-0">
                <div className="text-sm font-medium text-white/90 truncate">
                  {me?.name || "User"}
                </div>
                <div className="text-[11px] uppercase tracking-wider text-white/45">
                  Account
                </div>
              </div>
            </Link>
          </div>
        </div>
      </header>

      {/* PAGE CONTENT */}
      <main className="flex-1 min-h-0 [&>*]:!min-h-0">
        <Outlet />
      </main>

      <Footer />
    </div>
  );
}

function NavLink({ to, children }) {
  return (
    <Link
      to={to}
      className="inline-flex items-center rounded-xl px-3 py-2 text-white/70 transition hover:bg-white/[0.05] hover:text-white"
    >
      {children}
    </Link>
  );
}
