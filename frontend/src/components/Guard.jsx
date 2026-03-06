// frontend/src/components/Guard.jsx
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
      <div className="min-h-[60vh] grid place-items-center bg-[#070A07] text-white">
        <div className="relative w-full max-w-sm px-4">
          {/* glow */}
          <div className="pointer-events-none absolute -inset-10 opacity-40">
            <div className="absolute left-4 top-6 h-40 w-40 rounded-full blur-3xl bg-[#13e243]/20" />
            <div className="absolute right-6 top-10 h-40 w-40 rounded-full blur-3xl bg-[#991746]/20" />
          </div>

          <div className="relative rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-md p-5">
            <div className="flex items-center gap-3">
              {/* spinner */}
              <span className="relative inline-block w-5 h-5">
                <span className="absolute inset-0 rounded-full border-2 border-white/15" />
                <span className="absolute inset-0 rounded-full border-2 border-transparent border-t-white/80 animate-spin" />
              </span>

              <div className="min-w-0">
                <div className="text-sm font-medium text-white">
                  Checking session…
                </div>
                <div className="mt-1 text-xs text-white/60">
                  Verifying cookie session, then token fallback if needed.
                </div>
              </div>
            </div>

            {/* progress shimmer */}
            <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
              <div className="h-full w-1/3 animate-[guardbar_1.2s_ease-in-out_infinite] bg-white/30" />
            </div>

            <style>{`
              @keyframes guardbar {
                0% { transform: translateX(-120%); }
                100% { transform: translateX(320%); }
              }
            `}</style>
          </div>
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
