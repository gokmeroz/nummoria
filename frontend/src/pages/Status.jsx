/* eslint-disable no-unused-vars */
// frontend/src/pages/Status.jsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import api from "../lib/api";

const main = "#4f772d";
const secondary = "#90a955";

function Badge({ ok, label }) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border ${
        ok
          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
          : "bg-red-50 text-red-700 border-red-200"
      }`}
      title={ok ? "Operational" : "Degraded / Down"}
    >
      <span
        className={`inline-block w-2 h-2 rounded-full ${
          ok ? "bg-emerald-500" : "bg-red-500"
        }`}
      />
      {label}
    </span>
  );
}

function Stat({ label, value, hint }) {
  return (
    <div className="p-3 rounded-xl border">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-sm font-semibold">{value}</div>
      {hint ? <div className="text-[11px] text-gray-500">{hint}</div> : null}
    </div>
  );
}

function msFmt(ms) {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

export default function Status() {
  const [loading, setLoading] = useState(true);
  const [auto, setAuto] = useState(true);
  const timerRef = useRef(null);

  // individual probe results
  const [apiOk, setApiOk] = useState(null);
  const [apiLatency, setApiLatency] = useState(null);

  const [dbOk, setDbOk] = useState(null);
  const [dbLatency, setDbLatency] = useState(null);

  const [authOk, setAuthOk] = useState(null);
  const [authLatency, setAuthLatency] = useState(null);

  const [quotesOk, setQuotesOk] = useState(null);
  const [quotesLatency, setQuotesLatency] = useState(null);

  const [jobsOk, setJobsOk] = useState(null);
  const [jobsLatency, setJobsLatency] = useState(null);

  const [err, setErr] = useState("");

  const appVersion =
    (typeof window !== "undefined" && window.__APP_VERSION__) || "1.0.0";
  const env =
    (typeof window !== "undefined" && window.__APP_ENV__) ||
    import.meta?.env?.MODE ||
    "DEV"; // "development" or "production"

  const probe = useCallback(async () => {
    setLoading(true);
    setErr("");

    // small helper to time a call
    const time = async (fn) => {
      const t0 = performance.now();
      try {
        const res = await fn();
        const t1 = performance.now();
        return { ok: true, ms: Math.round(t1 - t0), data: res };
      } catch (e) {
        const t1 = performance.now();
        return {
          ok: false,
          ms: Math.round(t1 - t0),
          error: e?.response?.data?.error || e.message || "Probe failed",
        };
      }
    };

    // 1) API liveness (cheap GET)
    const pApi = await time(() => api.get("/health"));
    setApiOk(pApi.ok);
    setApiLatency(pApi.ms);
    if (!pApi.ok && !pApi.error?.includes("Not Found"))
      setErr(String(pApi.error || ""));

    // 2) DB check – expect /health to optionally report db; if not, do a tiny read
    const pDb =
      pApi.ok && pApi.data?.data?.db != null
        ? { ok: !!pApi.data.data.db, ms: pApi.ms }
        : await time(() => api.get("/accounts", { params: { limit: 1 } }));
    setDbOk(!!pDb.ok);
    setDbLatency(pDb.ms);

    // 3) Auth check – if /me exists; treat 401 as “up but unauth”
    const pAuth = await time(() => api.get("/me"));
    setAuthOk(pAuth.ok || (pAuth.error || "").includes("401"));
    setAuthLatency(pAuth.ms);

    // 4) Quotes provider via our proxy (/investments/quote)
    const pQuotes = await time(() =>
      api.get("/investments/quote", { params: { symbol: "AAPL" } })
    );
    setQuotesOk(pQuotes.ok);
    setQuotesLatency(pQuotes.ms);

    // 5) Background jobs / scheduler – if your backend exposes /health.jobs true; else ping a light endpoint
    const pJobs =
      pApi.ok && pApi.data?.data?.jobs != null
        ? { ok: !!pApi.data.data.jobs, ms: pApi.ms }
        : await time(() => api.get("/transactions", { params: { limit: 1 } }));
    setJobsOk(!!pJobs.ok);
    setJobsLatency(pJobs.ms);

    setLoading(false);
  }, []);

  useEffect(() => {
    probe();
    if (auto) {
      timerRef.current = setInterval(probe, 30000); // 30s
    }
    return () => clearInterval(timerRef.current);
  }, [auto, probe]);

  const overallGood = useMemo(() => {
    const vals = [apiOk, dbOk, quotesOk, jobsOk];
    if (vals.some((v) => v === false)) return false;
    if (vals.every((v) => v === true)) return true;
    return null; // unknown / loading
  }, [apiOk, dbOk, quotesOk, jobsOk]);

  return (
    <div className="min-h-dvh bg-white">
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur border-b">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h1
              className="text-lg sm:text-xl font-semibold"
              style={{ color: main }}
            >
              System Status
            </h1>
            {overallGood === true && (
              <Badge ok label="All systems operational" />
            )}
            {overallGood === false && (
              <Badge ok={false} label="Partial outage" />
            )}
            {overallGood === null && (
              <span className="text-xs text-gray-500">Checking…</span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <label className="text-xs flex items-center gap-2">
              <input
                type="checkbox"
                checked={auto}
                onChange={(e) => setAuto(e.target.checked)}
              />
              Auto-refresh
            </label>
            <button
              onClick={probe}
              className="px-3 py-2 rounded-xl border text-sm"
              style={{ borderColor: main, color: main }}
              disabled={loading}
              title="Refresh now"
            >
              {loading ? "Checking…" : "Refresh"}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {err && (
          <div className="rounded-xl border border-red-200 bg-red-50 text-red-700 p-3">
            {err}
          </div>
        )}

        {/* Overview */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="rounded-2xl border p-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold">API</h2>
              <Badge
                ok={apiOk === true}
                label={apiOk ? "Operational" : "Down"}
              />
            </div>
            <div className="text-sm text-gray-600">
              Latency: {msFmt(apiLatency)}
            </div>
          </div>

          <div className="rounded-2xl border p-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold">Database</h2>
              <Badge
                ok={dbOk === true}
                label={dbOk ? "Operational" : "Issue"}
              />
            </div>
            <div className="text-sm text-gray-600">
              Latency: {msFmt(dbLatency)}
            </div>
          </div>

          <div className="rounded-2xl border p-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold">Authentication</h2>
              <Badge ok={authOk === true} label="Reachable" />
            </div>
            <div className="text-sm text-gray-600">
              Latency: {msFmt(authLatency)}
            </div>
            <div className="text-[11px] text-gray-500 mt-1">
              401 counts as reachable.
            </div>
          </div>

          <div className="rounded-2xl border p-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold">Market Quotes</h2>
              <Badge
                ok={quotesOk === true}
                label={quotesOk ? "Operational" : "Issue"}
              />
            </div>
            <div className="text-sm text-gray-600">
              Latency: {msFmt(quotesLatency)}
            </div>
          </div>

          <div className="rounded-2xl border p-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold">Background Jobs</h2>
              <Badge
                ok={jobsOk === true}
                label={jobsOk ? "Operational" : "Issue"}
              />
            </div>
            <div className="text-sm text-gray-600">
              Latency: {msFmt(jobsLatency)}
            </div>
          </div>

          <div className="rounded-2xl border p-4">
            <h2 className="text-sm font-semibold mb-2">App</h2>
            <div className="grid grid-cols-2 gap-2">
              <Stat label="Environment" value={env} />
              <Stat label="Version" value={appVersion} />
            </div>
          </div>
        </section>

        {/* Optional: raw details for debugging */}
        <details className="rounded-2xl border p-4">
          <summary className="cursor-pointer text-sm font-semibold">
            Troubleshooting details
          </summary>
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
            <Stat
              label="API OK"
              value={String(apiOk)}
              hint={`Latency ${msFmt(apiLatency)}`}
            />
            <Stat
              label="DB OK"
              value={String(dbOk)}
              hint={`Latency ${msFmt(dbLatency)}`}
            />
            <Stat
              label="Auth Reachable"
              value={String(authOk)}
              hint={`Latency ${msFmt(authLatency)}`}
            />
            <Stat
              label="Quotes OK"
              value={String(quotesOk)}
              hint={`Latency ${msFmt(quotesLatency)}`}
            />
            <Stat
              label="Jobs OK"
              value={String(jobsOk)}
              hint={`Latency ${msFmt(jobsLatency)}`}
            />
          </div>
        </details>
      </main>

      <div className="h-1 w-full" style={{ backgroundColor: secondary }} />
    </div>
  );
}
