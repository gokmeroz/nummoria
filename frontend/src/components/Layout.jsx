// frontend/src/components/Layout.jsx
import { Link, Outlet } from "react-router-dom";
import Footer from "./Footer";

export default function Layout({ me, onLogout }) {
  return (
    <div className="min-h-dvh flex flex-col">
      {/* NAVBAR */}
      <header className="sticky top-0 z-50 bg-white border-b">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Logo + Brand */}
          <Link to="/" className="flex items-center gap-2">
            <img
              src="../src/assets/numora_logo.png"
              alt="Nummora Logo"
              className="h-8 w-8"
            />
            <span className="font-semibold text-lg text-[#4f772d]">
              Nummora
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
              <div
                className="w-9 h-9 rounded-full grid place-items-center text-white font-semibold"
                style={{ backgroundColor: "#4f772d" }}
              >
                {me?.name ? me.name[0]?.toUpperCase() : "U"}
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
