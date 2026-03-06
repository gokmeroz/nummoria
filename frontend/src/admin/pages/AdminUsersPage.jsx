// frontend/src/admin/pages/AdminUsersPage.jsx
import React, { useEffect, useMemo, useState, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { adminSearchUsers } from "../lib/adminApi";

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
  @keyframes spin-slow  { from{transform:rotate(0deg)}   to{transform:rotate(360deg)}  }
  @keyframes spin-rev   { from{transform:rotate(0deg)}   to{transform:rotate(-360deg)} }
  @keyframes float-y    { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-9px)} }
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
  @keyframes slide-up  { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:none} }
  @keyframes row-in    { from{opacity:0;transform:translateX(-8px)} to{opacity:1;transform:none} }
  @keyframes fade-in   { from{opacity:0} to{opacity:1} }
  @keyframes toast-in  { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:none} }
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
    -webkit-background-clip:text; -webkit-text-fill-color:transparent;
    background-clip:text; animation:shimmer 6s linear infinite;
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
    border-radius:22px;
    border:1px solid rgba(255,255,255,.07);
    background:rgba(255,255,255,.025);
    backdrop-filter:blur(18px);
    position:relative;overflow:hidden;
    animation:slide-up .4s cubic-bezier(.22,1,.36,1) both;
  }
  .admin-card::before {
    content:'';position:absolute;top:0;left:0;right:0;height:1px;
    background:linear-gradient(to right,transparent,rgba(0,255,135,.38),rgba(0,212,255,.22),transparent);
  }

  .search-input {
    flex:1;padding:11px 16px 11px 42px;border-radius:14px;
    border:1px solid rgba(255,255,255,.09);background:rgba(255,255,255,.04);
    color:#e2e8f0;font-family:'Outfit',sans-serif;font-size:14px;
    outline:none;transition:border-color .2s;
  }
  .search-input::placeholder { color:rgba(226,232,240,.26); }
  .search-input:focus { border-color:rgba(0,255,135,.3);box-shadow:0 0 0 3px rgba(0,255,135,.06); }

  .action-btn {
    display:inline-flex;align-items:center;gap:7px;
    padding:9px 18px;border-radius:12px;cursor:pointer;transition:all .2s;
    font-family:'Outfit',sans-serif;font-size:13px;font-weight:700;
    border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.04);
    color:rgba(226,232,240,.7);
  }
  .action-btn:hover:not(:disabled) { border-color:rgba(0,255,135,.28);color:#00ff87;background:rgba(0,255,135,.06);transform:translateY(-1px); }
  .action-btn:disabled { opacity:.4;cursor:not-allowed; }

  .logout-btn {
    display:inline-flex;align-items:center;gap:7px;
    padding:9px 18px;border-radius:12px;cursor:pointer;transition:all .2s;
    font-family:'Outfit',sans-serif;font-size:13px;font-weight:700;
    border:1px solid rgba(248,113,113,.28);background:rgba(248,113,113,.07);color:#f87171;
  }
  .logout-btn:hover { border-color:rgba(248,113,113,.5);background:rgba(248,113,113,.13);transform:translateY(-1px); }

  .pager-btn {
    display:inline-flex;align-items:center;gap:6px;
    padding:9px 18px;border-radius:12px;cursor:pointer;transition:all .2s;
    font-family:'DM Mono',monospace;font-size:11px;font-weight:500;letter-spacing:.06em;
    border:1px solid rgba(255,255,255,.09);background:rgba(255,255,255,.03);
    color:rgba(226,232,240,.55);
  }
  .pager-btn:hover:not(:disabled) { border-color:rgba(0,255,135,.25);color:#00ff87;background:rgba(0,255,135,.05); }
  .pager-btn:disabled { opacity:.35;cursor:not-allowed; }

  .toggle-label {
    display:inline-flex;align-items:center;gap:9px;cursor:pointer;
    font-family:'DM Mono',monospace;font-size:11px;color:var(--muted);
    letter-spacing:.04em;user-select:none;
  }

  /* custom toggle switch */
  .toggle-track {
    width:34px;height:18px;border-radius:100px;
    border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.06);
    position:relative;transition:all .2s;flex-shrink:0;
  }
  .toggle-track.on { background:rgba(0,255,135,.2);border-color:rgba(0,255,135,.35); }
  .toggle-thumb {
    position:absolute;top:2px;left:2px;width:12px;height:12px;border-radius:50%;
    background:rgba(226,232,240,.4);transition:all .2s;
  }
  .toggle-track.on .toggle-thumb { left:18px;background:#00ff87;box-shadow:0 0 6px rgba(0,255,135,.7); }

  /* user row */
  .user-row {
    display:grid;
    grid-template-columns: 200px 220px 80px 110px 90px 70px 120px 120px 40px;
    gap:0;align-items:center;
    border-bottom:1px solid rgba(255,255,255,.05);
    transition:background .15s;
    animation:row-in .3s cubic-bezier(.22,1,.36,1) both;
  }
  .user-row:hover { background:rgba(0,255,135,.03); }
  .user-row:last-child { border-bottom:none; }

  .th-cell {
    padding:10px 14px;
    font-family:'DM Mono',monospace;font-size:10px;font-weight:500;
    letter-spacing:.12em;text-transform:uppercase;color:rgba(226,232,240,.32);
    white-space:nowrap;
  }
  .td-cell {
    padding:12px 14px;
    font-size:13px;color:rgba(226,232,240,.75);
    white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
  }

  .user-link {
    font-family:'Outfit',sans-serif;font-weight:700;font-size:13px;
    color:#e2e8f0;text-decoration:none;transition:color .15s;
  }
  .user-link:hover { color:#00ff87; }

  .chip-xs {
    display:inline-flex;align-items:center;
    padding:2px 8px;border-radius:100px;
    font-family:'DM Mono',monospace;font-size:10px;font-weight:500;
  }

  .ticker-wrap  { overflow:hidden;width:100%; }
  .ticker-inner { display:flex;white-space:nowrap;animation:ticker-scroll 32s linear infinite; }

  .empty-state {
    padding:48px 24px;text-align:center;
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
            ctx.strokeStyle = `rgba(0,255,135,${0.05 * (1 - d / 110)})`;
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
function OrbitVisual({ size = 48 }) {
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
            "linear-gradient(135deg,rgba(0,255,135,.22),rgba(0,212,255,.12))",
          border: "1px solid rgba(0,255,135,.22)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
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
          width: size * 0.08,
          height: size * 0.08,
          marginLeft: -size * 0.04,
          marginTop: -size * 0.04,
          borderRadius: "50%",
          background: "#a78bfa",
          boxShadow: "0 0 6px #a78bfa",
          animation: "orbit-c 3.8s linear infinite",
        }}
      />
    </div>
  );
}

/* ─── USER AVATAR MINI ─── */
function UserAvatar({ name, size = 28 }) {
  const initials = useMemo(() => {
    const v = (name || "").trim();
    if (!v) return "?";
    const p = v.split(/\s+/).filter(Boolean);
    return (
      (p[0]?.[0] || "?") + (p.length > 1 ? p[p.length - 1][0] : "")
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
          border: "1px dashed rgba(0,255,135,.15)",
          animation: "spin-slow 16s linear infinite",
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
            width: size * 0.76,
            height: size * 0.76,
            borderRadius: "50%",
            background:
              "linear-gradient(135deg,rgba(0,255,135,.14),rgba(0,212,255,.09))",
            border: "1px solid rgba(0,255,135,.18)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span
            style={{
              fontFamily: "'Syne',sans-serif",
              fontWeight: 800,
              fontSize: size * 0.3,
              background: "linear-gradient(135deg,#00ff87,#00d4ff)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            {initials}
          </span>
        </div>
      </div>
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

/* ─── STATUS CHIPS ─── */
function YesNo({ val, trueColor = "#34d399", falseColor = "#f87171" }) {
  const c = val ? trueColor : falseColor;
  return (
    <span
      className="chip-xs"
      style={{ color: c, background: `${c}15`, border: `1px solid ${c}30` }}
    >
      <span
        style={{
          width: 5,
          height: 5,
          borderRadius: "50%",
          background: c,
          boxShadow: `0 0 4px ${c}`,
          marginRight: 4,
        }}
      />
      {val ? "Yes" : "No"}
    </span>
  );
}

function SubChip({ plan }) {
  const p = String(plan || "").toLowerCase();
  if (p === "premium")
    return (
      <span
        className="chip-xs"
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
        className="chip-xs"
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
      className="chip-xs"
      style={{
        color: "rgba(226,232,240,.4)",
        background: "rgba(255,255,255,.04)",
        border: "1px solid rgba(255,255,255,.09)",
      }}
    >
      Standard
    </span>
  );
}

function RoleChip({ role }) {
  const isAdmin = String(role || "").toLowerCase() === "admin";
  return (
    <span
      className="chip-xs"
      style={{
        color: isAdmin ? "#34d399" : "rgba(226,232,240,.4)",
        background: isAdmin ? "rgba(52,211,153,.1)" : "rgba(255,255,255,.04)",
        border: `1px solid ${isAdmin ? "rgba(52,211,153,.25)" : "rgba(255,255,255,.08)"}`,
      }}
    >
      {role || "user"}
    </span>
  );
}

/* ─── HELPERS ─── */
function formatDate(v) {
  if (!v) return "-";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toISOString().slice(0, 10);
}

function useDebouncedValue(value, delayMs) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

const COLUMNS = [
  "User",
  "Email",
  "Role",
  "Plan",
  "Verified",
  "Active",
  "Last Login",
  "Created",
  "",
];

/* ════════════════════════════════════ MAIN ════════════════════════════════════ */
export default function AdminUsersPage() {
  const navigate = useNavigate();

  const [q, setQ] = useState("");
  const [includeInactive, setIncludeInactive] = useState(false);
  const [page, setPage] = useState(1);
  const limit = 20;

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [data, setData] = useState({ total: 0, pages: 0, items: [] });

  const canPrev = page > 1;
  const canNext = data.pages ? page < data.pages : data.items.length === limit;
  const debouncedQ = useDebouncedValue(q, 300);

  function handleLogout() {
    localStorage.removeItem("token");
    localStorage.removeItem("defaultId");
    localStorage.removeItem("userEmail");
    localStorage.removeItem("userName");
    navigate("/login", { replace: true });
  }

  useEffect(() => {
    let mounted = true;
    async function run() {
      setLoading(true);
      setErr("");
      try {
        const res = await adminSearchUsers({
          q: debouncedQ,
          page,
          limit,
          includeInactive,
        });
        if (!mounted) return;
        setData({
          total: res.total ?? 0,
          pages: res.pages ?? 0,
          items: res.items ?? [],
        });
      } catch (e) {
        if (!mounted) return;
        setErr(e?.response?.data?.message || "Failed to load users.");
        setData({ total: 0, pages: 0, items: [] });
      } finally {
        if (mounted) setLoading(false);
      }
    }
    run();
    return () => {
      mounted = false;
    };
  }, [debouncedQ, page, includeInactive]);

  useEffect(() => {
    setPage(1);
  }, [debouncedQ, includeInactive]);

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
            "radial-gradient(ellipse,rgba(0,255,135,.032),transparent 62%)",
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
            "radial-gradient(ellipse,rgba(167,139,250,.025),transparent 62%)",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />
      <div
        style={{
          position: "fixed",
          top: "38%",
          right: "4%",
          width: 72,
          height: 72,
          borderRadius: "50%",
          background:
            "radial-gradient(circle,rgba(0,212,255,.06),transparent 65%)",
          animation: "float-y-slow 8s ease-in-out infinite",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />
      <div
        style={{
          position: "fixed",
          top: "68%",
          left: "2%",
          width: 52,
          height: 52,
          borderRadius: "50%",
          background:
            "radial-gradient(circle,rgba(0,255,135,.05),transparent 65%)",
          animation: "float-y-slow 10s ease-in-out infinite 2.5s",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />

      <div
        style={{
          position: "relative",
          zIndex: 1,
          maxWidth: 1300,
          margin: "0 auto",
          padding: "28px 24px 56px",
        }}
      >
        {/* ── HEADER ── */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            marginBottom: 24,
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <OrbitVisual size={50} />
            <div>
              <div
                style={{
                  fontFamily: "'Syne',sans-serif",
                  fontWeight: 800,
                  fontSize: 22,
                  letterSpacing: "-.025em",
                  lineHeight: 1,
                }}
              >
                <span className="grad-txt">Users</span>
              </div>
              <div
                style={{
                  fontFamily: "'DM Mono',monospace",
                  fontSize: 10,
                  color: "var(--muted)",
                  letterSpacing: ".1em",
                  marginTop: 4,
                  textTransform: "uppercase",
                }}
              >
                Admin Console
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {/* inactive toggle */}
            <label
              className="toggle-label"
              onClick={() => setIncludeInactive((v) => !v)}
            >
              <div className={`toggle-track${includeInactive ? " on" : ""}`}>
                <div className="toggle-thumb" />
              </div>
              Include inactive
            </label>
            <button className="logout-btn" onClick={handleLogout}>
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              Logout
            </button>
          </div>
        </div>

        {/* ── TICKER ── */}
        <div
          style={{
            borderBottom: "1px solid rgba(255,255,255,.04)",
            borderTop: "1px solid rgba(255,255,255,.04)",
            background: "rgba(255,255,255,.01)",
            padding: "7px 0",
            overflow: "hidden",
            marginBottom: 20,
          }}
        >
          <div className="ticker-wrap">
            <div className="ticker-inner">
              {[...Array(2)].map((_, d) => (
                <span key={d} style={{ display: "inline-flex" }}>
                  {[
                    "✦  Search by name, email or ID",
                    "✦  Click any row to inspect",
                    "✦  Manage flags and notes",
                    "✦  Force logout · reset passwords",
                    "✦  Update subscriptions instantly",
                    "✦  Audit timeline per user",
                  ].map((t, i) => (
                    <span
                      key={i}
                      style={{
                        fontSize: 10,
                        fontWeight: 600,
                        color: "rgba(226,232,240,.18)",
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

        {/* ── SEARCH BAR ── */}
        <div
          style={{
            display: "flex",
            gap: 10,
            alignItems: "center",
            marginBottom: 16,
          }}
        >
          <div style={{ position: "relative", flex: 1 }}>
            <svg
              style={{
                position: "absolute",
                left: 14,
                top: "50%",
                transform: "translateY(-50%)",
                color: "rgba(226,232,240,.28)",
                pointerEvents: "none",
              }}
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              className="search-input"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by email, name, or user ID…"
            />
          </div>
          <button
            className="action-btn"
            onClick={() => {
              setQ("");
              setIncludeInactive(false);
            }}
          >
            Reset
          </button>
        </div>

        {/* ── STATS ROW ── */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            marginBottom: 16,
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              fontFamily: "'DM Mono',monospace",
              fontSize: 11,
              color: "var(--muted)",
            }}
          >
            {loading ? (
              <>
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: "#00d4ff",
                    boxShadow: "0 0 6px #00d4ff",
                    animation: "pulse-dot .9s ease-in-out infinite",
                  }}
                />
                Loading…
              </>
            ) : (
              <>
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: "#00ff87",
                    boxShadow: "0 0 6px #00ff87",
                  }}
                />
                <span style={{ color: "#e2e8f0", fontWeight: 500 }}>
                  {data.total.toLocaleString()}
                </span>{" "}
                users
              </>
            )}
          </div>
          {data.pages > 0 && (
            <div
              style={{
                fontFamily: "'DM Mono',monospace",
                fontSize: 11,
                color: "var(--muted)",
              }}
            >
              page <strong style={{ color: "#e2e8f0" }}>{page}</strong> /{" "}
              {data.pages}
            </div>
          )}
        </div>

        {/* error */}
        {err && (
          <div
            style={{
              marginBottom: 16,
              padding: "12px 16px",
              borderRadius: 14,
              border: "1px solid rgba(248,113,113,.28)",
              background: "rgba(248,113,113,.06)",
              fontSize: 13,
              color: "#f87171",
              fontFamily: "'DM Mono',monospace",
            }}
          >
            {err}
          </div>
        )}

        {/* loading bar */}
        {loading && (
          <div
            style={{
              height: 2,
              borderRadius: 1,
              background: "rgba(255,255,255,.04)",
              overflow: "hidden",
              marginBottom: 16,
            }}
          >
            <div
              style={{
                height: "100%",
                background: "linear-gradient(90deg,#00ff87,#00d4ff,#a78bfa)",
                animation: "thinking-bar 1.4s ease-in-out infinite",
              }}
            />
          </div>
        )}

        {/* ── TABLE CARD ── */}
        <div className="admin-card" style={{ overflowX: "auto" }}>
          {/* thead */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "200px 220px 80px 110px 90px 70px 120px 120px 40px",
              borderBottom: "1px solid rgba(255,255,255,.07)",
            }}
          >
            {COLUMNS.map((col, i) => (
              <div key={i} className="th-cell">
                {col}
              </div>
            ))}
          </div>

          {/* rows */}
          {data.items.length === 0 && !loading ? (
            <div className="empty-state">
              <div
                style={{
                  fontFamily: "'Syne',sans-serif",
                  fontWeight: 700,
                  fontSize: 16,
                  marginBottom: 8,
                }}
              >
                No users found
              </div>
              <div style={{ fontSize: 13, color: "var(--muted)" }}>
                Try a different search term or toggle inactive users.
              </div>
            </div>
          ) : (
            data.items.map((u, idx) => (
              <div
                key={u._id}
                className="user-row"
                style={{ animationDelay: `${idx * 0.03}s` }}
                onClick={() => navigate(`/admin/users/${u._id}`)}
                title="Open user details"
              >
                {/* Name */}
                <div
                  className="td-cell"
                  style={{ display: "flex", alignItems: "center", gap: 10 }}
                >
                  <UserAvatar name={u.name || u.email} size={28} />
                  <Link
                    to={`/admin/users/${u._id}`}
                    className="user-link"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {u.name || "(no name)"}
                  </Link>
                </div>

                {/* Email */}
                <div
                  className="td-cell"
                  style={{
                    fontFamily: "'DM Mono',monospace",
                    fontSize: 11,
                    color: "rgba(226,232,240,.55)",
                  }}
                >
                  {u.email}
                </div>

                {/* Role */}
                <div className="td-cell">
                  <RoleChip role={u.role} />
                </div>

                {/* Plan */}
                <div className="td-cell">
                  <SubChip plan={u.subscription} />
                </div>

                {/* Email verified */}
                <div className="td-cell">
                  <YesNo val={u.isEmailVerified} />
                </div>

                {/* Active */}
                <div className="td-cell">
                  <YesNo val={u.isActive} falseColor="#f87171" />
                </div>

                {/* Last login */}
                <div
                  className="td-cell"
                  style={{
                    fontFamily: "'DM Mono',monospace",
                    fontSize: 11,
                    color: "rgba(226,232,240,.45)",
                  }}
                >
                  {formatDate(u.lastLogin)}
                </div>

                {/* Created */}
                <div
                  className="td-cell"
                  style={{
                    fontFamily: "'DM Mono',monospace",
                    fontSize: 11,
                    color: "rgba(226,232,240,.45)",
                  }}
                >
                  {formatDate(u.createdAt)}
                </div>

                {/* Arrow */}
                <div
                  className="td-cell"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <svg
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="rgba(0,255,135,.35)"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </div>
              </div>
            ))
          )}
        </div>

        {/* ── PAGINATION ── */}
        <div
          style={{
            marginTop: 16,
            display: "flex",
            gap: 10,
            alignItems: "center",
          }}
        >
          <button
            className="pager-btn"
            disabled={!canPrev || loading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
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
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Prev
          </button>

          <div style={{ display: "flex", gap: 6 }}>
            {data.pages > 0 &&
              Array.from({ length: Math.min(data.pages, 7) }, (_, i) => {
                const p = i + 1;
                const active = p === page;
                return (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    disabled={loading}
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 10,
                      border: active
                        ? "1px solid rgba(0,255,135,.35)"
                        : "1px solid rgba(255,255,255,.08)",
                      background: active
                        ? "rgba(0,255,135,.12)"
                        : "rgba(255,255,255,.03)",
                      color: active ? "#00ff87" : "rgba(226,232,240,.4)",
                      fontFamily: "'DM Mono',monospace",
                      fontSize: 11,
                      cursor: "pointer",
                      transition: "all .15s",
                      boxShadow: active
                        ? "0 0 12px rgba(0,255,135,.2)"
                        : "none",
                    }}
                  >
                    {p}
                  </button>
                );
              })}
            {data.pages > 7 && (
              <span
                style={{
                  fontFamily: "'DM Mono',monospace",
                  fontSize: 11,
                  color: "var(--muted)",
                  padding: "0 4px",
                  lineHeight: "32px",
                }}
              >
                …
              </span>
            )}
          </div>

          <button
            className="pager-btn"
            disabled={!canNext || loading}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
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
              <polyline points="9 18 15 12 9 6" transform="rotate(180 12 12)" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
