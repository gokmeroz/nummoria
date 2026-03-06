/* eslint-disable */
// frontend/src/pages/FinancialAdvisor.jsx

import React, { useEffect, useRef, useState } from "react";
import api from "../lib/api";
import logo from "../assets/nummoria_logo.png";

/* ─── GLOBAL STYLES ─── */
const G = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Mono:wght@400;500&family=Outfit:wght@300;400;500;600;700&display=swap');

  *, *::before, *::after { box-sizing: border-box; }
  :root {
    --mint:    #00ff87;
    --cyan:    #00d4ff;
    --violet:  #a78bfa;
    --bg:      #030508;
    --surface: rgba(255,255,255,0.038);
    --bdr:     rgba(255,255,255,0.07);
    --txt:     #e2e8f0;
    --muted:   rgba(226,232,240,0.48);
  }

  @keyframes shimmer {
    0%   { background-position: -400% center; }
    100% { background-position:  400% center; }
  }
  @keyframes pulse-dot {
    0%,100% { transform: scale(1);    opacity: .55; }
    50%     { transform: scale(1.65); opacity: 1;   }
  }
  @keyframes spin-slow {
    from { transform: rotate(0deg);   }
    to   { transform: rotate(360deg); }
  }
  @keyframes spin-rev {
    from { transform: rotate(0deg);    }
    to   { transform: rotate(-360deg); }
  }
  @keyframes float-y {
    0%,100% { transform: translateY(0);   }
    50%     { transform: translateY(-9px); }
  }
  @keyframes float-y-slow {
    0%,100% { transform: translateY(0);    }
    50%     { transform: translateY(-14px); }
  }

  @keyframes orbit-a {
    from { transform: rotate(0deg)   translateX(62px)  rotate(0deg);    }
    to   { transform: rotate(360deg) translateX(62px)  rotate(-360deg); }
  }
  @keyframes orbit-b {
    from { transform: rotate(130deg)  translateX(100px) rotate(-130deg); }
    to   { transform: rotate(490deg)  translateX(100px) rotate(-490deg); }
  }
  @keyframes orbit-c {
    from { transform: rotate(255deg)  translateX(80px)  rotate(-255deg); }
    to   { transform: rotate(615deg)  translateX(80px)  rotate(-615deg); }
  }
  @keyframes orbit-a-lg {
    from { transform: rotate(0deg)   translateX(88px)  rotate(0deg);    }
    to   { transform: rotate(360deg) translateX(88px)  rotate(-360deg); }
  }
  @keyframes orbit-b-lg {
    from { transform: rotate(100deg)  translateX(138px) rotate(-100deg); }
    to   { transform: rotate(460deg)  translateX(138px) rotate(-460deg); }
  }
  @keyframes orbit-c-lg {
    from { transform: rotate(220deg)  translateX(112px) rotate(-220deg); }
    to   { transform: rotate(580deg)  translateX(112px) rotate(-580deg); }
  }
  @keyframes orbit-sm {
    from { transform: rotate(0deg)   translateX(10px) rotate(0deg);    }
    to   { transform: rotate(360deg) translateX(10px) rotate(-360deg); }
  }

  @keyframes thinking-bar {
    0%   { transform: scaleX(0); transform-origin: left;  }
    50%  { transform: scaleX(1); transform-origin: left;  }
    51%  { transform: scaleX(1); transform-origin: right; }
    100% { transform: scaleX(0); transform-origin: right; }
  }
  @keyframes msg-in {
    from { opacity: 0; transform: translateY(12px); }
    to   { opacity: 1; transform: translateY(0);    }
  }
  @keyframes bounce-dot {
    0%,80%,100% { transform: translateY(0);   }
    40%         { transform: translateY(-6px); }
  }
  @keyframes ticker-scroll {
    0%   { transform: translateX(0);    }
    100% { transform: translateX(-50%); }
  }

  .grad-txt {
    background: linear-gradient(90deg, #00ff87 0%, #00d4ff 33%, #a78bfa 66%, #00ff87 100%);
    background-size: 400% auto;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    animation: shimmer 6s linear infinite;
  }
  .chip {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 4px 12px; border-radius: 100px;
    border: 1px solid rgba(0,255,135,.22); background: rgba(0,255,135,.07);
    font-size: 11px; font-weight: 700; color: #00ff87;
    letter-spacing: .04em; font-family: 'DM Mono', monospace;
  }
  .chip-amber {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 4px 12px; border-radius: 100px;
    border: 1px solid rgba(251,191,36,.3); background: rgba(251,191,36,.07);
    font-size: 11px; font-weight: 700; color: #fbbf24;
    letter-spacing: .04em; font-family: 'DM Mono', monospace;
  }
  .scanlines {
    position: fixed; inset: 0; z-index: 9999; pointer-events: none;
    background: repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,.018) 2px,rgba(0,0,0,.018) 4px);
  }
  .cursor-glow {
    position: fixed; width: 500px; height: 500px; border-radius: 50%;
    background: radial-gradient(circle, rgba(0,255,135,.042) 0%, transparent 65%);
    pointer-events: none; transform: translate(-50%,-50%);
    transition: left .1s ease, top .1s ease; z-index: 0;
  }
  ::-webkit-scrollbar       { width: 3px; }
  ::-webkit-scrollbar-track { background: #030508; }
  ::-webkit-scrollbar-thumb { background: rgba(0,255,135,.3); border-radius: 2px; }

  .msg-bubble { animation: msg-in .32s cubic-bezier(.22,1,.36,1) both; }

  .tone-btn {
    padding: 6px 16px; border-radius: 100px; cursor: pointer; transition: all .2s;
    font-family: 'DM Mono', monospace; font-size: 11px; font-weight: 500;
    letter-spacing: .04em; border: 1px solid rgba(0,255,135,.22);
  }
  .tone-btn.active   { background: linear-gradient(135deg,#00ff87,#00d4ff); color: #020b05; border-color: transparent; box-shadow: 0 0 22px rgba(0,255,135,.38); }
  .tone-btn.inactive { background: rgba(0,255,135,.05); color: rgba(0,255,135,.7); }
  .tone-btn.inactive:hover { background: rgba(0,255,135,.13); color: #00ff87; }
  .tone-btn:disabled { opacity: .4; cursor: not-allowed; }

  .upload-btn {
    display: inline-flex; align-items: center; gap: 8px;
    padding: 9px 20px; border-radius: 13px; cursor: pointer; transition: all .2s;
    font-family: 'Outfit', sans-serif; font-size: 13px; font-weight: 700;
    border: 1px solid rgba(0,255,135,.35); background: rgba(0,255,135,.08); color: #00ff87;
  }
  .upload-btn:hover:not(:disabled) { background: rgba(0,255,135,.16); transform: translateY(-1px); box-shadow: 0 6px 24px rgba(0,255,135,.22); }
  .upload-btn:disabled { opacity: .45; cursor: not-allowed; }

  .remove-btn {
    display: inline-flex; align-items: center; gap: 8px;
    padding: 9px 16px; border-radius: 13px; cursor: pointer; transition: all .2s;
    font-family: 'Outfit', sans-serif; font-size: 12px; font-weight: 600;
    border: 1px solid rgba(255,255,255,.1); background: rgba(255,255,255,.04); color: rgba(226,232,240,.5);
  }
  .remove-btn:hover:not(:disabled) { border-color: rgba(248,113,113,.3); color: #f87171; background: rgba(248,113,113,.07); }
  .remove-btn:disabled { opacity: .4; cursor: not-allowed; }

  .send-btn {
    padding: 11px 24px; border-radius: 13px; cursor: pointer; transition: all .2s;
    font-family: 'Outfit', sans-serif; font-size: 13px; font-weight: 800; flex-shrink: 0;
    background: linear-gradient(135deg,#00ff87,#00d4ff); color: #020b05; border: none;
    box-shadow: 0 0 28px rgba(0,255,135,.32);
  }
  .send-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 6px 38px rgba(0,255,135,.52); }
  .send-btn:disabled { opacity: .35; cursor: not-allowed; box-shadow: none; }

  .composer-area {
    flex: 1; resize: none; border-radius: 14px;
    border: 1px solid rgba(255,255,255,.09); background: rgba(255,255,255,.04);
    color: #e2e8f0; font-family: 'Outfit', sans-serif; font-size: 14px; line-height: 1.6;
    padding: 10px 14px; outline: none; transition: border-color .2s;
  }
  .composer-area::placeholder { color: rgba(226,232,240,.26); }
  .composer-area:focus         { border-color: rgba(0,255,135,.3); }
  .composer-area:disabled      { color: rgba(226,232,240,.26); cursor: not-allowed; }

  .ticker-wrap  { overflow: hidden; width: 100%; }
  .ticker-inner { display: flex; white-space: nowrap; animation: ticker-scroll 30s linear infinite; }
`;

/* ─── PARTICLE CANVAS ─── */
function ParticleNet() {
  const cvs = useRef(null);
  const mouse = useRef({ x: -9999, y: -9999 });
  useEffect(() => {
    const c = cvs.current,
      ctx = c.getContext("2d");
    let raf;
    const fit = () => {
      c.width = window.innerWidth;
      c.height = window.innerHeight;
    };
    fit();
    window.addEventListener("resize", fit);
    window.addEventListener("mousemove", (e) => {
      mouse.current = { x: e.clientX, y: e.clientY };
    });
    const N = 60;
    const pts = Array.from({ length: N }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      vx: (Math.random() - 0.5) * 0.22,
      vy: (Math.random() - 0.5) * 0.22,
      r: 0.7 + Math.random() * 1.3,
      col: ["#00ff87", "#00d4ff", "#ffffff"][~~(Math.random() * 3)],
      op: 0.08 + Math.random() * 0.26,
    }));
    const draw = () => {
      ctx.clearRect(0, 0, c.width, c.height);
      const { x: mx, y: my } = mouse.current;
      for (let i = 0; i < N; i++) {
        for (let j = i + 1; j < N; j++) {
          const dx = pts[i].x - pts[j].x,
            dy = pts[i].y - pts[j].y,
            d = Math.hypot(dx, dy);
          if (d < 115) {
            ctx.beginPath();
            ctx.strokeStyle = `rgba(0,255,135,${0.058 * (1 - d / 115)})`;
            ctx.lineWidth = 0.35;
            ctx.moveTo(pts[i].x, pts[i].y);
            ctx.lineTo(pts[j].x, pts[j].y);
            ctx.stroke();
          }
        }
        const mdx = pts[i].x - mx,
          mdy = pts[i].y - my,
          md = Math.hypot(mdx, mdy);
        if (md < 160) {
          ctx.beginPath();
          ctx.strokeStyle = `rgba(0,212,255,${0.13 * (1 - md / 160)})`;
          ctx.lineWidth = 0.5;
          ctx.moveTo(pts[i].x, pts[i].y);
          ctx.lineTo(mx, my);
          ctx.stroke();
          pts[i].x += (mdx / md) * 0.18;
          pts[i].y += (mdy / md) * 0.18;
        }
        ctx.beginPath();
        ctx.arc(pts[i].x, pts[i].y, pts[i].r, 0, Math.PI * 2);
        ctx.fillStyle = pts[i].col;
        ctx.globalAlpha = pts[i].op;
        ctx.shadowBlur = 6;
        ctx.shadowColor = pts[i].col;
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
        pts[i].x += pts[i].vx;
        pts[i].y += pts[i].vy;
        if (pts[i].x < 0) pts[i].x = c.width;
        if (pts[i].x > c.width) pts[i].x = 0;
        if (pts[i].y < 0) pts[i].y = c.height;
        if (pts[i].y > c.height) pts[i].y = 0;
      }
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", fit);
    };
  }, []);
  return (
    <canvas
      ref={cvs}
      style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none" }}
    />
  );
}

function CursorGlow() {
  const ref = useRef(null);
  useEffect(() => {
    const mm = (e) => {
      if (ref.current) {
        ref.current.style.left = `${e.clientX}px`;
        ref.current.style.top = `${e.clientY}px`;
      }
    };
    window.addEventListener("mousemove", mm);
    return () => window.removeEventListener("mousemove", mm);
  }, []);
  return <div ref={ref} className="cursor-glow" />;
}

/* ─── ORBIT VISUAL (header, upload corner) ─── */
function OrbitVisual({ size = 180, logoSrc }) {
  return (
    <div
      style={{ position: "relative", width: size, height: size, flexShrink: 0 }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "50%",
          border: "1px dashed rgba(0,255,135,.13)",
          animation: "spin-slow 22s linear infinite",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: size * 0.09,
          borderRadius: "50%",
          border: "1px dashed rgba(0,212,255,.09)",
          animation: "spin-rev 14s linear infinite",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: size * 0.18,
          borderRadius: "50%",
          border: "1px dashed rgba(167,139,250,.07)",
          animation: "spin-slow 9s linear infinite",
        }}
      />
      {/* center */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          width: size * 0.22,
          height: size * 0.22,
          marginLeft: -size * 0.11,
          marginTop: -size * 0.11,
          borderRadius: "50%",
          background:
            "linear-gradient(135deg,rgba(0,255,135,.28),rgba(0,212,255,.16))",
          border: "1px solid rgba(0,255,135,.28)",
          boxShadow: "0 0 22px rgba(0,255,135,.35)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        }}
      >
        {logoSrc ? (
          <img
            src={logo}
            alt="Nummoria Logo"
            className="relative h-10 w-10 object-contain transition duration-300 group-hover:scale-105"
          />
        ) : (
          <span
            style={{
              fontFamily: "'Syne',sans-serif",
              fontWeight: 800,
              fontSize: size * 0.08,
              background: "linear-gradient(135deg,#00ff87,#00d4ff)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            N
          </span>
        )}
      </div>
      {/* orbiting dots */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          width: 10,
          height: 10,
          marginLeft: -5,
          marginTop: -5,
          borderRadius: "50%",
          background: "#00ff87",
          boxShadow: "0 0 12px #00ff87",
          animation: "orbit-a 4.5s linear infinite",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          width: 7,
          height: 7,
          marginLeft: -3.5,
          marginTop: -3.5,
          borderRadius: "50%",
          background: "#00d4ff",
          boxShadow: "0 0 9px  #00d4ff",
          animation: "orbit-b 6.5s linear infinite",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          width: 5,
          height: 5,
          marginLeft: -2.5,
          marginTop: -2.5,
          borderRadius: "50%",
          background: "#a78bfa",
          boxShadow: "0 0 7px  #a78bfa",
          animation: "orbit-c 3.8s linear infinite",
        }}
      />
    </div>
  );
}

/* ─── LARGE ORBIT for empty-chat state ─── */
function OrbitVisualLarge({ logoSrc }) {
  const size = 220;
  return (
    <div
      style={{ position: "relative", width: size, height: size, flexShrink: 0 }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "50%",
          border: "1px dashed rgba(0,255,135,.12)",
          animation: "spin-slow 24s linear infinite",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: size * 0.09,
          borderRadius: "50%",
          border: "1px dashed rgba(0,212,255,.08)",
          animation: "spin-rev  16s linear infinite",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: size * 0.18,
          borderRadius: "50%",
          border: "1px dashed rgba(167,139,250,.06)",
          animation: "spin-slow 10s linear infinite",
        }}
      />
      {/* center logo */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          width: size * 0.22,
          height: size * 0.22,
          marginLeft: -size * 0.11,
          marginTop: -size * 0.11,
          borderRadius: "50%",
          background:
            "linear-gradient(135deg,rgba(0,255,135,.28),rgba(0,212,255,.16))",
          border: "1px solid rgba(0,255,135,.28)",
          boxShadow: "0 0 28px rgba(0,255,135,.4)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        }}
      >
        {logoSrc ? (
          <img
            src={logo}
            alt="Nummoria Logo"
            className="relative h-10 w-10 object-contain transition duration-300 group-hover:scale-105"
          />
        ) : (
          <span
            style={{
              fontFamily: "'Syne',sans-serif",
              fontWeight: 800,
              fontSize: 20,
              background: "linear-gradient(135deg,#00ff87,#00d4ff)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            N
          </span>
        )}
      </div>
      {/* larger-radius orbiting dots */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          width: 11,
          height: 11,
          marginLeft: -5.5,
          marginTop: -5.5,
          borderRadius: "50%",
          background: "#00ff87",
          boxShadow: "0 0 14px #00ff87",
          animation: "orbit-a-lg 5s   linear infinite",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          width: 8,
          height: 8,
          marginLeft: -4,
          marginTop: -4,
          borderRadius: "50%",
          background: "#00d4ff",
          boxShadow: "0 0 10px #00d4ff",
          animation: "orbit-b-lg 7.2s linear infinite",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          width: 6,
          height: 6,
          marginLeft: -3,
          marginTop: -3,
          borderRadius: "50%",
          background: "#a78bfa",
          boxShadow: "0 0 8px  #a78bfa",
          animation: "orbit-c-lg 4.2s linear infinite",
        }}
      />
    </div>
  );
}

/* ─── MINI AVATAR ORB for assistant messages ─── */
function AvatarOrb({ size = 28, logoSrc }) {
  return (
    <div
      style={{
        position: "relative",
        width: size,
        height: size,
        flexShrink: 0,
        marginTop: 2,
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "50%",
          border: "1px dashed rgba(0,255,135,.2)",
          animation: "spin-slow 10s linear infinite",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 3,
          borderRadius: "50%",
          border: "1px dashed rgba(0,212,255,.13)",
          animation: "spin-rev  7s  linear infinite",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: size * 0.62,
            height: size * 0.62,
            borderRadius: "50%",
            background:
              "linear-gradient(135deg,rgba(0,255,135,.25),rgba(0,212,255,.15))",
            border: "1px solid rgba(0,255,135,.25)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
          }}
        >
          {logoSrc ? (
            <img
              src={logoSrc}
              alt=""
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            <span
              style={{
                fontFamily: "'Syne',sans-serif",
                fontWeight: 800,
                fontSize: size * 0.28,
                background: "linear-gradient(135deg,#00ff87,#00d4ff)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              N
            </span>
          )}
        </div>
      </div>
      {/* tiny orbiting dot */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          width: 3,
          height: 3,
          marginLeft: -1.5,
          marginTop: -1.5,
          borderRadius: "50%",
          background: "#00ff87",
          boxShadow: "0 0 4px #00ff87",
          animation: "orbit-sm 3s linear infinite",
        }}
      />
    </div>
  );
}

/* ─── PLAN GATE / QUOTA HELPERS ─── */
function isEligible() {
  return true;
}
function toInt(v, fb = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.floor(n) : fb;
}
function formatDuration(seconds) {
  const s = Math.max(0, toInt(seconds, 0));
  const h = Math.floor(s / 3600),
    m = Math.floor((s % 3600) / 60),
    sec = s % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  if (m > 0) return `${m}m ${String(sec).padStart(2, "0")}s`;
  return `${sec}s`;
}
function humanPlanName(plan) {
  const p = String(plan || "").toLowerCase();
  return p === "premium" ? "Premium" : p === "plus" ? "Plus" : "Standard";
}
function planDailyLimit(plan) {
  const p = String(plan || "").toLowerCase();
  return p === "premium" ? Infinity : p === "plus" ? 5 : 1;
}

/* ════════════════════════════════════ MAIN ════════════════════════════════════ */
export default function FinancialAdvisor() {
  const [fileId, setFileId] = useState(null);
  const [tone, setTone] = useState(localStorage.getItem("fh_tone") || "");
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const [banner, setBanner] = useState(null);
  const [thinking, setThinking] = useState(false);
  const [plan, setPlan] = useState(null);
  const [planLoading, setPlanLoading] = useState(true);
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

  function showBanner(msg) {
    setBanner(String(msg || ""));
    window.clearTimeout(showBanner._t);
    showBanner._t = window.setTimeout(() => setBanner(null), 6500);
  }
  function quotaKeyForUser(data) {
    const id =
      data?._id ||
      data?.id ||
      data?.user?._id ||
      data?.user?.id ||
      data?.userId ||
      null;
    return id ? `fh_quota_${String(id)}` : "fh_quota_anon";
  }
  function readLocalQuota(key) {
    try {
      const obj = JSON.parse(localStorage.getItem(key) || "null");
      if (!obj || typeof obj !== "object") return null;
      const ws = toInt(obj.windowStart, 0);
      if (!ws || Date.now() - ws >= 86400000)
        return { windowStart: Date.now(), used: 0 };
      return { windowStart: ws, used: toInt(obj.used, 0) };
    } catch {
      return null;
    }
  }
  function writeLocalQuota(key, payload) {
    try {
      localStorage.setItem(key, JSON.stringify(payload));
    } catch {}
  }
  function computeQuotaSnapshot({ windowStart, used }, planValue) {
    const limit = planDailyLimit(planValue);
    if (!Number.isFinite(limit))
      return {
        used: 0,
        limit: Infinity,
        remaining: Infinity,
        resetInSeconds: 0,
        locked: false,
      };
    const ttl = Math.max(
      0,
      Math.ceil((windowStart + 86400000 - Date.now()) / 1000),
    );
    return {
      used,
      limit,
      remaining: Math.max(0, limit - used),
      resetInSeconds: ttl,
      locked: used >= limit,
    };
  }

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data } = await api.get("/me");
        if (!mounted) return;
        const p =
          data?.subscription?.toLowerCase?.() ||
          data?.plan?.toLowerCase?.() ||
          data?.user?.subscription?.toLowerCase?.() ||
          data?.user?.plan?.toLowerCase?.() ||
          null;
        setPlan(p);
        const k = quotaKeyForUser(data);
        const base = readLocalQuota(k) || { windowStart: Date.now(), used: 0 };
        if (!base.windowStart) base.windowStart = Date.now();
        writeLocalQuota(k, base);
        setQuota((q) => ({
          ...q,
          ...computeQuotaSnapshot(base, p),
          lastUpdatedAt: Date.now(),
        }));
        try {
          localStorage.setItem("fh_me_cache", JSON.stringify(data || {}));
        } catch {}
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
          next.resetInSeconds = 86400;
        }
        return next;
      });
    }, 1000);
    return () => window.clearInterval(quotaTickRef.current);
  }, [planLoading, plan]);

  useEffect(() => {
    chatRef.current?.scrollTo({
      top: chatRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages.length, thinking]);

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
          content: `File processed: ${data?.totals?.txCount ?? 0} transactions loaded.`,
        },
      ]);
      showBanner("Upload successful. File linked to your session.");
    } catch (err) {
      const code = err?.response?.data?.code;
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        "Upload failed.";
      if (err?.response?.status === 402)
        showBanner("Upgrade required to use Financial Advisor uploads.");
      else if (err?.response?.status === 413 || code === "LIMIT_FILE_SIZE")
        showBanner("File too large. Please upload a smaller PDF/CSV.");
      else if (code === "PDF_NO_TEXT")
        showBanner(
          "This PDF is scanned/image-only. Please export a text-based PDF or upload a CSV.",
        );
      else if (code === "NO_TRANSACTIONS")
        showBanner(`${msg} Tip: Export a CSV from your bank and upload that.`);
      else showBanner(msg);
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

  async function onSend() {
    if (!isEligible(plan)) return;
    const limit = planDailyLimit(plan);
    if (Number.isFinite(limit) && quota.locked) {
      showBanner(
        `AI quota reached for ${humanPlanName(plan)}. Resets in ${formatDuration(quota.resetInSeconds)}.`,
      );
      return;
    }
    const tonePref = (tone || "formal").toLowerCase();
    localStorage.setItem("fh_tone", tonePref);
    if (!tone) setTone(tonePref);
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
      if (Number.isFinite(limit)) {
        const k = (() => {
          try {
            return quotaKeyForUser(
              JSON.parse(localStorage.getItem("fh_me_cache") || "{}"),
            );
          } catch {
            return "fh_quota_anon";
          }
        })();
        const base = readLocalQuota(k) || { windowStart: Date.now(), used: 0 };
        const updated = {
          windowStart: base.windowStart || Date.now(),
          used: toInt(base.used, 0) + 1,
        };
        writeLocalQuota(k, updated);
        setQuota((q) => ({
          ...q,
          ...computeQuotaSnapshot(updated, plan),
          lastUpdatedAt: Date.now(),
        }));
      }
    } catch (err) {
      const status = err?.response?.status,
        payload = err?.response?.data || {};
      if (status === 429) {
        const resetIn =
          toInt(payload?.resetInSeconds, 0) || toInt(payload?.reset, 0);
        showBanner(
          `AI quota reached for ${humanPlanName(plan)}. Resets in ${formatDuration(resetIn)}.`,
        );
        if (Number.isFinite(limit))
          setQuota((q) => ({
            ...q,
            used: limit,
            limit,
            remaining: 0,
            locked: true,
            resetInSeconds: resetIn || q.resetInSeconds,
            lastUpdatedAt: Date.now(),
          }));
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

  const limit = planDailyLimit(plan);
  const quotaActive =
    !planLoading && isEligible(plan) && Number.isFinite(limit) && plan != null;
  const quotaText =
    !planLoading && plan
      ? !Number.isFinite(limit)
        ? `unlimited · ${humanPlanName(plan)}`
        : quota.locked
          ? `limit reached · ${formatDuration(quota.resetInSeconds)}`
          : `${quota.used}/${quota.limit} · ${quota.remaining} left · ${formatDuration(quota.resetInSeconds)}`
      : null;

  /* ── RENDER ── */
  return (
    <div
      style={{
        minHeight: "100dvh",
        background: "#030508",
        color: "#e2e8f0",
        fontFamily: "'Outfit',sans-serif",
        position: "relative",
        overflowX: "hidden",
      }}
    >
      <style>{G}</style>
      <ParticleNet />
      <CursorGlow />
      <div className="scanlines" />

      {/* ── FIXED AMBIENT GLOWS ── */}
      <div
        style={{
          position: "fixed",
          top: -220,
          left: "8%",
          width: 700,
          height: 520,
          borderRadius: "50%",
          background:
            "radial-gradient(ellipse,rgba(0,255,135,.042),transparent 62%)",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />
      <div
        style={{
          position: "fixed",
          bottom: -120,
          right: "4%",
          width: 520,
          height: 420,
          borderRadius: "50%",
          background:
            "radial-gradient(ellipse,rgba(0,212,255,.032),transparent 62%)",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />
      {/* ── FLOATING SPACE BLOBS ── */}
      <div
        style={{
          position: "fixed",
          top: "28%",
          right: "5%",
          width: 90,
          height: 90,
          borderRadius: "50%",
          background:
            "radial-gradient(circle,rgba(167,139,250,.09),transparent 65%)",
          animation: "float-y-slow 7s ease-in-out infinite",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />
      <div
        style={{
          position: "fixed",
          top: "62%",
          left: "3%",
          width: 66,
          height: 66,
          borderRadius: "50%",
          background:
            "radial-gradient(circle,rgba(0,255,135,.07),transparent 65%)",
          animation: "float-y-slow 9s ease-in-out infinite 2s",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />
      <div
        style={{
          position: "fixed",
          top: "45%",
          right: "2%",
          width: 44,
          height: 44,
          borderRadius: "50%",
          background:
            "radial-gradient(circle,rgba(0,212,255,.06),transparent 65%)",
          animation: "float-y 5s ease-in-out infinite 1s",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />

      {/* ── TOP BAR ── */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 100,
          borderBottom: "1px solid rgba(0,255,135,.08)",
          background: "rgba(3,5,8,.92)",
          backdropFilter: "blur(32px)",
        }}
      >
        <div
          style={{
            maxWidth: 920,
            margin: "0 auto",
            padding: "0 24px",
            height: 72,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
          }}
        >
          {/* Logo with mini orbit */}
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <OrbitVisual size={50} logoSrc={logo} />
            <div>
              <div
                style={{
                  fontFamily: "'Syne',sans-serif",
                  fontWeight: 800,
                  fontSize: 17,
                  letterSpacing: "-.02em",
                  lineHeight: 1,
                }}
              >
                AI Financial Advisor
              </div>
              <div
                style={{
                  fontSize: 10,
                  color: "rgba(226,232,240,.3)",
                  fontFamily: "'DM Mono',monospace",
                  letterSpacing: ".04em",
                  marginTop: 3,
                }}
              >
                educational only · not licensed advice
              </div>
            </div>
          </div>

          {/* Right controls */}
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {!planLoading && quotaText && (
              <div className={quota.locked ? "chip-amber" : "chip"}>
                <span
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: "50%",
                    background: quota.locked ? "#fbbf24" : "#00ff87",
                    animation: "pulse-dot 2s ease-in-out infinite",
                  }}
                />
                {quotaText}
              </div>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span
                style={{
                  fontSize: 10,
                  fontFamily: "'DM Mono',monospace",
                  color: "rgba(226,232,240,.28)",
                  letterSpacing: ".08em",
                  textTransform: "uppercase",
                }}
              >
                tone
              </span>
              {["formal", "buddy"].map((t) => (
                <button
                  key={t}
                  className={`tone-btn ${tone === t ? "active" : "inactive"}`}
                  onClick={() => setTone(t)}
                  disabled={planLoading}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Quota lock banner */}
        {!planLoading && quotaActive && quota.locked && (
          <div
            style={{
              borderTop: "1px solid rgba(251,191,36,.18)",
              background: "rgba(251,191,36,.05)",
              padding: "9px 24px",
            }}
          >
            <div
              style={{
                maxWidth: 920,
                margin: "0 auto",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
              }}
            >
              <span
                style={{
                  fontSize: 12,
                  color: "#fbbf24",
                  fontFamily: "'DM Mono',monospace",
                }}
              >
                ⚠ Daily AI limit reached for{" "}
                <strong>{humanPlanName(plan)}</strong> — resets in{" "}
                <strong>{formatDuration(quota.resetInSeconds)}</strong>
              </span>
              <a
                href="/subscriptions/purchase?plan=premium"
                style={{
                  fontSize: 11,
                  color: "rgba(0,255,135,.7)",
                  fontFamily: "'DM Mono',monospace",
                  textDecoration: "underline",
                  cursor: "pointer",
                }}
              >
                Upgrade to Premium →
              </a>
            </div>
          </div>
        )}

        {/* Alert banner */}
        {banner && (
          <div
            style={{
              borderTop: "1px solid rgba(251,191,36,.18)",
              background: "rgba(251,191,36,.05)",
              padding: "9px 24px",
            }}
          >
            <div
              style={{
                maxWidth: 920,
                margin: "0 auto",
                fontSize: 12,
                color: "#fcd34d",
                fontFamily: "'DM Mono',monospace",
              }}
            >
              {banner}
            </div>
          </div>
        )}

        {/* Thinking progress bar */}
        {thinking && (
          <div
            style={{
              height: 2,
              background: "rgba(255,255,255,.04)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                background: "linear-gradient(90deg,#00ff87,#00d4ff,#a78bfa)",
                animation: "thinking-bar 1.6s ease-in-out infinite",
              }}
            />
          </div>
        )}
      </header>

      {/* ── TICKER ── */}
      <div
        style={{
          borderBottom: "1px solid rgba(255,255,255,.04)",
          background: "rgba(255,255,255,.01)",
          padding: "8px 0",
          overflow: "hidden",
          position: "relative",
          zIndex: 1,
        }}
      >
        <div className="ticker-wrap">
          <div className="ticker-inner">
            {[...Array(2)].map((_, dup) => (
              <span key={dup} style={{ display: "inline-flex" }}>
                {[
                  "✦  Upload PDF or CSV",
                  "✦  AI-powered analysis",
                  "✦  Formal or buddy tone",
                  "✦  Session-based privacy",
                  "✦  Educational guidance only",
                  "✦  No data stored after session",
                ].map((t, i) => (
                  <span
                    key={i}
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      color: "rgba(226,232,240,.2)",
                      letterSpacing: ".06em",
                      padding: "0 28px",
                      whiteSpace: "nowrap",
                      fontFamily: "'DM Mono',monospace",
                    }}
                  >
                    {t}
                  </span>
                ))}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── MAIN CONTENT ── */}
      <div
        style={{
          maxWidth: 920,
          margin: "0 auto",
          padding: "28px 24px 52px",
          position: "relative",
          zIndex: 1,
        }}
      >
        {/* ── UPLOAD CARD ── */}
        <div
          style={{
            borderRadius: 26,
            border: "1px solid rgba(0,255,135,.1)",
            background: "rgba(255,255,255,.025)",
            backdropFilter: "blur(20px)",
            padding: "24px 28px",
            marginBottom: 18,
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/* shimmer top edge */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: 1,
              background:
                "linear-gradient(to right,transparent,rgba(0,255,135,.48),rgba(0,212,255,.3),transparent)",
            }}
          />
          {/* decorative orbit in corner */}
          <div
            style={{
              position: "absolute",
              top: -28,
              right: -28,
              opacity: 0.3,
              animation: "float-y 6s ease-in-out infinite",
              pointerEvents: "none",
            }}
          >
            <OrbitVisual size={100} />
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 16,
              flexWrap: "wrap",
              position: "relative",
            }}
          >
            <div>
              <div
                style={{
                  fontFamily: "'Syne',sans-serif",
                  fontWeight: 700,
                  fontSize: 15,
                  marginBottom: 5,
                }}
              >
                Upload statement
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: "var(--muted)",
                  fontFamily: "'DM Mono',monospace",
                }}
              >
                accepts <span style={{ color: "#00ff87" }}>PDF</span>{" "}
                (text-based) or <span style={{ color: "#00d4ff" }}>CSV</span>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <input
                ref={fileRef}
                type="file"
                accept="application/pdf,text/csv,.csv,.pdf"
                style={{ display: "none" }}
                onChange={handleFileChange}
              />
              <button
                className="upload-btn"
                onClick={() => fileRef.current?.click()}
                disabled={uploading || planLoading}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                {uploading ? `Uploading… ${uploadPct}%` : "Choose file"}
              </button>
              {fileId && (
                <button
                  className="remove-btn"
                  onClick={clearFile}
                  disabled={uploading}
                >
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                  </svg>
                  Remove
                </button>
              )}
            </div>
          </div>

          {uploading && (
            <div style={{ marginTop: 14 }}>
              <div
                style={{
                  height: 3,
                  borderRadius: 2,
                  background: "rgba(255,255,255,.06)",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${uploadPct}%`,
                    background: "linear-gradient(90deg,#00ff87,#00d4ff)",
                    transition: "width .2s",
                    borderRadius: 2,
                  }}
                />
              </div>
            </div>
          )}

          {!planLoading && (
            <div
              style={{
                marginTop: 14,
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                gap: 10,
              }}
            >
              <StatusPill
                active={!!fileId}
                color="#00ff87"
                label={fileId ? "file linked" : "no file"}
              />
              {plan && (
                <StatusPill
                  active={!(quotaActive && quota.locked)}
                  warning={quotaActive && quota.locked}
                  color={!Number.isFinite(limit) ? "#a78bfa" : "#00d4ff"}
                  warnColor="#fbbf24"
                  label={
                    Number.isFinite(limit)
                      ? `AI ${quota.used}/${quota.limit} · ${formatDuration(quota.resetInSeconds)}`
                      : "AI unlimited"
                  }
                />
              )}
            </div>
          )}
        </div>

        {/* ── CHAT CARD ── */}
        <div
          style={{
            borderRadius: 26,
            border: "1px solid rgba(255,255,255,.07)",
            background: "rgba(255,255,255,.02)",
            backdropFilter: "blur(20px)",
            overflow: "hidden",
            position: "relative",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: 1,
              background:
                "linear-gradient(to right,transparent,rgba(0,212,255,.3),rgba(167,139,250,.2),transparent)",
            }}
          />

          {/* Chat top bar */}
          <div
            style={{
              padding: "14px 20px",
              borderBottom: "1px solid rgba(255,255,255,.05)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: thinking ? "#00d4ff" : "#00ff87",
                  boxShadow: `0 0 8px ${thinking ? "#00d4ff" : "#00ff87"}`,
                  animation: thinking
                    ? "pulse-dot 1s ease-in-out infinite"
                    : "none",
                }}
              />
              <span
                style={{
                  fontFamily: "'DM Mono',monospace",
                  fontSize: 11,
                  color: "rgba(226,232,240,.36)",
                  letterSpacing: ".06em",
                  textTransform: "uppercase",
                }}
              >
                {thinking
                  ? "thinking…"
                  : messages.length > 0
                    ? `${messages.filter((m) => m.role !== "system").length} messages`
                    : "ready"}
              </span>
            </div>
            {messages.length > 0 && (
              <button
                onClick={() => setMessages([])}
                style={{
                  fontSize: 10,
                  fontFamily: "'DM Mono',monospace",
                  color: "rgba(226,232,240,.22)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  letterSpacing: ".04em",
                  transition: "color .2s",
                }}
                onMouseEnter={(e) => (e.target.style.color = "#f87171")}
                onMouseLeave={(e) =>
                  (e.target.style.color = "rgba(226,232,240,.22)")
                }
              >
                clear ×
              </button>
            )}
          </div>

          {/* Messages / empty state */}
          <div
            ref={chatRef}
            style={{
              height: "52vh",
              overflowY: "auto",
              padding: "24px 20px",
              display: "flex",
              flexDirection: "column",
              gap: 14,
            }}
          >
            {messages.length === 0 ? (
              /* ── EMPTY STATE ── */
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 28,
                  userSelect: "none",
                }}
              >
                {/* large orbit */}
                <div style={{ position: "relative" }}>
                  <OrbitVisualLarge logoSrc={logo} />
                  {/* floating accent blobs */}
                  <div
                    style={{
                      position: "absolute",
                      top: -18,
                      right: -18,
                      width: 34,
                      height: 34,
                      borderRadius: "50%",
                      background:
                        "radial-gradient(circle,rgba(0,255,135,.18),transparent 65%)",
                      animation: "float-y 5s ease-in-out infinite",
                      pointerEvents: "none",
                    }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      bottom: -14,
                      left: -14,
                      width: 26,
                      height: 26,
                      borderRadius: "50%",
                      background:
                        "radial-gradient(circle,rgba(0,212,255,.15),transparent 65%)",
                      animation: "float-y 7s ease-in-out infinite 1.5s",
                      pointerEvents: "none",
                    }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      top: "40%",
                      left: -28,
                      width: 16,
                      height: 16,
                      borderRadius: "50%",
                      background:
                        "radial-gradient(circle,rgba(167,139,250,.18),transparent 65%)",
                      animation: "float-y 6s ease-in-out infinite 0.8s",
                      pointerEvents: "none",
                    }}
                  />
                </div>

                <div style={{ textAlign: "center" }}>
                  <div
                    style={{
                      fontFamily: "'Syne',sans-serif",
                      fontWeight: 800,
                      fontSize: 19,
                      marginBottom: 9,
                      letterSpacing: "-.02em",
                    }}
                  >
                    {planLoading ? (
                      "Checking your plan…"
                    ) : quotaActive && quota.locked ? (
                      "Daily AI limit reached."
                    ) : (
                      <span className="grad-txt">Start a conversation</span>
                    )}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: "rgba(226,232,240,.3)",
                      fontFamily: "'DM Mono',monospace",
                      maxWidth: 280,
                      margin: "0 auto",
                      lineHeight: 1.7,
                    }}
                  >
                    {quotaActive && quota.locked
                      ? `Resets in ${formatDuration(quota.resetInSeconds)}`
                      : "Upload a file or ask any financial question"}
                  </div>
                </div>

                {/* suggestion pills */}
                {!planLoading && !quota.locked && (
                  <div
                    style={{
                      display: "flex",
                      gap: 9,
                      flexWrap: "wrap",
                      justifyContent: "center",
                      maxWidth: 400,
                    }}
                  >
                    {[
                      "Budget analysis",
                      "Risk assessment",
                      "Investment clarity",
                      "Habit cost · annual",
                    ].map((label) => (
                      <span
                        key={label}
                        style={{
                          padding: "5px 14px",
                          borderRadius: 100,
                          border: "1px solid rgba(255,255,255,.07)",
                          background: "rgba(255,255,255,.03)",
                          fontSize: 11,
                          fontFamily: "'DM Mono',monospace",
                          color: "rgba(226,232,240,.32)",
                          letterSpacing: ".03em",
                          cursor: "default",
                        }}
                      >
                        {label}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <>
                {messages.map((m, i) => (
                  <ChatBubble
                    key={i}
                    role={m.role}
                    text={m.content}
                    logoSrc={logo}
                  />
                ))}
                {thinking && <TypingBubble logoSrc={logo} />}
              </>
            )}
          </div>

          {/* Composer */}
          <div
            style={{
              padding: "14px 16px",
              borderTop: "1px solid rgba(255,255,255,.05)",
              background: "rgba(3,5,8,.65)",
              backdropFilter: "blur(16px)",
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-end", gap: 10 }}>
              <textarea
                className="composer-area"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleComposerKeyDown}
                rows={2}
                placeholder={
                  planLoading
                    ? "Checking plan…"
                    : quotaActive && quota.locked
                      ? `Quota reached — resets in ${formatDuration(quota.resetInSeconds)}`
                      : tone
                        ? "Ask about your budget, risk, or investments… (Shift+Enter for newline)"
                        : "Pick a tone above to start…"
                }
                disabled={!tone || planLoading || (quotaActive && quota.locked)}
              />
              <button
                className="send-btn"
                onClick={onSend}
                disabled={
                  !tone ||
                  !input.trim() ||
                  thinking ||
                  planLoading ||
                  (quotaActive && quota.locked)
                }
              >
                {thinking ? (
                  <span
                    style={{ display: "flex", alignItems: "center", gap: 5 }}
                  >
                    <span
                      style={{
                        width: 5,
                        height: 5,
                        borderRadius: "50%",
                        background: "#020b05",
                        animation: "pulse-dot .9s ease-in-out infinite",
                      }}
                    />
                    …
                  </span>
                ) : (
                  <span
                    style={{ display: "flex", alignItems: "center", gap: 7 }}
                  >
                    Send
                    <svg
                      width="13"
                      height="13"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <line x1="22" y1="2" x2="11" y2="13" />
                      <polygon points="22 2 15 22 11 13 2 9 22 2" />
                    </svg>
                  </span>
                )}
              </button>
            </div>
            {!tone && !planLoading && (
              <div
                style={{
                  marginTop: 7,
                  fontSize: 11,
                  color: "rgba(226,232,240,.24)",
                  fontFamily: "'DM Mono',monospace",
                }}
              >
                ↑ select a tone in the header to enable chat
              </div>
            )}
          </div>
        </div>

        {/* Disclaimer */}
        <div
          style={{
            marginTop: 22,
            textAlign: "center",
            fontSize: 11,
            color: "rgba(226,232,240,.17)",
            fontFamily: "'DM Mono',monospace",
            letterSpacing: ".04em",
          }}
        >
          AI provides educational guidance only · Not a licensed financial
          advisor · Always consult a professional
        </div>
      </div>
    </div>
  );
}

/* ── STATUS PILL ── */
function StatusPill({ active, warning, color, warnColor, label }) {
  const dot = warning
    ? warnColor || "#fbbf24"
    : active
      ? color || "#00ff87"
      : "rgba(255,255,255,.18)";
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
        padding: "4px 12px",
        borderRadius: 100,
        border: "1px solid rgba(255,255,255,.07)",
        background: "rgba(255,255,255,.03)",
        fontSize: 11,
        fontFamily: "'DM Mono',monospace",
        color: "var(--muted)",
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: dot,
          boxShadow: `0 0 6px ${dot}`,
          flexShrink: 0,
        }}
      />
      {label}
    </div>
  );
}

