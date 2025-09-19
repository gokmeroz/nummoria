import { useSearchParams } from "react-router-dom";
import { useState } from "react";
import api from "../lib/api";

export default function ResetPassword() {
  const [sp] = useSearchParams();
  const email = sp.get("email") || "";
  const token = sp.get("token") || "";
  const [pwd, setPwd] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  async function submit(e) {
    e.preventDefault();
    setErr("");
    setMsg("");
    try {
      const { data } = await api.post("/auth/reset-password", {
        email,
        token,
        newPassword: pwd,
      });
      setMsg(data.message || "Password updated. You can now login.");
    } catch (e) {
      setErr(e.response?.data?.error || "Failed to reset password");
    }
  }

  return (
    <div className="min-h-dvh grid place-items-center bg-gray-50">
      <form
        onSubmit={submit}
        className="w-full max-w-sm space-y-4 bg-white p-6 rounded-xl shadow"
      >
        <h1 className="text-2xl font-semibold text-[#4f772d]">
          Reset password
        </h1>
        {email && <div className="text-xs text-gray-500">For: {email}</div>}
        {msg && <div className="text-[#4f772d] text-sm">{msg}</div>}
        {err && <div className="text-red-600 text-sm">{err}</div>}
        <div>
          <label className="block text-sm mb-1 text-gray-700">
            New password
          </label>
          <input
            type="password"
            className="w-full border rounded px-3 py-2 outline-none focus:ring-2 focus:ring-[#90a955]"
            value={pwd}
            onChange={(e) => setPwd(e.target.value)}
          />
        </div>
        <button className="w-full bg-[#4f772d] hover:bg-[#90a955] text-white py-2 rounded transition">
          Update password
        </button>
      </form>
    </div>
  );
}
