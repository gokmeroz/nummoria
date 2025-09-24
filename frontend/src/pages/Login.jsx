// src/pages/Login.jsx
import { useState } from "react";
import api from "../lib/api";
import Footer from "../components/Footer";

export default function Login() {
  // login state
  const [loginEmail, setLoginEmail] = useState("mert@nummora.com");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginErr, setLoginErr] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  // signup state
  const [name, setName] = useState("");
  const [signEmail, setSignEmail] = useState("");
  const [signPassword, setSignPassword] = useState("");
  const [signErr, setSignErr] = useState("");
  const [signLoading, setSignLoading] = useState(false);

  async function onLogin(e) {
    e.preventDefault();
    setLoginErr("");
    setLoginLoading(true);
    try {
      const { data } = await api.post("/auth/login", {
        email: loginEmail,
        password: loginPassword,
      });

      localStorage.setItem("token", data.token);
      if (data?.user?.id) {
        localStorage.setItem("defaultId", data.user.id);
        localStorage.setItem("userEmail", data.user.email || "");
        localStorage.setItem("userName", data.user.name || "");
      }
      location.href = "/";
    } catch (e) {
      setLoginErr(e.response?.data?.error || "Login failed");
    } finally {
      setLoginLoading(false);
    }
  }

  async function onSignup(e) {
    e.preventDefault();
    setSignErr("");
    setSignLoading(true);
    try {
      await api.post("/auth/register", {
        name,
        email: signEmail,
        password: signPassword,
      });

      // auto-login after register
      const { data } = await api.post("/auth/login", {
        email: signEmail,
        password: signPassword,
      });

      localStorage.setItem("token", data.token);
      if (data?.user?.id) {
        localStorage.setItem("defaultId", data.user.id);
        localStorage.setItem("userEmail", data.user.email || "");
        localStorage.setItem("userName", data.user.name || "");
      }
      location.href = "/";
    } catch (e) {
      setSignErr(e.response?.data?.error || "Registration failed");
    } finally {
      setSignLoading(false);
    }
  }

  return (
    <div className="relative min-h-dvh flex flex-col">
      {/* 🔥 Background */}
      <img
        src="../../src/assets/loginAlt.jpg"
        alt="Background"
        className="absolute inset-0 w-full h-full object-cover -z-10"
      />
      {/* Dark overlay for readability */}
      <div className="absolute inset-0 bg-black/50 -z-10" />

      {/* ===== Main content (centered) ===== */}
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-5xl bg-white rounded-2xl shadow-xl overflow-hidden grid grid-cols-1 md:grid-cols-2">
          {/* Left: Sign in */}
          <div className="relative p-8 md:p-10 bg-[#4f772d]/90 text-white flex flex-col justify-center">
            <div className="relative">
              <h2 className="text-3xl font-extrabold">Welcome Back!</h2>
              <p className="mt-2 text-white/90">
                To keep connected with us please login with your personal info.
              </p>

              <form onSubmit={onLogin} className="mt-8 space-y-4">
                {loginErr && (
                  <div className="text-sm bg-white/15 px-3 py-2 rounded">
                    {loginErr}
                  </div>
                )}
                <div>
                  <label className="text-sm">Email</label>
                  <input
                    type="email"
                    className="mt-1 w-full rounded-lg px-3 py-2 bg-white text-gray-900 placeholder-gray-400 outline-none focus:ring-2 focus:ring-[#90a955]"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="you@nummora.com"
                    required
                  />
                </div>
                <div>
                  <label className="text-sm">Password</label>
                  <input
                    type="password"
                    className="mt-1 w-full rounded-lg px-3 py-2 bg-white text-gray-900 placeholder-gray-400 outline-none focus:ring-2 focus:ring-[#90a955]"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                  />
                </div>
                <button
                  className="w-full rounded-full border-2 border-white py-2 font-semibold hover:bg-white hover:text-[#4f772d] transition disabled:opacity-60"
                  disabled={loginLoading}
                >
                  {loginLoading ? "Signing in..." : "SIGN IN"}
                </button>
                <div className="text-sm text-white/90">
                  <a href="/forgot-password" className="underline">
                    Forgot password?
                  </a>
                </div>
              </form>
            </div>
          </div>

          {/* Right: Create account */}
          <div className="p-8 md:p-10 flex flex-col justify-center bg-white/95">
            <h2 className="text-3xl font-extrabold text-[#4f772d]">
              Create Account
            </h2>

            <div className="mt-5 flex items-center gap-3">
              <button
                type="button"
                className="w-9 h-9 rounded-full border flex items-center justify-center"
              >
                f
              </button>
              <button
                type="button"
                className="w-9 h-9 rounded-full border flex items-center justify-center"
              >
                G+
              </button>
              <button
                type="button"
                className="w-9 h-9 rounded-full border flex items-center justify-center"
              >
                in
              </button>
            </div>

            <p className="mt-4 text-gray-500 text-sm">
              or use your email for registration:
            </p>

            <form onSubmit={onSignup} className="mt-4 space-y-4">
              {signErr && <div className="text-sm text-red-600">{signErr}</div>}
              <div>
                <label className="block text-sm mb-1">Name</label>
                <input
                  className="w-full border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-[#90a955]"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  required
                />
              </div>
              <div>
                <label className="block text-sm mb-1">Email</label>
                <input
                  type="email"
                  className="w-full border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-[#90a955]"
                  value={signEmail}
                  onChange={(e) => setSignEmail(e.target.value)}
                  placeholder="you@nummora.com"
                  required
                />
              </div>
              <div>
                <label className="block text-sm mb-1">Password</label>
                <input
                  type="password"
                  className="w-full border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-[#90a955]"
                  value={signPassword}
                  onChange={(e) => setSignPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  minLength={8}
                  required
                />
              </div>
              <button
                className="w-full bg-[#4f772d] text-white py-2 rounded-full font-semibold shadow-md hover:shadow-lg hover:bg-[#90a955] transition disabled:opacity-60"
                disabled={signLoading}
              >
                {signLoading ? "Creating..." : "SIGN UP"}
              </button>

              <div className="text-sm text-gray-600">
                Already have an account?{" "}
                <a href="#" className="text-[#4f772d] underline">
                  Sign in on the left
                </a>
              </div>
            </form>
          </div>
        </div>
      </main>

      {/* ===== Footer pinned to bottom, full-bleed ===== */}
      <footer className="mt-auto w-full">
        <Footer fullBleed className="bg-white/70 backdrop-blur-sm" />
      </footer>
    </div>
  );
}
