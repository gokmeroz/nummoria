// src/pages/Login.jsx
import { useState } from "react";
import api from "../lib/api";
import Footer from "../components/Footer";

export default function Login() {
  // login state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginErr, setLoginErr] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  // signup state
  const [name, setName] = useState("");
  const [signEmail, setSignEmail] = useState("");
  const [signPassword, setSignPassword] = useState("");
  const [signErr, setSignErr] = useState("");
  const [signLoading, setSignLoading] = useState(false);

  // social state
  const [socialLoading, setSocialLoading] = useState("");
  const [socialErr, setSocialErr] = useState("");

  // Build absolute API URL for redirects (works in dev/prod)
  const API_BASE =
    (api?.defaults?.baseURL || "").replace(/\/+$/, "") ||
    window.location.origin;

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

  // Kick off OAuth with provider (backend handles callback + session)
  function startSocial(provider) {
    try {
      setSocialErr("");
      setSocialLoading(provider);
      // Optional: let backend know where to send us after success
      const next = encodeURIComponent(`${window.location.origin}/`);
      const url = `${API_BASE}/auth/${provider}?next=${next}`;
      window.location.href = url;
    } catch (err) {
      setSocialErr(`Could not start social sign-in. Please try again: ${err}`);
      setSocialLoading("");
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
                    placeholder="you@nummoria.com"
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

            {/* Social providers */}
            <div className="mt-5">
              {socialErr && (
                <div className="text-sm text-red-600 mb-3">{socialErr}</div>
              )}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  aria-label="Continue with Google"
                  title="Continue with Google"
                  className="w-9 h-9 rounded-full border flex items-center justify-center"
                  disabled={!!socialLoading}
                  onClick={() => {
                    setSocialLoading(true);
                    const apiUrl =
                      import.meta.env.VITE_API_URL || "http://localhost:4000";
                    window.location.href = `${apiUrl}/auth/google?next=/`;
                  }}
                >
                  {/* {socialLoading ? "…" : "G"} */}

                  {/* Google G */}
                  <svg width="20" height="20" viewBox="0 0 48 48">
                    <path
                      fill="#FFC107"
                      d="M43.6 20.5H42V20H24v8h11.3C33.7 32.6 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.7 1.1 7.8 3l5.7-5.7C33.9 6.3 29.2 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 19.3-8.8 19.3-20c0-1.3-.1-2.5-.7-3.5z"
                    />
                    <path
                      fill="#FF3D00"
                      d="M6.3 14.7l6.6 4.8C14.5 16 18.9 12 24 12c3 0 5.7 1.1 7.8 3l5.7-5.7C33.9 6.3 29.2 4 24 4 16.2 4 9.4 8.4 6.3 14.7z"
                    />
                    <path
                      fill="#4CAF50"
                      d="M24 44c5.2 0 9.9-1.9 13.5-5.1l-6.2-5c-2 1.4-4.7 2.2-7.3 2.2-5.3 0-9.7-3.4-11.3-8.1l-6.6 5.1C9.4 39.6 16.2 44 24 44z"
                    />
                    <path
                      fill="#1976D2"
                      d="M43.6 20.5H42V20H24v8h11.3c-1.1 3.6-4.5 6-8.3 6-5.3 0-9.7-3.4-11.3-8.1l-6.6 5.1C9.4 39.6 16.2 44 24 44c8.6 0 19.3-6.2 19.3-20 0-1.3-.1-2.5-.7-3.5z"
                    />
                  </svg>
                </button>

                <button
                  type="button"
                  aria-label="Continue with Twitter"
                  title="Continue with Twitter"
                  className="w-10 h-10 rounded-full border flex items-center justify-center hover:bg-gray-50 disabled:opacity-60"
                  disabled={!!socialLoading}
                  onClick={() => startSocial("twitter")}
                >
                  {/* Twitter/X X */}
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="black">
                    <path d="M18.244 2H21.5l-7.42 8.49L22 22h-6.77l-5.3-6.97L4.77 22H1.5l7.92-9.05L2 2h6.91l4.79 6.39L18.244 2zm-2.37 18h2.11L8.21 4H6.01l9.864 16z" />
                  </svg>
                </button>

                <button
                  type="button"
                  aria-label="Continue with GitHub"
                  title="Continue with GitHub"
                  className="w-10 h-10 rounded-full border flex items-center justify-center hover:bg-gray-50 disabled:opacity-60 bg-black"
                  disabled={!!socialLoading}
                  onClick={() => startSocial("github")}
                >
                  {/* GitHub logo */}
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="white"
                  >
                    <path
                      d="M12 .5C5.73.5.5 5.74.5 12.02c0 5.1 3.29 9.42 7.86 10.95.58.11.79-.25.79-.56 0-.28-.01-1.02-.02-2 
      -3.2.7-3.88-1.54-3.88-1.54-.53-1.35-1.3-1.71-1.3-1.71-1.06-.72.08-.71.08-.71 1.17.08 
      1.79 1.2 1.79 1.2 1.04 1.79 2.73 1.27 3.4.97.1-.76.41-1.27.75-1.56-2.55-.29-5.23-1.28-5.23-5.7 
      0-1.26.45-2.29 1.2-3.1-.12-.29-.52-1.45.11-3.02 0 0 .97-.31 3.18 1.18a11.1 11.1 0 0 1 2.9-.39c.98 0 
      1.96.13 2.9.39 2.2-1.49 3.17-1.18 3.17-1.18.63 1.57.23 2.73.11 3.02.75.81 1.2 1.84 1.2 3.1 
      0 4.43-2.69 5.41-5.25 5.7.42.36.8 1.09.8 2.2 0 1.59-.01 2.87-.01 3.26 0 .31.21.68.8.56 
      A10.52 10.52 0 0 0 23.5 12c0-6.28-5.23-11.5-11.5-11.5z"
                    />
                  </svg>
                </button>

                {socialLoading && (
                  <span className="text-sm text-gray-500">
                    Redirecting to {socialLoading}…
                  </span>
                )}
              </div>

              <p className="mt-4 text-gray-500 text-sm">
                or use your email for registration:
              </p>
            </div>

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
                  placeholder="you@nummoria.com"
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

              <div className="text-xs text-gray-500 text-center">
                By continuing you agree to our{" "}
                <a className="underline" href="/terms">
                  Terms
                </a>{" "}
                and{" "}
                <a className="underline" href="/privacy">
                  Privacy Policy
                </a>
                .
              </div>

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
