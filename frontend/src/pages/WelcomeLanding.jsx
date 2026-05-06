/* eslint-disable */
import { useState, useEffect, useRef, useCallback } from "react";

const logoUrl = new URL("../assets/nummoria_logo.png", import.meta.url).href;
const phone1 = new URL("../assets/phone-1.png", import.meta.url).href;
const phone2 = new URL("../assets/phone-2.png", import.meta.url).href;
const phone3 = new URL("../assets/phone-3.png", import.meta.url).href;
const phone4 = new URL("../assets/phone-4.png", import.meta.url).href;
const phone5 = new URL("../assets/phone-5.png", import.meta.url).href;
const phone7 = new URL("../assets/phone-7.png", import.meta.url).href;
const phone8 = new URL("../assets/phone-8.png", import.meta.url).href;
const phone9 = new URL("../assets/phone-9.png", import.meta.url).href;

/* ─── GLOBAL STYLES ─── */
const G = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Mono:wght@400;500&family=Outfit:wght@300;400;500;600;700&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
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
  html { scroll-behavior: smooth; }
  body { background: var(--bg); color: var(--txt); font-family: 'Outfit', sans-serif; overflow-x: hidden; }
  a    { color: inherit; text-decoration: none; }
  button { font-family: inherit; border: none; cursor: pointer; }

  ::-webkit-scrollbar       { width: 3px; }
  ::-webkit-scrollbar-track { background: #030508; }
  ::-webkit-scrollbar-thumb { background: rgba(0,255,135,0.3); border-radius: 2px; }

  @keyframes shimmer {
    0%   { background-position: -400% center; }
    100% { background-position:  400% center; }
  }
  @keyframes blink {
    0%,100% { opacity: 1; }
    50%     { opacity: 0; }
  }
  @keyframes pulse-dot {
    0%,100% { transform: scale(1); opacity: .6; }
    50%     { transform: scale(1.55); opacity: 1; }
  }
  @keyframes float-y {
    0%,100% { transform: translateY(0); }
    50%     { transform: translateY(-9px); }
  }
  @keyframes spin-slow {
    from { transform: rotate(0deg); }
    to   { transform: rotate(360deg); }
  }
  @keyframes spin-rev {
    from { transform: rotate(0deg); }
    to   { transform: rotate(-360deg); }
  }
  @keyframes orbit-a {
    from { transform: rotate(0deg)   translateX(68px) rotate(0deg); }
    to   { transform: rotate(360deg) translateX(68px) rotate(-360deg); }
  }
  @keyframes orbit-b {
    from { transform: rotate(130deg)  translateX(108px) rotate(-130deg); }
    to   { transform: rotate(490deg)  translateX(108px) rotate(-490deg); }
  }
  @keyframes orbit-c {
    from { transform: rotate(255deg)  translateX(86px) rotate(-255deg); }
    to   { transform: rotate(615deg)  translateX(86px) rotate(-615deg); }
  }
  @keyframes ticker-scroll {
    0%   { transform: translateX(0); }
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

  .rv  { opacity: 0; transition: opacity .75s cubic-bezier(.22,1,.36,1), transform .75s cubic-bezier(.22,1,.36,1); }
  .rv-up  { transform: translateY(28px); }
  .rv-lft { transform: translateX(-36px); }
  .rv-rgt { transform: translateX(36px); }
  .rv-scl { transform: scale(.96); }
  .rv.in  { opacity: 1 !important; transform: none !important; }

  .cursor-glow {
    position: fixed; width: 500px; height: 500px; border-radius: 50%;
    background: radial-gradient(circle, rgba(0,255,135,.04) 0%, transparent 65%);
    pointer-events: none; transform: translate(-50%,-50%);
    transition: left .1s ease, top .1s ease; z-index: 0;
  }

  .ghost-num {
    font-family: 'DM Mono', monospace; font-size: 88px; font-weight: 500;
    color: rgba(0,255,135,.045); line-height: 1;
    position: absolute; top: 14px; right: 18px;
    pointer-events: none; user-select: none;
  }

  .faq-body { max-height: 0; overflow: hidden; transition: max-height .4s cubic-bezier(.4,0,.2,1); }
  .faq-body.open { max-height: 220px; }

  .chip {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 4px 12px; border-radius: 100px;
    border: 1px solid rgba(0,255,135,.22);
    background: rgba(0,255,135,.07);
    font-size: 11px; font-weight: 700; color: #00ff87;
    letter-spacing: .04em;
  }

  .ticker-wrap { overflow: hidden; width: 100%; }
  .ticker-inner { display: flex; white-space: nowrap; animation: ticker-scroll 28s linear infinite; }

  .scanlines {
    position: fixed; inset: 0; z-index: 9999; pointer-events: none;
    background: repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,.018) 2px, rgba(0,0,0,.018) 4px);
  }

  .cta-primary {
    position: relative; display: inline-flex; align-items: center; justify-content: center;
    height: 48px; padding: 0 28px; border-radius: 13px;
    background: linear-gradient(135deg, #00ff87, #00d4ff);
    color: #020b05; font-size: 14px; font-weight: 800; font-family: 'Outfit', sans-serif;
    box-shadow: 0 0 36px rgba(0,255,135,.38); text-decoration: none;
    transition: transform .2s, box-shadow .2s;
  }
  .cta-primary:hover { transform: translateY(-2px); box-shadow: 0 6px 48px rgba(0,255,135,.6); }

  .cta-ghost {
    display: inline-flex; align-items: center; justify-content: center;
    height: 48px; padding: 0 24px; border-radius: 13px;
    border: 1px solid rgba(255,255,255,.12); background: rgba(255,255,255,.04);
    color: rgba(226,232,240,.8); font-size: 14px; font-weight: 600; font-family: 'Outfit', sans-serif;
    text-decoration: none;
    transition: border-color .2s, background .2s, transform .2s;
  }
  .cta-ghost:hover { border-color: rgba(0,255,135,.28); background: rgba(0,255,135,.05); transform: translateY(-1px); }

  @keyframes phone-float {
    0%,100% { transform: translateY(0px); }
    50% { transform: translateY(-12px); }
  }
  @keyframes phone-glow-pulse {
    0%,100% { opacity: .5; transform: scale(1); }
    50% { opacity: .92; transform: scale(1.06); }
  }
  @keyframes screen-scan {
    0%   { transform: translateY(-130%); opacity: 0; }
    14%  { opacity: .2; }
    100% { transform: translateY(240%); opacity: 0; }
  }
  @keyframes phone-orb-float-a {
    0%,100% { transform: translate3d(0,0,0); }
    50% { transform: translate3d(0,-14px,0); }
  }
  @keyframes phone-orb-float-b {
    0%,100% { transform: translate3d(0,0,0); }
    50% { transform: translate3d(0,12px,0); }
  }

  /* ─── MOBILE NAV DRAWER ─── */
  .nav-drawer-overlay {
    position: fixed; inset: 0; z-index: 998;
    background: rgba(0,0,0,.72); backdrop-filter: blur(8px);
    opacity: 0; pointer-events: none; transition: opacity .3s;
  }
  .nav-drawer-overlay.open { opacity: 1; pointer-events: auto; }

  .nav-drawer {
    position: fixed; top: 0; right: 0; bottom: 0; z-index: 999;
    width: 280px; max-width: 80vw;
    background: rgba(6,10,16,.97); border-left: 1px solid rgba(0,255,135,.1);
    backdrop-filter: blur(24px);
    transform: translateX(100%); transition: transform .35s cubic-bezier(.22,1,.36,1);
    padding: 80px 28px 28px; display: flex; flex-direction: column; gap: 8px;
  }
  .nav-drawer.open { transform: translateX(0); }
  .nav-drawer a {
    display: block; padding: 14px 16px; border-radius: 12px; font-size: 15px;
    font-weight: 600; color: rgba(226,232,240,.7); transition: all .2s;
  }
  .nav-drawer a:hover, .nav-drawer a:active {
    color: #00ff87; background: rgba(0,255,135,.07);
  }

  /* ─── RESPONSIVE ─── */
  @media (max-width: 1024px) {
    .hero-grid   { grid-template-columns: 1fr !important; gap: 40px !important; }
    .feat-row-a  { grid-template-columns: 1fr !important; }
    .feat-row-b  { grid-template-columns: 1fr !important; }
    .price-grid  { grid-template-columns: 1fr !important; }
    .steps-grid  { grid-template-columns: 1fr !important; }
    .metrics-grid { grid-template-columns: repeat(2, 1fr) !important; }
    .conviction-inner { flex-direction: column !important; align-items: flex-start !important; }
  }

  @media (max-width: 768px) {
    .desktop-nav  { display: none !important; }
    .burger-btn   { display: flex !important; }
    .cursor-glow  { display: none !important; }
    .hero-badges  { grid-template-columns: repeat(2, 1fr) !important; }
    .hero-ctas    { flex-direction: column !important; align-items: stretch !important; }
    .hero-ctas .cta-primary,
    .hero-ctas .cta-ghost { width: 100%; text-align: center; }
    .store-row    { justify-content: center !important; }
    .phone-float-card { display: none !important; }
    .phone-shell  { width: 240px !important; height: 488px !important; border-radius: 36px !important; }
    .phone-screen { border-radius: 28px !important; }
    .phone-notch  { width: 86px !important; height: 22px !important; top: 11px !important; }
    .phone-wrap   { min-height: 520px !important; }
    .conviction-orbit { display: none !important; }
    .metrics-grid { grid-template-columns: repeat(2, 1fr) !important; }
    .section-pad  { padding-top: 60px !important; padding-bottom: 60px !important; }
    .cta-box      { padding: 48px 24px !important; border-radius: 22px !important; }
    .cta-bottom-row { flex-direction: column !important; align-items: stretch !important; }
    .cta-bottom-row > * { width: 100%; justify-content: center; }
  }

  @media (max-width: 480px) {
    .hero-badges  { grid-template-columns: repeat(2, 1fr) !important; }
    .metrics-grid { grid-template-columns: 1fr 1fr !important; }
    .metrics-grid > div { border-left: none !important; border-bottom: 1px solid rgba(255,255,255,.06); }
    .ghost-num    { font-size: 56px !important; }
    .phone-shell  { width: 200px !important; height: 408px !important; border-radius: 30px !important; }
    .phone-screen { border-radius: 22px !important; }
    .phone-notch  { width: 72px !important; height: 18px !important; top: 9px !important; }
    .phone-wrap   { min-height: 440px !important; }
  }
`;

/* ─── HOOKS ─── */
function useIsMobile(breakpoint = 768) {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint}px)`);
    setMobile(mq.matches);
    const handler = (e) => setMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [breakpoint]);
  return mobile;
}

