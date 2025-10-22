/* eslint-disable no-unused-vars */
// frontend/src/components/Layout.jsx
import { useEffect, useState } from "react";
import api from "../lib/api";

import { Link, Outlet } from "react-router-dom";
import Footer from "./Footer";
const basic_avatarUrl = "../assets/basic_avatar.jpg";

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

  if (loading) return <div className="p-4">Loading...</div>;
  if (err) return <div className="p-4 text-red-500">{err}</div>;

  return (
    <div className="min-h-dvh flex flex-col">
      {/* NAVBAR */}
      <header className="sticky top-0 z-50 bg-white border-b">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Logo + Brand */}
          <Link to="/" className="flex items-center gap-2">
            <img
              src="../src/assets/nummoria_logo.png"
              alt="Nummoria Logo"
              className="h-8 w-8"
            />
            <span className="font-semibold text-lg text-[#4f772d]">
              Nummoria
            </span>
          </Link>

          {/* Links */}
          <nav className="hidden md:flex items-center gap-6 text-sm">
            <Link to="/ai/financial-helper">Financial Helper</Link>
            <Link to="/expenses">Expenses</Link>
            <Link to="/incomes">Income</Link>
            <Link to="/investments">Investments</Link>
            <Link to="/reports">Reports</Link>
            <Link to="/support">Support</Link>
          </nav>

          {/* Right side */}
          <div className="flex items-center gap-3">
            <button
              onClick={onLogout}
              className="text-sm px-3 py-1.5 rounded border border-[#90a955] text-[#4f772d] hover:bg-[#90a955] hover:text-white transition"
            >
              Logout
            </button>
            <Link to="/user" className="flex items-center gap-2 text-sm">
              <div className="w-9 h-9 rounded-full overflow-hidden">
                {me?.avatarUrl ? (
                  <img
                    src={me.avatarUrl}
                    alt="User Avatar"
                    className="h-9 w-9 object-cover"
                  />
                ) : (
                  <div
                    className="w-8 h-8 rounded-full ring-4 ring-white grid place-items-center text-white text-l font-bold shadow"
                    style={{ backgroundColor: main }}
                  >
                    {initials}
                  </div>
                )}
              </div>
              <span className="hidden sm:block text-gray-700">
                {me?.name || "User"}
              </span>
            </Link>
          </div>
        </div>
      </header>

      {/* PAGE CONTENT */}
      {/* The [&>*]:!min-h-0 removes min-h-[100dvh]/min-h-dvh from page roots to kill that big gap */}
      <main className="flex-1 bg-gray-50 min-h-0 [&>*]:!min-h-0">
        <Outlet />
      </main>

      <Footer />
    </div>
  );
}