/* ── CHAT BUBBLE ── */
function ChatBubble({ role, text, logoSrc }) {
  if (role === "user")
    return (
      <div
        className="msg-bubble"
        style={{ display: "flex", justifyContent: "flex-end" }}
      >
        <div
          style={{
            maxWidth: "78%",
            borderRadius: "18px 18px 4px 18px",
            padding: "10px 16px",
            background:
              "linear-gradient(135deg,rgba(0,255,135,.17),rgba(0,212,255,.11))",
            border: "1px solid rgba(0,255,135,.18)",
            color: "#e2e8f0",
            fontSize: 14,
            lineHeight: 1.65,
            whiteSpace: "pre-wrap",
          }}
        >
          {text}
        </div>
      </div>
    );
  if (role === "assistant")
    return (
      <div
        className="msg-bubble"
        style={{ display: "flex", justifyContent: "flex-start", gap: 10 }}
      >
        <AvatarOrb size={28} logoSrc={logoSrc} />
        <div
          style={{
            maxWidth: "80%",
            borderRadius: "4px 18px 18px 18px",
            padding: "10px 16px",
            background: "rgba(255,255,255,.04)",
            border: "1px solid rgba(255,255,255,.08)",
            color: "#e2e8f0",
            fontSize: 14,
            lineHeight: 1.75,
            whiteSpace: "pre-wrap",
          }}
        >
          {text}
        </div>
      </div>
    );
  return (
    <div
      className="msg-bubble"
      style={{ display: "flex", justifyContent: "center" }}
    >
      <div
        style={{
          padding: "5px 14px",
          borderRadius: 100,
          border: "1px solid rgba(255,255,255,.07)",
          background: "rgba(255,255,255,.025)",
          fontSize: 11,
          color: "rgba(226,232,240,.34)",
          fontFamily: "'DM Mono',monospace",
        }}
      >
        {text}
      </div>
    </div>
  );
}

/* ── TYPING BUBBLE ── */
function TypingBubble({ logoSrc }) {
  return (
    <div style={{ display: "flex", justifyContent: "flex-start", gap: 10 }}>
      <AvatarOrb size={28} logoSrc={logoSrc} />
      <div
        style={{
          borderRadius: "4px 18px 18px 18px",
          padding: "12px 18px",
          background: "rgba(255,255,255,.04)",
          border: "1px solid rgba(255,255,255,.08)",
          display: "inline-flex",
          alignItems: "center",
          gap: 5,
        }}
      >
        {[0, 150, 300].map((delay) => (
          <span
            key={delay}
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "#00ff87",
              boxShadow: "0 0 6px rgba(0,255,135,.6)",
              display: "inline-block",
              animation: `bounce-dot 1.2s ease-in-out ${delay}ms infinite`,
            }}
          />
        ))}
        <span
          style={{
            fontSize: 11,
            color: "rgba(226,232,240,.28)",
            fontFamily: "'DM Mono',monospace",
            marginLeft: 6,
          }}
        >
          thinking
        </span>
      </div>
    </div>
  );
}
