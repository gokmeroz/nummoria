/* eslint-disable no-empty */
/* eslint-disable no-unused-vars */
// src/pages/Login.jsx
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import api from "../lib/api";
import Footer from "../components/Footer";

const logoUrl = new URL("../assets/nummoria_logo.png", import.meta.url).href;
const loginBgUrl = new URL("../assets/loginAlt.jpg", import.meta.url).href;

const BG = "#030508";
const MINT = "#00ff87";
const CYAN = "#00d4ff";
const VIOLET = "#a78bfa";
const CARD_BG = "rgba(255,255,255,0.025)";
const CARD_BD = "rgba(255,255,255,0.07)";
const T_HI = "#e2e8f0";
const T_MID = "rgba(226,232,240,0.55)";
const T_DIM = "rgba(226,232,240,0.32)";
const DANGER = "#fb7185";

const HUD_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap');

  :root {
    --bg: #030508;
    --mint: #00ff87;
    --cyan: #00d4ff;
    --violet: #a78bfa;
    --card-bg: rgba(255,255,255,0.025);
    --card-bd: rgba(255,255,255,0.07);
    --t-hi: #e2e8f0;
    --t-mid: rgba(226,232,240,0.55);
    --t-dim: rgba(226,232,240,0.32);
    --danger: #fb7185;
  }

  * {
    box-sizing: border-box;
  }

  html,
  body,
  #root {
    min-height: 100%;
    background: var(--bg);
    color: var(--t-hi);
    font-family: 'Outfit', sans-serif;
  }

  body {
    margin: 0;
    overflow-x: hidden;
  }

  @keyframes pulse-dot {
    0%, 100% { transform: scale(1); opacity: .6; }
    50% { transform: scale(1.5); opacity: 1; }
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .hud-shell {
    min-height: 100vh;
    background:
      linear-gradient(rgba(3,5,8,.78), rgba(3,5,8,.86)),
      radial-gradient(circle at 12% 18%, rgba(0,255,135,.08), transparent 22%),
      radial-gradient(circle at 86% 12%, rgba(0,212,255,.08), transparent 24%),
      radial-gradient(circle at 50% 78%, rgba(167,139,250,.07), transparent 28%),
      url("${loginBgUrl}"),
      #030508;
    background-size: auto, auto, auto, auto, cover, auto;
    background-position: center, center, center, center, center, center;
    background-attachment: fixed;
    position: relative;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .hud-shell::before {
    content: "";
    position: fixed;
    inset: 0;
    pointer-events: none;
    background:
      linear-gradient(rgba(0,255,135,.035) 1px, transparent 1px),
      linear-gradient(90deg, rgba(0,212,255,.025) 1px, transparent 1px);
    background-size: 110px 72px;
    opacity: .7;
    z-index: 0;
  }

  .hud-shell::after {
    content: "";
    position: fixed;
    inset: 0;
    pointer-events: none;
    background: repeating-linear-gradient(
      0deg,
      transparent,
      transparent 2px,
      rgba(0,0,0,.03) 2px,
      rgba(0,0,0,.03) 4px
    );
    z-index: 0;
  }

  .hud-main {
    position: relative;
    z-index: 1;
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 32px 16px 40px;
  }

  .hud-card {
    width: min(100%, 1180px);
    position: relative;
    border-radius: 4px;
    border: 1px solid rgba(0,255,135,0.18);
    background: rgba(0,255,135,0.035);
    overflow: hidden;
    box-shadow: 0 40px 100px rgba(0,0,0,.45);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
  }

  .hud-card::before {
    content: "";
    position: absolute;
    left: 10%;
    right: 10%;
    top: 0;
    height: 1.5px;
    background: var(--mint);
    opacity: .65;
  }

  .hud-card::after {
    content: "";
    position: absolute;
    inset: 0;
    pointer-events: none;
    background: linear-gradient(
      180deg,
      rgba(255,255,255,.03),
      transparent 28%,
      transparent 72%,
      rgba(255,255,255,.02)
    );
  }

  .hud-grid {
    display: grid;
    grid-template-columns: 1.05fr .95fr;
    min-height: 760px;
  }

  .hud-panel {
    position: relative;
    padding: 24px;
    z-index: 1;
  }

  .hud-left {
    border-right: 1px solid rgba(255,255,255,0.06);
    background: linear-gradient(180deg, rgba(0,255,135,.025), rgba(255,255,255,.015));
  }

  .hud-right {
    background: rgba(255,255,255,.015);
  }

  .hud-topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 18px;
  }

  .hud-logoRow {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .hud-statusDot {
    width: 6px;
    height: 6px;
    border-radius: 999px;
    background: var(--mint);
    animation: pulse-dot 2s ease-in-out infinite;
  }

  .hud-logoTxt {
    font-size: 13px;
    font-weight: 800;
    color: var(--t-hi);
    letter-spacing: 3px;
  }

  .hud-livePill {
    padding: 4px 8px;
    border-radius: 2px;
    border: 1px solid rgba(0,255,135,0.25);
    background: rgba(0,255,135,0.12);
    color: var(--mint);
    font-size: 8px;
    font-weight: 800;
    letter-spacing: 1.3px;
    white-space: nowrap;
  }

  .hud-homeBtn {
    width: 40px;
    height: 40px;
    border-radius: 2px;
    overflow: hidden;
    border: 1px solid rgba(0,255,135,0.20);
    background: rgba(255,255,255,0.04);
    display: grid;
    place-items: center;
    position: relative;
    flex-shrink: 0;
    cursor: pointer;
  }

  .hud-homeBtn img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .hud-bracket {
    position: absolute;
    width: var(--size, 10px);
    height: var(--size, 10px);
    pointer-events: none;
  }

  .hud-bracket.tl {
    top: 0;
    left: 0;
    border-top: var(--thick, 1.5px) solid var(--color, var(--mint));
    border-left: var(--thick, 1.5px) solid var(--color, var(--mint));
  }

  .hud-bracket.tr {
    top: 0;
    right: 0;
    border-top: var(--thick, 1.5px) solid var(--color, var(--mint));
    border-right: var(--thick, 1.5px) solid var(--color, var(--mint));
  }

  .hud-bracket.bl {
    bottom: 0;
    left: 0;
    border-bottom: var(--thick, 1.5px) solid var(--color, var(--mint));
    border-left: var(--thick, 1.5px) solid var(--color, var(--mint));
  }

  .hud-bracket.br {
    bottom: 0;
    right: 0;
    border-bottom: var(--thick, 1.5px) solid var(--color, var(--mint));
    border-right: var(--thick, 1.5px) solid var(--color, var(--mint));
  }

  .hud-heroTitle {
    font-size: clamp(2.2rem, 4vw, 3.75rem);
    line-height: .98;
    letter-spacing: -.06em;
    font-weight: 800;
    color: var(--t-hi);
    margin: 0 0 10px;
    max-width: 560px;
  }

  .hud-heroSub {
    max-width: 560px;
    font-size: 14px;
    color: var(--t-mid);
    line-height: 1.65;
    margin: 0;
  }

  .hud-scanline {
    display: flex;
    align-items: center;
    gap: 6px;
    margin: 16px 0 18px;
  }

  .hud-scanlineDot {
    width: 3px;
    height: 3px;
    border-radius: 999px;
    opacity: .6;
    flex-shrink: 0;
  }

  .hud-scanlineBar {
    flex: 1;
    height: 1px;
    opacity: .2;
  }

  .hud-controlsRow {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    margin-bottom: 14px;
  }

  .hud-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 12px;
    border-radius: 2px;
    border: 1px solid rgba(255,255,255,.07);
    background: rgba(255,255,255,.025);
    font-size: 9px;
    font-weight: 800;
    letter-spacing: 1.2px;
    text-transform: uppercase;
  }

  .hud-pillDot {
    width: 5px;
    height: 5px;
    border-radius: 999px;
  }

  .hud-statusCard {
    position: relative;
    border-radius: 4px;
    border: 1px solid;
    padding: 12px;
    overflow: hidden;
    margin-bottom: 10px;
  }

  .hud-statusTitle {
    font-size: 9px;
    font-weight: 800;
    letter-spacing: 1.6px;
    margin-bottom: 6px;
    text-transform: uppercase;
  }

  .hud-statusBody {
    font-size: 12px;
    color: var(--t-hi);
    line-height: 1.6;
  }

  .hud-formBlock {
    margin-top: 6px;
  }

  .hud-fieldLabel {
    display: block;
    font-size: 8px;
    font-weight: 800;
    color: var(--t-dim);
    letter-spacing: 2px;
    margin: 10px 0 6px;
    text-transform: uppercase;
  }

  .hud-inputWrap {
    display: flex;
    align-items: center;
    border: 1px solid var(--card-bd);
    border-radius: 2px;
    padding: 0 10px;
    background: rgba(255,255,255,0.025);
    min-height: 46px;
    transition: border-color .18s ease, background .18s ease, box-shadow .18s ease;
  }

  .hud-inputWrap:focus-within {
    border-color: rgba(0,255,135,0.18);
    box-shadow: 0 0 0 1px rgba(0,255,135,0.07);
    background: rgba(255,255,255,.035);
  }

  .hud-inputDot {
    width: 5px;
    height: 5px;
    border-radius: 999px;
    margin-right: 8px;
    opacity: .75;
    flex-shrink: 0;
  }

  .hud-input {
    width: 100%;
    background: transparent;
    border: none;
    outline: none;
    color: var(--t-hi);
    font-size: 13px;
    padding: 12px 0;
    font-family: inherit;
  }

  .hud-input::placeholder {
    color: var(--t-dim);
  }

  .hud-forgot {
    margin-top: 10px;
    display: inline-block;
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 1.2px;
    color: var(--cyan);
    text-decoration: none;
    text-transform: uppercase;
  }

  .hud-primaryBtn,
  .hud-secondaryBtn,
  .hud-inlineBtn,
  .hud-socialBtn,
  .hud-modalBtnPrimary,
  .hud-modalBtnCancel,
  .hud-ghostLink {
    font-family: inherit;
    cursor: pointer;
    transition: transform .18s ease, opacity .18s ease, background .18s ease, border-color .18s ease;
  }

  .hud-primaryBtn {
    margin-top: 18px;
    width: 100%;
    min-height: 52px;
    border-radius: 2px;
    background: var(--mint);
    color: var(--bg);
    display: grid;
    place-items: center;
    position: relative;
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 1.6px;
    text-transform: uppercase;
    border: none;
  }

  .hud-secondaryBtn {
    width: 100%;
    min-height: 50px;
    border-radius: 2px;
    background: rgba(255,255,255,.025);
    border: 1px solid rgba(0,212,255,.22);
    color: var(--cyan);
    display: grid;
    place-items: center;
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 1.4px;
    text-transform: uppercase;
  }

  .hud-primaryBtn:hover,
  .hud-secondaryBtn:hover,
  .hud-socialBtn:hover,
  .hud-inlineBtn:hover,
  .hud-modalBtnPrimary:hover,
  .hud-modalBtnCancel:hover {
    transform: translateY(-1px);
  }

  .hud-inlineActions {
    display: flex;
    gap: 8px;
    margin-top: 10px;
    flex-wrap: wrap;
  }

  .hud-inlineBtn {
    padding: 9px 12px;
    border-radius: 2px;
    border: 1px solid rgba(0,212,255,0.22);
    background: rgba(255,255,255,0.025);
    font-size: 9px;
    font-weight: 800;
    letter-spacing: 1.1px;
    text-transform: uppercase;
  }

  .hud-sectionRow {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .hud-sectionEyebrow {
    font-size: 8px;
    font-weight: 800;
    color: var(--t-dim);
    letter-spacing: 2px;
    text-transform: uppercase;
  }

  .hud-sectionHint {
    font-size: 9px;
    color: var(--t-dim);
    letter-spacing: .6px;
  }

  .hud-socialBtn {
    width: 100%;
    margin-top: 10px;
    padding: 13px 14px;
    border-radius: 2px;
    border: 1px solid var(--card-bd);
    background: var(--card-bg);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    color: var(--t-hi);
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 1.1px;
    text-transform: uppercase;
  }

  .hud-socialIconBox {
    width: 28px;
    height: 28px;
    border-radius: 2px;
    border: 1px solid rgba(255,255,255,.08);
    background: rgba(255,255,255,0.025);
    display: grid;
    place-items: center;
    flex-shrink: 0;
  }

  .hud-footerRow {
    margin-top: 20px;
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
    text-align: center;
  }

  .hud-footerHint {
    font-size: 11px;
    color: var(--t-dim);
    letter-spacing: .8px;
    text-transform: uppercase;
  }

  .hud-footerLink,
  .hud-inlineLink,
  .hud-ghostLink,
  .hud-legalLink {
    color: var(--mint);
    text-decoration: none;
    background: transparent;
    border: none;
    padding: 0;
  }

  .hud-footerLink,
  .hud-inlineLink {
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 1px;
    text-transform: uppercase;
  }

  .hud-sideInfo {
    margin-top: 24px;
    display: grid;
    gap: 12px;
  }

  .hud-miniCard {
    position: relative;
    border: 1px solid rgba(167,139,250,.18);
    background: rgba(167,139,250,.06);
    border-radius: 4px;
    padding: 12px;
    overflow: hidden;
  }

  .hud-miniTitle {
    font-size: 9px;
    font-weight: 800;
    letter-spacing: 1.5px;
    color: var(--violet);
    margin-bottom: 6px;
    text-transform: uppercase;
  }

  .hud-miniBody {
    font-size: 12px;
    line-height: 1.6;
    color: var(--t-hi);
  }

  .hud-legal {
    margin-top: 14px;
    font-size: 11px;
    line-height: 1.7;
    color: var(--t-mid);
    text-align: center;
  }

  .hud-modalBackdrop {
    position: fixed;
    inset: 0;
    z-index: 100;
    display: grid;
    place-items: center;
    padding: 16px;
    background: rgba(3,5,8,0.92);
    backdrop-filter: blur(8px);
  }

  .hud-modalCard {
    width: 100%;
    max-width: 420px;
    border-radius: 4px;
    padding: 18px;
    background: var(--bg);
    border: 1px solid var(--card-bd);
    overflow: hidden;
    position: relative;
    box-shadow: 0 32px 90px rgba(0,0,0,.5);
  }

  .hud-modalCard::before {
    content: "";
    position: absolute;
    top: 0;
    left: 10%;
    right: 10%;
    height: 1.5px;
    background: var(--violet);
    opacity: .65;
  }

  .hud-modalHeader {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12px;
    margin-bottom: 4px;
  }

  .hud-modalTitle {
    font-size: 13px;
    font-weight: 800;
    color: var(--t-hi);
    letter-spacing: 2.4px;
    margin: 4px 0 6px;
    text-transform: uppercase;
  }

  .hud-modalSub {
    font-size: 12px;
    color: var(--t-mid);
    line-height: 1.6;
    max-width: 92%;
  }

  .hud-modalEmail {
    color: var(--t-hi);
    font-weight: 700;
  }

  .hud-modalClose {
    background: transparent;
    color: var(--t-dim);
    font-size: 26px;
    line-height: 1;
    padding: 0;
    border: none;
    cursor: pointer;
  }

  .hud-modalHint {
    margin-top: 5px;
    font-size: 10px;
    color: var(--t-dim);
    line-height: 1.5;
    letter-spacing: .3px;
  }

  .hud-modalActions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    flex-wrap: wrap;
  }

  .hud-modalBtnCancel {
    padding: 10px 14px;
    border-radius: 2px;
    border: 1px solid var(--card-bd);
    background: rgba(255,255,255,0.025);
    color: var(--t-mid);
    font-size: 9px;
    font-weight: 800;
    letter-spacing: 1px;
    text-transform: uppercase;
  }

  .hud-modalBtnPrimary {
    min-width: 138px;
    padding: 10px 16px;
    border-radius: 2px;
    background: var(--violet);
    color: var(--bg);
    display: grid;
    place-items: center;
    font-size: 9px;
    font-weight: 800;
    letter-spacing: 1px;
    text-transform: uppercase;
    border: none;
  }

  .hud-resendLink {
    margin-top: 12px;
    background: transparent;
    color: var(--cyan);
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 1px;
    text-transform: uppercase;
    padding: 0;
    border: none;
    cursor: pointer;
  }

  .hud-disabled {
    opacity: .65;
    pointer-events: none;
  }

  .hud-spinner {
    width: 16px;
    height: 16px;
    border-radius: 999px;
    border: 2px solid rgba(3,5,8,.28);
    border-top-color: transparent;
    animation: spin .8s linear infinite;
  }

  @media (max-width: 980px) {
    .hud-grid {
      grid-template-columns: 1fr;
    }

    .hud-left {
      border-right: none;
      border-bottom: 1px solid rgba(255,255,255,.06);
    }
  }

  @media (max-width: 640px) {
    .hud-main {
      padding: 16px 10px 24px;
    }

    .hud-panel {
      padding: 16px;
    }

    .hud-heroTitle {
      font-size: 2.15rem;
    }

    .hud-footerRow,
    .hud-sectionRow,
    .hud-topbar {
      align-items: flex-start;
    }
  }
`;

function Brackets({ color = MINT, size = 10, thick = 1.5 }) {
  return (
    <>
      <span
        className="hud-bracket tl"
        style={{
          "--color": color,
          "--size": `${size}px`,
          "--thick": `${thick}px`,
        }}
      />
      <span
        className="hud-bracket tr"
        style={{
          "--color": color,
          "--size": `${size}px`,
          "--thick": `${thick}px`,
        }}
      />
      <span
        className="hud-bracket bl"
        style={{
          "--color": color,
          "--size": `${size}px`,
          "--thick": `${thick}px`,
        }}
      />
      <span
        className="hud-bracket br"
        style={{
          "--color": color,
          "--size": `${size}px`,
          "--thick": `${thick}px`,
        }}
      />
    </>
  );
}

function ScanLine({ color = MINT, style }) {
  return (
    <div className="hud-scanline" style={style}>
      <span className="hud-scanlineDot" style={{ background: color }} />
      <span className="hud-scanlineBar" style={{ background: color }} />
      <span className="hud-scanlineDot" style={{ background: color }} />
    </div>
  );
}

function ChipButton({ label, accent = MINT, disabled, loading }) {
  return (
    <div
      className={`hud-pill ${disabled ? "hud-disabled" : ""}`}
      style={{ borderColor: `${accent}55`, color: accent }}
    >
      <span className="hud-pillDot" style={{ background: accent }} />
      <span>{loading ? "PROCESSING" : label}</span>
    </div>
  );
}

function StatusCard({ title, body, accent = VIOLET }) {
  const backgroundColor =
    accent === DANGER
      ? "rgba(251,113,133,0.08)"
      : accent === MINT
        ? "rgba(0,255,135,0.08)"
        : "rgba(167,139,250,0.08)";

  return (
    <div
      className="hud-statusCard"
      style={{ borderColor: `${accent}33`, background: backgroundColor }}
    >
      <Brackets color={accent} size={8} thick={1} />
      <div className="hud-statusTitle" style={{ color: accent }}>
        {title}
      </div>
      <div className="hud-statusBody">{body}</div>
    </div>
  );
}

function Spinner({ color = BG }) {
  return (
    <span
      className="hud-spinner"
      style={{
        borderColor: `${color}55`,
        borderTopColor: "transparent",
      }}
    />
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
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
  );
}

function AppleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M16.365 1.43c0 1.14-.416 2.186-1.1 2.95-.746.833-1.968 1.476-3.02 1.39-.133-1.07.386-2.22 1.11-2.98.8-.84 2.17-1.44 3.01-1.36zM20.54 17.2c-.57 1.28-.84 1.85-1.57 2.97-1.02 1.56-2.45 3.5-4.22 3.52-1.58.02-1.99-1.03-4.13-1.02-2.14.01-2.6 1.04-4.18 1-1.77-.03-3.12-1.78-4.14-3.34C-.58 16.95-.66 12.92 1.5 9.59c1.53-2.36 3.95-3.74 6.22-3.74 1.74 0 2.84 1.08 4.29 1.08 1.4 0 2.25-1.08 4.27-1.08 2.02 0 4.16 1.1 5.69 3.01-3.56 1.95-2.98 7.03.57 8.34-.43.99-.63 1.43-1 2z"
      />
    </svg>
  );
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
  const [signConsent, setSignConsent] = useState(false);

  const [socialLoading, setSocialLoading] = useState("");
  const [socialErr, setSocialErr] = useState("");

  const [meProbe, setMeProbe] = useState({
    tried: false,
    ok: false,
    body: null,
  });

  const API_BASE =
    (api?.defaults?.baseURL || "").replace(/\/+$/, "") ||
    window.location.origin;

  const [showVerify, setShowVerify] = useState(false);
  const [verifyEmail, setVerifyEmail] = useState(
    localStorage.getItem("pendingVerifyEmail") || "",
  );
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
        ? `${u[0]}*`
        : `${u[0]}${"*".repeat(Math.max(1, u.length - 2))}${u[u.length - 1]}`;
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
        {
          email: loginEmail,
          password: loginPassword,
        },
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
        localStorage.setItem("pendingVerifyEmail", email);
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

    if (!signConsent) {
      setSignErr(
        "You must accept the Terms and Privacy Policy to create an account.",
      );
      setSignLoading(false);
      return;
    }

    try {
      const { data } = await api.post(
        "/auth/register",
        {
          name,
          email: signEmail,
          password: signPassword,
          consent: {
            accepted: true,
            version: "v1",
          },
        },
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

      setCode("");
      setVerifyErr("");
      setVerifyMsg("");
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
        {
          email: verifyEmail,
          password: signPassword || loginPassword,
        },
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
          body: meErr?.response?.data || {
            error: meErr?.message || "Unknown",
          },
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
    <div className="hud-shell">
      <style>{HUD_CSS}</style>

      <main className="hud-main">
        <section className="hud-card">
          <Brackets color={MINT} size={12} thick={1.5} />

          <div className="hud-grid">
            <div className="hud-panel hud-left">
              <div className="hud-topbar">
                <div className="hud-logoRow">
                  <span className="hud-statusDot" />
                  <span className="hud-logoTxt">AUTH</span>
                  <span className="hud-livePill">SECURE LOGIN</span>
                </div>

                <button
                  type="button"
                  className="hud-homeBtn"
                  onClick={() => navigate("/")}
                  aria-label="Go home"
                  title="Go home"
                >
                  <img src={logoUrl} alt="Nummoria" />
                  <Brackets color={MINT} size={7} thick={1} />
                </button>
              </div>

              <h1 className="hud-heroTitle">Welcome back.</h1>

              <p className="hud-heroSub">
                Sign in to continue tracking your money with a cleaner, sharper,
                aerospace-grade interface.
              </p>

              <ScanLine color={MINT} />

              <div className="hud-controlsRow">
                <ChipButton
                  label="LOGIN"
                  accent={MINT}
                  disabled={loginLoading || !!socialLoading}
                  loading={loginLoading || !!socialLoading}
                />
                <ChipButton
                  label="SECURE"
                  accent={CYAN}
                  disabled={loginLoading || !!socialLoading}
                />
              </div>

              {loginErr ? (
                <StatusCard
                  title={
                    loginReason === "UNVERIFIED" ? "UNVERIFIED" : "AUTH ERROR"
                  }
                  body={loginErr}
                  accent={DANGER}
                />
              ) : null}

              {socialErr ? (
                <StatusCard
                  title="SOCIAL AUTH"
                  body={socialErr}
                  accent={VIOLET}
                />
              ) : null}

              <form onSubmit={onLogin} className="hud-formBlock">
                <label className="hud-fieldLabel">Email</label>
                <div className="hud-inputWrap">
                  <span className="hud-inputDot" style={{ background: MINT }} />
                  <input
                    type="email"
                    className="hud-input"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="you@nummoria.com"
                    autoComplete="email"
                    disabled={loginLoading}
                    required
                  />
                </div>

                <label className="hud-fieldLabel">Password</label>
                <div className="hud-inputWrap">
                  <span
                    className="hud-inputDot"
                    style={{ background: VIOLET }}
                  />
                  <input
                    type="password"
                    className="hud-input"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    disabled={loginLoading}
                    required
                  />
                </div>

                <a className="hud-forgot" href="/forgot-password">
                  Forgot password?
                </a>

                <button
                  type="submit"
                  className={`hud-primaryBtn ${loginLoading ? "hud-disabled" : ""}`}
                  disabled={loginLoading}
                >
                  <Brackets color={BG} size={8} thick={1} />
                  {loginLoading ? <Spinner color={BG} /> : "SIGN IN"}
                </button>

                {loginReason === "UNVERIFIED" ? (
                  <div className="hud-inlineActions">
                    <button
                      type="button"
                      className={`hud-inlineBtn ${resending ? "hud-disabled" : ""}`}
                      style={{ color: CYAN }}
                      onClick={onResendCode}
                      disabled={resending}
                    >
                      {resending ? "RESENDING..." : "RESEND CODE"}
                    </button>

                    <button
                      type="button"
                      className="hud-inlineBtn"
                      style={{
                        color: MINT,
                        borderColor: "rgba(0,255,135,0.22)",
                      }}
                      onClick={() => setShowVerify(true)}
                    >
                      ENTER CODE
                    </button>
                  </div>
                ) : null}
              </form>

              <div className="hud-sideInfo">
                <div className="hud-miniCard">
                  <Brackets color={VIOLET} size={8} thick={1} />
                  <div className="hud-miniTitle">PLATFORM</div>
                  <div className="hud-miniBody">AI money clarity platform</div>
                </div>
              </div>
            </div>

            <div className="hud-panel hud-right">
              <div className="hud-sectionRow">
                <div className="hud-sectionRow">
                  <span className="hud-sectionEyebrow">Social access</span>
                  <span className="hud-sectionHint">
                    Continue with Google or Apple
                  </span>
                </div>

                <ScanLine
                  color={CYAN}
                  style={{ marginTop: 12, marginBottom: 14 }}
                />

                <button
                  type="button"
                  className={`hud-socialBtn ${socialLoading ? "hud-disabled" : ""}`}
                  onClick={() => startSocial("google")}
                  disabled={!!socialLoading}
                >
                  <span
                    className="hud-socialIconBox"
                    style={{ borderColor: `${CYAN}44`, color: CYAN }}
                  >
                    <GoogleIcon />
                  </span>
                  {socialLoading === "google"
                    ? "REDIRECTING..."
                    : "SIGN IN WITH GOOGLE"}
                </button>

                <button
                  type="button"
                  className={`hud-socialBtn ${socialLoading ? "hud-disabled" : ""}`}
                  onClick={() => startSocial("apple")}
                  disabled={!!socialLoading}
                >
                  <span
                    className="hud-socialIconBox"
                    style={{ borderColor: `${MINT}44`, color: T_HI }}
                  >
                    <AppleIcon />
                  </span>
                  {socialLoading === "apple"
                    ? "REDIRECTING..."
                    : "SIGN IN WITH APPLE"}
                </button>
                <span className="hud-sectionEyebrow">Create account</span>
                <span className="hud-sectionHint">Start with your email</span>
              </div>

              {signErr ? (
                <StatusCard
                  title="SIGNUP ERROR"
                  body={signErr}
                  accent={DANGER}
                />
              ) : null}

              <form onSubmit={onSignup} className="hud-formBlock">
                <label className="hud-fieldLabel">Name</label>
                <div className="hud-inputWrap">
                  <span className="hud-inputDot" style={{ background: MINT }} />
                  <input
                    className="hud-input"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                    autoComplete="name"
                    disabled={signLoading}
                    required
                  />
                </div>

                <label className="hud-fieldLabel">Email</label>
                <div className="hud-inputWrap">
                  <span className="hud-inputDot" style={{ background: CYAN }} />
                  <input
                    type="email"
                    className="hud-input"
                    value={signEmail}
                    onChange={(e) => setSignEmail(e.target.value)}
                    placeholder="you@nummoria.com"
                    autoComplete="email"
                    disabled={signLoading}
                    required
                  />
                </div>

                <label className="hud-fieldLabel">Password</label>
                <div className="hud-inputWrap">
                  <span
                    className="hud-inputDot"
                    style={{ background: VIOLET }}
                  />
                  <input
                    type="password"
                    className="hud-input"
                    value={signPassword}
                    onChange={(e) => setSignPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    autoComplete="new-password"
                    minLength={8}
                    disabled={signLoading}
                    required
                  />
                </div>

                <div
                  className="hud-legal"
                  style={{ textAlign: "left", marginTop: 16 }}
                >
                  <label
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 10,
                      cursor: "pointer",
                      color: T_MID,
                      lineHeight: 1.7,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={signConsent}
                      onChange={(e) => setSignConsent(e.target.checked)}
                      disabled={signLoading}
                      style={{
                        marginTop: 3,
                        accentColor: MINT,
                        width: 16,
                        height: 16,
                        flexShrink: 0,
                      }}
                    />
                    <span>
                      I agree to the{" "}
                      <a
                        className="hud-legalLink"
                        href="/terms"
                        target="_blank"
                        rel="noreferrer"
                      >
                        Terms
                      </a>{" "}
                      and{" "}
                      <a
                        className="hud-legalLink"
                        href="/privacy"
                        target="_blank"
                        rel="noreferrer"
                      >
                        Privacy Policy
                      </a>
                      .
                    </span>
                  </label>
                </div>

                <button
                  type="submit"
                  className={`hud-secondaryBtn ${signLoading ? "hud-disabled" : ""}`}
                  disabled={signLoading}
                  style={{ marginTop: 18 }}
                >
                  {signLoading ? <Spinner color={CYAN} /> : "SIGN UP"}
                </button>

                <div className="hud-footerRow" style={{ marginTop: 16 }}>
                  <span className="hud-footerHint">
                    Already have an account?
                  </span>
                  <button
                    type="button"
                    className="hud-ghostLink hud-inlineLink"
                    onClick={() =>
                      window.scrollTo({ top: 0, behavior: "smooth" })
                    }
                  >
                    SIGN IN ON THE LEFT
                  </button>
                </div>
              </form>
            </div>
          </div>
        </section>
      </main>

      <footer style={{ position: "relative", zIndex: 1 }}>
        <Footer fullBleed className="bg-transparent" />
      </footer>

      {showVerify ? (
        <div className="hud-modalBackdrop" onClick={() => setShowVerify(false)}>
          <div className="hud-modalCard" onClick={(e) => e.stopPropagation()}>
            <Brackets color={VIOLET} size={10} thick={1.5} />

            <div className="hud-modalHeader">
              <div>
                <div className="hud-modalTitle">Verify your email</div>
                <div className="hud-modalSub">
                  We sent a 6-digit code to{" "}
                  <span className="hud-modalEmail">{maskedEmail}</span>
                </div>
              </div>

              <button
                type="button"
                className="hud-modalClose"
                onClick={() => setShowVerify(false)}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            {verifyErr ? (
              <StatusCard
                title="VERIFY ERROR"
                body={verifyErr}
                accent={DANGER}
              />
            ) : null}

            {verifyMsg ? (
              <StatusCard
                title="VERIFY STATUS"
                body={verifyMsg}
                accent={MINT}
              />
            ) : null}

            <form onSubmit={onVerifySubmit}>
              <label className="hud-fieldLabel">Verification code</label>
              <div className="hud-inputWrap">
                <span className="hud-inputDot" style={{ background: VIOLET }} />
                <input
                  className="hud-input"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="Enter 6-digit code"
                  disabled={verifying}
                  required
                />
              </div>

              <div className="hud-modalHint">
                Code expires 15 minutes after request.
              </div>

              <ScanLine
                color={VIOLET}
                style={{ marginTop: 16, marginBottom: 14 }}
              />

              <div className="hud-modalActions">
                <button
                  type="button"
                  className="hud-modalBtnCancel"
                  onClick={() => setShowVerify(false)}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className={`hud-modalBtnPrimary ${verifying ? "hud-disabled" : ""}`}
                  disabled={verifying || (!verifyEmail && !regToken)}
                >
                  {verifying ? <Spinner color={BG} /> : "VERIFY & CONTINUE"}
                </button>
              </div>
            </form>

            <button
              type="button"
              className={`hud-resendLink ${resending ? "hud-disabled" : ""}`}
              onClick={onResendCode}
              disabled={resending || (!verifyEmail && !regToken)}
            >
              {resending ? "RESENDING..." : "RESEND CODE"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}