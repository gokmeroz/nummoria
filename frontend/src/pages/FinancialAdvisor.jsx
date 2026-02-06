/* eslint-disable */
// frontend/src/pages/FinancialAdvisor.jsx

import React, { useEffect, useRef, useState } from "react";
import api from "../lib/api"; // your axios instance
import logo from "../assets/nummoria_logo.png";

// ───────────── Plan Gate ─────────────
// ✅ UPDATED: Standard users CAN use it (quota will handle limits)
function isEligible(plan) {
  return true;
}

// ✅ NEW: quota helpers (pure additions)
function toInt(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.floor(n) : fallback;
}
function formatDuration(seconds) {
  const s = Math.max(0, toInt(seconds, 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  if (m > 0) return `${m}m ${String(sec).padStart(2, "0")}s`;
  return `${sec}s`;
}
function humanPlanName(plan) {
  const p = String(plan || "").toLowerCase();
  if (p === "premium") return "Premium";
  if (p === "plus") return "Plus";
  return "Standard";
}
// For web chat quotas: Standard=1, Plus=5, Premium=∞
function planDailyLimit(plan) {
  const p = String(plan || "").toLowerCase();
  if (p === "premium") return Infinity;
  if (p === "plus") return 5;
  return 1;
}

export default function FinancialAdvisor() {
  // ----------------------------- STATE -----------------------------
  const [fileId, setFileId] = useState(null);
  const [tone, setTone] = useState(localStorage.getItem("fh_tone") || "");
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");

  const [uploading, setUploading] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const [banner, setBanner] = useState(null);

  const [thinking, setThinking] = useState(false);

  // Auth & plan
  const [plan, setPlan] = useState(null);
  const [planLoading, setPlanLoading] = useState(true);

  // ✅ NEW: quota state (pure additions)
  const [quota, setQuota] = useState({
    used: 0,
    limit: 0,
    remaining: 0,
    resetInSeconds: 0,
    locked: false,
    lastUpdatedAt: 0,
  });

  const quotaTickRef = useRef(null);

  const fileRef = useRef(null);
  const chatRef = useRef(null);

  // ----------------------------- HELPERS -----------------------------
  function showBanner(msg) {
    setBanner(String(msg || ""));
    window.clearTimeout(showBanner._t);
    showBanner._t = window.setTimeout(() => setBanner(null), 6500);
  }

  // ✅ NEW: local, non-DB quota tracker helpers
  function quotaKeyForUser(data) {
    const id =
      data?._id ||
      data?.id ||
      data?.user?._id ||
      data?.user?.id ||
      data?.userId ||
      null;
    return id ? `fh_quota_${String(id)}` : `fh_quota_anon`;
  }

  function readLocalQuota(key) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const obj = JSON.parse(raw);
      if (!obj || typeof obj !== "object") return null;

      const windowStart = toInt(obj.windowStart, 0);
      const used = toInt(obj.used, 0);
      const now = Date.now();
      if (!windowStart || now - windowStart >= 24 * 60 * 60 * 1000) {
        return { windowStart: now, used: 0 };
      }
      return { windowStart, used };
    } catch {
      return null;
    }
  }

  function writeLocalQuota(key, payload) {
    try {
      localStorage.setItem(key, JSON.stringify(payload));
    } catch {
      // ignore
    }
  }

  function computeQuotaSnapshot({ windowStart, used }, planValue) {
    const limit = planDailyLimit(planValue);
    const now = Date.now();
    const ttl = Math.max(
      0,
      Math.ceil((windowStart + 24 * 60 * 60 * 1000 - now) / 1000),
    );

    if (!Number.isFinite(limit)) {
      return {
        used: 0,
        limit: Infinity,
        remaining: Infinity,
        resetInSeconds: 0,
        locked: false,
      };
    }

    const remaining = Math.max(0, limit - used);
    return {
      used,
      limit,
      remaining,
      resetInSeconds: ttl,
      locked: used >= limit,
    };
  }

  // Fetch plan once
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data } = await api.get("/me");
        if (!mounted) return;

        console.log("✅ /me response:", data);

        const p =
          data?.subscription?.toLowerCase?.() ||
          data?.plan?.toLowerCase?.() ||
          data?.user?.subscription?.toLowerCase?.() ||
          data?.user?.plan?.toLowerCase?.() ||
          null;

        console.log("✅ Parsed plan:", p);
        setPlan(p);

        // ✅ init local quota window for this user (no DB)
        const k = quotaKeyForUser(data);
        const existing = readLocalQuota(k);
        const now = Date.now();
        const base = existing || { windowStart: now, used: 0 };

        if (!base.windowStart) base.windowStart = now;

        writeLocalQuota(k, base);

        const snap = computeQuotaSnapshot(base, p);
        setQuota((q) => ({
          ...q,
          ...snap,
          lastUpdatedAt: Date.now(),
        }));

        // cache /me for later quota key use (add-only)
        try {
          localStorage.setItem("fh_me_cache", JSON.stringify(data || {}));
        } catch {}
      } catch (err) {
        console.error("❌ /me failed:", err);
        setPlan(null);
      } finally {
        if (mounted) setPlanLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // ✅ live countdown tick (only updates reset timer)
  useEffect(() => {
    if (planLoading) return;

    window.clearInterval(quotaTickRef.current);

    if (!plan || !Number.isFinite(planDailyLimit(plan))) return;

    quotaTickRef.current = window.setInterval(() => {
      setQuota((q) => {
        if (!q.lastUpdatedAt) return q;
        const next = { ...q };
        next.resetInSeconds = Math.max(0, toInt(next.resetInSeconds, 0) - 1);

        if (next.resetInSeconds <= 0) {
          next.used = 0;
          next.remaining = next.limit;
          next.locked = false;
          next.resetInSeconds = 24 * 60 * 60;
        }

        return next;
      });
    }, 1000);

    return () => {
      window.clearInterval(quotaTickRef.current);
    };
  }, [planLoading, plan]);

  // auto-scroll
  useEffect(() => {
    chatRef.current?.scrollTo({
      top: chatRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages.length, thinking]);

  // ------------------------- FILE UPLOAD -------------------------
  async function handleFileChange(e) {
    try {
      const f = e?.target?.files?.[0];
      if (!f) return;

      const fd = new FormData();
      fd.append("file", f);

      setUploading(true);
      setUploadPct(0);
      setBanner(null);

      const res = await api.post("/ai/financial-helper/ingest", fd, {
        onUploadProgress: (evt) => {
          if (evt?.total)
            setUploadPct(Math.round((evt.loaded / evt.total) * 100));
        },
      });

      const data = res?.data || {};
      setFileId(data?.fileId || null);

      setMessages((m) => [
        ...m,
        {
          role: "system",
          content: `File processed: ${
            data?.totals?.txCount ?? 0
          } transactions loaded.`,
        },
      ]);

      showBanner("Upload successful. File linked to your session.");
    } catch (err) {
      console.error("Upload error:", err);

      const code = err?.response?.data?.code;
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        "Upload failed.";

      if (err?.response?.status === 402) {
        showBanner("Upgrade required to use Financial Advisor uploads.");
      } else if (err?.response?.status === 413 || code === "LIMIT_FILE_SIZE") {
        showBanner("File too large. Please upload a smaller PDF/CSV.");
      } else if (code === "PDF_NO_TEXT") {
        showBanner(
          "This PDF is scanned/image-only. Please export a text-based PDF or upload a CSV.",
        );
      } else if (code === "NO_TRANSACTIONS") {
        showBanner(`${msg} Tip: Export a CSV from your bank and upload that.`);
      } else {
        showBanner(msg);
      }
    } finally {
      setUploading(false);
      setUploadPct(0);
      if (e?.target) e.target.value = "";
    }
  }

  function clearFile() {
    setFileId(null);
    showBanner("File unlinked from this session.");
  }

  // ------------------------- CHAT -------------------------
  async function onSend() {
    // ✅ Standard allowed now (quota will enforce)
    if (!isEligible(plan)) return;

    // ✅ local quota gate
    if (Number.isFinite(planDailyLimit(plan)) && quota.locked) {
      showBanner(
        `AI quota reached for ${humanPlanName(
          plan,
        )}. Resets in ${formatDuration(quota.resetInSeconds)}.`,
      );
      return;
    }

    const tonePref = (tone || "formal").toLowerCase();
    if (!tone) {
      setTone(tonePref);
      localStorage.setItem("fh_tone", tonePref);
    } else {
      localStorage.setItem("fh_tone", tonePref);
    }

    const userMsg = input.trim();
    setMessages((m) => [
      ...m,
      { role: "user", content: userMsg || `(Using tone: ${tonePref})` },
    ]);
    setInput("");

    try {
      setThinking(true);

      const { data } = await api.post("/ai/financial-helper/chat", {
        message: userMsg || `Start session. Tone: ${tonePref}`,
        tonePreference: tonePref,
        fileId,
      });

      setMessages((m) => [...m, { role: "assistant", content: data.reply }]);

      // ✅ increment local quota on successful response
      const limit = planDailyLimit(plan);
      if (Number.isFinite(limit)) {
        const k = (() => {
          try {
            const stored = localStorage.getItem("fh_me_cache");
            if (stored) {
              const obj = JSON.parse(stored);
              return quotaKeyForUser(obj);
            }
          } catch {}
          return "fh_quota_anon";
        })();

        const base = readLocalQuota(k) || { windowStart: Date.now(), used: 0 };

        const updated = {
          windowStart: base.windowStart || Date.now(),
          used: toInt(base.used, 0) + 1,
        };

        writeLocalQuota(k, updated);

        const snap = computeQuotaSnapshot(updated, plan);
        setQuota((q) => ({
          ...q,
          ...snap,
          lastUpdatedAt: Date.now(),
        }));
      }
    } catch (err) {
      const status = err?.response?.status;
      const payload = err?.response?.data || {};

      if (status === 429) {
        const resetIn =
          toInt(payload?.resetInSeconds, 0) || toInt(payload?.reset, 0);

        showBanner(
          `AI quota reached for ${humanPlanName(
            plan,
          )}. Resets in ${formatDuration(resetIn)}.`,
        );

        const limit = planDailyLimit(plan);
        if (Number.isFinite(limit)) {
          setQuota((q) => ({
            ...q,
            used: limit,
            limit,
            remaining: 0,
            locked: true,
            resetInSeconds: resetIn || q.resetInSeconds,
            lastUpdatedAt: Date.now(),
          }));
        }
      } else {
        const msg =
          payload?.error || payload?.message || err?.message || "Chat failed";

        setMessages((m) => [
          ...m,
          { role: "system", content: `Chat failed: ${msg}` },
        ]);
      }
    } finally {
      setThinking(false);
    }
  }

  function handleComposerKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (tone && input.trim() && !thinking && isEligible(plan)) onSend();
    }
  }

  // ------------------------------- UI -------------------------------
  // ✅ UPDATED: no longer locked by plan; Standard is allowed
  const lockedByPlan = false;

  const limit = planDailyLimit(plan);
  const quotaActive =
    !planLoading && isEligible(plan) && Number.isFinite(limit) && plan != null;

  const quotaText =
    !planLoading && plan
      ? !Number.isFinite(limit)
        ? `Daily AI: unlimited (${humanPlanName(plan)})`
        : quota.locked
          ? `Daily AI limit reached (${quota.used}/${quota.limit}). Resets in ${formatDuration(
              quota.resetInSeconds,
            )}.`
          : `Daily AI: ${quota.used}/${quota.limit} used • ${
              quota.remaining
            } left • resets in ${formatDuration(quota.resetInSeconds)}`
      : null;

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-[#f4f8f4] to-[#eef5ea]">
      {/* Top bar */}
      <div className="sticky top-0 z-10 border-b bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60">
        <div className="mx-auto max-w-4xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Nummoria Logo" className="h-9 w-9" />
            <div>
              <h1 className="text-xl font-bold tracking-tight">
                AI Financial Advisor
              </h1>
              <p className="text-xs text-gray-500 -mt-0.5">
                Educational only • Not licensed financial advice
              </p>

              {/* ✅ quota status line */}
              {!planLoading && quotaText ? (
                <p
                  className={[
                    "text-[11px] mt-1",
                    quota.locked ? "text-amber-700" : "text-gray-500",
                  ].join(" ")}
                >
                  {quotaText}
                </p>
              ) : null}
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-2">
            <span className="text-xs text-gray-500">Tone:</span>
            <ToneChip
              selected={tone === "formal"}
              onClick={() => setTone("formal")}
              label="Formal"
              disabled={planLoading}
            />
            <ToneChip
              selected={tone === "buddy"}
              onClick={() => setTone("buddy")}
              label="Buddy"
              disabled={planLoading}
            />
          </div>
        </div>

        {/* banner */}
        {banner ? (
          <div className="border-t bg-amber-50 text-amber-900">
            <div className="mx-auto max-w-4xl px-4 py-2 text-sm">{banner}</div>
          </div>
        ) : null}

        {/* quota lock banner */}
        {!planLoading && quotaActive && quota.locked ? (
          <div className="border-t bg-amber-50 text-amber-900">
            <div className="mx-auto max-w-4xl px-4 py-2 text-sm flex items-center justify-between gap-3">
              <div>
                ⚠️ Daily AI limit reached for{" "}
                <span className="font-semibold">{humanPlanName(plan)}</span>.
                Reset in{" "}
                <span className="font-semibold">
                  {formatDuration(quota.resetInSeconds)}
                </span>
                .
              </div>
              <div className="hidden sm:block text-xs text-amber-800">
                Upgrade to Premium for unlimited.
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <div className="mx-auto max-w-4xl px-4 py-6 space-y-6">
        {/* Upload card */}
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="font-semibold">Upload your statement</div>
              <div className="text-sm text-gray-500">
                Accepts <span className="font-medium">PDF</span> (text-based) or{" "}
                <span className="font-medium">CSV</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                ref={fileRef}
                type="file"
                accept="application/pdf,text/csv,.csv,.pdf"
                className="hidden"
                onChange={handleFileChange}
              />

              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="px-3 py-2 rounded-xl border text-[#4f772d] border-[#4f772d] hover:bg-[#eef5ea] font-semibold disabled:opacity-60"
                disabled={uploading || planLoading || lockedByPlan}
                title={
                  planLoading ? "Checking your plan..." : "Choose a PDF or CSV"
                }
              >
                {uploading ? "Uploading…" : "Choose File"}
              </button>

              {fileId && (
                <button
                  type="button"
                  onClick={clearFile}
                  className="px-3 py-2 rounded-xl border border-gray-300 text-gray-700 hover:bg-gray-50 font-semibold"
                  disabled={uploading}
                >
                  Remove
                </button>
              )}
            </div>
          </div>

          {/* progress */}
          {uploading && (
            <div className="mt-3">
              <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
                <div
                  className="h-2 bg-[#4f772d] transition-all"
                  style={{ width: `${uploadPct}%` }}
                />
              </div>
              <div className="mt-1 text-xs text-gray-500">{uploadPct}%</div>
            </div>
          )}

          {/* status */}
          {!planLoading && (
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-gray-600">
              <span
                className={`inline-flex items-center gap-1 px-2 py-1 rounded-full ${
                  fileId ? "bg-emerald-50 text-emerald-700" : "bg-gray-50"
                }`}
              >
                <Dot ok={!!fileId} />
                {fileId ? "File linked to session" : "No file yet"}
              </span>

              {/* quota chip */}
              {plan && (
                <span
                  className={[
                    "inline-flex items-center rounded-md px-2 py-1",
                    quotaActive && quota.locked
                      ? "bg-amber-50 text-amber-800"
                      : "bg-gray-50 text-gray-700",
                  ].join(" ")}
                  title="Daily quota resets every 24 hours"
                >
                  {Number.isFinite(limit) ? (
                    <>
                      {quotaActive && quota.locked ? "⚠️ " : "🧠 "}
                      AI {quota.used}/{quota.limit} • reset{" "}
                      {formatDuration(quota.resetInSeconds)}
                    </>
                  ) : (
                    <>🧠 AI unlimited</>
                  )}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Chat card */}
        <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
          <div
            ref={chatRef}
            className="relative h-[52vh] p-4 overflow-auto bg-[linear-gradient(180deg,#ffffff_0%,#fbfdf9_100%)]"
          >
            {messages.length === 0 ? (
              <div className="h-full grid place-items-center text-gray-500 text-sm text-center px-6">
                {planLoading
                  ? "Checking your plan…"
                  : quotaActive && quota.locked
                    ? `Daily AI limit reached. Resets in ${formatDuration(
                        quota.resetInSeconds,
                      )}.`
                    : "Start by uploading a file and asking a question."}
              </div>
            ) : (
              <div className="space-y-3">
                {messages.map((m, i) => (
                  <ChatBubble key={i} role={m.role} text={m.content} />
                ))}
                {thinking && <TypingBubble />}
              </div>
            )}

            {/* ✅ REMOVED: plan upgrade overlay for Standard users */}
          </div>

          {/* Composer */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (tone && input.trim() && !thinking && isEligible(plan))
                onSend();
            }}
            className="border-t bg-white/60 backdrop-blur p-3"
          >
            <div className="flex items-end gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleComposerKeyDown}
                rows={2}
                placeholder={
                  planLoading
                    ? "Checking plan…"
                    : quotaActive && quota.locked
                      ? `Daily AI limit reached. Resets in ${formatDuration(
                          quota.resetInSeconds,
                        )}.`
                      : tone
                        ? "Ask about your budget, risk, or investments… (Shift+Enter = newline)"
                        : "Pick a tone to start…"
                }
                disabled={!tone || planLoading || (quotaActive && quota.locked)}
                className="flex-1 resize-none rounded-xl border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#90a955]/40 disabled:bg-gray-50 disabled:text-gray-400"
              />
              <button
                type="submit"
                disabled={
                  !tone ||
                  !input.trim() ||
                  thinking ||
                  planLoading ||
                  (quotaActive && quota.locked)
                }
                className="px-4 py-2 rounded-xl bg-emerald-700 text-white font-semibold hover:bg-emerald-800 disabled:opacity-60"
              >
                {thinking ? "Thinking…" : "Send"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------- SMALL COMPONENTS ---------------------------- */

function ToneChip({ selected, onClick, label, big, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        "rounded-full border px-3",
        big ? "py-2 text-sm" : "py-1 text-xs",
        selected
          ? "bg-[#4f772d] text-white border-[#4f772d]"
          : "bg-white text-[#4f772d] border-[#4f772d] hover:bg-[#eef5ea]",
        "transition disabled:opacity-60 disabled:hover:bg-white",
      ].join(" ")}
    >
      {label}
    </button>
  );
}

function ChatBubble({ role, text }) {
  const isUser = role === "user";
  const isAssistant = role === "assistant";
  const base =
    "max-w-[85%] rounded-2xl px-3 py-2 shadow-sm leading-relaxed whitespace-pre-wrap";
  const cls = isUser
    ? "ml-auto bg-emerald-700 text-white"
    : isAssistant
      ? "bg-[#f3f8ef] text-gray-900 border border-[#e3f0da]"
      : "bg-gray-100 text-gray-700";

  return (
    <div className={isUser ? "text-right" : "text-left"}>
      <div className={`${base} ${cls}`}>{text}</div>
    </div>
  );
}

function Dot({ ok }) {
  return (
    <span
      className={`inline-block h-2 w-2 rounded-full ${
        ok ? "bg-emerald-600" : "bg-gray-300"
      }`}
    />
  );
}

function TypingBubble() {
  return (
    <div className="max-w-[85%] rounded-2xl px-3 py-2 shadow-sm leading-relaxed bg-[#f3f8ef] text-gray-900 border border-[#e3f0da] inline-flex items-center gap-2">
      <span
        className="inline-block h-2 w-2 rounded-full bg-emerald-600 animate-bounce"
        style={{ animationDelay: "0ms" }}
      />
      <span
        className="inline-block h-2 w-2 rounded-full bg-emerald-600 animate-bounce"
        style={{ animationDelay: "150ms" }}
      />
      <span
        className="inline-block h-2 w-2 rounded-full bg-emerald-600 animate-bounce"
        style={{ animationDelay: "300ms" }}
      />
      <span className="sr-only">Assistant is typing…</span>
    </div>
  );
}
