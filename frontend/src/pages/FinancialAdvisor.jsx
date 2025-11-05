/* eslint-disable */
import React, { useEffect, useMemo, useRef, useState } from "react";
import api from "../lib/api"; // axios instance

// ───────────── Plan Gate ─────────────
const ELIGIBLE_PLANS = new Set(["plus", "premium"]);
function isEligible(plan) {
  if (!plan) return false;
  return ELIGIBLE_PLANS.has(String(plan).toLowerCase());
}

export default function FinancialHelper() {
  // ----------------------------- STATE -----------------------------
  const [fileId, setFileId] = useState(null);
  const [tone, setTone] = useState(localStorage.getItem("fh_tone") || "");
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const [banner, setBanner] = useState(null); // soft in-page banner

  // NEW: show a waiting animation while the assistant is generating
  const [thinking, setThinking] = useState(false);

  // PLAN: current user's subscription (free/plus/premium)
  const [plan, setPlan] = useState(null);
  const [planLoading, setPlanLoading] = useState(true);

  const fileRef = useRef(null);
  const askToneIfNeeded = !tone;

  // Fetch plan once (adjust /me path if different in your backend)
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data } = await api.get("/me");
        if (!mounted) return;
        const p =
          data?.subscription?.toLowerCase?.() ||
          data?.plan?.toLowerCase?.() ||
          null;
        setPlan(p);
      } catch {
        setPlan(null);
      } finally {
        if (mounted) setPlanLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // local banner helper (safe even if you have a global showBanner elsewhere)
  function showBanner(msg) {
    setBanner(String(msg || ""));
    // auto-hide after 5s
    window.clearTimeout(showBanner._t);
    showBanner._t = window.setTimeout(() => setBanner(null), 5000);
  }

  // ------------------------- HANDLERS (with gate + waiting flag) -------------------------
  async function handleFileChange(e) {
    if (!isEligible(plan)) {
      showBanner(
        "Uploads require Plus or Premium. Please upgrade to continue."
      );
      // allow selecting the same file again to re-trigger onChange later
      if (e?.target) e.target.value = "";
      return;
    }

    const f = e.target.files?.[0];
    if (!f) return;

    const fd = new FormData();
    fd.append("file", f); // backend expects 'file'

    try {
      setUploading(true);
      setBanner(null);
      const { data } = await api.post("/ai/financial-helper/ingest", fd, {
        onUploadProgress: (evt) => {
          if (evt.total)
            setUploadPct(Math.round((evt.loaded / evt.total) * 100));
        },
      });

      setFileId(data.fileId || null);
      setMessages((m) => [
        ...m,
        {
          role: "system",
          content: `File processed: ${
            data?.totals?.txCount ?? 0
          } transactions loaded.`,
        },
      ]);
    } catch (err) {
      const code = err?.response?.data?.code;
      const msg = err?.response?.data?.message || "Upload failed.";
      if (code === "NO_TRANSACTIONS") {
        showBanner(msg + " Tip: Export a CSV from your bank and upload that.");
      } else if (code === "PDF_NO_TEXT") {
        showBanner(
          "This PDF is scanned/image-only. Please export a text-based PDF or CSV."
        );
      } else if (err?.response?.status === 402) {
        // if backend also enforces upgrade
        showBanner("Upgrade required to use Financial Advisor.");
      } else {
        showBanner(msg);
      }
    } finally {
      setUploading(false);
      setUploadPct(0);
      // allow selecting the same file again to re-trigger onChange
      if (e?.target) e.target.value = "";
    }
  }

  async function onSend() {
    if (!isEligible(plan)) {
      showBanner(
        "Financial Advisor is available on Plus/Premium. Please upgrade to continue."
      );
      return;
    }

    if (!input.trim() && askToneIfNeeded) {
      if (!tone) return; // pick tone first
    }

    const tonePref = tone || "formal";
    if (!tone) localStorage.setItem("fh_tone", tonePref);

    const userMsg = input.trim();
    setMessages((m) => [
      ...m,
      { role: "user", content: userMsg || `(Using tone: ${tonePref})` },
    ]);
    setInput("");

    try {
      setThinking(true); // start typing indicator
      const { data } = await api.post("/ai/financial-helper/chat", {
        message: userMsg || `Start session. Tone: ${tonePref}`,
        tonePreference: tonePref,
        fileId,
      });
      setMessages((m) => [...m, { role: "assistant", content: data.reply }]);
    } catch (err) {
      const msg =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        err.message ||
        "Chat failed";
      setMessages((m) => [
        ...m,
        { role: "system", content: `Chat failed: ${msg}` },
      ]);
    } finally {
      setThinking(false); // stop typing indicator
    }
  }

  // Enter-to-send (also keeps your onClick)
  function handleComposerKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (tone && input.trim() && isEligible(plan)) onSend();
    }
  }

  // auto-scroll chat to bottom on new message
  const chatRef = useRef(null);
  useEffect(() => {
    chatRef.current?.scrollTo({
      top: chatRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages.length, thinking]); // include thinking so the typing bubble stays in view

  // ------------------------------- UI -------------------------------
  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-[#f4f8f4] to-[#eef5ea]">
      {/* Top bar */}
      <div className="sticky top-0 z-10 border-b bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60">
        <div className="mx-auto max-w-4xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-2xl bg-[#4f772d] grid place-items-center text-white font-bold">
              ₮
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">
                AI Financial Advisor
              </h1>
              <p className="text-xs text-gray-500 -mt-0.5">
                Educational only • Not licensed financial advice
              </p>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-2">
            <span className="text-xs text-gray-500">Tone:</span>
            <ToneChip
              selected={tone === "formal"}
              onClick={() => setTone("formal")}
              label="Formal"
            />
            <ToneChip
              selected={tone === "buddy"}
              onClick={() => setTone("buddy")}
              label="Buddy"
            />
          </div>
        </div>

        {/* banner */}
        {banner ? (
          <div className="border-t bg-amber-50 text-amber-900">
            <div className="mx-auto max-w-4xl px-4 py-2 text-sm">{banner}</div>
          </div>
        ) : null}
      </div>

      <div className="mx-auto max-w-4xl px-4 py-6 space-y-6">
        {/* Tone selector (mobile & first-run) */}
        {!tone && (
          <div className="rounded-2xl border bg-white p-4 shadow-sm">
            <p className="text-sm text-gray-700 mb-3">How should I talk?</p>
            <div className="flex gap-2">
              <ToneChip
                big
                selected={tone === "formal"}
                onClick={() => setTone("formal")}
                label="Formal"
              />
              <ToneChip
                big
                selected={tone === "buddy"}
                onClick={() => setTone("buddy")}
                label="Buddy"
              />
            </div>
          </div>
        )}

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
                accept="application/pdf,text/csv,.csv"
                className="hidden"
                onChange={handleFileChange}
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="px-3 py-2 rounded-xl border text-[#4f772d] border-[#4f772d] hover:bg-[#eef5ea] font-semibold disabled:opacity-60"
                disabled={uploading || !isEligible(plan) || planLoading}
                title={
                  !isEligible(plan) && !planLoading
                    ? "Upgrade to Plus or Premium"
                    : "Choose a PDF or CSV"
                }
              >
                {uploading ? "Uploading…" : "Choose File"}
              </button>
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

          {/* file status */}
          <div className="mt-3 flex items-center gap-2 text-xs text-gray-600">
            <span
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-full ${
                fileId ? "bg-emerald-50 text-emerald-700" : "bg-gray-50"
              }`}
              title={fileId ? String(fileId) : "No file uploaded yet"}
            >
              <Dot ok={!!fileId} />
              {fileId ? "File linked to session" : "No file yet"}
            </span>
            {!planLoading && !isEligible(plan) && (
              <span className="ml-2 inline-flex items-center rounded-md bg-amber-50 text-amber-800 px-2 py-1">
                Plus/Premium required
              </span>
            )}
          </div>
        </div>

        {/* Chat card */}
        <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
          <div
            ref={chatRef}
            className="relative h-[52vh] p-4 overflow-auto bg-[linear-gradient(180deg,#ffffff_0%,#fbfdf9_100%)]"
          >
            {messages.length === 0 ? (
              <div className="h-full grid place-items-center text-gray-500 text-sm">
                {planLoading
                  ? "Checking your plan…"
                  : isEligible(plan)
                  ? "Start by uploading a file and asking a question."
                  : "Upgrade to Plus or Premium to chat with the advisor."}
              </div>
            ) : (
              <div className="space-y-3">
                {messages.map((m, i) => (
                  <ChatBubble key={i} role={m.role} text={m.content} />
                ))}
                {thinking && <TypingBubble />} {/* waiting indicator */}
              </div>
            )}

            {/* PLAN GATE OVERLAY */}
            {!planLoading && !isEligible(plan) && (
              <UpgradeOverlay plan={plan} />
            )}
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
                  !planLoading && !isEligible(plan)
                    ? "Upgrade to Plus or Premium to chat with the advisor."
                    : tone
                    ? "Ask about your budget, risk, or investments… (Shift+Enter = newline)"
                    : "Pick a tone to start…"
                }
                disabled={!tone || !isEligible(plan) || planLoading}
                className="flex-1 resize-none rounded-xl border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#90a955]/40 disabled:bg-gray-50 disabled:text-gray-400"
              />
              <button
                type="submit"
                onClick={(e) => e.currentTarget.blur()}
                disabled={
                  !tone ||
                  !input.trim() ||
                  thinking ||
                  !isEligible(plan) ||
                  planLoading
                }
                className="px-4 py-2 rounded-xl bg-emerald-700 text-white font-semibold hover:bg-emerald-800 disabled:opacity-60"
                title={
                  !isEligible(plan) && !planLoading
                    ? "Upgrade to use Financial Advisor"
                    : !tone
                    ? "Pick a tone first"
                    : thinking
                    ? "Waiting for reply…"
                    : "Send"
                }
              >
                {thinking ? "Thinking…" : "Send"}
              </button>
            </div>
            {!tone && isEligible(plan) && (
              <div className="pt-1 text-xs text-gray-500">
                Select a tone above to enable the composer.
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------- SMALL COMPONENTS ---------------------------- */

function ToneChip({ selected, onClick, label, big }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-full border px-3",
        big ? "py-2 text-sm" : "py-1 text-xs",
        selected
          ? "bg-[#4f772d] text-white border-[#4f772d]"
          : "bg-white text-[#4f772d] border-[#4f772d] hover:bg-[#eef5ea]",
        "transition",
      ].join(" ")}
    >
      {label}
    </button>
  );
}

function ChatBubble({ role, text }) {
  const isUser = role === "user";
  const isAssistant = role === "assistant";
  const isSystem = role === "system";

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

// Minimal typing indicator using Tailwind animate-bounce with staggered delays
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

// Upgrade overlay displayed when plan is not eligible
function UpgradeOverlay({ plan }) {
  return (
    <div className="absolute inset-0 bg-white/85 backdrop-blur-sm grid place-items-center p-6">
      <div className="max-w-md w-full rounded-2xl border bg-white shadow-sm p-5 text-center">
        <div className="text-2xl font-bold">Unlock AI Financial Advisor</div>
        <p className="mt-2 text-sm text-gray-600">
          Your current plan{" "}
          <span className="font-medium">({plan || "free"})</span> doesn’t
          include this feature. Upgrade to{" "}
          <span className="font-semibold">Plus</span> or{" "}
          <span className="font-semibold">Premium</span> to continue.
        </p>
        <div className="mt-4 flex items-center gap-2 justify-center">
          <a
            href="/subscriptions"
            className="rounded-xl bg-emerald-700 text-white px-4 py-2 font-semibold hover:bg-emerald-800"
          >
            See Plans
          </a>
          <a
            href="/subscriptions/purchase?plan=premium"
            className="rounded-xl border border-emerald-700 text-emerald-700 px-4 py-2 font-semibold hover:bg-emerald-50"
          >
            Go Premium
          </a>
        </div>
        <p className="mt-3 text-xs text-gray-500">
          Plus & Premium include AI insights, savings tips, and more.
        </p>
      </div>
    </div>
  );
}
