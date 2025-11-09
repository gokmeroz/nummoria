import { useEffect, useState } from "react";
import { Outlet, Navigate, useLocation } from "react-router-dom";
import api from "../lib/api";

/**
 * Auth guard that prefers cookie session (/me) and gracefully falls back to token.
 * Shows a tiny loader while checking to avoid flicker/redirect loops.
 */
export default function Guard() {
  const location = useLocation();
  const [state, setState] = useState({ loading: true, ok: false });

  useEffect(() => {
    let alive = true;

    async function check() {
      try {
        // 1) Primary: cookie session (HttpOnly). This succeeds if the cookie is present.
        await api.get("/me", { withCredentials: true });
        if (!alive) return;
        setState({ loading: false, ok: true });
        return;
      } catch {
        // 2) Fallback: legacy localStorage token (if you still store it on login)
        const token = localStorage.getItem("token");
        if (token) {
          // Try again, this time with Authorization (api interceptor adds it)
          try {
            await api.get("/me", { withCredentials: true });
            if (!alive) return;
            setState({ loading: false, ok: true });
            return;
          } catch {
            // token is stale
            localStorage.removeItem("token");
          }
        }
        if (!alive) return;
        setState({ loading: false, ok: false });
      }
    }

    check();
    return () => {
      alive = false;
    };
  }, [location.pathname]);

  if (state.loading) {
    return (
      <div className="min-h-[60vh] grid place-items-center">
        <div className="flex items-center gap-3 text-gray-600">
          <span className="relative inline-block w-5 h-5">
            <span className="absolute inset-0 rounded-full border-2 border-gray-300" />
            <span className="absolute inset-0 rounded-full border-2 border-transparent border-t-gray-700 animate-spin" />
          </span>
          <span>Checking session…</span>
        </div>
      </div>
    );
  }

  return state.ok ? (
    <Outlet />
  ) : (
    <Navigate to="/login" replace state={{ from: location }} />
  );
}
