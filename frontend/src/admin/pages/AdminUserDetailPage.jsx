/* eslint-disable no-unused-vars */
// frontend/src/admin/pages/AdminUserDetailPage.jsx
import React, { useEffect, useMemo, useState, useRef } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import {
  adminGetUserById,
  adminDeactivateUser,
  adminReactivateUser,
  adminHardDeleteUser,
  adminResendVerification,
  adminForceLogout,
  adminSendPasswordReset,
  adminGetUserAccounts,
  adminUpdateUserSubscription,
  adminGetUserNotes,
  adminAddUserNote,
  adminUpdateUserFlags,
  adminGetUserActivity,
} from "../lib/adminApi";

/* ─── GLOBAL STYLES ─── */
const G = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Mono:wght@400;500&family=Outfit:wght@300;400;500;600;700&display=swap');

  *, *::before, *::after { box-sizing: border-box; }
  :root {
    --mint:   #00ff87;
    --cyan:   #00d4ff;
    --violet: #a78bfa;
    --red:    #f87171;
    --amber:  #fbbf24;
    --green:  #34d399;
    --bg:     #030508;
    --bdr:    rgba(255,255,255,0.07);
    --txt:    #e2e8f0;
    --muted:  rgba(226,232,240,0.45);
  }

  @keyframes shimmer {
    0%   { background-position: -400% center; }
    100% { background-position:  400% center; }
  }
  @keyframes pulse-dot {
    0%,100% { transform:scale(1);    opacity:.55; }
    50%     { transform:scale(1.65); opacity:1;   }
  }
  @keyframes spin-slow { from{transform:rotate(0deg)}   to{transform:rotate(360deg)}  }
  @keyframes spin-rev  { from{transform:rotate(0deg)}   to{transform:rotate(-360deg)} }
  @keyframes float-y   { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-9px)} }
  @keyframes float-y-slow { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-14px)} }
  @keyframes orbit-a {
    from{transform:rotate(0deg)   translateX(62px)  rotate(0deg)}
    to  {transform:rotate(360deg) translateX(62px)  rotate(-360deg)}
  }
  @keyframes orbit-b {
    from{transform:rotate(130deg)  translateX(100px) rotate(-130deg)}
    to  {transform:rotate(490deg)  translateX(100px) rotate(-490deg)}
  }
  @keyframes orbit-c {
    from{transform:rotate(255deg)  translateX(80px)  rotate(-255deg)}
    to  {transform:rotate(615deg)  translateX(80px)  rotate(-615deg)}
  }
  @keyframes orbit-sm {
    from{transform:rotate(0deg) translateX(10px) rotate(0deg)}
    to  {transform:rotate(360deg) translateX(10px) rotate(-360deg)}
  }
  @keyframes slide-up   { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:none} }
  @keyframes fade-in    { from{opacity:0} to{opacity:1} }
  @keyframes toast-in   { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:none} }
  @keyframes thinking-bar {
    0%  {transform:scaleX(0);transform-origin:left}
    50% {transform:scaleX(1);transform-origin:left}
    51% {transform:scaleX(1);transform-origin:right}
    100%{transform:scaleX(0);transform-origin:right}
  }
  @keyframes ticker-scroll { 0%{transform:translateX(0)} 100%{transform:translateX(-50%)} }

  .grad-txt {
    background:linear-gradient(90deg,#00ff87 0%,#00d4ff 33%,#a78bfa 66%,#00ff87 100%);
    background-size:400% auto;
    -webkit-background-clip:text;
    -webkit-text-fill-color:transparent;
    background-clip:text;
    animation:shimmer 6s linear infinite;
  }
  .chip-base {
    display:inline-flex;align-items:center;gap:5px;
    padding:3px 10px;border-radius:100px;
    font-size:11px;font-weight:700;letter-spacing:.04em;
    font-family:'DM Mono',monospace;
  }
  .scanlines {
    position:fixed;inset:0;z-index:9999;pointer-events:none;
    background:repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,.016) 2px,rgba(0,0,0,.016) 4px);
  }
  .cursor-glow {
    position:fixed;width:500px;height:500px;border-radius:50%;
    background:radial-gradient(circle,rgba(0,255,135,.038) 0%,transparent 65%);
    pointer-events:none;transform:translate(-50%,-50%);
    transition:left .1s ease,top .1s ease;z-index:0;
  }
  ::-webkit-scrollbar       { width:3px; }
  ::-webkit-scrollbar-track { background:#030508; }
  ::-webkit-scrollbar-thumb { background:rgba(0,255,135,.3);border-radius:2px; }

  .admin-card {
    border-radius:20px;
    border:1px solid rgba(255,255,255,.07);
    background:rgba(255,255,255,.025);
    backdrop-filter:blur(16px);
    position:relative;overflow:hidden;
    animation:slide-up .4s cubic-bezier(.22,1,.36,1) both;
  }
  .admin-card::before {
    content:'';position:absolute;top:0;left:0;right:0;height:1px;
    background:linear-gradient(to right,transparent,rgba(0,255,135,.35),rgba(0,212,255,.2),transparent);
  }
  .admin-card:hover { border-color:rgba(0,255,135,.12); }

  .tab-btn {
    padding:8px 16px;border-radius:100px;cursor:pointer;transition:all .2s;
    font-family:'DM Mono',monospace;font-size:11px;font-weight:500;
    letter-spacing:.06em;text-transform:uppercase;border:1px solid rgba(255,255,255,.08);
    background:rgba(255,255,255,.03);color:rgba(226,232,240,.5);
  }
  .tab-btn:hover { border-color:rgba(0,255,135,.2);color:rgba(0,255,135,.8); }
  .tab-btn.active {
    background:linear-gradient(135deg,rgba(0,255,135,.15),rgba(0,212,255,.08));
    border-color:rgba(0,255,135,.3);color:#00ff87;
    box-shadow:0 0 18px rgba(0,255,135,.12);
  }

  .action-btn {
    display:inline-flex;align-items:center;gap:7px;
    padding:8px 16px;border-radius:12px;cursor:pointer;transition:all .2s;
    font-family:'Outfit',sans-serif;font-size:12px;font-weight:700;
    border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.04);
    color:rgba(226,232,240,.7);
  }
  .action-btn:hover:not(:disabled) { border-color:rgba(0,255,135,.25);color:#00ff87;background:rgba(0,255,135,.06);transform:translateY(-1px); }
  .action-btn:disabled { opacity:.4;cursor:not-allowed; }

  .danger-btn {
    display:inline-flex;align-items:center;gap:7px;
    padding:8px 16px;border-radius:12px;cursor:pointer;transition:all .2s;
    font-family:'Outfit',sans-serif;font-size:12px;font-weight:700;
    border:1px solid rgba(248,113,113,.3);background:rgba(248,113,113,.07);color:#f87171;
  }
  .danger-btn:hover:not(:disabled) { border-color:rgba(248,113,113,.55);background:rgba(248,113,113,.13);transform:translateY(-1px); }
  .danger-btn:disabled { opacity:.4;cursor:not-allowed; }

  .danger-btn-hard {
    display:inline-flex;align-items:center;gap:7px;
    padding:8px 16px;border-radius:12px;cursor:pointer;transition:all .2s;
    font-family:'Outfit',sans-serif;font-size:12px;font-weight:700;
    border:1px solid rgba(248,113,113,.55);background:rgba(248,113,113,.14);color:#fca5a5;
  }
  .danger-btn-hard:hover:not(:disabled) { border-color:rgba(248,113,113,.8);background:rgba(248,113,113,.22);transform:translateY(-1px);box-shadow:0 4px 18px rgba(248,113,113,.25); }
  .danger-btn-hard:disabled { opacity:.4;cursor:not-allowed; }

  .success-btn {
    display:inline-flex;align-items:center;gap:7px;
    padding:8px 16px;border-radius:12px;cursor:pointer;transition:all .2s;
    font-family:'Outfit',sans-serif;font-size:12px;font-weight:700;
    border:1px solid rgba(52,211,153,.3);background:rgba(52,211,153,.07);color:#34d399;
  }
  .success-btn:hover:not(:disabled) { border-color:rgba(52,211,153,.55);background:rgba(52,211,153,.12);transform:translateY(-1px); }
  .success-btn:disabled { opacity:.4;cursor:not-allowed; }

  .primary-btn {
    display:inline-flex;align-items:center;gap:7px;
    padding:9px 20px;border-radius:12px;cursor:pointer;transition:all .2s;
    font-family:'Outfit',sans-serif;font-size:13px;font-weight:800;
    background:linear-gradient(135deg,#00ff87,#00d4ff);color:#020b05;border:none;
    box-shadow:0 0 24px rgba(0,255,135,.28);
  }
  .primary-btn:hover:not(:disabled) { transform:translateY(-1px);box-shadow:0 6px 32px rgba(0,255,135,.45); }
  .primary-btn:disabled { opacity:.38;cursor:not-allowed;box-shadow:none; }

  .ghost-input {
    flex:1;min-width:220px;
    padding:9px 14px;border-radius:12px;
    border:1px solid rgba(255,255,255,.09);background:rgba(255,255,255,.04);
    color:#e2e8f0;font-family:'Outfit',sans-serif;font-size:13px;font-weight:500;
    outline:none;transition:border-color .2s;
  }
  .ghost-input::placeholder { color:rgba(226,232,240,.26); }
  .ghost-input:focus { border-color:rgba(0,255,135,.3); }

  .ghost-textarea {
    width:100%;padding:10px 14px;border-radius:14px;
    border:1px solid rgba(255,255,255,.09);background:rgba(255,255,255,.04);
    color:#e2e8f0;font-family:'Outfit',sans-serif;font-size:13px;
    outline:none;resize:vertical;transition:border-color .2s;line-height:1.6;
  }
  .ghost-textarea::placeholder { color:rgba(226,232,240,.26); }
  .ghost-textarea:focus { border-color:rgba(0,255,135,.3); }

  .preset-chip {
    padding:5px 12px;border-radius:100px;cursor:pointer;transition:all .2s;
    font-family:'DM Mono',monospace;font-size:11px;font-weight:500;
    border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.03);
    color:rgba(226,232,240,.55);
  }
  .preset-chip:hover { border-color:rgba(0,255,135,.25);color:rgba(0,255,135,.8); }
  .preset-chip.on  { border-color:rgba(0,255,135,.35);background:rgba(0,255,135,.1);color:#00ff87; }

  .filter-chip {
    padding:5px 12px;border-radius:100px;cursor:pointer;transition:all .2s;
    font-family:'DM Mono',monospace;font-size:10px;font-weight:500;letter-spacing:.04em;
    border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.03);
    color:rgba(226,232,240,.5);
  }
  .filter-chip:hover { border-color:rgba(0,212,255,.3);color:#00d4ff; }
  .filter-chip.on  { border-color:rgba(0,212,255,.4);background:rgba(0,212,255,.1);color:#00d4ff; }

  .flag-tag {
    display:inline-flex;align-items:center;
    padding:4px 11px;border-radius:100px;
    font-family:'DM Mono',monospace;font-size:11px;font-weight:500;
    border:1px solid rgba(167,139,250,.3);background:rgba(167,139,250,.1);color:#a78bfa;
  }

  .ticker-wrap  { overflow:hidden;width:100%; }
  .ticker-inner { display:flex;white-space:nowrap;animation:ticker-scroll 32s linear infinite; }

  .section-label {
    font-family:'DM Mono',monospace;font-size:10px;font-weight:500;
    letter-spacing:.22em;text-transform:uppercase;color:rgba(0,255,135,.55);
    margin-bottom:14px;
  }
  .row-grid { display:grid;grid-template-columns:180px 1fr;gap:8px 16px;align-items:baseline; }
  .row-label { font-family:'DM Mono',monospace;font-size:11px;color:var(--muted); }
  .row-val   { font-size:13px;word-break:break-word;color:#e2e8f0; }

  details > summary { cursor:pointer;font-family:'DM Mono',monospace;font-size:11px;color:var(--muted);letter-spacing:.04em; }
  details[open] > summary { color:#00ff87; }

  .note-card {
    padding:14px 16px;border-radius:14px;
    border:1px solid rgba(255,255,255,.07);background:rgba(255,255,255,.025);
    animation:fade-in .3s ease both;
  }
  .activity-card {
    padding:14px 16px;border-radius:14px;
    border:1px solid rgba(255,255,255,.07);background:rgba(255,255,255,.02);
    transition:border-color .2s;animation:slide-up .3s cubic-bezier(.22,1,.36,1) both;
  }
  .activity-card:hover { border-color:rgba(0,212,255,.15); }

  .account-card {
    padding:14px 16px;border-radius:14px;
    border:1px solid rgba(255,255,255,.07);background:rgba(255,255,255,.02);
    transition:border-color .2s;
  }
  .account-card:hover { border-color:rgba(0,255,135,.15); }

  .empty-state {
    padding:32px;border-radius:18px;text-align:center;
    border:1px dashed rgba(255,255,255,.08);background:rgba(255,255,255,.02);
  }

  .divider { height:1px;background:rgba(255,255,255,.07);margin:16px 0; }
  .danger-zone {
    padding:16px;border-radius:16px;
    border:1px solid rgba(248,113,113,.18);background:rgba(248,113,113,.04);
  }
`;

/* ─── PARTICLE NET ─── */
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
    const N = 50;
    const pts = Array.from({ length: N }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      vx: (Math.random() - 0.5) * 0.2,
      vy: (Math.random() - 0.5) * 0.2,
      r: 0.6 + Math.random() * 1.2,
      col: ["#00ff87", "#00d4ff", "#ffffff"][~~(Math.random() * 3)],
      op: 0.06 + Math.random() * 0.22,
    }));
    const draw = () => {
      ctx.clearRect(0, 0, c.width, c.height);
      const { x: mx, y: my } = mouse.current;
      for (let i = 0; i < N; i++) {
        for (let j = i + 1; j < N; j++) {
          const dx = pts[i].x - pts[j].x,
            dy = pts[i].y - pts[j].y,
            d = Math.hypot(dx, dy);
          if (d < 110) {
            ctx.beginPath();
            ctx.strokeStyle = `rgba(0,255,135,${0.052 * (1 - d / 110)})`;
            ctx.lineWidth = 0.3;
            ctx.moveTo(pts[i].x, pts[i].y);
            ctx.lineTo(pts[j].x, pts[j].y);
            ctx.stroke();
          }
        }
        const mdx = pts[i].x - mx,
          mdy = pts[i].y - my,
          md = Math.hypot(mdx, mdy);
        if (md < 150) {
          ctx.beginPath();
          ctx.strokeStyle = `rgba(0,212,255,${0.11 * (1 - md / 150)})`;
          ctx.lineWidth = 0.45;
          ctx.moveTo(pts[i].x, pts[i].y);
          ctx.lineTo(mx, my);
          ctx.stroke();
          pts[i].x += (mdx / md) * 0.16;
          pts[i].y += (mdy / md) * 0.16;
        }
        ctx.beginPath();
        ctx.arc(pts[i].x, pts[i].y, pts[i].r, 0, Math.PI * 2);
        ctx.fillStyle = pts[i].col;
        ctx.globalAlpha = pts[i].op;
        ctx.shadowBlur = 5;
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

/* ─── ORBIT ─── */
function OrbitVisual({ size = 48, logoSrc }) {
  return (
    <div
      style={{ position: "relative", width: size, height: size, flexShrink: 0 }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "50%",
          border: "1px dashed rgba(0,255,135,.14)",
          animation: "spin-slow 22s linear infinite",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: size * 0.1,
          borderRadius: "50%",
          border: "1px dashed rgba(0,212,255,.09)",
          animation: "spin-rev 14s linear infinite",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          width: size * 0.5,
          height: size * 0.5,
          marginLeft: -size * 0.25,
          marginTop: -size * 0.25,
          borderRadius: "50%",
          background:
            "linear-gradient(135deg,rgba(0,255,135,.25),rgba(0,212,255,.14))",
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
              fontSize: size * 0.2,
              background: "linear-gradient(135deg,#00ff87,#00d4ff)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            A
          </span>
        )}
      </div>
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          width: size * 0.12,
          height: size * 0.12,
          marginLeft: -size * 0.06,
          marginTop: -size * 0.06,
          borderRadius: "50%",
          background: "#00ff87",
          boxShadow: "0 0 8px #00ff87",
          animation: "orbit-a 4.5s linear infinite",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          width: size * 0.09,
          height: size * 0.09,
          marginLeft: -size * 0.045,
          marginTop: -size * 0.045,
          borderRadius: "50%",
          background: "#a78bfa",
          boxShadow: "0 0 6px #a78bfa",
          animation: "orbit-c 3.8s linear infinite",
        }}
      />
    </div>
  );
}

function AvatarOrb({ name, avatarUrl, size = 42 }) {
  const initials = useMemo(() => {
    const v = (name || "").trim();
    if (!v) return "?";
    const parts = v.split(/\s+/).filter(Boolean);
    return (
      (parts[0]?.[0] || "?") +
      (parts.length > 1 ? parts[parts.length - 1][0] : "")
    ).toUpperCase();
  }, [name]);

  return (
    <div
      style={{ position: "relative", width: size, height: size, flexShrink: 0 }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "50%",
          border: "1px dashed rgba(0,255,135,.18)",
          animation: "spin-slow 18s linear infinite",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 3,
          borderRadius: "50%",
          border: "1px dashed rgba(0,212,255,.11)",
          animation: "spin-rev 11s linear infinite",
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
            width: size * 0.72,
            height: size * 0.72,
            borderRadius: "50%",
            background:
              "linear-gradient(135deg,rgba(0,255,135,.18),rgba(0,212,255,.1))",
            border: "1px solid rgba(0,255,135,.22)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
          }}
        >
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt=""
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          ) : (
            <span
              style={{
                fontFamily: "'Syne',sans-serif",
                fontWeight: 800,
                fontSize: size * 0.26,
                background: "linear-gradient(135deg,#00ff87,#00d4ff)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              {initials}
            </span>
          )}
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          width: 4,
          height: 4,
          marginLeft: -2,
          marginTop: -2,
          borderRadius: "50%",
          background: "#00ff87",
          boxShadow: "0 0 5px #00ff87",
          animation: "orbit-sm 3s linear infinite",
        }}
      />
    </div>
  );
}

/* ─── STATUS PILL ─── */
function StatusPill({ kind, children }) {
  const map = {
    admin: {
      color: "#34d399",
      bg: "rgba(52,211,153,.12)",
      bdr: "rgba(52,211,153,.28)",
    },
    user: {
      color: "rgba(226,232,240,.55)",
      bg: "rgba(255,255,255,.05)",
      bdr: "rgba(255,255,255,.1)",
    },
    active: {
      color: "#34d399",
      bg: "rgba(52,211,153,.1)",
      bdr: "rgba(52,211,153,.22)",
    },
    inactive: {
      color: "#f87171",
      bg: "rgba(248,113,113,.1)",
      bdr: "rgba(248,113,113,.25)",
    },
    verified: {
      color: "#00ff87",
      bg: "rgba(0,255,135,.08)",
      bdr: "rgba(0,255,135,.2)",
    },
    unverified: {
      color: "#fbbf24",
      bg: "rgba(251,191,36,.09)",
      bdr: "rgba(251,191,36,.25)",
    },
    flagged: {
      color: "#a78bfa",
      bg: "rgba(167,139,250,.1)",
      bdr: "rgba(167,139,250,.25)",
    },
    default: {
      color: "rgba(226,232,240,.55)",
      bg: "rgba(255,255,255,.05)",
      bdr: "rgba(255,255,255,.1)",
    },
  };
  const s = map[kind] || map.default;
  return (
    <span
      className="chip-base"
      style={{
        color: s.color,
        background: s.bg,
        border: `1px solid ${s.bdr}`,
        marginLeft: 6,
      }}
    >
      {children}
    </span>
  );
}

/* ─── SUBSCRIPTION BADGE ─── */
function SubBadge({ plan }) {
  const p = String(plan || "").toLowerCase();
  if (p === "premium")
    return (
      <span
        className="chip-base"
        style={{
          color: "#00d4ff",
          background: "rgba(0,212,255,.1)",
          border: "1px solid rgba(0,212,255,.25)",
        }}
      >
        Premium
      </span>
    );
  if (p === "plus")
    return (
      <span
        className="chip-base"
        style={{
          color: "#a78bfa",
          background: "rgba(167,139,250,.1)",
          border: "1px solid rgba(167,139,250,.25)",
        }}
      >
        Plus
      </span>
    );
  return (
    <span
      className="chip-base"
      style={{
        color: "rgba(226,232,240,.45)",
        background: "rgba(255,255,255,.04)",
        border: "1px solid rgba(255,255,255,.1)",
      }}
    >
      Standard
    </span>
  );
}

/* ─── SECTION ─── */
function Section({ label, children, delay = 0, accent = "#00ff87" }) {
  return (
    <div
      className="admin-card"
      style={{ padding: "22px 24px", animationDelay: `${delay}s` }}
    >
      <div
        style={{
          position: "absolute",
          top: -20,
          right: -20,
          width: 80,
          height: 80,
          borderRadius: "50%",
          background: `radial-gradient(circle,${accent}0a,transparent 60%)`,
          pointerEvents: "none",
          animation: "float-y 6s ease-in-out infinite",
        }}
      />
      <div className="section-label">{label}</div>
      {children}
    </div>
  );
}

function RowGrid({ children }) {
  return <div className="row-grid">{children}</div>;
}
function Row({ label, value }) {
  return (
    <>
      <div className="row-label">{label}</div>
      <div className="row-val">{value ?? "-"}</div>
    </>
  );
}
function Divider() {
  return <div className="divider" />;
}

/* ─── HELPERS ─── */
function maskId(v) {
  const s = String(v || "");
  if (s.length <= 10) return s;
  return `${s.slice(0, 4)}…${s.slice(-4)}`;
}
function formatDateTime(v) {
  if (!v) return "-";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toISOString().replace("T", " ").slice(0, 19) + "Z";
}
function timeAgo(v) {
  if (!v) return "no activity";
  const d = new Date(v);
  const t = d.getTime();
  if (Number.isNaN(t)) return "unknown";
  const diff = Date.now() - t;
  if (diff < 0) return "in the future";
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}
function parseFlagsDraft(raw) {
  return String(raw || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}
function serializeFlags(flags) {
  return (flags || []).join(", ");
}
function normalizeFlagsDraft(raw) {
  return String(raw || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => s.slice(0, 40));
}
function toggleDraftFlag(rawDraft, flag) {
  const list = parseFlagsDraft(rawDraft);
  const idx = list.findIndex(
    (x) => x.toLowerCase() === String(flag).toLowerCase(),
  );
  if (idx >= 0) list.splice(idx, 1);
  else list.push(flag);
  const seen = new Set(),
    out = [];
  for (const item of list) {
    const k = item.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(item);
  }
  return serializeFlags(out);
}

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "accounts", label: "Accounts" },
  { key: "security", label: "Security" },
  { key: "subscription", label: "Subscription" },
  { key: "activity", label: "Activity" },
];

const FLAG_PRESETS_DEF = [
  { key: "manual_review", label: "manual_review", icon: "🚨" },
  { key: "vip", label: "vip", icon: "💎" },
  { key: "refund_risk", label: "refund_risk", icon: "⚠️" },
  { key: "chargeback", label: "chargeback", icon: "🧾" },
  { key: "trusted", label: "trusted", icon: "✅" },
];

/* ════════════════════════════════════ MAIN ════════════════════════════════════ */
export default function AdminUserDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [accounts, setAccounts] = useState([]);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [toast, setToast] = useState("");
  const [actionLoading, setActionLoading] = useState({
    deactivate: false,
    reactivate: false,
    hardDelete: false,
    resendVerification: false,
    forceLogout: false,
    sendPasswordReset: false,
    updateSubscription: false,
    saveFlags: false,
    addNote: false,
    loadNotes: false,
  });
  const [notes, setNotes] = useState([]);
  const [notesErr, setNotesErr] = useState("");
  const [noteDraft, setNoteDraft] = useState("");
  const [flagsDraft, setFlagsDraft] = useState("");

  const userId = user?._id || user?.id || id;
  const email = user?.email || "";
  const isActive = user?.isActive !== false;

  const [activityItems, setActivityItems] = useState([]);
  const [activityErr, setActivityErr] = useState("");
  const [activityCursor, setActivityCursor] = useState(null);
  const [activityHasMore, setActivityHasMore] = useState(true);
  const [activityLoading, setActivityLoading] = useState(false);
  const ACTIVITY_TYPES = useMemo(
    () => [
      { key: "flags_updated", label: "Flags" },
      { key: "note_added", label: "Notes" },
      { key: "user_deactivated", label: "Deactivate" },
      { key: "user_reactivated", label: "Reactivate" },
      { key: "force_logout", label: "Force logout" },
      { key: "password_reset_sent", label: "Password reset" },
      { key: "verification_resent", label: "Verification" },
      { key: "subscription_updated", label: "Subscription" },
      { key: "admin_event", label: "Other" },
    ],
    [],
  );
  const [activitySelectedTypes, setActivitySelectedTypes] = useState([]);

  const FLAG_PRESETS = useMemo(() => FLAG_PRESETS_DEF, []);
  const draftFlagsSet = useMemo(
    () => new Set(parseFlagsDraft(flagsDraft).map((x) => x.toLowerCase())),
    [flagsDraft],
  );

  const displayName = useMemo(() => {
    if (!user) return "";
    return user.name || "(no name)";
  }, [user]);
  const providers = useMemo(() => {
    if (!user) return [];
    const p = [];
    if (user.googleId) p.push("Google");
    if (user.githubId) p.push("GitHub");
    if (user.twitterId) p.push("Twitter/X");
    if (p.length === 0) p.push("Password");
    return p;
  }, [user]);
  const avatarUrl = user?.avatarUrl || "";

  // ── effects ──
  useEffect(() => {
    if (activeTab !== "accounts" || !id) return;
    let mounted = true;
    setAccountsLoading(true);
    adminGetUserAccounts(id)
      .then((res) => {
        if (!mounted) return;
        setAccounts(res?.accounts || []);
      })
      .catch(() => {
        if (!mounted) return;
        setAccounts([]);
      })
      .finally(() => {
        if (!mounted) return;
        setAccountsLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [activeTab, id]);

  useEffect(() => {
    let mounted = true;
    async function run() {
      setLoading(true);
      setErr("");
      try {
        const data = await adminGetUserById(id);
        const u = data?.user ?? data;
        if (!mounted) return;
        setUser(u);
        setFlagsDraft((Array.isArray(u?.flags) ? u.flags : []).join(", "));
      } catch (e) {
        if (!mounted) return;
        setErr(e?.response?.data?.message || "Failed to load user.");
        setUser(null);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    run();
    return () => {
      mounted = false;
    };
  }, [id]);

  useEffect(() => {
    setActiveTab("overview");
    setAccounts([]);
    setNotes([]);
    setNotesErr("");
    setNoteDraft("");
    setActivityItems([]);
    setActivityErr("");
    setActivityCursor(null);
    setActivityHasMore(true);
    setActivitySelectedTypes([]);
  }, [id]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 1800);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (activeTab !== "overview" || !userId) return;
    let mounted = true;
    setActionLoading((s) => ({ ...s, loadNotes: true }));
    setNotesErr("");
    adminGetUserNotes(userId)
      .then((res) => {
        if (!mounted) return;
        const list = res?.notes || [];
        list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        setNotes(list);
      })
      .catch((e) => {
        if (!mounted) return;
        setNotes([]);
        setNotesErr(e?.response?.data?.message || "Failed to load notes.");
      })
      .finally(() => {
        if (!mounted) return;
        setActionLoading((s) => ({ ...s, loadNotes: false }));
      });
    return () => {
      mounted = false;
    };
  }, [activeTab, userId]);

  async function loadActivity({ reset = false } = {}) {
    if (!userId || activityLoading) return;
    try {
      setActivityLoading(true);
      setActivityErr("");
      const types =
        activitySelectedTypes.length > 0
          ? activitySelectedTypes.join(",")
          : undefined;
      const res = await adminGetUserActivity(userId, {
        limit: 50,
        cursor: reset ? null : activityCursor || undefined,
        types,
      });
      const incoming = Array.isArray(res?.items) ? res.items : [];
      const next = res?.nextCursor || null;
      if (reset) {
        setActivityItems(incoming);
      } else {
        setActivityItems((prev) => {
          const seen = new Set(
            prev.map((x) => x?._id || `${x?.ts}-${x?.title}-${x?.type}`),
          );
          const merged = [...prev];
          for (const it of incoming) {
            const k = it?._id || `${it?.ts}-${it?.title}-${it?.type}`;
            if (seen.has(k)) continue;
            merged.push(it);
          }
          return merged;
        });
      }
      setActivityCursor(next);
      setActivityHasMore(Boolean(next) && incoming.length > 0);
    } catch (e) {
      setActivityErr(e?.response?.data?.message || "Failed to load activity.");
      if (reset) setActivityItems([]);
    } finally {
      setActivityLoading(false);
    }
  }

  useEffect(() => {
    if (activeTab !== "activity" || !userId) return;
    loadActivity({ reset: true });
  }, [activeTab, userId, activitySelectedTypes.join("|")]); // eslint-disable-line

  async function copyToClipboard(value, label) {
    try {
      await navigator.clipboard.writeText(String(value || ""));
      setToast(`${label} copied`);
    } catch {
      setToast("Copy failed");
    }
  }
  async function onDeactivate() {
    if (!userId) return;
    if (
      !window.confirm(
        "Deactivate this user?\n\nThey will be prevented from using the app until reactivated.",
      )
    )
      return;
    try {
      setActionLoading((s) => ({ ...s, deactivate: true }));
      setErr("");
      const res = await adminDeactivateUser(userId);
      const upd = res?.user ?? res;
      setUser((p) => ({ ...(p || {}), ...(upd || {}), isActive: false }));
      setToast("User deactivated");
    } catch (e) {
      setErr(e?.response?.data?.message || "Failed to deactivate user.");
    } finally {
      setActionLoading((s) => ({ ...s, deactivate: false }));
    }
  }
  async function onReactivate() {
    if (!userId) return;
    if (!window.confirm("Reactivate this user?")) return;
    try {
      setActionLoading((s) => ({ ...s, reactivate: true }));
      setErr("");
      const res = await adminReactivateUser(userId);
      const upd = res?.user ?? res;
      setUser((p) => ({ ...(p || {}), ...(upd || {}), isActive: true }));
      setToast("User reactivated");
    } catch (e) {
      setErr(e?.response?.data?.message || "Failed to reactivate user.");
    } finally {
      setActionLoading((s) => ({ ...s, reactivate: false }));
    }
  }
  async function onHardDelete() {
    if (!userId) return;
    const expected = (email || "DELETE").trim();
    const typed = window.prompt(
      `Permanently delete this user?\n\nType exactly: ${expected}`,
    );
    if (!typed) return;
    if (typed.trim() !== expected) {
      setToast("Confirmation text did not match");
      return;
    }
    if (
      !window.confirm(
        "Last confirmation: This will permanently delete the user record. Continue?",
      )
    )
      return;
    try {
      setActionLoading((s) => ({ ...s, hardDelete: true }));
      setErr("");
      await adminHardDeleteUser(userId);
      setToast("User permanently deleted");
      navigate("/admin/users", { replace: true });
    } catch (e) {
      setErr(
        e?.response?.data?.message || "Failed to permanently delete user.",
      );
    } finally {
      setActionLoading((s) => ({ ...s, hardDelete: false }));
    }
  }
  async function onResendVerification() {
    if (!userId) return;
    if (!window.confirm("Resend email verification code?")) return;
    try {
      setActionLoading((s) => ({ ...s, resendVerification: true }));
      setErr("");
      await adminResendVerification(userId);
      setToast("Verification code resent");
    } catch (e) {
      setErr(
        e?.response?.data?.message || "Failed to resend verification code.",
      );
    } finally {
      setActionLoading((s) => ({ ...s, resendVerification: false }));
    }
  }
  async function onForceLogout() {
    if (!userId) return;
    if (!window.confirm("Force logout this user everywhere?")) return;
    try {
      setActionLoading((s) => ({ ...s, forceLogout: true }));
      setErr("");
      await adminForceLogout(userId);
      setToast("User logged out everywhere");
    } catch (e) {
      setErr(e?.response?.data?.message || "Failed to force logout user.");
    } finally {
      setActionLoading((s) => ({ ...s, forceLogout: false }));
    }
  }
  async function onSendPasswordReset() {
    if (!userId) return;
    if (!window.confirm("Send password reset email to this user?")) return;
    try {
      setActionLoading((s) => ({ ...s, sendPasswordReset: true }));
      setErr("");
      await adminSendPasswordReset(userId);
      setToast("Password reset email sent");
    } catch (e) {
      setErr(
        e?.response?.data?.message || "Failed to send password reset email.",
      );
    } finally {
      setActionLoading((s) => ({ ...s, sendPasswordReset: false }));
    }
  }
  async function onUpdateSubscription(nextPlan) {
    if (!userId) return;
    if (!window.confirm(`Change subscription to "${nextPlan}"?`)) return;
    try {
      setActionLoading((s) => ({ ...s, updateSubscription: true }));
      setErr("");
      const res = await adminUpdateUserSubscription(userId, nextPlan);
      const upd = res?.user ?? res;
      setUser((p) => ({
        ...(p || {}),
        ...(upd || {}),
        subscription: nextPlan,
      }));
      setToast(`Subscription updated to ${nextPlan}`);
    } catch (e) {
      setErr(e?.response?.data?.message || "Failed to update subscription.");
    } finally {
      setActionLoading((s) => ({ ...s, updateSubscription: false }));
    }
  }
  async function onSaveFlags() {
    if (!userId) return;
    const flags = normalizeFlagsDraft(flagsDraft);
    try {
      setActionLoading((s) => ({ ...s, saveFlags: true }));
      setErr("");
      const res = await adminUpdateUserFlags(userId, flags);
      const uf = Array.isArray(res?.flags) ? res.flags : [];
      setUser((p) => ({ ...(p || {}), flags: uf }));
      setFlagsDraft(uf.join(", "));
      setToast("Flags updated");
    } catch (e) {
      setErr(e?.response?.data?.message || "Failed to update flags.");
    } finally {
      setActionLoading((s) => ({ ...s, saveFlags: false }));
    }
  }
  async function onAddNote() {
    if (!userId) return;
    const text = String(noteDraft || "").trim();
    if (!text) return;
    try {
      setActionLoading((s) => ({ ...s, addNote: true }));
      setErr("");
      const res = await adminAddUserNote(userId, text);
      const list = res?.notes || [];
      list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setNotes(list);
      setNoteDraft("");
      setToast("Note added");
    } catch (e) {
      setErr(e?.response?.data?.message || "Failed to add note.");
    } finally {
      setActionLoading((s) => ({ ...s, addNote: false }));
    }
  }

  /* ── RENDER ── */
  return (
    <div
      style={{
        minHeight: "100vh",
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

      {/* ambient glows */}
      <div
        style={{
          position: "fixed",
          top: -200,
          left: "5%",
          width: 600,
          height: 450,
          borderRadius: "50%",
          background:
            "radial-gradient(ellipse,rgba(0,255,135,.035),transparent 62%)",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />
      <div
        style={{
          position: "fixed",
          bottom: -100,
          right: "3%",
          width: 480,
          height: 380,
          borderRadius: "50%",
          background:
            "radial-gradient(ellipse,rgba(167,139,250,.028),transparent 62%)",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />
      <div
        style={{
          position: "fixed",
          top: "35%",
          right: "4%",
          width: 80,
          height: 80,
          borderRadius: "50%",
          background:
            "radial-gradient(circle,rgba(0,212,255,.07),transparent 65%)",
          animation: "float-y-slow 8s ease-in-out infinite",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />
      <div
        style={{
          position: "fixed",
          top: "65%",
          left: "2%",
          width: 56,
          height: 56,
          borderRadius: "50%",
          background:
            "radial-gradient(circle,rgba(0,255,135,.06),transparent 65%)",
          animation: "float-y-slow 10s ease-in-out infinite 2s",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />

      <div
        style={{
          position: "relative",
          zIndex: 1,
          maxWidth: 1100,
          margin: "0 auto",
          padding: "28px 24px 56px",
        }}
      >
        {/* ── HEADER ── */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
            marginBottom: 24,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <Link
              to="/admin/users"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 14px",
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,.1)",
                background: "rgba(255,255,255,.04)",
                color: "rgba(226,232,240,.6)",
                textDecoration: "none",
                fontFamily: "'DM Mono',monospace",
                fontSize: 11,
                letterSpacing: ".06em",
                transition: "all .2s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "rgba(0,255,135,.25)";
                e.currentTarget.style.color = "#00ff87";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "rgba(255,255,255,.1)";
                e.currentTarget.style.color = "rgba(226,232,240,.6)";
              }}
            >
              ← BACK
            </Link>

            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <AvatarOrb name={displayName} avatarUrl={avatarUrl} size={52} />
              <div>
                <div
                  style={{
                    fontFamily: "'Syne',sans-serif",
                    fontWeight: 800,
                    fontSize: 20,
                    letterSpacing: "-.02em",
                    lineHeight: 1.1,
                  }}
                >
                  {displayName || (
                    <span style={{ opacity: 0.4 }}>(no name)</span>
                  )}
                </div>
                <div
                  style={{
                    marginTop: 5,
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "center",
                    gap: 2,
                  }}
                >
                  <span
                    style={{
                      fontFamily: "'DM Mono',monospace",
                      fontSize: 12,
                      color: "var(--muted)",
                    }}
                  >
                    {email || "—"}
                  </span>
                  {user?.role && (
                    <StatusPill kind={user.role === "admin" ? "admin" : "user"}>
                      {user.role}
                    </StatusPill>
                  )}
                  <StatusPill kind={isActive ? "active" : "inactive"}>
                    {isActive ? "active" : "inactive"}
                  </StatusPill>
                  <StatusPill
                    kind={user?.isEmailVerified ? "verified" : "unverified"}
                  >
                    {user?.isEmailVerified ? "verified" : "unverified"}
                  </StatusPill>
                  {Array.isArray(user?.flags) && user.flags.length ? (
                    <StatusPill kind="flagged">flagged</StatusPill>
                  ) : null}
                </div>
                <div
                  style={{
                    marginTop: 6,
                    fontFamily: "'DM Mono',monospace",
                    fontSize: 11,
                    color: "var(--muted)",
                    display: "flex",
                    gap: 16,
                    flexWrap: "wrap",
                  }}
                >
                  <span>
                    created{" "}
                    <strong style={{ color: "rgba(226,232,240,.7)" }}>
                      {formatDateTime(user?.createdAt)}
                    </strong>
                  </span>
                  <span>
                    last login{" "}
                    <strong style={{ color: "rgba(226,232,240,.7)" }}>
                      {formatDateTime(user?.lastLogin)}
                    </strong>{" "}
                    <span style={{ opacity: 0.6 }}>
                      ({timeAgo(user?.lastLogin)})
                    </span>
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* quick actions */}
          <div
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <button
              className="action-btn"
              onClick={() => copyToClipboard(userId, "User ID")}
              disabled={!userId}
            >
              Copy ID
            </button>
            <button
              className="action-btn"
              onClick={() => copyToClipboard(email, "Email")}
              disabled={!email}
            >
              Copy Email
            </button>
            <button
              className="action-btn"
              onClick={() => copyToClipboard(avatarUrl, "Avatar URL")}
              disabled={!avatarUrl}
            >
              Copy Avatar URL
            </button>
            <a
              href={email ? `mailto:${email}` : undefined}
              className="action-btn"
              style={{
                textDecoration: "none",
                pointerEvents: email ? "auto" : "none",
                opacity: email ? 1 : 0.5,
              }}
            >
              Email User
            </a>
          </div>
        </div>

        {/* toast */}
        {toast && (
          <div
            style={{
              position: "fixed",
              right: 20,
              bottom: 20,
              padding: "10px 18px",
              borderRadius: 14,
              border: "1px solid rgba(0,255,135,.25)",
              background: "rgba(3,5,8,.95)",
              color: "#00ff87",
              zIndex: 1000,
              fontFamily: "'DM Mono',monospace",
              fontSize: 12,
              letterSpacing: ".04em",
              boxShadow:
                "0 8px 32px rgba(0,255,135,.2),0 0 0 1px rgba(0,255,135,.1)",
              animation: "toast-in .3s ease both",
              backdropFilter: "blur(20px)",
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "#00ff87",
                boxShadow: "0 0 6px #00ff87",
                display: "inline-block",
                marginRight: 8,
                animation: "pulse-dot 1s ease-in-out infinite",
              }}
            />
            {toast}
          </div>
        )}

        {/* loading */}
        {loading && (
          <div
            style={{
              marginBottom: 16,
              padding: "12px 16px",
              borderRadius: 14,
              border: "1px solid rgba(255,255,255,.07)",
              background: "rgba(255,255,255,.02)",
              fontFamily: "'DM Mono',monospace",
              fontSize: 12,
              color: "var(--muted)",
            }}
          >
            <div
              style={{
                height: 2,
                background: "linear-gradient(90deg,#00ff87,#00d4ff,#a78bfa)",
                animation: "thinking-bar 1.6s ease-in-out infinite",
                borderRadius: 1,
                marginBottom: 10,
              }}
            />
            Loading user…
          </div>
        )}

        {/* error */}
        {err && (
          <div
            style={{
              marginBottom: 16,
              padding: "14px 16px",
              borderRadius: 14,
              border: "1px solid rgba(248,113,113,.3)",
              background: "rgba(248,113,113,.06)",
            }}
          >
            <div
              style={{
                fontFamily: "'Syne',sans-serif",
                fontWeight: 700,
                fontSize: 13,
                color: "#f87171",
                marginBottom: 4,
              }}
            >
              Error
            </div>
            <div style={{ fontSize: 13, color: "rgba(248,113,113,.8)" }}>
              {err}
            </div>
          </div>
        )}

        {!loading && user && (
          <>
            {/* ── TABS ── */}
            <div
              style={{
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
                marginBottom: 20,
              }}
            >
              {TABS.map((t) => (
                <button
                  key={t.key}
                  className={`tab-btn${activeTab === t.key ? " active" : ""}`}
                  onClick={() => setActiveTab(t.key)}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* ── TAB: OVERVIEW ── */}
            {activeTab === "overview" && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill,minmax(420px,1fr))",
                  gap: 16,
                }}
              >
                {/* User Profile */}
                <Section label="User Profile" delay={0}>
                  <RowGrid>
                    <Row
                      label="User ID"
                      value={
                        <code
                          style={{
                            fontFamily: "'DM Mono',monospace",
                            fontSize: 11,
                            color: "rgba(0,255,135,.8)",
                          }}
                        >
                          {userId}
                        </code>
                      }
                    />
                    <Row label="Name" value={user.name} />
                    <Row label="Email" value={user.email} />
                    <Row label="Role" value={user.role} />
                    <Row
                      label="Subscription"
                      value={<SubBadge plan={user.subscription} />}
                    />
                    <Row label="Profession" value={user.profession || "-"} />
                    <Row label="Timezone" value={user.tz || "-"} />
                    <Row
                      label="Base currency"
                      value={user.baseCurrency || "-"}
                    />
                  </RowGrid>
                </Section>

                {/* Flags & Notes */}
                <Section
                  label="Flags & Admin Notes"
                  delay={0.05}
                  accent="#a78bfa"
                >
                  {/* flags */}
                  <div
                    style={{
                      fontFamily: "'DM Mono',monospace",
                      fontSize: 11,
                      color: "var(--muted)",
                      marginBottom: 10,
                    }}
                  >
                    Current flags
                  </div>
                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      flexWrap: "wrap",
                      minHeight: 28,
                    }}
                  >
                    {(Array.isArray(user.flags) ? user.flags : []).length ? (
                      (user.flags || []).map((f, i) => (
                        <span key={`${f}-${i}`} className="flag-tag">
                          {f}
                        </span>
                      ))
                    ) : (
                      <span
                        style={{
                          fontSize: 12,
                          color: "var(--muted)",
                          fontFamily: "'DM Mono',monospace",
                        }}
                      >
                        no flags
                      </span>
                    )}
                  </div>

                  <div
                    style={{
                      marginTop: 12,
                      display: "flex",
                      gap: 6,
                      flexWrap: "wrap",
                    }}
                  >
                    {FLAG_PRESETS.map((p) => {
                      const on = draftFlagsSet.has(p.key.toLowerCase());
                      return (
                        <button
                          key={p.key}
                          className={`preset-chip${on ? " on" : ""}`}
                          onClick={() =>
                            setFlagsDraft((prev) =>
                              toggleDraftFlag(prev, p.label),
                            )
                          }
                        >
                          {p.icon} {p.key}
                        </button>
                      );
                    })}
                  </div>

                  <div
                    style={{
                      marginTop: 10,
                      display: "flex",
                      gap: 8,
                      flexWrap: "wrap",
                      alignItems: "center",
                    }}
                  >
                    <input
                      className="ghost-input"
                      value={flagsDraft}
                      onChange={(e) => setFlagsDraft(e.target.value)}
                      placeholder="manual_review, vip, refund_risk…"
                    />
                    <button
                      className="primary-btn"
                      onClick={onSaveFlags}
                      disabled={actionLoading.saveFlags || loading}
                      style={{ padding: "8px 16px", fontSize: 12 }}
                    >
                      {actionLoading.saveFlags ? "Saving…" : "Save Flags"}
                    </button>
                  </div>

                  <Divider />

                  {/* notes */}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 10,
                    }}
                  >
                    <div
                      style={{
                        fontFamily: "'DM Mono',monospace",
                        fontSize: 11,
                        color: "var(--muted)",
                      }}
                    >
                      Admin notes
                    </div>
                    <button
                      className="action-btn"
                      style={{ padding: "4px 10px", fontSize: 11 }}
                      onClick={() => {
                        setActiveTab("security");
                        setTimeout(() => setActiveTab("overview"), 0);
                      }}
                    >
                      Refresh
                    </button>
                  </div>

                  <textarea
                    className="ghost-textarea"
                    value={noteDraft}
                    onChange={(e) => setNoteDraft(e.target.value)}
                    rows={3}
                    placeholder="Write a note…"
                  />
                  <div
                    style={{
                      marginTop: 8,
                      display: "flex",
                      gap: 10,
                      alignItems: "center",
                    }}
                  >
                    <button
                      className="primary-btn"
                      onClick={onAddNote}
                      disabled={
                        actionLoading.addNote || loading || !noteDraft.trim()
                      }
                      style={{ padding: "8px 18px", fontSize: 12 }}
                    >
                      {actionLoading.addNote ? "Adding…" : "Add Note"}
                    </button>
                    <span
                      style={{
                        fontSize: 11,
                        color: "var(--muted)",
                        fontFamily: "'DM Mono',monospace",
                      }}
                    >
                      {noteDraft.trim().length}/1500
                    </span>
                  </div>

                  <div style={{ marginTop: 12 }}>
                    {notesErr && (
                      <div
                        style={{
                          padding: "10px 14px",
                          borderRadius: 12,
                          border: "1px solid rgba(248,113,113,.28)",
                          background: "rgba(248,113,113,.06)",
                          fontSize: 12,
                          color: "#f87171",
                        }}
                      >
                        {notesErr}
                      </div>
                    )}
                    {actionLoading.loadNotes && (
                      <div
                        style={{
                          fontSize: 12,
                          color: "var(--muted)",
                          fontFamily: "'DM Mono',monospace",
                        }}
                      >
                        Loading notes…
                      </div>
                    )}
                    {!actionLoading.loadNotes &&
                      notes.length === 0 &&
                      !notesErr && (
                        <div className="empty-state">
                          <div
                            style={{
                              fontFamily: "'Syne',sans-serif",
                              fontWeight: 700,
                              fontSize: 14,
                              marginBottom: 6,
                            }}
                          >
                            No notes yet
                          </div>
                          <div style={{ fontSize: 12, color: "var(--muted)" }}>
                            Add the first note to start building support
                            context.
                          </div>
                        </div>
                      )}
                    {notes.length > 0 && (
                      <div style={{ display: "grid", gap: 8 }}>
                        {notes.map((n, i) => (
                          <div
                            key={n._id || `${n.createdAt}-${i}`}
                            className="note-card"
                          >
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                gap: 10,
                              }}
                            >
                              <span
                                style={{
                                  fontFamily: "'DM Mono',monospace",
                                  fontSize: 11,
                                  color: "#00ff87",
                                }}
                              >
                                {n?.adminId?.email || n?.adminEmail || "admin"}
                              </span>
                              <span
                                style={{
                                  fontFamily: "'DM Mono',monospace",
                                  fontSize: 10,
                                  color: "var(--muted)",
                                }}
                              >
                                {formatDateTime(n.createdAt)}
                              </span>
                            </div>
                            <div
                              style={{
                                marginTop: 8,
                                fontSize: 13,
                                lineHeight: 1.6,
                                whiteSpace: "pre-wrap",
                                color: "rgba(226,232,240,.85)",
                              }}
                            >
                              {n.text}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </Section>

                {/* Account Health + Danger Zone */}
                <Section label="Account Health" delay={0.1} accent="#f87171">
                  <RowGrid>
                    <Row
                      label="Active"
                      value={
                        <span
                          style={{
                            color: user.isActive ? "#34d399" : "#f87171",
                          }}
                        >
                          {user.isActive ? "Yes" : "No"}
                        </span>
                      }
                    />
                    <Row
                      label="Email verified"
                      value={
                        <span
                          style={{
                            color: user.isEmailVerified ? "#34d399" : "#fbbf24",
                          }}
                        >
                          {user.isEmailVerified ? "Yes" : "No"}
                        </span>
                      }
                    />
                    <Row
                      label="Verified at"
                      value={formatDateTime(user.emailVerifiedAt)}
                    />
                    <Row label="Providers" value={providers.join(", ")} />
                    <Row
                      label="Avatar"
                      value={
                        avatarUrl ? (
                          <a
                            href={avatarUrl}
                            target="_blank"
                            rel="noreferrer"
                            style={{ color: "#00d4ff" }}
                          >
                            Open avatar
                          </a>
                        ) : (
                          "-"
                        )
                      }
                    />
                  </RowGrid>

                  <Divider />

                  <div className="danger-zone">
                    <div
                      style={{
                        fontFamily: "'DM Mono',monospace",
                        fontSize: 10,
                        letterSpacing: ".16em",
                        textTransform: "uppercase",
                        color: "rgba(248,113,113,.65)",
                        marginBottom: 12,
                      }}
                    >
                      Danger zone
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {isActive ? (
                        <button
                          className="danger-btn"
                          onClick={onDeactivate}
                          disabled={actionLoading.deactivate || loading}
                        >
                          {actionLoading.deactivate
                            ? "Deactivating…"
                            : "Deactivate"}
                        </button>
                      ) : (
                        <button
                          className="success-btn"
                          onClick={onReactivate}
                          disabled={actionLoading.reactivate || loading}
                        >
                          {actionLoading.reactivate
                            ? "Reactivating…"
                            : "Reactivate"}
                        </button>
                      )}
                      <button
                        className="danger-btn-hard"
                        onClick={onHardDelete}
                        disabled={actionLoading.hardDelete || loading}
                      >
                        {actionLoading.hardDelete ? "Deleting…" : "Hard Delete"}
                      </button>
                    </div>
                    <div
                      style={{
                        marginTop: 10,
                        fontSize: 11,
                        color: "rgba(248,113,113,.5)",
                        fontFamily: "'DM Mono',monospace",
                        lineHeight: 1.5,
                      }}
                    >
                      Hard delete is blocked server-side unless user is
                      inactive. Admin users are protected.
                    </div>
                  </div>
                </Section>

                {/* Identifiers */}
                <Section
                  label="Identifiers (debug)"
                  delay={0.15}
                  accent="#00d4ff"
                >
                  <RowGrid>
                    <Row
                      label="Google ID"
                      value={user.googleId ? maskId(user.googleId) : "-"}
                    />
                    <Row
                      label="GitHub ID"
                      value={user.githubId ? maskId(user.githubId) : "-"}
                    />
                    <Row
                      label="Twitter/X ID"
                      value={user.twitterId ? maskId(user.twitterId) : "-"}
                    />
                    <Row
                      label="Avatar version"
                      value={user.avatarVersion ?? "-"}
                    />
                  </RowGrid>
                  <Divider />
                  <details>
                    <summary>Raw user payload</summary>
                    <pre
                      style={{
                        marginTop: 10,
                        padding: "12px 14px",
                        borderRadius: 12,
                        border: "1px solid rgba(255,255,255,.07)",
                        background: "rgba(0,0,0,.35)",
                        overflowX: "auto",
                        fontSize: 11,
                        lineHeight: 1.5,
                        color: "rgba(226,232,240,.65)",
                        fontFamily: "'DM Mono',monospace",
                      }}
                    >
                      {JSON.stringify(user, null, 2)}
                    </pre>
                  </details>
                </Section>
              </div>
            )}

            {/* ── TAB: ACCOUNTS ── */}
            {activeTab === "accounts" && (
              <Section label="Financial Accounts" delay={0}>
                {accountsLoading ? (
                  <div
                    style={{
                      fontFamily: "'DM Mono',monospace",
                      fontSize: 12,
                      color: "var(--muted)",
                    }}
                  >
                    Loading accounts…
                  </div>
                ) : accounts.length === 0 ? (
                  <div className="empty-state">
                    <div
                      style={{
                        fontFamily: "'Syne',sans-serif",
                        fontWeight: 700,
                        fontSize: 14,
                        marginBottom: 6,
                      }}
                    >
                      No accounts found
                    </div>
                    <div style={{ fontSize: 12, color: "var(--muted)" }}>
                      This user has no linked accounts.
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "grid", gap: 10 }}>
                    {accounts.map((acc) => (
                      <div key={acc._id} className="account-card">
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "flex-start",
                            gap: 12,
                          }}
                        >
                          <div>
                            <div
                              style={{
                                fontFamily: "'Syne',sans-serif",
                                fontWeight: 700,
                                fontSize: 14,
                              }}
                            >
                              {acc.name}
                              <StatusPill
                                kind={acc.isDeleted ? "inactive" : "active"}
                              >
                                {acc.type}
                              </StatusPill>
                              {acc.isDeleted && (
                                <StatusPill kind="inactive">deleted</StatusPill>
                              )}
                            </div>
                            <div
                              style={{
                                marginTop: 6,
                                fontSize: 13,
                                color: "rgba(226,232,240,.8)",
                              }}
                            >
                              Balance:{" "}
                              <strong style={{ color: "#00ff87" }}>
                                {Number(acc.balance || 0).toLocaleString()}{" "}
                                {acc.currency}
                              </strong>
                            </div>
                            <div
                              style={{
                                fontSize: 12,
                                color: "var(--muted)",
                                marginTop: 3,
                              }}
                            >
                              {acc.institution || "—"}
                              {acc.last4 ? ` · ****${acc.last4}` : ""}
                            </div>
                          </div>
                          <div
                            style={{
                              fontFamily: "'DM Mono',monospace",
                              fontSize: 10,
                              color: "var(--muted)",
                              textAlign: "right",
                            }}
                          >
                            {formatDateTime(acc.createdAt)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Section>
            )}

            {/* ── TAB: SECURITY ── */}
            {activeTab === "security" && (
              <Section label="Security" delay={0}>
                <RowGrid>
                  <Row
                    label="Email verified"
                    value={
                      <span
                        style={{
                          color: user.isEmailVerified ? "#34d399" : "#fbbf24",
                        }}
                      >
                        {user.isEmailVerified ? "Yes" : "No"}
                      </span>
                    }
                  />
                  <Row
                    label="Verified at"
                    value={formatDateTime(user.emailVerifiedAt)}
                  />
                  <Row
                    label="Last login"
                    value={formatDateTime(user.lastLogin)}
                  />
                  <Row label="Providers" value={providers.join(", ")} />
                </RowGrid>
                <Divider />
                <div
                  style={{
                    fontFamily: "'DM Mono',monospace",
                    fontSize: 10,
                    letterSpacing: ".16em",
                    textTransform: "uppercase",
                    color: "rgba(226,232,240,.35)",
                    marginBottom: 12,
                  }}
                >
                  Security Actions
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {!user.isEmailVerified && (
                    <button
                      className="action-btn"
                      style={{
                        color: "#34d399",
                        borderColor: "rgba(52,211,153,.25)",
                      }}
                      onClick={onResendVerification}
                      disabled={actionLoading.resendVerification || loading}
                    >
                      {actionLoading.resendVerification
                        ? "Resending…"
                        : "Resend Verification"}
                    </button>
                  )}
                  <button
                    className="danger-btn"
                    onClick={onForceLogout}
                    disabled={actionLoading.forceLogout || loading}
                  >
                    {actionLoading.forceLogout ? "Forcing…" : "Force Logout"}
                  </button>
                  <button
                    className="action-btn"
                    style={{
                      color: "#00d4ff",
                      borderColor: "rgba(0,212,255,.25)",
                    }}
                    onClick={onSendPasswordReset}
                    disabled={actionLoading.sendPasswordReset || loading}
                  >
                    {actionLoading.sendPasswordReset
                      ? "Sending…"
                      : "Send Password Reset"}
                  </button>
                </div>
                <div
                  style={{
                    marginTop: 10,
                    fontSize: 11,
                    color: "var(--muted)",
                    fontFamily: "'DM Mono',monospace",
                    lineHeight: 1.6,
                  }}
                >
                  Use these actions only when assisting users with access or
                  security issues.
                </div>
              </Section>
            )}

            {/* ── TAB: SUBSCRIPTION ── */}
            {activeTab === "subscription" && (
              <Section label="Subscription" delay={0} accent="#a78bfa">
                <RowGrid>
                  <Row
                    label="Current plan"
                    value={<SubBadge plan={user.subscription || "Standard"} />}
                  />
                  <Row
                    label="Active user"
                    value={
                      <span
                        style={{ color: user.isActive ? "#34d399" : "#f87171" }}
                      >
                        {user.isActive ? "Yes" : "No"}
                      </span>
                    }
                  />
                </RowGrid>
                <Divider />
                <div
                  style={{
                    fontFamily: "'DM Mono',monospace",
                    fontSize: 10,
                    letterSpacing: ".16em",
                    textTransform: "uppercase",
                    color: "rgba(226,232,240,.35)",
                    marginBottom: 12,
                  }}
                >
                  Manage Plan
                </div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  {/* Standard — always "current" if on Standard */}
                  <button
                    disabled
                    className="action-btn"
                    style={{
                      opacity: user.subscription === "Standard" ? 0.7 : 1,
                      cursor: "default",
                    }}
                  >
                    Standard{" "}
                    {user.subscription === "Standard" ? "(current)" : ""}
                  </button>
                  <button
                    className="action-btn"
                    style={{
                      color: "#a78bfa",
                      borderColor: "rgba(167,139,250,.28)",
                      opacity: user.subscription === "Plus" ? 0.65 : 1,
                      cursor:
                        user.subscription === "Plus" ? "default" : "pointer",
                    }}
                    onClick={() => onUpdateSubscription("Plus")}
                    disabled={
                      loading ||
                      actionLoading.updateSubscription ||
                      user.subscription === "Plus"
                    }
                  >
                    {user.subscription === "Plus"
                      ? "Plus (current)"
                      : "Set Plus"}
                  </button>
                  <button
                    className="action-btn"
                    style={{
                      color: "#00d4ff",
                      borderColor: "rgba(0,212,255,.28)",
                      opacity: user.subscription === "Premium" ? 0.65 : 1,
                      cursor:
                        user.subscription === "Premium" ? "default" : "pointer",
                    }}
                    onClick={() => onUpdateSubscription("Premium")}
                    disabled={
                      loading ||
                      actionLoading.updateSubscription ||
                      user.subscription === "Premium"
                    }
                  >
                    {user.subscription === "Premium"
                      ? "Premium (current)"
                      : "Set Premium"}
                  </button>
                </div>
                <div
                  style={{
                    marginTop: 12,
                    fontSize: 11,
                    color: "var(--muted)",
                    fontFamily: "'DM Mono',monospace",
                    lineHeight: 1.6,
                  }}
                >
                  Subscription changes are applied immediately. Billing
                  enforcement can be layered on without changing this UI.
                </div>
              </Section>
            )}

            {/* ── TAB: ACTIVITY ── */}
            {activeTab === "activity" && (
              <Section label="Activity Timeline" delay={0} accent="#00d4ff">
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--muted)",
                    marginBottom: 14,
                    lineHeight: 1.6,
                  }}
                >
                  Audit timeline for this user. Admin + system events. Use
                  filters to narrow the feed.
                </div>

                {/* filters */}
                <div
                  style={{
                    display: "flex",
                    gap: 6,
                    flexWrap: "wrap",
                    marginBottom: 16,
                  }}
                >
                  {ACTIVITY_TYPES.map((t) => {
                    const on = activitySelectedTypes.includes(t.key);
                    return (
                      <button
                        key={t.key}
                        className={`filter-chip${on ? " on" : ""}`}
                        onClick={() => {
                          setActivityItems([]);
                          setActivityCursor(null);
                          setActivityHasMore(true);
                          setActivitySelectedTypes((prev) =>
                            prev.includes(t.key)
                              ? prev.filter((x) => x !== t.key)
                              : [...prev, t.key],
                          );
                        }}
                      >
                        {t.label}
                      </button>
                    );
                  })}
                  {activitySelectedTypes.length > 0 && (
                    <button
                      className="filter-chip"
                      onClick={() => {
                        setActivityItems([]);
                        setActivityCursor(null);
                        setActivityHasMore(true);
                        setActivitySelectedTypes([]);
                      }}
                    >
                      Clear ×
                    </button>
                  )}
                </div>

                {activityErr && (
                  <div
                    style={{
                      padding: "10px 14px",
                      borderRadius: 12,
                      border: "1px solid rgba(248,113,113,.28)",
                      background: "rgba(248,113,113,.06)",
                      fontSize: 12,
                      color: "#f87171",
                      marginBottom: 12,
                    }}
                  >
                    {activityErr}
                  </div>
                )}
                {activityLoading && activityItems.length === 0 && (
                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--muted)",
                      fontFamily: "'DM Mono',monospace",
                    }}
                  >
                    Loading activity…
                  </div>
                )}
                {!activityLoading &&
                  activityItems.length === 0 &&
                  !activityErr && (
                    <div className="empty-state">
                      <div
                        style={{
                          fontFamily: "'Syne',sans-serif",
                          fontWeight: 700,
                          fontSize: 14,
                          marginBottom: 6,
                        }}
                      >
                        No activity yet
                      </div>
                      <div style={{ fontSize: 12, color: "var(--muted)" }}>
                        Events will appear here as admins take actions and
                        system events occur.
                      </div>
                    </div>
                  )}

                {activityItems.length > 0 && (
                  <div style={{ display: "grid", gap: 8 }}>
                    {activityItems.map((ev, idx) => (
                      <div
                        key={ev._id || `${ev.ts}-${ev.title}-${idx}`}
                        className="activity-card"
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: 10,
                            alignItems: "flex-start",
                          }}
                        >
                          <div style={{ display: "grid", gap: 5 }}>
                            <div
                              style={{
                                display: "flex",
                                gap: 8,
                                flexWrap: "wrap",
                                alignItems: "center",
                              }}
                            >
                              <span
                                style={{
                                  padding: "2px 9px",
                                  borderRadius: 100,
                                  border: "1px solid rgba(0,212,255,.2)",
                                  background: "rgba(0,212,255,.07)",
                                  fontFamily: "'DM Mono',monospace",
                                  fontSize: 10,
                                  color: "#00d4ff",
                                }}
                              >
                                {ev.type || "event"}
                              </span>
                              <span
                                style={{
                                  fontFamily: "'DM Mono',monospace",
                                  fontSize: 10,
                                  color: "var(--muted)",
                                }}
                              >
                                {ev.adminEmail
                                  ? `by ${ev.adminEmail}`
                                  : "system"}
                              </span>
                            </div>
                            <div
                              style={{
                                fontFamily: "'Syne',sans-serif",
                                fontWeight: 700,
                                fontSize: 13,
                              }}
                            >
                              {ev.title || "(no title)"}
                            </div>
                            {ev.subtitle && (
                              <div
                                style={{ fontSize: 12, color: "var(--muted)" }}
                              >
                                {ev.subtitle}
                              </div>
                            )}
                          </div>
                          <div
                            style={{
                              fontFamily: "'DM Mono',monospace",
                              fontSize: 10,
                              color: "var(--muted)",
                              flexShrink: 0,
                            }}
                          >
                            {formatDateTime(ev.ts)}
                          </div>
                        </div>
                        {ev.meta && (
                          <div
                            style={{
                              marginTop: 8,
                              fontSize: 12,
                              color: "var(--muted)",
                            }}
                          >
                            {ev.meta}
                          </div>
                        )}
                        {ev.payload && Object.keys(ev.payload || {}).length ? (
                          <details style={{ marginTop: 10 }}>
                            <summary>View payload</summary>
                            <pre
                              style={{
                                marginTop: 8,
                                padding: "10px 12px",
                                borderRadius: 10,
                                border: "1px solid rgba(255,255,255,.07)",
                                background: "rgba(0,0,0,.35)",
                                overflowX: "auto",
                                fontSize: 10,
                                lineHeight: 1.5,
                                color: "rgba(226,232,240,.6)",
                                fontFamily: "'DM Mono',monospace",
                              }}
                            >
                              {JSON.stringify(ev.payload, null, 2)}
                            </pre>
                          </details>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ marginTop: 14, display: "flex", gap: 8 }}>
                  <button
                    className="action-btn"
                    onClick={() => loadActivity({ reset: true })}
                    disabled={activityLoading}
                  >
                    Refresh
                  </button>
                  <button
                    className="primary-btn"
                    onClick={() => loadActivity({ reset: false })}
                    disabled={activityLoading || !activityHasMore}
                    style={{ padding: "8px 18px", fontSize: 12 }}
                  >
                    {activityLoading
                      ? "Loading…"
                      : activityHasMore
                        ? "Load more"
                        : "No more"}
                  </button>
                </div>
              </Section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
