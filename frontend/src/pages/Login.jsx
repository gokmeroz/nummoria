import { useState } from "react";
import api from "../lib/api";

export default function Login() {
  const [email, setEmail] = useState("mert@nummora.com");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");

  async function onSubmit(e) {
    e.preventDefault();
    setErr("");
    try {
      const { data } = await api.post("/auth/login", { email, password });
      localStorage.setItem("token", data.token);
      location.href = "/";
    } catch (e) {
      setErr(e.response?.data?.error || "Login failed");
    }
  }

  return (
    <div className="min-h-dvh grid place-items-center bg-gray-50">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4 bg-white p-6 rounded-xl shadow">
        <h1 className="text-2xl font-semibold">Sign in</h1>
        {err && <div className="text-red-600 text-sm">{err}</div>}
        <div>
          <label className="block text-sm mb-1">Email</label>
          <input className="w-full border rounded px-3 py-2" value={email} onChange={e=>setEmail(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm mb-1">Password</label>
          <input type="password" className="w-full border rounded px-3 py-2" value={password} onChange={e=>setPassword(e.target.value)} />
        </div>
        <button className="w-full bg-black text-white py-2 rounded">Login</button>
        <a href="/forgot-password" className="text-sm text-blue-600">Forgot password?</a>
      </form>
    </div>
  );
}
