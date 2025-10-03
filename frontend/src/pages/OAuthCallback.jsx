import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import api from "../lib/api";

export default function OAuthCallback() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const token = params.get("token");
        const next = params.get("next") || "/";
        if (!token) {
          setErr("Missing token");
          return;
        }

        // store token
        localStorage.setItem("token", token);

        // (optional) pull current user and cache a few fields
        try {
          const { data } = await api.get("/auth/me");
          localStorage.setItem("defaultId", data.id || "");
          localStorage.setItem("userEmail", data.email || "");
          localStorage.setItem("userName", data.name || "");
          if (data.avatarUrl) localStorage.setItem("avatarUrl", data.avatarUrl);
        } catch (e) {
          setErr(e.message);
        }

        navigate(next, { replace: true });
      } catch (e) {
        setErr(e?.response?.data?.error || e.message || "OAuth error");
      }
    })();
  }, [params, navigate]);

  return (
    <div className="grid place-items-center min-h-[70vh]">
      {err ? (
        <div className="p-4 border rounded-xl bg-red-50 text-red-700">
          {err}
        </div>
      ) : (
        <div className="p-4 border rounded-xl bg-white">Signing you in…</div>
      )}
    </div>
  );
}
