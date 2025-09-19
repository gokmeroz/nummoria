// frontend/src/pages/ForgotPassword.jsx
import { useState, useEffect } from "react";
import api from "../lib/api";

/**
 * Full forgot-password page with robust error reporting and Option A behavior:
 * - Redirects to /reset-password?email=...&token=... only if backend returns token or resetUrl
 * - Otherwise shows message "check your inbox"
 *
 * Helpful debugging:
 * - Logs axios baseURL and full error to console (remove in production)
 */

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  // Optional: surface api baseURL for quick debugging in UI (only when undefined/misconfigured)
  const [apiBase, setApiBase] = useState("");

  useEffect(() => {
    // show configured baseURL for debug
    try {
      // api could be an axios instance; many apps export axios.create()
      // reading defaults.baseURL is safe for debug
      setApiBase(api?.defaults?.baseURL || "");
      console.log("DEBUG: api.baseURL =", api?.defaults?.baseURL);
    } catch (e) {
      console.log("DEBUG: cannot read api.baseURL", e);
    }
  }, []);

  async function submit(e) {
    e.preventDefault();
    setErr("");
    setMsg("");
    setLoading(true);

    // trim email early, avoid empty sending
    const cleanEmail = (email || "").trim();
    if (!cleanEmail) {
      setErr("Please enter an email address.");
      setLoading(false);
      return;
    }

    try {
      // Try to request the backend. We include a short timeout so the user doesn't hang forever.
      // Remove the timeout if your server is slow or during debugging.
      console.log("Sending forgot-password for:", cleanEmail);
      const { data } = await api.post(
        "/auth/forgot-password",
        { email: cleanEmail },
        { timeout: 8000 }
      );

      // log full response for debug
      console.log("forgot-password response:", data);

      // Expect one of:
      // { message, token }  OR  { message, resetUrl }  OR  { message }
      const message =
        data?.message || "If that email exists, we sent instructions.";
      const token = data?.token;
      const resetUrl = data?.resetUrl;

      // If server returned a ready-to-use reset URL, go there.
      if (resetUrl) {
        window.location.href = resetUrl;
        return;
      }

      // If server returned a token (dev-friendly), pass token in query and redirect to reset page.
      if (token) {
        const qp = new URLSearchParams({ email: cleanEmail, token });
        window.location.href = `/reset-password?${qp.toString()}`;
        return;
      }

      // No token/resetUrl in response -> inform user to check their inbox.
      setMsg(message);
    } catch (e) {
      // DEBUG: log entire error to console (very useful)
      console.error("forgot-password error (full):", e);

      // Build a helpful message for the UI
      let userMsg = "Something went wrong";

      if (e.response) {
        // Server responded with non-2xx
        const { status, statusText, data } = e.response;
        const detail =
          data?.error || data?.message || JSON.stringify(data) || "";
        userMsg = `${status} ${statusText}${detail ? `: ${detail}` : ""}`;
      } else if (e.request) {
        // Request was made but no response (network / CORS / timeout)
        userMsg =
          "No response from server. Check server URL, CORS, or timeout.";
      } else if (e.message) {
        userMsg = e.message;
      }

      setErr(userMsg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-dvh grid place-items-center bg-gray-50 p-4">
      <form
        onSubmit={submit}
        className="w-full max-w-sm space-y-4 bg-white p-6 rounded-xl shadow"
      >
        <h1 className="text-2xl font-semibold text-[#4f772d]">
          Forgot password
        </h1>

        {/* Helpful dev note if baseURL looks empty */}
        {(!apiBase || apiBase === "") && (
          <div className="text-xs text-amber-600">
            Dev tip: api baseURL is not configured (api.defaults.baseURL is
            empty). Check <code>src/lib/api.js</code>.
          </div>
        )}

        {msg && <div className="text-[#4f772d] text-sm">{msg}</div>}
        {err && <div className="text-red-600 text-sm">{err}</div>}

        <div>
          <label className="block text-sm mb-1 text-gray-700">Email</label>
          <input
            type="email"
            required
            autoComplete="email"
            className="w-full border rounded px-3 py-2 outline-none focus:ring-2 focus:ring-[#90a955]"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@nummora.com"
          />
        </div>

        <button
          type="submit"
          disabled={loading || !email.trim()}
          className="w-full bg-[#4f772d] hover:bg-[#90a955] disabled:opacity-60 text-white py-2 rounded transition"
        >
          {loading ? "Sending…" : "Send reset link"}
        </button>

        <div className="text-xs text-gray-500">
          We’ll email you a secure link to reset your password.
        </div>

        {/* Optional dev-only testing helpers (comment out/remove in production) */}
        <div className="pt-2 text-xs text-gray-400">
          <div>Debug:</div>
          <div>
            api.baseURL:{" "}
            <span className="font-mono">{apiBase || "(empty)"}</span>
          </div>
          <div className="mt-1 text-amber-600">
            If you still see "No response from server", check that your backend
            is running and that CORS allows{" "}
            <span className="font-mono">http://localhost:5173</span>.
          </div>
        </div>

        {/* DEV shortcut: quickly test redirect without backend.
            Uncomment during development only.
        <div className="pt-2">
          <button
            type="button"
            onClick={() => {
              const qp = new URLSearchParams({ email: email.trim(), token: "DEV-TOKEN" });
              window.location.href = `/reset-password?${qp.toString()}`;
            }}
            className="mt-2 w-full border rounded py-1 text-sm"
          >
            DEV: Force redirect to reset (no API)
          </button>
        </div>
        */}
      </form>
    </div>
  );
}
