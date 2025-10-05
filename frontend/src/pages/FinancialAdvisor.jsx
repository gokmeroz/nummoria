/* eslint-disable */
import React, { useRef, useState } from "react";
import api from "../lib/api"; // axios instance

export default function FinancialHelper() {
  const [fileId, setFileId] = useState(null);
  const [tone, setTone] = useState(localStorage.getItem("fh_tone") || "");
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const fileRef = useRef(null);

  const askToneIfNeeded = !tone;

  /* HERE CHANGED: auto-upload on file select (no button) */
  async function handleFileChange(e) {
    const f = e.target.files?.[0];
    if (!f) return;

    const fd = new FormData();
    fd.append("file", f); // backend expects 'file'

    try {
      setUploading(true);
      const { data } = await api.post(
        // NOTE: if your backend is mounted under /api, change to:
        // "/api/ai/financial-helper/ingest"
        "/ai/financial-helper/ingest",
        fd,
        {
          onUploadProgress: (evt) => {
            if (evt.total) {
              setUploadPct(Math.round((evt.loaded / evt.total) * 100));
            }
          },
        }
      );

      setFileId(data.fileId);
      setMessages((m) => [
        ...m,
        {
          role: "system",
          content: `PDF processed: ${data.totals.txCount} transactions loaded.`,
        },
      ]);
    } catch (err) {
      const data = err?.response?.data || {};
      const msg = data.error || err.message || "Upload failed";
      const details = data.details ? ` (${data.details})` : "";
      setMessages((m) => [
        ...m,
        { role: "system", content: `Upload failed: ${msg}${details}` },
      ]);
    } finally {
      setUploading(false);
      setUploadPct(0);
      // allow selecting the same file again to re-trigger onChange
      e.target.value = "";
    }
  }

  async function onSend() {
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
      const { data } = await api.post(
        // NOTE: use "/api/ai/financial-helper/chat" if backend has /api prefix
        "/ai/financial-helper/chat",
        {
          message: userMsg || `Start session. Tone: ${tonePref}`,
          tonePreference: tonePref,
          fileId,
        }
      );
      setMessages((m) => [...m, { role: "assistant", content: data.reply }]);
    } catch (err) {
      const msg = err?.response?.data?.error || err.message || "Chat failed";
      setMessages((m) => [
        ...m,
        { role: "system", content: `Chat failed: ${msg}` },
      ]);
    }
  }

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-4">
      <h1 className="text-2xl font-semibold">AI Financial Advisor</h1>

      {/* Tone selector (first-run) */}
      {askToneIfNeeded && (
        <div className="p-3 rounded-lg border">
          <p className="mb-2">How should I talk?</p>
          <div className="flex gap-2">
            <button
              className="px-3 py-1 rounded border"
              onClick={() => setTone("formal")}
            >
              Like a financial advisor?
            </button>
            <button
              className="px-3 py-1 rounded border"
              onClick={() => setTone("buddy")}
            >
              Like your buddy next door?
            </button>
          </div>
        </div>
      )}

      {/* HERE CHANGED: file input only (auto-upload onChange) */}
      <div className="flex items-center gap-3">
        <input
          type="file"
          accept="application/pdf,text/csv" // <— allow CSV too
          onChange={handleFileChange}
        />
        {uploading && (
          <span className="text-sm text-gray-600">Uploading… {uploadPct}%</span>
        )}
      </div>

      {/* Chat */}
      <div className="p-3 rounded-lg border h-[50vh] overflow-auto space-y-3 bg-white/5">
        {messages.map((m, i) => (
          <div
            key={i}
            className={m.role === "user" ? "text-right" : "text-left"}
          >
            <div
              className={`inline-block px-3 py-2 rounded-2xl ${
                m.role === "user"
                  ? "bg-emerald-700 text-white"
                  : "bg-gray-100 text-gray-900"
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <input
          className="flex-1 px-3 py-2 rounded border"
          placeholder={
            tone
              ? "Ask about your budget, risk, or investments…"
              : "Pick a tone above to start…"
          }
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={!tone}
        />
        <button
          className="px-3 py-2 rounded bg-emerald-700 text-white"
          onClick={onSend}
          disabled={!tone}
        >
          Send
        </button>
      </div>
    </div>
  );
}
