/* eslint-disable no-unused-vars */
// frontend/src/admin/components/AdminLayout.jsx
import React, { useEffect, useRef, useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";

/* ─── GLOBAL STYLES ─── */
const G = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Mono:wght@400;500&family=Outfit:wght@300;400;500;600;700&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --mint:   #00ff87;
    --cyan:   #00d4ff;
    --violet: #a78bfa;
    --bg:     #030508;
    --bdr:    rgba(255,255,255,0.07);
    --txt:    #e2e8f0;
    --muted:  rgba(226,232,240,0.42);
  }

  @keyframes shimmer {
    0%   { background-position: -400% center; }
    100% { background-position:  400% center; }
  }
  @keyframes pulse-dot {
    0%,100% { transform:scale(1);    opacity:.5;  }
    50%     { transform:scale(1.7);  opacity:1;   }
  }
  @keyframes spin-slow { from{transform:rotate(0deg)}   to{transform:rotate(360deg)}  }
  @keyframes spin-rev  { from{transform:rotate(0deg)}   to{transform:rotate(-360deg)} }
  @keyframes float-y   { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-9px)} }
  @keyframes float-y-slow { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-14px)} }
  @keyframes orbit-a {
    from{transform:rotate(0deg)   translateX(52px) rotate(0deg)   }
    to  {transform:rotate(360deg) translateX(52px) rotate(-360deg)}
  }
  @keyframes orbit-b {
    from{transform:rotate(120deg)  translateX(84px) rotate(-120deg) }
    to  {transform:rotate(480deg)  translateX(84px) rotate(-480deg) }
  }
  @keyframes orbit-c {
    from{transform:rotate(240deg)  translateX(68px) rotate(-240deg) }
    to  {transform:rotate(600deg)  translateX(68px) rotate(-600deg) }
  }
  @keyframes orbit-sm {
    from{transform:rotate(0deg)   translateX(9px) rotate(0deg)   }
    to  {transform:rotate(360deg) translateX(9px) rotate(-360deg)}
  }
  @keyframes slide-in-left {
    from{opacity:0;transform:translateX(-16px)}
    to  {opacity:1;transform:none}
  }
  @keyframes ticker-scroll { 0%{transform:translateX(0)} 100%{transform:translateX(-50%)} }
  @keyframes thinking-bar {
    0%  {transform:scaleX(0);transform-origin:left}
    50% {transform:scaleX(1);transform-origin:left}
    51% {transform:scaleX(1);transform-origin:right}
    100%{transform:scaleX(0);transform-origin:right}
  }

  .grad-txt {
    background:linear-gradient(90deg,#00ff87 0%,#00d4ff 40%,#a78bfa 80%,#00ff87 100%);
    background-size:400% auto;
    -webkit-background-clip:text; -webkit-text-fill-color:transparent;
    background-clip:text; animation:shimmer 6s linear infinite;
  }
  .scanlines {
    position:fixed;inset:0;z-index:9999;pointer-events:none;
    background:repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,.016) 2px,rgba(0,0,0,.016) 4px);
  }
  .cursor-glow {
    position:fixed;width:500px;height:500px;border-radius:50%;
    background:radial-gradient(circle,rgba(0,255,135,.036) 0%,transparent 65%);
    pointer-events:none;transform:translate(-50%,-50%);
    transition:left .1s ease,top .1s ease;z-index:0;
  }
  ::-webkit-scrollbar       { width:3px; }
  ::-webkit-scrollbar-track { background:#030508; }
  ::-webkit-scrollbar-thumb { background:rgba(0,255,135,.28);border-radius:2px; }

  .nav-link {
    display:flex;align-items:center;gap:11px;
    padding:10px 14px;border-radius:14px;text-decoration:none;
    font-family:'Outfit',sans-serif;font-size:13px;font-weight:600;
    color:rgba(226,232,240,.5);border:1px solid transparent;
    transition:all .2s;position:relative;overflow:hidden;
    animation:slide-in-left .35s cubic-bezier(.22,1,.36,1) both;
  }
  .nav-link::before {
    content:'';position:absolute;inset:0;border-radius:14px;
    background:rgba(0,255,135,.0);transition:background .2s;
  }
  .nav-link:hover {
    color:rgba(226,232,240,.85);border-color:rgba(0,255,135,.14);
    background:rgba(0,255,135,.05);
  }
  .nav-link.active {
    color:#00ff87;
    background:linear-gradient(135deg,rgba(0,255,135,.12),rgba(0,212,255,.06));
    border-color:rgba(0,255,135,.28);
    box-shadow:0 0 16px rgba(0,255,135,.1);
  }
  .nav-link.active::after {
    content:'';position:absolute;left:0;top:20%;bottom:20%;width:2px;
    background:linear-gradient(to bottom,transparent,#00ff87,transparent);
    border-radius:2px;
  }

  .ticker-wrap  { overflow:hidden;width:100%; }
  .ticker-inner { display:flex;white-space:nowrap;animation:ticker-scroll 28s linear infinite; }
`;

/* ─── PARTICLE NET (sidebar only — lighter) ─── */
function SideParticles() {
  const cvs = useRef(null);
  useEffect(() => {
    const c = cvs.current,
      ctx = c.getContext("2d");
    let raf;
    const fit = () => {
      c.width = c.offsetWidth;
      c.height = c.offsetHeight;
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(c.parentElement);
    const N = 22;
    const pts = Array.from({ length: N }, () => ({
      x: Math.random() * c.width,
      y: Math.random() * c.height,
      vx: (Math.random() - 0.5) * 0.18,
      vy: (Math.random() - 0.5) * 0.18,
      r: 0.5 + Math.random() * 1,
      col: ["#00ff87", "#00d4ff"][~~(Math.random() * 2)],
      op: 0.05 + Math.random() * 0.18,
    }));
    const draw = () => {
      ctx.clearRect(0, 0, c.width, c.height);
      for (let i = 0; i < N; i++) {
        for (let j = i + 1; j < N; j++) {
          const dx = pts[i].x - pts[j].x,
            dy = pts[i].y - pts[j].y,
            d = Math.hypot(dx, dy);
          if (d < 80) {
            ctx.beginPath();
            ctx.strokeStyle = `rgba(0,255,135,${0.04 * (1 - d / 80)})`;
            ctx.lineWidth = 0.28;
            ctx.moveTo(pts[i].x, pts[i].y);
            ctx.lineTo(pts[j].x, pts[j].y);
            ctx.stroke();
          }
        }
        ctx.beginPath();
        ctx.arc(pts[i].x, pts[i].y, pts[i].r, 0, Math.PI * 2);
        ctx.fillStyle = pts[i].col;
        ctx.globalAlpha = pts[i].op;
        ctx.shadowBlur = 4;
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
      ro.disconnect();
    };
  }, []);
  return (
    <canvas
      ref={cvs}
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 0,
        pointerEvents: "none",
        width: "100%",
        height: "100%",
      }}
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

/* ─── SIDEBAR ORBIT (logo area) ─── */
function SidebarOrbit({ size = 52 }) {
  return (
    <div
      style={{ position: "relative", width: size, height: size, flexShrink: 0 }}
    >
      {/* rings */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "50%",
          border: "1px dashed rgba(0,255,135,.16)",
          animation: "spin-slow 20s linear infinite",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: size * 0.1,
          borderRadius: "50%",
          border: "1px dashed rgba(0,212,255,.1)",
          animation: "spin-rev 13s linear infinite",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: size * 0.2,
          borderRadius: "50%",
          border: "1px dashed rgba(167,139,250,.07)",
          animation: "spin-slow 8s linear infinite",
        }}
      />
      {/* center */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          width: size * 0.44,
          height: size * 0.44,
          marginLeft: -size * 0.22,
          marginTop: -size * 0.22,
          borderRadius: "50%",
          background:
            "linear-gradient(135deg,rgba(0,255,135,.24),rgba(0,212,255,.14))",
          border: "1px solid rgba(0,255,135,.26)",
          boxShadow: "0 0 18px rgba(0,255,135,.28)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span
          style={{
            fontFamily: "'Syne',sans-serif",
            fontWeight: 800,
            fontSize: size * 0.18,
            background: "linear-gradient(135deg,#00ff87,#00d4ff)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          A
        </span>
      </div>
      {/* orbiting dots */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          width: size * 0.1,
          height: size * 0.1,
          marginLeft: -size * 0.05,
          marginTop: -size * 0.05,
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
          width: size * 0.07,
          height: size * 0.07,
          marginLeft: -size * 0.035,
          marginTop: -size * 0.035,
          borderRadius: "50%",
          background: "#00d4ff",
          boxShadow: "0 0 6px #00d4ff",
          animation: "orbit-b 6.5s linear infinite",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          width: size * 0.055,
          height: size * 0.055,
          marginLeft: -size * 0.0275,
          marginTop: -size * 0.0275,
          borderRadius: "50%",
          background: "#a78bfa",
          boxShadow: "0 0 5px #a78bfa",
          animation: "orbit-c 3.8s linear infinite",
        }}
      />
    </div>
  );
}

/* ─── NAV ICON SET ─── */
const NAV_ICONS = {
  users: (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
};

/* ─── FLOATING BLOB ─── */
function Blob({ top, left, right, bottom, size, color, delay = 0 }) {
  return (
    <div
      style={{
        position: "absolute",
        top,
        left,
        right,
        bottom,
        width: size,
        height: size,
        borderRadius: "50%",
        background: `radial-gradient(circle,${color},transparent 65%)`,
        animation: `float-y-slow 8s ease-in-out ${delay}s infinite`,
        pointerEvents: "none",
      }}
    />
  );
}

/* ════════════════════════════════════ LAYOUT ════════════════════════════════════ */
export default function AdminLayout() {
  const loc = useLocation();
  const isActive = (path) =>
    loc.pathname === path || loc.pathname.startsWith(path + "/");

  return (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        background: "#030508",
        color: "#e2e8f0",
        fontFamily: "'Outfit',sans-serif",
        position: "relative",
      }}
    >
      <style>{G}</style>
      <CursorGlow />
      <div className="scanlines" />

      {/* ── SIDEBAR ── */}
      <aside
        style={{
          width: 240,
          flexShrink: 0,
          borderRight: "1px solid rgba(0,255,135,.07)",
          background: "rgba(3,5,8,.85)",
          backdropFilter: "blur(24px)",
          display: "flex",
          flexDirection: "column",
          position: "sticky",
          top: 0,
          height: "100vh",
          overflowY: "auto",
          zIndex: 10,
          // inner glow on right edge
          boxShadow:
            "inset -1px 0 0 rgba(0,255,135,.05), 4px 0 24px rgba(0,0,0,.5)",
        }}
      >
        {/* sidebar particle canvas */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            overflow: "hidden",
            pointerEvents: "none",
          }}
        >
          <SideParticles />
          {/* floating blobs */}
          <Blob
            top="-60px"
            left="-40px"
            size={160}
            color="rgba(0,255,135,.04)"
            delay={0}
          />
          <Blob
            bottom="-40px"
            right="-30px"
            size={120}
            color="rgba(167,139,250,.04)"
            delay={2}
          />
        </div>

        {/* top gradient edge */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 1,
            background:
              "linear-gradient(to right,transparent,rgba(0,255,135,.35),rgba(0,212,255,.2),transparent)",
          }}
        />

        {/* LOGO */}
        <div
          style={{ padding: "22px 20px 18px", position: "relative", zIndex: 1 }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <SidebarOrbit size={48} />
            <div>
              <div
                style={{
                  fontFamily: "'Syne',sans-serif",
                  fontWeight: 800,
                  fontSize: 15,
                  letterSpacing: "-.02em",
                  lineHeight: 1,
                }}
              >
                <span className="grad-txt">Nummoria</span>
              </div>
              <div
                style={{
                  fontFamily: "'DM Mono',monospace",
                  fontSize: 9,
                  color: "rgba(226,232,240,.3)",
                  letterSpacing: ".1em",
                  marginTop: 3,
                  textTransform: "uppercase",
                }}
              >
                Admin Console
              </div>
            </div>
          </div>

          {/* divider */}
          <div
            style={{
              height: 1,
              background:
                "linear-gradient(to right,transparent,rgba(0,255,135,.1),transparent)",
              marginTop: 18,
            }}
          />
        </div>

        {/* NAV */}
        <nav
          style={{
            flex: 1,
            padding: "4px 12px",
            display: "flex",
            flexDirection: "column",
            gap: 4,
            position: "relative",
            zIndex: 1,
          }}
        >
          <div
            style={{
              fontFamily: "'DM Mono',monospace",
              fontSize: 9,
              letterSpacing: ".18em",
              textTransform: "uppercase",
              color: "rgba(226,232,240,.22)",
              padding: "4px 6px 10px",
            }}
          >
            Management
          </div>

          <Link
            to="/admin/users"
            className={`nav-link${isActive("/admin/users") ? " active" : ""}`}
            style={{ animationDelay: ".05s" }}
          >
            {NAV_ICONS.users}
            <span>Users</span>
            {isActive("/admin/users") && (
              <span
                style={{
                  marginLeft: "auto",
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: "#00ff87",
                  boxShadow: "0 0 6px #00ff87",
                  animation: "pulse-dot 2s ease-in-out infinite",
                }}
              />
            )}
          </Link>

          {/* placeholder for future nav items */}
          {/* e.g. Analytics, Settings, etc. */}
        </nav>

        {/* FOOTER */}
        <div
          style={{ padding: "14px 18px 20px", position: "relative", zIndex: 1 }}
        >
          <div
            style={{
              height: 1,
              background:
                "linear-gradient(to right,transparent,rgba(255,255,255,.06),transparent)",
              marginBottom: 14,
            }}
          />

          {/* live indicator */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 10,
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "#00ff87",
                boxShadow: "0 0 6px #00ff87",
                animation: "pulse-dot 2s ease-in-out infinite",
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontFamily: "'DM Mono',monospace",
                fontSize: 10,
                color: "rgba(226,232,240,.28)",
                letterSpacing: ".04em",
              }}
            >
              Backend-enforced RBAC
            </span>
          </div>

          <div
            style={{
              fontFamily: "'DM Mono',monospace",
              fontSize: 9,
              color: "rgba(226,232,240,.16)",
              letterSpacing: ".04em",
            }}
          >
            © {new Date().getFullYear()} Nummoria
          </div>
        </div>
      </aside>

      {/* ── MAIN ── */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
          position: "relative",
        }}
      >
        {/* ambient glows (behind main content) */}
        <div
          style={{
            position: "fixed",
            top: -200,
            left: "20%",
            width: 700,
            height: 520,
            borderRadius: "50%",
            background:
              "radial-gradient(ellipse,rgba(0,255,135,.028),transparent 62%)",
            pointerEvents: "none",
            zIndex: 0,
          }}
        />
        <div
          style={{
            position: "fixed",
            bottom: -100,
            right: "3%",
            width: 500,
            height: 400,
            borderRadius: "50%",
            background:
              "radial-gradient(ellipse,rgba(167,139,250,.022),transparent 62%)",
            pointerEvents: "none",
            zIndex: 0,
          }}
        />
        <div
          style={{
            position: "fixed",
            top: "40%",
            right: "6%",
            width: 70,
            height: 70,
            borderRadius: "50%",
            background:
              "radial-gradient(circle,rgba(0,212,255,.055),transparent 65%)",
            animation: "float-y-slow 9s ease-in-out infinite",
            pointerEvents: "none",
            zIndex: 0,
          }}
        />
        <div
          style={{
            position: "fixed",
            top: "70%",
            left: "25%",
            width: 50,
            height: 50,
            borderRadius: "50%",
            background:
              "radial-gradient(circle,rgba(0,255,135,.045),transparent 65%)",
            animation: "float-y-slow 11s ease-in-out infinite 3s",
            pointerEvents: "none",
            zIndex: 0,
          }}
        />

        <main style={{ flex: 1, position: "relative", zIndex: 1 }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
