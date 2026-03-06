/* eslint-disable no-empty */
/* eslint-disable no-unused-vars */
// src/pages/Login.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import api from "../lib/api";
import Footer from "../components/Footer";

const logoUrl = new URL("../assets/nummoria_logo.png", import.meta.url).href;
const loginBgUrl = new URL("../assets/loginAlt.jpg", import.meta.url).href;

/* ─── WELCOME LANDING BACKGROUND STYLES (COPIED) ─── */
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

  body {
    background: var(--bg);
    color: var(--txt);
    font-family: 'Outfit', sans-serif;
    overflow-x: hidden;
  }

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

  .cursor-glow {
    position: fixed;
    width: 500px;
    height: 500px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(0,255,135,.04) 0%, transparent 65%);
    pointer-events: none;
    transform: translate(-50%,-50%);
    transition: left .1s ease, top .1s ease;
    z-index: 0;
  }

  .scanlines {
    position: fixed;
    inset: 0;
    z-index: 9999;
    pointer-events: none;
    background: repeating-linear-gradient(
      0deg,
      transparent,
      transparent 2px,
      rgba(0,0,0,.018) 2px,
      rgba(0,0,0,.018) 4px
    );
  }

  .auth-glass {
    border: 1px solid rgba(255,255,255,.08);
    background: rgba(255,255,255,.045);
    backdrop-filter: blur(26px);
    -webkit-backdrop-filter: blur(26px);
    box-shadow: 0 30px 80px -40px rgba(0,0,0,.7);
  }

  .auth-input {
    width: 100%;
    border-radius: 16px;
    border: 1px solid rgba(255,255,255,.10);
    background: rgba(255,255,255,.05);
    color: #e2e8f0;
    padding: 12px 14px;
    outline: none;
    transition: border-color .2s, background .2s, box-shadow .2s;
  }

  .auth-input::placeholder {
    color: rgba(226,232,240,.28);
  }

  .auth-input:focus {
    border-color: rgba(0,255,135,.28);
    box-shadow: 0 0 0 3px rgba(0,255,135,.08);
    background: rgba(255,255,255,.06);
  }

  .auth-label {
    display: block;
    margin-bottom: 6px;
    font-size: 13px;
    color: rgba(226,232,240,.72);
    font-weight: 500;
  }

  .cta-primary-auth {
    width: 100%;
    height: 48px;
    border-radius: 999px;
    background: linear-gradient(135deg, #00ff87, #00d4ff);
    color: #04110a;
    font-size: 14px;
    font-weight: 800;
    transition: transform .2s, box-shadow .2s, opacity .2s;
    box-shadow: 0 0 28px rgba(0,255,135,.22);
  }

  .cta-primary-auth:hover {
    transform: translateY(-1px);
    box-shadow: 0 8px 38px rgba(0,255,135,.28);
  }

  .cta-secondary-auth {
    width: 100%;
    height: 48px;
    border-radius: 999px;
    border: 1px solid rgba(255,255,255,.14);
    background: rgba(255,255,255,.05);
    color: rgba(226,232,240,.86);
    font-size: 14px;
    font-weight: 700;
    transition: transform .2s, border-color .2s, background .2s;
  }

  .cta-secondary-auth:hover {
    transform: translateY(-1px);
    border-color: rgba(0,255,135,.22);
    background: rgba(0,255,135,.05);
  }

  .auth-divider {
    height: 1px;
    background: linear-gradient(
      to right,
      transparent,
      rgba(255,255,255,.10),
      transparent
    );
  }
`;

/* ─── PARTICLE CANVAS (COPIED) ─── */
function ParticleNet() {
  const cvs = useRef(null);
  const mouse = useRef({ x: -9999, y: -9999 });

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

    const onMove = (e) => {
      mouse.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener("mousemove", onMove);

    const N = 68;
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
          const dx = pts[i].x - pts[j].x;
          const dy = pts[i].y - pts[j].y;
          const d = Math.hypot(dx, dy);

          if (d < 115) {
            ctx.beginPath();
            ctx.strokeStyle = `rgba(0,255,135,${0.06 * (1 - d / 115)})`;
            ctx.lineWidth = 0.35;
            ctx.moveTo(pts[i].x, pts[i].y);
            ctx.lineTo(pts[j].x, pts[j].y);
            ctx.stroke();
          }
        }

        const mdx = pts[i].x - mx;
        const mdy = pts[i].y - my;
        const md = Math.hypot(mdx, mdy);

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
      window.removeEventListener("mousemove", onMove);
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

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from;

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginErr, setLoginErr] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginReason, setLoginReason] = useState("");

  const [name, setName] = useState("");
  const [signEmail, setSignEmail] = useState("");
  const [signPassword, setSignPassword] = useState("");
  const [signErr, setSignErr] = useState("");
  const [signLoading, setSignLoading] = useState(false);

  const [socialLoading, setSocialLoading] = useState("");
  const [socialErr, setSocialErr] = useState("");

  const [meProbe, setMeProbe] = useState({
    tried: false,
    ok: false,
    body: null,
  });
  const [lastSetCookieSeen, setLastSetCookieSeen] = useState(null);

  const API_BASE =
    (api?.defaults?.baseURL || "").replace(/\/+$/, "") ||
    window.location.origin;

  const [showVerify, setShowVerify] = useState(false);
  const [verifyEmail, setVerifyEmail] = useState("");
  const [regToken, setRegToken] = useState(
    localStorage.getItem("regToken") || "",
  );
  const [code, setCode] = useState("");
  const [verifyMsg, setVerifyMsg] = useState("");
  const [verifyErr, setVerifyErr] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);

  const maskedEmail = useMemo(() => {
    const email = verifyEmail?.trim();
    if (!email) return "";
    const [u, d] = email.split("@");
    if (!d) return email;
    const maskU =
      u.length <= 2
        ? u[0] + "*"
        : u[0] + "*".repeat(Math.max(1, u.length - 2)) + u[u.length - 1];
    return `${maskU}@${d}`;
  }, [verifyEmail]);

  useEffect(() => {
    if (showVerify) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [showVerify]);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/me", { withCredentials: true });
        setMeProbe({ tried: true, ok: true, body: data });
      } catch (e) {
        setMeProbe({
          tried: true,
          ok: false,
          body: e?.response?.data || { error: e?.message || "Unknown" },
        });
      }
    })();
  }, []);

  async function goPostLogin() {
    if (from) {
      navigate(from, { replace: true });
      return;
    }

    try {
      const { data } = await api.get("/me", { withCredentials: true });
      const user = data?.user ?? data;
      if (user?.role === "admin") {
        navigate("/admin/users", { replace: true });
        return;
      }
    } catch (e) {}

    navigate("/dashboard", { replace: true });
  }

  async function onLogin(e) {
    e.preventDefault();
    setLoginErr("");
    setLoginReason("");
    setLoginLoading(true);

    try {
      const resp = await api.post(
        "/auth/login",
        { email: loginEmail, password: loginPassword },
        { withCredentials: true },
      );

      const data = resp?.data || {};

      if (data?.user?.id) {
        localStorage.setItem("defaultId", data.user.id);
        localStorage.setItem("userEmail", data.user.email || "");
        localStorage.setItem("userName", data.user.name || "");
      }

      if (data?.token) localStorage.setItem("token", data.token);

      try {
        const meResp = await api.get("/me", { withCredentials: true });
        setMeProbe({ tried: true, ok: true, body: meResp.data });
        await goPostLogin();
        return;
      } catch (meErr) {
        const body = meErr?.response?.data || {
          error: meErr?.message || "Unknown",
        };
        setMeProbe({ tried: true, ok: false, body });
        await goPostLogin();
        return;
      }
    } catch (e) {
      const status = e.response?.status;
      const body = e.response?.data || {};
      const errMsg = body.error || "Login failed";

      if (
        status === 403 &&
        (body.reason === "UNVERIFIED" || body.needsVerification === true)
      ) {
        const email = (loginEmail || "").trim();
        setVerifyEmail(email);
        setLoginReason("UNVERIFIED");
        const message = body.maskedEmail
          ? `Your account isn't verified yet. Check your inbox (${body.maskedEmail}) or resend the code.`
          : "Your account isn't verified yet. Check your inbox or resend the code.";
        setLoginErr(message);
        setLoginLoading(false);
        return;
      }

      setLoginErr(errMsg);
    } finally {
      setLoginLoading(false);
    }
  }

  async function onSignup(e) {
    e.preventDefault();
    setSignErr("");
    setSignLoading(true);

    try {
      const { data } = await api.post(
        "/auth/register",
        { name, email: signEmail, password: signPassword },
        { withCredentials: true },
      );

      const email = (signEmail || "").trim();
      setVerifyEmail(email);
      localStorage.setItem("pendingVerifyEmail", email);

      if (data?.regToken) {
        setRegToken(data.regToken);
        localStorage.setItem("regToken", data.regToken);
      } else {
        setRegToken("");
        localStorage.removeItem("regToken");
      }

      setShowVerify(true);
    } catch (e) {
      setSignErr(e.response?.data?.error || "Registration failed");
    } finally {
      setSignLoading(false);
    }
  }

  function startSocial(provider) {
    try {
      setSocialErr("");
      setSocialLoading(provider);

      const nextPath = from || "/dashboard";
      const next = encodeURIComponent(`${window.location.origin}${nextPath}`);

      const url = `${API_BASE}/auth/${provider}?next=${next}`;
      window.location.href = url;
    } catch (err) {
      setSocialErr(`Could not start social sign-in. Please try again: ${err}`);
      setSocialLoading("");
    }
  }

  async function onVerifySubmit(e) {
    e.preventDefault();
    if (!verifyEmail && !regToken) return;
    setVerifyErr("");
    setVerifyMsg("");
    setVerifying(true);

    try {
      const payload = regToken
        ? { regToken, code: code.trim() }
        : { email: verifyEmail, code: code.trim() };

      await api.post("/auth/verify-email", payload, { withCredentials: true });

      setVerifyMsg("Email verified! Signing you in…");

      const { data } = await api.post(
        "/auth/login",
        { email: verifyEmail, password: signPassword || loginPassword },
        { withCredentials: true },
      );

      if (data?.user?.id) {
        localStorage.setItem("defaultId", data.user.id);
        localStorage.setItem("userEmail", data.user.email || "");
        localStorage.setItem("userName", data.user.name || "");
      }
      if (data?.token) localStorage.setItem("token", data.token);

      localStorage.removeItem("pendingVerifyEmail");
      localStorage.removeItem("regToken");
      setRegToken("");

      try {
        const meResp = await api.get("/me", { withCredentials: true });
        setMeProbe({ tried: true, ok: true, body: meResp.data });
      } catch (meErr) {
        setMeProbe({
          tried: true,
          ok: false,
          body: meErr?.response?.data || { error: meErr?.message || "Unknown" },
        });
      }

      await goPostLogin();
    } catch (e) {
      setVerifyErr(
        e.response?.data?.error ||
          "Verification failed. Check the code and try again.",
      );
    } finally {
      setVerifying(false);
    }
  }

  async function onResendCode() {
    if (!verifyEmail && !regToken) return;
    setVerifyErr("");
    setVerifyMsg("");
    setResending(true);

    try {
      const payload = regToken ? { regToken } : { email: verifyEmail };
      const { data } = await api.post("/auth/resend-code", payload, {
        withCredentials: true,
      });

      if (data?.regToken) {
        setRegToken(data.regToken);
        localStorage.setItem("regToken", data.regToken);
      }

      setVerifyMsg("A new verification code was sent.");
    } catch (e) {
      setVerifyErr(e.response?.data?.error || "Could not resend the code.");
    } finally {
      setResending(false);
    }
  }

  return (
    <div
      style={{
        background: "#030508",
        color: "#e2e8f0",
        fontFamily: "'Outfit', sans-serif",
        minHeight: "100vh",
        overflowX: "hidden",
        position: "relative",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <style>{G}</style>
      <ParticleNet />
      <CursorGlow />
      <div className="scanlines" />

      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 0,
          pointerEvents: "none",
          background: `
            radial-gradient(ellipse at top left, rgba(0,255,135,0.06), transparent 40%),
            radial-gradient(ellipse at top right, rgba(0,212,255,0.05), transparent 42%),
            radial-gradient(ellipse at bottom center, rgba(167,139,250,0.04), transparent 40%)
          `,
        }}
      />

      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 0,
          pointerEvents: "none",
          backgroundImage: `linear-gradient(rgba(3,5,8,.45), rgba(3,5,8,.8)), url(${loginBgUrl})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          opacity: 0.18,
        }}
      />

      <main
        style={{
          position: "relative",
          zIndex: 2,
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "40px 20px",
        }}
      >
        <div style={{ width: "100%", maxWidth: 1240 }}>
          <div
            className="auth-glass"
            style={{
              width: "100%",
              borderRadius: 30,
              overflow: "hidden",
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
            }}
          >
            {/* LEFT */}
            <div
              style={{
                padding: "42px 38px",
                background:
                  "linear-gradient(180deg, rgba(0,255,135,.06), rgba(255,255,255,.02))",
                borderRight: "1px solid rgba(255,255,255,.07)",
                position: "relative",
              }}
            >
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "4px 12px",
                  borderRadius: 999,
                  border: "1px solid rgba(0,255,135,.22)",
                  background: "rgba(0,255,135,.07)",
                  fontSize: 11,
                  fontWeight: 700,
                  color: "#00ff87",
                  letterSpacing: ".04em",
                  marginBottom: 22,
                }}
              >
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    background: "#00ff87",
                    animation: "pulse-dot 2s ease-in-out infinite",
                  }}
                />
                SECURE LOGIN
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <img
                  src={logoUrl}
                  alt="Nummoria Logo"
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 12,
                    border: "1px solid rgba(0,255,135,.22)",
                  }}
                />
                <div>
                  <div
                    style={{
                      fontFamily: "'Syne', sans-serif",
                      fontWeight: 800,
                      fontSize: 17,
                      letterSpacing: "-.02em",
                    }}
                  >
                    Nummoria
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: "rgba(226,232,240,.42)",
                      letterSpacing: ".04em",
                    }}
                  >
                    AI money clarity platform
                  </div>
                </div>
              </div>

              <h1
                style={{
                  marginTop: 26,
                  fontFamily: "'Syne', sans-serif",
                  fontSize: "clamp(2.3rem, 4vw, 3.3rem)",
                  fontWeight: 800,
                  lineHeight: 1.06,
                  letterSpacing: "-.04em",
                }}
              >
                Welcome back.
              </h1>

              <p
                style={{
                  marginTop: 14,
                  fontSize: 15,
                  color: "rgba(226,232,240,.56)",
                  lineHeight: 1.8,
                  maxWidth: 440,
                }}
              >
                Sign in to continue tracking your money with a cleaner, sharper,
                aerospace-grade interface.
              </p>

              <form onSubmit={onLogin} style={{ marginTop: 28 }}>
                {loginErr && (
                  <div
                    style={{
                      marginBottom: 16,
                      fontSize: 13,
                      borderRadius: 14,
                      padding: "12px 14px",
                      background: "rgba(255, 80, 80, .08)",
                      border: "1px solid rgba(255, 80, 80, .18)",
                      color: "#fecaca",
                    }}
                  >
                    {loginErr}
                    {loginReason === "UNVERIFIED" && (
                      <div
                        style={{
                          marginTop: 10,
                          display: "flex",
                          gap: 14,
                          flexWrap: "wrap",
                        }}
                      >
                        <button
                          type="button"
                          style={{
                            background: "transparent",
                            color: "#e2e8f0",
                            textDecoration: "underline",
                          }}
                          onClick={() => onResendCode()}
                          disabled={!verifyEmail && !regToken}
                        >
                          Resend code
                        </button>
                        <button
                          type="button"
                          style={{
                            background: "transparent",
                            color: "#e2e8f0",
                            textDecoration: "underline",
                          }}
                          onClick={() => setShowVerify(true)}
                        >
                          Enter code
                        </button>
                      </div>
                    )}
                  </div>
                )}

                <div style={{ marginBottom: 14 }}>
                  <label className="auth-label">Email</label>
                  <input
                    type="email"
                    className="auth-input"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="you@nummoria.com"
                    required
                  />
                </div>

                <div style={{ marginBottom: 16 }}>
                  <label className="auth-label">Password</label>
                  <input
                    type="password"
                    className="auth-input"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                  />
                </div>

                <button className="cta-primary-auth" disabled={loginLoading}>
                  {loginLoading ? "SIGNING IN..." : "SIGN IN"}
                </button>

                <div style={{ marginTop: 14, fontSize: 13 }}>
                  <a
                    href="/forgot-password"
                    style={{
                      color: "rgba(226,232,240,.72)",
                      textDecoration: "underline",
                    }}
                  >
                    Forgot password?
                  </a>
                </div>
              </form>
            </div>

            {/* RIGHT */}
            <div
              style={{
                padding: "42px 38px",
                background: "rgba(255,255,255,.015)",
                position: "relative",
              }}
            >
              <h2
                style={{
                  fontFamily: "'Syne', sans-serif",
                  fontSize: 36,
                  fontWeight: 800,
                  letterSpacing: "-.04em",
                  color: "#fff",
                }}
              >
                Create account
              </h2>

              <p
                style={{
                  marginTop: 10,
                  color: "rgba(226,232,240,.54)",
                  fontSize: 14,
                }}
              >
                Start with your email or continue with a social account.
              </p>

              <div style={{ marginTop: 22 }}>
                {socialErr && (
                  <div
                    style={{
                      marginBottom: 14,
                      fontSize: 13,
                      color: "#fecaca",
                    }}
                  >
                    {socialErr}
                  </div>
                )}

                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <button
                    type="button"
                    aria-label="Continue with Google"
                    title="Continue with Google"
                    disabled={!!socialLoading}
                    onClick={() => {
                      setSocialLoading("google");
                      const apiUrl =
                        import.meta.env.VITE_API_URL || "http://localhost:4000";
                      const nextPath = from || "/dashboard";
                      window.location.href = `${apiUrl}/auth/google?next=${encodeURIComponent(
                        nextPath,
                      )}`;
                    }}
                    style={socialBtnStyle}
                  >
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 48 48"
                      aria-hidden="true"
                    >
                      <path
                        fill="#FFC107"
                        d="M43.611 20.083H42V20H24v8h11.303C33.659 32.657 29.239 36 24 36c-6.627 0-12-5.373-12-12S17.373 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.27 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
                      />
                      <path
                        fill="#FF3D00"
                        d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.27 4 24 4c-7.682 0-14.347 4.337-17.694 10.691z"
                      />
                      <path
                        fill="#4CAF50"
                        d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.17 35.091 26.715 36 24 36c-5.219 0-9.629-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
                      />
                      <path
                        fill="#1976D2"
                        d="M43.611 20.083H42V20H24v8h11.303a12.053 12.053 0 0 1-4.084 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
                      />
                    </svg>
                  </button>

                  <button
                    type="button"
                    aria-label="Continue with X"
                    title="Continue with X"
                    disabled={!!socialLoading}
                    onClick={() => startSocial("twitter")}
                    style={socialBtnStyle}
                  >
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path
                        fill="currentColor"
                        d="M18.244 2H21.5l-7.42 8.49L22 22h-6.77l-5.3-6.97L4.77 22H1.5l7.92-9.05L2 2h6.91l4.79 6.39L18.244 2zm-2.37 18h2.11L8.21 4H6.01l9.864 16z"
                      />
                    </svg>
                  </button>

                  <button
                    type="button"
                    aria-label="Continue with GitHub"
                    title="Continue with GitHub"
                    disabled={!!socialLoading}
                    onClick={() => startSocial("github")}
                    style={socialBtnStyle}
                  >
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path
                        fill="currentColor"
                        d="M12 .5C5.649.5.5 5.649.5 12A11.5 11.5 0 0 0 8.36 22.91c.575.106.785-.25.785-.556 0-.274-.01-1-.015-1.962-3.197.695-3.872-1.54-3.872-1.54-.523-1.327-1.278-1.68-1.278-1.68-1.045-.714.08-.7.08-.7 1.155.081 1.763 1.187 1.763 1.187 1.026 1.758 2.692 1.25 3.348.956.104-.744.402-1.25.731-1.538-2.552-.29-5.238-1.276-5.238-5.68 0-1.255.448-2.28 1.183-3.083-.119-.29-.513-1.46.112-3.045 0 0 .965-.309 3.162 1.177A10.98 10.98 0 0 1 12 6.09c.975.005 1.958.132 2.875.388 2.195-1.486 3.158-1.177 3.158-1.177.627 1.585.233 2.755.115 3.045.737.803 1.181 1.828 1.181 3.083 0 4.415-2.69 5.386-5.255 5.67.413.355.78 1.057.78 2.132 0 1.54-.014 2.781-.014 3.16 0 .31.207.669.79.555A11.502 11.502 0 0 0 23.5 12C23.5 5.649 18.351.5 12 .5z"
                      />
                    </svg>
                  </button>

                  {socialLoading && (
                    <span
                      style={{ fontSize: 13, color: "rgba(226,232,240,.42)" }}
                    >
                      Redirecting to {socialLoading}…
                    </span>
                  )}
                </div>

                <div style={{ marginTop: 22 }} className="auth-divider" />

                <p
                  style={{
                    marginTop: 18,
                    marginBottom: 16,
                    color: "rgba(226,232,240,.42)",
                    fontSize: 13,
                  }}
                >
                  or use your email for registration:
                </p>
              </div>

              <form onSubmit={onSignup}>
                {signErr && (
                  <div
                    style={{
                      marginBottom: 16,
                      fontSize: 13,
                      color: "#fecaca",
                    }}
                  >
                    {signErr}
                  </div>
                )}

                <div style={{ marginBottom: 14 }}>
                  <label className="auth-label">Name</label>
                  <input
                    className="auth-input"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                    required
                  />
                </div>

                <div style={{ marginBottom: 14 }}>
                  <label className="auth-label">Email</label>
                  <input
                    type="email"
                    className="auth-input"
                    value={signEmail}
                    onChange={(e) => setSignEmail(e.target.value)}
                    placeholder="you@nummoria.com"
                    required
                  />
                </div>

                <div style={{ marginBottom: 18 }}>
                  <label className="auth-label">Password</label>
                  <input
                    type="password"
                    className="auth-input"
                    value={signPassword}
                    onChange={(e) => setSignPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    minLength={8}
                    required
                  />
                </div>

                <button className="cta-secondary-auth" disabled={signLoading}>
                  {signLoading ? "CREATING..." : "SIGN UP"}
                </button>

                <div
                  style={{
                    marginTop: 16,
                    fontSize: 12,
                    lineHeight: 1.8,
                    color: "rgba(226,232,240,.44)",
                    textAlign: "center",
                  }}
                >
                  By continuing you agree to our{" "}
                  <a href="/terms" style={{ textDecoration: "underline" }}>
                    Terms
                  </a>{" "}
                  and{" "}
                  <a href="/privacy" style={{ textDecoration: "underline" }}>
                    Privacy Policy
                  </a>
                  .
                </div>

                <div
                  style={{
                    marginTop: 12,
                    fontSize: 13,
                    color: "rgba(226,232,240,.52)",
                  }}
                >
                  Already have an account?{" "}
                  <a
                    href="#"
                    style={{ color: "#00ff87", textDecoration: "underline" }}
                  >
                    Sign in on the left
                  </a>
                </div>
              </form>
            </div>
          </div>
        </div>
      </main>

      <footer style={{ position: "relative", zIndex: 2 }}>
        <Footer fullBleed className="bg-transparent" />
      </footer>

      {showVerify && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 100,
            display: "grid",
            placeItems: "center",
            background: "rgba(0,0,0,.62)",
            backdropFilter: "blur(8px)",
            padding: 16,
          }}
        >
          <div
            className="auth-glass"
            style={{
              width: "100%",
              maxWidth: 460,
              borderRadius: 24,
              padding: 24,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "start",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <h2
                style={{
                  fontFamily: "'Syne', sans-serif",
                  fontSize: 24,
                  fontWeight: 800,
                  letterSpacing: "-.03em",
                }}
              >
                Verify your email
              </h2>

              <button
                onClick={() => setShowVerify(false)}
                aria-label="Close"
                title="Close"
                style={{
                  background: "transparent",
                  color: "rgba(226,232,240,.68)",
                  fontSize: 24,
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            </div>

            <p
              style={{
                marginTop: 8,
                fontSize: 14,
                color: "rgba(226,232,240,.56)",
              }}
            >
              We sent a 6-digit code to{" "}
              <span style={{ color: "#fff", fontWeight: 600 }}>
                {maskedEmail}
              </span>
              .
            </p>

            <form onSubmit={onVerifySubmit} style={{ marginTop: 18 }}>
              {verifyErr && (
                <div
                  style={{
                    marginBottom: 14,
                    fontSize: 13,
                    borderRadius: 12,
                    padding: "10px 12px",
                    background: "rgba(255,80,80,.08)",
                    border: "1px solid rgba(255,80,80,.18)",
                    color: "#fecaca",
                  }}
                >
                  {verifyErr}
                </div>
              )}

              {verifyMsg && (
                <div
                  style={{
                    marginBottom: 14,
                    fontSize: 13,
                    borderRadius: 12,
                    padding: "10px 12px",
                    background: "rgba(0,255,135,.08)",
                    border: "1px solid rgba(0,255,135,.18)",
                    color: "#bbf7d0",
                  }}
                >
                  {verifyMsg}
                </div>
              )}

              <div style={{ marginBottom: 16 }}>
                <label className="auth-label">Verification Code</label>
                <input
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  className="auth-input"
                  placeholder="Enter 6-digit code"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  required
                />
              </div>

              <button
                className="cta-primary-auth"
                disabled={verifying || (!verifyEmail && !regToken)}
              >
                {verifying ? "VERIFYING…" : "VERIFY & CONTINUE"}
              </button>
            </form>

            <div
              style={{
                marginTop: 16,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 16,
                fontSize: 13,
                color: "rgba(226,232,240,.54)",
              }}
            >
              <span>Didn’t get the code?</span>
              <button
                onClick={onResendCode}
                disabled={resending || (!verifyEmail && !regToken)}
                style={{
                  background: "transparent",
                  color: "#00ff87",
                  textDecoration: "underline",
                }}
              >
                {resending ? "Resending…" : "Resend code"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const socialBtnStyle = {
  width: 42,
  height: 42,
  borderRadius: "50%",
  border: "1px solid rgba(255,255,255,.10)",
  background: "rgba(255,255,255,.05)",
  color: "#e2e8f0",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  transition: "transform .2s, border-color .2s, background .2s",
};
