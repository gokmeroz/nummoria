import { useState } from "react";
import api from "../lib/api";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  async function submit(e){
    e.preventDefault();
    setErr(""); setMsg("");
    try{
      const { data } = await api.post("/auth/forgot-password", { email });
      setMsg(data.message || "If that email exists, we sent instructions.");
    }catch(e){
      setErr(e.response?.data?.error || "Something went wrong");
    }
  }

  return (
    <div className="min-h-dvh grid place-items-center bg-gray-50">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 bg-white p-6 rounded-xl shadow">
        <h1 className="text-2xl font-semibold">Forgot password</h1>
        {msg && <div className="text-green-700 text-sm">{msg}</div>}
        {err && <div className="text-red-600 text-sm">{err}</div>}
        <div>
          <label className="block text-sm mb-1">Email</label>
          <input className="w-full border rounded px-3 py-2" value={email} onChange={e=>setEmail(e.target.value)} />
        </div>
        <button className="w-full bg-black text-white py-2 rounded">Send reset link</button>
      </form>
    </div>
  );
}
