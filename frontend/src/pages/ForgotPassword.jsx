import { useState } from "react";
import api from "../lib/api";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  async function submit(e) {
    e.preventDefault();
    setErr("");
    setMsg("");
    try {
      const { data } = await api.post("/auth/forgot-password", { email });
      setMsg(data.message || "If that email exists, we sent instructions.");
    } catch (e) {
      setErr(e.response?.data?.error || "Something went wrong");
    }
  }

  return (
    <div className="min-h-dvh grid place-items-center bg-gray-50">
      <form
        onSubmit={submit}
        className="w-full max-w-sm space-y-4 bg-white p-6 rounded-xl shadow"
      >
        <h1 className="text-2xl font-semibold text-[#4f772d]">
          Forgot password
        </h1>
        {msg && <div className="text-[#4f772d] text-sm">{msg}</div>}
        {err && <div className="text-red-600 text-sm">{err}</div>}
        <div>
          <label className="block text-sm mb-1 text-gray-700">Email</label>
          <input
            className="w-full border rounded px-3 py-2 outline-none focus:ring-2 focus:ring-[#90a955]"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <button className="w-full bg-[#4f772d] hover:bg-[#90a955] text-white py-2 rounded transition">
          Send reset link
        </button>
      </form>
    </div>
  );
}
