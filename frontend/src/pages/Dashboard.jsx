import { useEffect, useState } from "react";
import api from "../lib/api";

export default function Dashboard() {
  const [me, setMe] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    api.get("/me")
      .then(({ data }) => setMe(data))
      .catch(e => setErr(e.response?.data?.error || "Failed to load /me"));
  }, []);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <button
          onClick={() => { localStorage.removeItem("token"); location.href="/login"; }}
          className="text-sm text-red-600"
        >
          Logout
        </button>
      </div>
      {err && <div className="text-red-600 mt-3">{err}</div>}
      {me && (
        <div className="mt-4 rounded border p-4">
          <div><span className="font-medium">Name:</span> {me.name}</div>
          <div><span className="font-medium">Email:</span> {me.email}</div>
          <div><span className="font-medium">Base currency:</span> {me.baseCurrency}</div>
          <div><span className="font-medium">TZ:</span> {me.tz}</div>
        </div>
      )}
    </div>
  );
}