/* ─── PARTICLE CANVAS ─── */
function ParticleNet() {
  const cvs = useRef(null);
  const mouse = useRef({ x: -9999, y: -9999 });
  const isMobile = useIsMobile();

  useEffect(() => {
    const c = cvs.current;
    const ctx = c.getContext("2d");
    let raf;
    const fit = () => {
      c.width = window.innerWidth;
      c.height = window.innerHeight;
    };
    fit();
    window.addEventListener("resize", fit);
    if (!isMobile) {
      window.addEventListener("mousemove", (e) => {
        mouse.current = { x: e.clientX, y: e.clientY };
      });
    }
    const N = isMobile ? 28 : 68;
    const pts = Array.from({ length: N }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      vx: (Math.random() - 0.5) * 0.25,
      vy: (Math.random() - 0.5) * 0.25,
      r: 0.7 + Math.random() * 1.4,
      col: ["#00ff87", "#00d4ff", "#ffffff"][~~(Math.random() * 3)],
      op: 0.1 + Math.random() * 0.32,
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
            ctx.strokeStyle = `rgba(0,255,135,${0.06 * (1 - d / 115)})`;
            ctx.lineWidth = 0.35;
            ctx.moveTo(pts[i].x, pts[i].y);
            ctx.lineTo(pts[j].x, pts[j].y);
            ctx.stroke();
          }
        }
        if (!isMobile) {
          const mdx = pts[i].x - mx,
            mdy = pts[i].y - my,
            md = Math.hypot(mdx, mdy);
          if (md < 165) {
            ctx.beginPath();
            ctx.strokeStyle = `rgba(0,212,255,${0.14 * (1 - md / 165)})`;
            ctx.lineWidth = 0.5;
            ctx.moveTo(pts[i].x, pts[i].y);
            ctx.lineTo(mx, my);
            ctx.stroke();
            pts[i].x += (mdx / md) * 0.2;
            pts[i].y += (mdy / md) * 0.2;
          }
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
  }, [isMobile]);

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

function useReveal() {
  useEffect(() => {
    const els = document.querySelectorAll(".rv");
    const io = new IntersectionObserver(
      (e) =>
        e.forEach((x) => {
          if (x.isIntersecting) x.target.classList.add("in");
        }),
      { threshold: 0.1 },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
}

function useTypewriter(phrases, spd = 72, del = 36, pause = 2400) {
  const [txt, setTxt] = useState("");
  const [pi, setPi] = useState(0);
  const [isD, setIsD] = useState(false);
  useEffect(() => {
    const cur = phrases[pi];
    const t = setTimeout(
      () => {
        if (!isD) {
          if (txt.length < cur.length) setTxt(cur.slice(0, txt.length + 1));
          else setTimeout(() => setIsD(true), pause);
        } else {
          if (txt.length > 0) setTxt(txt.slice(0, -1));
          else {
            setIsD(false);
            setPi((pi + 1) % phrases.length);
          }
        }
      },
      isD ? del : spd,
    );
    return () => clearTimeout(t);
  }, [txt, isD, pi, phrases, spd, del, pause]);
  return txt;
}

function Counter({ to, suffix = "", prefix = "", duration = 1600 }) {
  const [val, setVal] = useState(0);
  const ref = useRef(null);
  useEffect(() => {
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          io.disconnect();
          const start = Date.now();
          const tick = () => {
            const p = Math.min((Date.now() - start) / duration, 1);
            setVal(Math.round((1 - Math.pow(1 - p, 3)) * to));
            if (p < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        }
      },
      { threshold: 0.5 },
    );
    if (ref.current) io.observe(ref.current);
    return () => io.disconnect();
  }, [to, duration]);
  return (
    <span ref={ref}>
      {prefix}
      {val.toLocaleString()}
      {suffix}
    </span>
  );
}

function OrbitVisual() {
  return (
    <div
      className="conviction-orbit"
      style={{ position: "relative", width: 200, height: 200, flexShrink: 0 }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "50%",
          border: "1px dashed rgba(0,255,135,.11)",
          animation: "spin-slow 22s linear infinite",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 18,
          borderRadius: "50%",
          border: "1px dashed rgba(0,212,255,.08)",
          animation: "spin-rev 14s linear infinite",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 38,
          borderRadius: "50%",
          border: "1px dashed rgba(167,139,250,.06)",
          animation: "spin-slow 9s linear infinite",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          width: 34,
          height: 34,
          marginLeft: -17,
          marginTop: -17,
          borderRadius: "50%",
          background:
            "linear-gradient(135deg,rgba(0,255,135,.3),rgba(0,212,255,.18))",
          border: "1px solid rgba(0,255,135,.28)",
          boxShadow: "0 0 20px rgba(0,255,135,.32)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <img
          src={logoUrl}
          alt="Nummoria Logo"
          style={{ width: 34, height: 34, borderRadius: "50%" }}
        />
      </div>
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
          boxShadow: "0 0 10px #00ff87",
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
          boxShadow: "0 0 8px #00d4ff",
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
          boxShadow: "0 0 7px #a78bfa",
          animation: "orbit-c 3.8s linear infinite",
        }}
      />
    </div>
  );
}

function SectionHead({ label, title, sub }) {
  return (
    <div className="rv rv-up" style={{ textAlign: "center", marginBottom: 42 }}>
      <div
        style={{
          fontFamily: "'DM Mono',monospace",
          fontSize: 10,
          fontWeight: 500,
          letterSpacing: ".28em",
          color: "rgba(0,255,135,.6)",
          textTransform: "uppercase",
          marginBottom: 14,
        }}
      >
        {label}
      </div>
      <h2
        style={{
          fontFamily: "'Syne',sans-serif",
          fontSize: "clamp(1.6rem,4vw,3rem)",
          fontWeight: 800,
          letterSpacing: "-.035em",
          lineHeight: 1.1,
        }}
      >
        {title}
      </h2>
      {sub && (
        <p
          style={{
            marginTop: 14,
            color: "var(--muted)",
            fontSize: 15,
            lineHeight: 1.8,
            maxWidth: 540,
            margin: "14px auto 0",
          }}
        >
          {sub}
        </p>
      )}
    </div>
  );
}

const Divider = () => (
  <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 20px" }}>
    <div
      style={{
        height: 1,
        background:
          "linear-gradient(to right, transparent, rgba(0,255,135,.1), transparent)",
      }}
    />
  </div>
);

function StoreBadge({ type }) {
  const apple = type === "apple";
  return (
    <a
      href={
        apple
          ? "https://apps.apple.com/app/id0000000000"
          : "https://play.google.com/store/apps/details?id=com.example"
      }
      className="cta-ghost"
      style={{ height: 42, gap: 8, padding: "0 14px", fontSize: 12 }}
    >
      {apple ? (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
          <path d="M16.365 1.43c.056.73-.27 1.44-.77 1.98-.48.56-1.29 1-2.07.93-.07-.72.29-1.45.78-1.99.49-.56 1.36-.98 2.06-.92zm4.145 15.6c-.38.88-.84 1.75-1.45 2.51-.55.7-1.23 1.39-2.11 1.42-.92.04-1.22-.55-2.28-.55-1.06 0-1.4.53-2.29.56-.9.04-1.59-.75-2.15-1.44-1.17-1.49-2.07-3.6-1.83-5.64.2-1.15.8-2.22 1.73-2.96.81-.64 1.9-1.11 2.95-.92.3.06.6.16.88.29.26.12.52.29.8.28.23 0 .45-.15.64-.26.53-.31 1.01-.67 1.6-.87.86-.3 1.8-.28 2.6.17.39.22.72.54.95.94-.88.53-1.47 1.49-1.39 2.53.09 1.02.7 1.98 1.68 2.45-.2.29-.43.56-.66.85z" />
        </svg>
      ) : (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
          <path d="M3.01 2.406c-.01.063-.02.127-.02.191v18.806c0 .064.01.128.02.191l10.73-9.594L3.01 2.406zM14.53 11.5l4.79-4.29c-.33-.255-.78-.267-1.19-.036L14.53 11.5zm0 1l3.6 4.325c.41.23.86.218 1.19-.037L14.53 12.5zM13.25 12L3 21.403c.15.834.98 1.23 1.67.83l15.44-8.74c.9-.51.9-1.93 0-2.44L4.67 2.313c-.69-.401-1.52-.004-1.67.833L13.25 12z" />
        </svg>
      )}
      <div style={{ lineHeight: 1.3, textAlign: "left" }}>
        <div style={{ fontSize: 9, color: "var(--muted)" }}>
          {apple ? "Download on the" : "Get it on"}
        </div>
        <div style={{ fontSize: 12, fontWeight: 600 }}>
          {apple ? "App Store" : "Google Play"}
        </div>
      </div>
    </a>
  );
}

function FeatureCard({ title, accent, desc, items, className = "" }) {
  const ref = useRef(null);
  const mv = (e) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--fx", `${e.clientX - r.left}px`);
    el.style.setProperty("--fy", `${e.clientY - r.top}px`);
  };
  return (
    <div
      ref={ref}
      onMouseMove={mv}
      className={`rv rv-up ${className}`}
      style={{
        borderRadius: 24,
        border: "1px solid rgba(255,255,255,.07)",
        background: "rgba(255,255,255,.03)",
        padding: "28px 22px",
        position: "relative",
        overflow: "hidden",
        transition: "border-color .3s",
        backgroundImage: `radial-gradient(280px 240px at var(--fx,50%) var(--fy,50%), ${accent}09, transparent 60%)`,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = accent + "2a";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "rgba(255,255,255,.07)";
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          width: 180,
          height: 180,
          background: `radial-gradient(circle at 80% 10%, ${accent}12, transparent 55%)`,
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          fontFamily: "'DM Mono',monospace",
          fontSize: 10,
          fontWeight: 500,
          letterSpacing: ".2em",
          textTransform: "uppercase",
          color: accent,
          marginBottom: 10,
        }}
      >
        {title}
      </div>
      <div
        style={{
          fontSize: 14,
          color: "var(--muted)",
          lineHeight: 1.75,
          marginBottom: 20,
        }}
      >
        {desc}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {items.map((item) => (
          <div
            key={item}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 9,
              fontSize: 13,
              color: "rgba(226,232,240,.72)",
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: accent,
                flexShrink: 0,
                boxShadow: `0 0 6px ${accent}`,
              }}
            />
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}

function PriceCard({
  name,
  tagline,
  price,
  period,
  accent,
  bullets,
  actionLabel,
  highlight,
  current,
  plan,
}) {
  const ref = useRef(null);
  const h2r = (hex, a) => {
    const r = parseInt(hex.slice(1, 3), 16),
      g = parseInt(hex.slice(3, 5), 16),
      b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${a})`;
  };
  const mv = (e) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--px", `${e.clientX - r.left}px`);
    el.style.setProperty("--py", `${e.clientY - r.top}px`);
  };
  return (
    <div
      ref={ref}
      onMouseMove={mv}
      className="rv rv-up"
      style={{
        borderRadius: 26,
        position: "relative",
        overflow: "hidden",
        flexDirection: "column",
        display: "flex",
        border: `1px solid ${highlight ? h2r(accent, 0.3) : "rgba(255,255,255,.08)"}`,
        background: highlight
          ? "rgba(0,255,135,.035)"
          : "rgba(255,255,255,.03)",
        padding: "28px 24px",
        boxShadow: highlight ? `0 0 90px -50px ${h2r(accent, 0.55)}` : "none",
        backgroundImage: `radial-gradient(220px 200px at var(--px,50%) var(--py,50%), ${h2r(accent, 0.07)}, transparent 55%)`,
        transition: "box-shadow .3s",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 2,
          background: `linear-gradient(to right, transparent, ${accent}, transparent)`,
          opacity: highlight ? 0.95 : 0.3,
        }}
      />
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 10,
          marginBottom: 20,
        }}
      >
        <div>
          <div
            style={{
              fontFamily: "'DM Mono',monospace",
              fontSize: 10,
              fontWeight: 500,
              letterSpacing: ".2em",
              textTransform: "uppercase",
              color: "rgba(226,232,240,.38)",
              marginBottom: 6,
            }}
          >
            {name}
          </div>
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "rgba(226,232,240,.72)",
            }}
          >
            {tagline}
          </div>
        </div>
        {highlight && (
          <span className="chip" style={{ fontSize: 9, flexShrink: 0 }}>
            {highlight}
          </span>
        )}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: 6,
          marginBottom: 22,
        }}
      >
        <span
          style={{
            fontFamily: "'Syne',sans-serif",
            fontSize: 52,
            fontWeight: 800,
            letterSpacing: "-.04em",
            color: accent,
            lineHeight: 1,
          }}
        >
          {price}
        </span>
        <span
          style={{
            fontSize: 11,
            textTransform: "uppercase",
            letterSpacing: ".08em",
            color: "rgba(226,232,240,.32)",
            paddingBottom: 8,
          }}
        >
          {period}
        </span>
      </div>
      <div
        style={{
          height: 1,
          background: "rgba(255,255,255,.07)",
          marginBottom: 20,
        }}
      />
      <ul
        style={{
          listStyle: "none",
          display: "flex",
          flexDirection: "column",
          gap: 11,
          flex: 1,
          marginBottom: 24,
        }}
      >
        {bullets.map((b, i) => (
          <li
            key={i}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 10,
              fontSize: 13.5,
              color: "rgba(226,232,240,.73)",
            }}
          >
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: accent,
                flexShrink: 0,
                marginTop: 5,
                boxShadow: `0 0 6px ${accent}`,
              }}
            />
            {b}
          </li>
        ))}
      </ul>
      {current ? (
        <button
          disabled
          style={{
            width: "100%",
            height: 44,
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,.09)",
            background: "rgba(255,255,255,.04)",
            color: "rgba(226,232,240,.3)",
            fontSize: 13,
            fontWeight: 600,
            cursor: "not-allowed",
          }}
        >
          {actionLabel}
        </button>
      ) : (
        <button
          onClick={() =>
            (window.location.href = `/subscriptions/purchase?plan=${plan}`)
          }
          style={{
            width: "100%",
            height: 44,
            borderRadius: 12,
            border: `1px solid ${h2r(accent, 0.35)}`,
            background: highlight
              ? `linear-gradient(135deg,${accent},${h2r(accent, 0.78)})`
              : h2r(accent, 0.09),
            color: highlight ? "#020b05" : accent,
            fontSize: 13.5,
            fontWeight: 800,
            boxShadow: highlight
              ? `0 0 36px -10px ${h2r(accent, 0.7)}`
              : "none",
            transition: "all .2s",
          }}
        >
          {actionLabel}
        </button>
      )}
      <div
        style={{
          marginTop: 10,
          fontSize: 11,
          color: "rgba(226,232,240,.3)",
          textAlign: "center",
        }}
      >
        {name === "Standard"
          ? "Ideal for tracking and basic reporting."
          : name === "Plus"
            ? "Best value: AI clarity + reporting."
            : "Power users: advanced AI and full exports."}
      </div>
    </div>
  );
}

function FAQ({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className="rv rv-up"
      onClick={() => setOpen(!open)}
      style={{
        borderRadius: 16,
        border: `1px solid ${open ? "rgba(0,255,135,.18)" : "rgba(255,255,255,.07)"}`,
        background: "rgba(255,255,255,.03)",
        cursor: "pointer",
        overflow: "hidden",
        transition: "border-color .3s",
      }}
    >
      <div
        style={{
          padding: "18px 20px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 16,
        }}
      >
        <span
          style={{
            fontFamily: "'Syne',sans-serif",
            fontWeight: 700,
            fontSize: 14,
          }}
        >
          {q}
        </span>
        <span
          style={{
            width: 24,
            height: 24,
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: "50%",
            border: "1px solid rgba(0,255,135,.28)",
            color: "#00ff87",
            fontSize: 18,
            transition: "transform .3s",
            transform: open ? "rotate(45deg)" : "none",
          }}
        >
          +
        </span>
      </div>
      <div className={`faq-body${open ? " open" : ""}`}>
        <div
          style={{
            padding: "0 20px 18px",
            color: "var(--muted)",
            fontSize: 14,
            lineHeight: 1.75,
          }}
        >
          {a}
        </div>
      </div>
    </div>
  );
}

function HeroPhoneShowcase() {
  const screens = [
    phone1,
    phone2,
    phone3,
    phone4,
    phone5,
    phone7,
    phone8,
    phone9,
  ];
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(
      () => setIndex((prev) => (prev + 1) % screens.length),
      2200,
    );
    return () => clearInterval(id);
  }, [screens.length]);

  const FloatCard = ({
    top,
    left,
    right,
    bottom,
    border,
    glow,
    glowColor,
    label,
    text,
    textColor,
    delay,
    zIndex = 3,
  }) => (
    <div
      className="phone-float-card"
      style={{
        position: "absolute",
        top,
        left,
        right,
        bottom,
        zIndex,
        width: 172,
        padding: "14px 16px",
        borderRadius: 18,
        border,
        background:
          "linear-gradient(180deg, rgba(10,16,24,.92), rgba(6,10,16,.84))",
        backdropFilter: "blur(18px)",
        WebkitBackdropFilter: "blur(18px)",
        boxShadow: `0 18px 50px rgba(0,0,0,.42), 0 0 0 1px ${glowColor}, 0 0 28px ${glow}`,
        animation: `float-y 5.8s ease-in-out infinite ${delay || "0s"}`,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 14,
          right: 14,
          height: 1,
          background: `linear-gradient(to right, transparent, ${glowColor.replace(/[\d.]+\)$/, ".45)")}, transparent)`,
        }}
      />
      <div
        style={{
          fontSize: 10,
          color: "rgba(226,232,240,.56)",
          fontFamily: "'DM Mono', monospace",
          letterSpacing: ".12em",
          marginBottom: 8,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 14,
          fontWeight: 800,
          color: textColor,
          lineHeight: 1.35,
        }}
      >
        {text}
      </div>
    </div>
  );

  return (
    <div
      className="phone-wrap"
      style={{
        position: "relative",
        width: "100%",
        minHeight: 640,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* ambient glow */}
      <div
        style={{
          position: "absolute",
          width: 430,
          height: 430,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(0,255,135,.16) 0%, rgba(0,212,255,.08) 35%, transparent 72%)",
          filter: "blur(30px)",
          animation: "phone-glow-pulse 5.5s ease-in-out infinite",
          pointerEvents: "none",
        }}
      />

      {/* floating cards — hidden on mobile via CSS */}
      <FloatCard
        top={150}
        left={-80}
        border="1px solid rgba(255,255,255,.12)"
        glow="rgba(0,255,135,.10)"
        glowColor="rgba(0,255,135,.08)"
        label="AI INSIGHT"
        text={
          <>
            Subscriptions
            <br />
            detected
          </>
        }
        textColor="#f8fafc"
      />
      <FloatCard
        top={365}
        left={-80}
        border="1px solid rgba(0,212,255,.14)"
        glow="rgba(0,212,255,.10)"
        glowColor="rgba(0,212,255,.08)"
        label="CASH FLOW"
        text={
          <>
            Inflow sources
            <br />
            visible
          </>
        }
        textColor="#7dd3fc"
        delay="0.8s"
      />
      <FloatCard
        top={170}
        right={-80}
        border="1px solid rgba(0,255,135,.16)"
        glow="rgba(0,255,135,.15)"
        glowColor="rgba(0,255,135,.10)"
        label="MONTHLY CLARITY"
        text={
          <>
            + better
            <br />
            visibility
          </>
        }
        textColor="#00ff87"
        delay="0.5s"
      />
      <FloatCard
        top={392}
        right={-80}
        border="1px solid rgba(167,139,250,.16)"
        glow="rgba(167,139,250,.12)"
        glowColor="rgba(167,139,250,.08)"
        label="PORTFOLIO VIEW"
        text={
          <>
            Assets in one
            <br />
            system
          </>
        }
        textColor="#c4b5fd"
        delay="1.2s"
      />

      {/* phone shell */}
      <div
        className="phone-shell"
        style={{
          position: "relative",
          width: 305,
          height: 620,
          borderRadius: 44,
          padding: 10,
          background:
            "linear-gradient(155deg, rgba(255,255,255,.13), rgba(255,255,255,.04))",
          border: "1px solid rgba(255,255,255,.12)",
          boxShadow:
            "0 50px 120px rgba(0,0,0,.55), 0 0 0 1px rgba(0,255,135,.07), 0 0 90px rgba(0,255,135,.12)",
          animation: "phone-float 5.8s ease-in-out infinite",
          backdropFilter: "blur(18px)",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "inherit",
            boxShadow:
              "inset 0 0 0 1px rgba(255,255,255,.05), inset 0 0 40px rgba(255,255,255,.03)",
            pointerEvents: "none",
          }}
        />
        <div
          className="phone-notch"
          style={{
            position: "absolute",
            top: 14,
            left: "50%",
            transform: "translateX(-50%)",
            width: 108,
            height: 28,
            borderRadius: 100,
            background: "#020304",
            zIndex: 6,
            boxShadow: "0 1px 0 rgba(255,255,255,.06)",
          }}
        />

        <div
          className="phone-screen"
          style={{
            position: "relative",
            width: "100%",
            height: "100%",
            overflow: "hidden",
            borderRadius: 35,
            background: "#05070a",
          }}
        >
          {screens.map((src, i) => {
            const active = i === index;
            const previous =
              i === (index - 1 + screens.length) % screens.length;
            return (
              <img
                key={src}
                src={src}
                alt={`Nummoria screen ${i + 1}`}
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  objectFit: "contain",
                  background: "#05070a",
                  transition:
                    "transform 1s cubic-bezier(.22,1,.36,1), opacity 1s cubic-bezier(.22,1,.36,1), filter .8s ease",
                  transform: active
                    ? "translateY(0%) scale(1)"
                    : previous
                      ? "translateY(-10%) scale(.985)"
                      : "translateY(12%) scale(1.02)",
                  opacity: active ? 1 : 0,
                  filter: active ? "blur(0px)" : "blur(8px)",
                }}
              />
            );
          })}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(115deg, rgba(255,255,255,.13) 0%, rgba(255,255,255,.03) 18%, transparent 32%, transparent 68%, rgba(255,255,255,.04) 100%)",
              pointerEvents: "none",
            }}
          />
          <div
            style={{
              position: "absolute",
              top: "-40%",
              left: 0,
              right: 0,
              height: "28%",
              background:
                "linear-gradient(to bottom, transparent, rgba(255,255,255,.08), transparent)",
              animation: "screen-scan 4.8s linear infinite",
              pointerEvents: "none",
            }}
          />
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              height: 130,
              background:
                "linear-gradient(to top, rgba(3,5,8,.72), rgba(3,5,8,.18), transparent)",
              pointerEvents: "none",
            }}
          />

          <div
            style={{
              position: "absolute",
              left: 14,
              right: 14,
              bottom: 14,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              zIndex: 7,
            }}
          >
            <div
              style={{
                padding: "7px 10px",
                borderRadius: 999,
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: ".08em",
                fontFamily: "'DM Mono', monospace",
                color: "#00ff87",
                background: "rgba(0,0,0,.42)",
                border: "1px solid rgba(0,255,135,.18)",
                backdropFilter: "blur(10px)",
              }}
            >
              LIVE PREVIEW
            </div>
            <div style={{ display: "flex", gap: 5 }}>
              {screens.map((_, i) => (
                <span
                  key={i}
                  style={{
                    width: i === index ? 16 : 5,
                    height: 5,
                    borderRadius: 999,
                    background:
                      i === index ? "#00ff87" : "rgba(255,255,255,.22)",
                    boxShadow:
                      i === index ? "0 0 10px rgba(0,255,135,.65)" : "none",
                    transition: "all .35s ease",
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════ MAIN ═══════════════════════════════ */
export default function WelcomeLanding() {
  useReveal();
  const tw = useTypewriter([
    "a clear picture",
    "real clarity",
    "your financial edge",
    "one simple system",
  ]);
  const [scrolled, setScrolled] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const W = { maxWidth: 1200, margin: "0 auto", padding: "0 20px" };

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 30);
    window.addEventListener("scroll", fn);
    return () => window.removeEventListener("scroll", fn);
  }, []);

  // Lock body scroll when drawer open
  useEffect(() => {
    document.body.style.overflow = drawerOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [drawerOpen]);

  const navLinks = [
    ["How it works", "#how"],
    ["Features", "#features"],
    ["Pricing", "#pricing"],
    ["FAQ", "#faq"],
  ];

  return (
    <div
      style={{
        background: "#030508",
        color: "#e2e8f0",
        fontFamily: "'Outfit',sans-serif",
        minHeight: "100vh",
        overflowX: "hidden",
        position: "relative",
      }}
    >
      <style>{G}</style>
      <ParticleNet />
      <CursorGlow />
      <div className="scanlines" />

      {/* MOBILE DRAWER */}
      <div
        className={`nav-drawer-overlay${drawerOpen ? " open" : ""}`}
        onClick={() => setDrawerOpen(false)}
      />
      <div className={`nav-drawer${drawerOpen ? " open" : ""}`}>
        {navLinks.map(([l, h]) => (
          <a key={h} href={h} onClick={() => setDrawerOpen(false)}>
            {l}
          </a>
        ))}
        <div style={{ marginTop: 16 }}>
          <a
            href="/login"
            className="cta-primary"
            style={{
              width: "100%",
              textAlign: "center",
              height: 44,
              fontSize: 14,
            }}
            onClick={() => setDrawerOpen(false)}
          >
            Continue on web
          </a>
        </div>
      </div>

      {/* NAV */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 300,
          borderBottom: `1px solid ${scrolled ? "rgba(0,255,135,.09)" : "rgba(255,255,255,.05)"}`,
          background: scrolled ? "rgba(3,5,8,.96)" : "rgba(3,5,8,.72)",
          backdropFilter: "blur(28px)",
          transition: "all .4s",
        }}
      >
        <div
          style={{
            ...W,
            height: 62,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <a
            href="#top"
            style={{ display: "flex", alignItems: "center", gap: 11 }}
          >
            <div style={{ position: "relative" }}>
              <div
                style={{
                  position: "absolute",
                  inset: -2,
                  borderRadius: 13,
                  background: "rgba(0,255,135,.15)",
                  filter: "blur(8px)",
                  opacity: 0.6,
                }}
              />
              <div
                style={{
                  position: "relative",
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  background:
                    "linear-gradient(135deg,rgba(0,255,135,.2),rgba(0,212,255,.1))",
                  border: "1px solid rgba(0,255,135,.22)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <img
                  src={logoUrl}
                  alt="Nummoria Logo"
                  style={{ width: 34, height: 34, borderRadius: 10 }}
                />
              </div>
            </div>
            <div>
              <div
                style={{
                  fontFamily: "'Syne',sans-serif",
                  fontWeight: 800,
                  fontSize: 15,
                  letterSpacing: "-.02em",
                }}
              >
                Nummoria
              </div>
              <div
                style={{
                  fontSize: 9,
                  color: "rgba(226,232,240,.38)",
                  letterSpacing: ".04em",
                }}
              >
                AI money clarity platform
              </div>
            </div>
          </a>

          {/* Desktop nav */}
          <nav
            className="desktop-nav"
            style={{ display: "flex", alignItems: "center", gap: 1 }}
          >
            {navLinks.map(([l, h]) => (
              <a
                key={h}
                href={h}
                style={{
                  padding: "7px 14px",
                  borderRadius: 100,
                  color: "rgba(226,232,240,.52)",
                  fontSize: 13.5,
                  fontWeight: 600,
                  transition: "all .2s",
                }}
                onMouseEnter={(e) => {
                  e.target.style.color = "#00ff87";
                  e.target.style.background = "rgba(0,255,135,.07)";
                }}
                onMouseLeave={(e) => {
                  e.target.style.color = "rgba(226,232,240,.52)";
                  e.target.style.background = "transparent";
                }}
              >
                {l}
              </a>
            ))}
          </nav>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <a
              href="/login"
              className="cta-primary desktop-nav"
              style={{
                height: 36,
                padding: "0 18px",
                fontSize: 12.5,
                whiteSpace: "nowrap",
              }}
            >
              Continue on web
            </a>

            {/* Burger */}
            <button
              className="burger-btn"
              onClick={() => setDrawerOpen(!drawerOpen)}
              style={{
                display: "none",
                alignItems: "center",
                justifyContent: "center",
                width: 40,
                height: 40,
                borderRadius: 10,
                background: "rgba(255,255,255,.06)",
                border: "1px solid rgba(255,255,255,.1)",
                color: "#e2e8f0",
                flexDirection: "column",
                gap: 5,
                padding: 0,
              }}
            >
              <span
                style={{
                  display: "block",
                  width: 18,
                  height: 2,
                  background: drawerOpen ? "#00ff87" : "currentColor",
                  borderRadius: 2,
                  transition: "all .3s",
                  transform: drawerOpen
                    ? "rotate(45deg) translateY(3.5px)"
                    : "none",
                }}
              />
              <span
                style={{
                  display: "block",
                  width: 18,
                  height: 2,
                  background: drawerOpen ? "#00ff87" : "currentColor",
                  borderRadius: 2,
                  transition: "all .3s",
                  transform: drawerOpen
                    ? "rotate(-45deg) translateY(-3.5px)"
                    : "none",
                  opacity: drawerOpen ? 1 : 1,
                }}
              />
            </button>
          </div>
        </div>
      </header>

      {/* TRUST TICKER */}
      <div
        style={{
          borderBottom: "1px solid rgba(255,255,255,.05)",
          background: "rgba(255,255,255,.015)",
          padding: "10px 0",
          overflow: "hidden",
          position: "relative",
          zIndex: 2,
        }}
      >
        <div className="ticker-wrap">
          <div className="ticker-inner">
            {[...Array(2)].map((_, dup) => (
              <span key={dup} style={{ display: "inline-flex" }}>
                {[
                  "✦  Unified ledger across all accounts",
                  "✦  Multi-currency tracking",
                  "✦  AI-powered financial insights",
                  "✦  Investments & portfolio overview",
                  "✦  No bank connection required",
                  "✦  Private by default",
                  "✦  Cancel anytime",
                  "✦  Real clarity. No generic advice.",
                ].map((t, i) => (
                  <span
                    key={i}
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: "rgba(226,232,240,.28)",
                      letterSpacing: ".06em",
                      padding: "0 32px",
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

      {/* HERO */}
      <section
        id="top"
        className="section-pad"
        style={{
          ...W,
          paddingTop: 62,
          paddingBottom: 50,
          position: "relative",
          zIndex: 1,
        }}
      >
        <div
          style={{
            position: "absolute",
            top: -200,
            left: "10%",
            width: 750,
            height: 550,
            borderRadius: "50%",
            background:
              "radial-gradient(ellipse,rgba(0,255,135,.055),transparent 62%)",
            pointerEvents: "none",
          }}
        />

        <div
          className="hero-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "1.08fr .92fr",
            gap: 68,
            alignItems: "center",
          }}
        >
          <div className="rv rv-lft">
            <div className="chip" style={{ marginBottom: 20 }}>
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: "#00ff87",
                  animation: "pulse-dot 2s ease-in-out infinite",
                }}
              />
              Your money. One system. Real clarity.
            </div>

            <h1
              style={{
                fontFamily: "'Syne',sans-serif",
                fontSize: "clamp(2rem,4.8vw,4rem)",
                fontWeight: 800,
                letterSpacing: "-.04em",
                lineHeight: 1.07,
              }}
            >
              Nummoria turns
              <br />
              your finances into <span className="grad-txt">{tw}</span>
              <span
                style={{
                  display: "inline-block",
                  width: 3,
                  height: "0.82em",
                  background: "#00ff87",
                  marginLeft: 4,
                  verticalAlign: "middle",
                  animation: "blink .85s step-end infinite",
                  boxShadow: "0 0 8px #00ff87",
                }}
              />
              <span>.</span>
            </h1>

            <p
              style={{
                marginTop: 18,
                fontSize: 15,
                color: "var(--muted)",
                lineHeight: 1.8,
                maxWidth: 460,
              }}
            >
              Track income, expenses, and investments in one place — then get
              AI-guided explanations and action steps based on your own data. No
              fluff. No generic advice.
            </p>

            <div
              className="hero-ctas"
              style={{
                marginTop: 26,
                display: "flex",
                flexWrap: "wrap",
                gap: 12,
                alignItems: "center",
              }}
            >
              <a href="/login" className="cta-primary">
                Open Web App
              </a>
              <a href="#how" className="cta-ghost">
                See how it works ↓
              </a>
            </div>

            <div
              className="store-row"
              style={{
                marginTop: 14,
                display: "flex",
                gap: 10,
                flexWrap: "wrap",
              }}
            >
              <StoreBadge type="apple" />
              <StoreBadge type="google" />
            </div>

            <div
              className="hero-badges"
              style={{
                marginTop: 28,
                display: "grid",
                gridTemplateColumns: "repeat(4,1fr)",
                gap: 10,
              }}
            >
              {[
                ["01", "Unified ledger"],
                ["02", "Multi-currency"],
                ["03", "Investments"],
                ["04", "AI mentor"],
              ].map(([k, v]) => (
                <div
                  key={k}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 13,
                    border: "1px solid rgba(255,255,255,.06)",
                    background: "rgba(255,255,255,.03)",
                    transition: "all .2s",
                  }}
                >
                  <div
                    style={{
                      fontFamily: "'DM Mono',monospace",
                      fontSize: 9,
                      color: "rgba(0,255,135,.55)",
                      marginBottom: 4,
                    }}
                  >
                    {k}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: "rgba(226,232,240,.68)",
                    }}
                  >
                    {v}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rv rv-rgt" style={{ position: "relative" }}>
            <HeroPhoneShowcase />
          </div>
        </div>
      </section>

      {/* METRICS BAR */}
      <div
        style={{
          borderTop: "1px solid rgba(255,255,255,.05)",
          borderBottom: "1px solid rgba(255,255,255,.05)",
          background: "rgba(255,255,255,.02)",
          position: "relative",
          zIndex: 1,
        }}
      >
        <div style={{ ...W, padding: "28px 20px" }}>
          <div
            className="metrics-grid"
            style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)" }}
          >
            {[
              { label: "Entries tracked", to: 2400000, suffix: "+" },
              { label: "Currencies supported", to: 60, suffix: "+" },
              { label: "AI insights generated", to: 180000, suffix: "+" },
              {
                label: "Avg. savings per user",
                to: 340,
                suffix: "/yr",
                prefix: "$",
              },
            ].map((s, i) => (
              <div
                key={i}
                className="rv rv-up"
                style={{
                  transitionDelay: `${i * 0.08}s`,
                  textAlign: "center",
                  padding: "16px 12px",
                  borderLeft:
                    i === 0 ? "none" : "1px solid rgba(255,255,255,.06)",
                }}
              >
                <div
                  style={{
                    fontFamily: "'Syne',sans-serif",
                    fontSize: "clamp(1.5rem,3vw,2.5rem)",
                    fontWeight: 800,
                    letterSpacing: "-.04em",
                    color: "#fff",
                    lineHeight: 1,
                    marginBottom: 8,
                  }}
                >
                  <Counter
                    to={s.to}
                    suffix={s.suffix}
                    prefix={s.prefix || ""}
                  />
                </div>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: "var(--muted)",
                    letterSpacing: ".03em",
                  }}
                >
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <Divider />

      {/* HOW IT WORKS */}
      <section
        id="how"
        className="section-pad"
        style={{
          ...W,
          paddingTop: 90,
          paddingBottom: 90,
          position: "relative",
          zIndex: 1,
        }}
      >
        <SectionHead
          label="HOW IT WORKS"
          title="3 steps. One clear system."
          sub="Nummoria is simple: capture your reality, structure it cleanly, and use AI to understand your decisions."
        />
        <div
          className="steps-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3,1fr)",
            gap: 16,
          }}
        >
          {[
            [
              "1",
              "Add entries (fast)",
              "Log expenses, income, and investments. Manual entry or imports. Multi-currency supported.",
            ],
            [
              "2",
              "Get a clear snapshot",
              "Your totals, trends, and allocation in one dashboard. No scattered spreadsheets.",
            ],
            [
              "3",
              "Ask AI, get tradeoffs",
              "AI explains what changed, why it matters, and what action improves your goal.",
            ],
          ].map(([n, t, d], i) => (
            <div
              key={n}
              className="rv rv-up"
              style={{
                transitionDelay: `${i * 0.1}s`,
                borderRadius: 24,
                border: "1px solid rgba(255,255,255,.07)",
                background: "rgba(255,255,255,.03)",
                padding: "28px 22px",
                position: "relative",
                overflow: "hidden",
                transition: "border-color .3s, background .3s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "rgba(0,255,135,.18)";
                e.currentTarget.style.background = "rgba(0,255,135,.03)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "rgba(255,255,255,.07)";
                e.currentTarget.style.background = "rgba(255,255,255,.03)";
              }}
            >
              <div className="ghost-num">{n}</div>
              <div
                style={{
                  fontFamily: "'DM Mono',monospace",
                  fontSize: 10,
                  fontWeight: 500,
                  letterSpacing: ".18em",
                  color: "rgba(0,255,135,.58)",
                  textTransform: "uppercase",
                  marginBottom: 12,
                }}
              >
                Step {n}
              </div>
              <div
                style={{
                  fontFamily: "'Syne',sans-serif",
                  fontSize: 20,
                  fontWeight: 700,
                  marginBottom: 12,
                  letterSpacing: "-.02em",
                }}
              >
                {t}
              </div>
              <div
                style={{ fontSize: 14, color: "var(--muted)", lineHeight: 1.8 }}
              >
                {d}
              </div>
              <div
                style={{
                  position: "absolute",
                  bottom: 0,
                  right: 0,
                  width: 90,
                  height: 90,
                  background:
                    "radial-gradient(circle at 85% 85%,rgba(0,255,135,.06),transparent 55%)",
                  borderRadius: "0 0 24px 0",
                  pointerEvents: "none",
                }}
              />
            </div>
          ))}
        </div>
      </section>

      <Divider />

      {/* FEATURES */}
      <section
        id="features"
        className="section-pad"
        style={{
          ...W,
          paddingTop: 90,
          paddingBottom: 90,
          position: "relative",
          zIndex: 1,
        }}
      >
        <SectionHead
          label="FEATURES"
          title="Built for real-world finance"
          sub="Every feature is designed around clarity, discipline, and long-term financial progress."
        />
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div
            className="feat-row-a"
            style={{ display: "grid", gridTemplateColumns: "58% 1fr", gap: 16 }}
          >
            <FeatureCard
              title="Unified ledger"
              accent="#00ff87"
              desc="Expenses, income, transfers, and investments — one coherent model."
              items={[
                "Multiple accounts",
                "Categories & rules",
                "Per-currency totals",
                "Exports & reports",
              ]}
            />
            <FeatureCard
              title="AI Financial Helper"
              accent="#00d4ff"
              desc="Data-driven, behavior-aware explanations and suggestions."
              items={[
                "Annualize habits",
                "Compare alternatives",
                "Break-even logic",
                "Scenario planning",
              ]}
            />
          </div>
          <div
            className="feat-row-b"
            style={{ display: "grid", gridTemplateColumns: "1fr 58%", gap: 16 }}
          >
            <FeatureCard
              title="Investments overview"
              accent="#a78bfa"
              desc="Track crypto, stocks, and manual assets together."
              items={[
                "Holdings & positions",
                "Allocation awareness",
                "Cost basis support",
                "Simple performance view",
              ]}
            />
            <FeatureCard
              title="Discipline-first workflows"
              accent="#00ff87"
              desc="Rules and reporting that keep you consistent over time."
              items={[
                "Recurring reminders",
                "Spend caps (optional)",
                "Clean monthly snapshot",
                "Decision-ready reports",
              ]}
            />
          </div>
        </div>
      </section>

      <Divider />

      {/* CONVICTION STRIP */}
      <div
        className="section-pad"
        style={{
          ...W,
          paddingTop: 60,
          paddingBottom: 60,
          position: "relative",
          zIndex: 1,
        }}
      >
        <div
          className="rv rv-up conviction-inner"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 48,
            borderRadius: 26,
            border: "1px solid rgba(255,255,255,.07)",
            background: "rgba(255,255,255,.025)",
            padding: "36px 32px",
            flexWrap: "wrap",
            justifyContent: "space-between",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 22,
              flexWrap: "wrap",
            }}
          >
            <OrbitVisual />
            <div>
              <div
                style={{
                  fontFamily: "'Syne',sans-serif",
                  fontSize: "clamp(1.3rem,2.5vw,2rem)",
                  fontWeight: 800,
                  letterSpacing: "-.03em",
                  marginBottom: 10,
                  lineHeight: 1.15,
                }}
              >
                Your financial clarity
                <br />
                starts with one entry.
              </div>
              <div
                style={{
                  fontSize: 14,
                  color: "var(--muted)",
                  lineHeight: 1.8,
                  maxWidth: 360,
                }}
              >
                Most users see a clear picture of their money within the first
                10 minutes. No setup calls. No financial complexity.
              </div>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {[
              ["No bank connection required", "Connect later — or never."],
              ["100% manual control", "Your data, your rules."],
              ["AI that knows your numbers", "Not generic templates."],
            ].map(([t, s]) => (
              <div
                key={t}
                style={{ display: "flex", alignItems: "flex-start", gap: 12 }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: "#00ff87",
                    flexShrink: 0,
                    marginTop: 6,
                    boxShadow: "0 0 8px #00ff87",
                  }}
                />
                <div>
                  <div
                    style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 2 }}
                  >
                    {t}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--muted)" }}>{s}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <Divider />

      {/* PRICING */}
      <section
        id="pricing"
        className="section-pad"
        style={{
          ...W,
          paddingTop: 90,
          paddingBottom: 90,
          position: "relative",
          zIndex: 1,
        }}
      >
        <div
          style={{
            position: "absolute",
            top: "5%",
            left: "50%",
            transform: "translateX(-50%)",
            width: 900,
            height: 460,
            borderRadius: "50%",
            background:
              "radial-gradient(ellipse,rgba(0,255,135,.035),transparent 62%)",
            pointerEvents: "none",
          }}
        />
        <SectionHead
          label="PRICING"
          title="Plans built for momentum"
          sub="Start free. Upgrade when you want deeper AI clarity. Cancel anytime."
        />
        <div
          className="price-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3,1fr)",
            gap: 20,
            alignItems: "stretch",
          }}
        >
          <PriceCard
            name="Standard"
            tagline="Track & report"
            price="$0"
            period="/month"
            accent="#94a3b8"
            bullets={["Track transactions", "Monthly reports", "Basic support"]}
            actionLabel="Your plan"
            current
          />
          <PriceCard
            name="Plus"
            tagline="AI clarity, every month"
            price="$4.99"
            period="/month"
            accent="#00ff87"
            bullets={[
              "Everything in Standard",
              "AI Financial Helper",
              "Smarter summaries",
              "Priority reports",
            ]}
            actionLabel="Upgrade to Plus"
            highlight="Most popular"
            plan="plus"
          />
          <PriceCard
            name="Premium"
            tagline="Advanced AI + priority support"
            price="$9.99"
            period="/month"
            accent="#00d4ff"
            bullets={[
              "Everything in Plus",
              "Advanced AI Financial Helper",
              "Priority support",
              "Early access features",
              "Data export",
              "Multi-currency support",
            ]}
            actionLabel="Upgrade to Premium"
            plan="premium"
          />
        </div>
        <p
          style={{
            textAlign: "center",
            fontSize: 12,
            color: "rgba(226,232,240,.32)",
            marginTop: 22,
            fontFamily: "'DM Mono',monospace",
          }}
        >
          Purchases are handled in the mobile app. Web remains fully usable.
        </p>
      </section>

      <Divider />

      {/* FAQ */}
      <section
        id="faq"
        className="section-pad"
        style={{
          maxWidth: 800,
          margin: "0 auto",
          padding: "90px 20px",
          position: "relative",
          zIndex: 1,
        }}
      >
        <SectionHead label="FAQ" title="Quick answers" />
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <FAQ
            q="Is this financial advice?"
            a="Nummoria provides educational guidance and decision support based on your inputs — not personalized investment advice."
          />
          <FAQ
            q="Does Nummoria support multiple currencies?"
            a="Yes. Track accounts and totals across currencies with clear summaries."
          />
          <FAQ
            q="Do I need to connect a bank?"
            a="No. You can track manually. Integrations can be added later without changing your workflow."
          />
          <FAQ
            q="Where do upgrades happen?"
            a="Purchases are handled in the mobile app. Web remains fully usable."
          />
        </div>
      </section>

      {/* CTA */}
      <section
        id="contact"
        style={{ ...W, paddingBottom: 90, position: "relative", zIndex: 1 }}
      >
        <div
          className="rv rv-scl cta-box"
          style={{
            borderRadius: 30,
            border: "1px solid rgba(0,255,135,.11)",
            background: "rgba(0,255,135,.022)",
            padding: "72px 56px",
            textAlign: "center",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: -100,
              right: -100,
              width: 300,
              height: 300,
              borderRadius: "50%",
              border: "1px solid rgba(0,255,135,.06)",
              animation: "spin-slow 25s linear infinite",
              pointerEvents: "none",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: 10,
                left: 10,
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "#00ff87",
                boxShadow: "0 0 10px #00ff87",
                transform: "translate(-50%,-50%)",
              }}
            />
          </div>
          <div
            style={{
              position: "absolute",
              bottom: -70,
              left: -70,
              width: 220,
              height: 220,
              borderRadius: "50%",
              border: "1px solid rgba(0,212,255,.05)",
              animation: "spin-rev 16s linear infinite",
              pointerEvents: "none",
            }}
          />
          <div
            style={{
              position: "absolute",
              top: -60,
              left: "50%",
              transform: "translateX(-50%)",
              width: 700,
              height: 350,
              borderRadius: "50%",
              background:
                "radial-gradient(ellipse,rgba(0,255,135,.06),transparent 58%)",
              pointerEvents: "none",
            }}
          />

          <div style={{ position: "relative" }}>
            <div className="chip" style={{ marginBottom: 20 }}>
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: "#00ff87",
                  animation: "pulse-dot 2s ease-in-out infinite",
                }}
              />
              Free to start. No credit card required.
            </div>
            <h3
              style={{
                fontFamily: "'Syne',sans-serif",
                fontSize: "clamp(1.6rem,4vw,3.2rem)",
                fontWeight: 800,
                letterSpacing: "-.035em",
                marginBottom: 16,
                lineHeight: 1.08,
              }}
            >
              Start today.
              <br />
              Get clarity tonight.
            </h3>
            <p
              style={{
                color: "var(--muted)",
                fontSize: 15,
                lineHeight: 1.8,
                maxWidth: 500,
                margin: "0 auto 32px",
              }}
            >
              Create an account, add your first entries, and get your first AI
              explanation immediately.
            </p>
            <div
              className="cta-bottom-row"
              style={{
                display: "flex",
                flexWrap: "wrap",
                justifyContent: "center",
                gap: 12,
              }}
            >
              <a
                href="/signup"
                className="cta-primary"
                style={{ height: 50, padding: "0 28px", fontSize: 14.5 }}
              >
                Create free account
              </a>
              <a
                href="/login"
                className="cta-ghost"
                style={{ height: 50, padding: "0 24px", fontSize: 13.5 }}
              >
                I already have an account
              </a>
              <StoreBadge type="apple" />
              <StoreBadge type="google" />
            </div>
          </div>
        </div>

        <footer
          style={{
            marginTop: 40,
            borderTop: "1px solid rgba(255,255,255,.07)",
            paddingTop: 24,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 14,
          }}
        >
          <div
            style={{
              fontFamily: "'DM Mono',monospace",
              fontSize: 12,
              color: "rgba(226,232,240,.3)",
            }}
          >
            © {new Date().getFullYear()} Nummoria
          </div>
          <nav style={{ display: "flex", gap: 24 }}>
            {[
              ["Privacy", "/privacy"],
              ["Terms", "/terms"],
              ["Contact", "/contact"],
            ].map(([l, h]) => (
              <a
                key={h}
                href={h}
                style={{
                  fontSize: 12,
                  color: "rgba(226,232,240,.32)",
                  transition: "color .2s",
                }}
                onMouseEnter={(e) => {
                  e.target.style.color = "#00ff87";
                }}
                onMouseLeave={(e) => {
                  e.target.style.color = "rgba(226,232,240,.32)";
                }}
              >
                {l}
              </a>
            ))}
          </nav>
        </footer>
      </section>
    </div>
  );
}