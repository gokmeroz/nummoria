// src/components/ui/hyperspeed.jsx
/* eslint-disable */
import React, { useMemo } from "react";

/**
 * Hyperspeed (React + CSS only)
 * - Drop-in animated background layer (no deps).
 * - Usage:
 *    import { Hyperspeed } from "@/components/ui/hyperspeed";
 *    <div className="absolute inset-0 -z-10">
 *      <Hyperspeed effectOptions={hyperspeedPresets.one} />
 *    </div>
 *
 * effectOptions (all optional):
 *  {
 *    density: number,        // number of streaks
 *    speed: number,          // overall speed multiplier
 *    maxWidth: number,       // px
 *    minWidth: number,       // px
 *    maxLength: number,      // px
 *    minLength: number,      // px
 *    tilt: number,           // degrees (positive = tilt right)
 *    perspective: number,    // px
 *    depth: number,          // 0..1 (scales)
 *    blur: number,           // px
 *    glow: number,           // 0..1
 *    opacity: number,        // 0..1
 *    colors: string[],       // streak colors
 *    background: string,     // background base (css color)
 *    noise: number           // 0..1
 *  }
 */

const DEFAULTS = {
  density: 140,
  speed: 1.0,
  maxWidth: 3,
  minWidth: 1,
  maxLength: 220,
  minLength: 80,
  tilt: 16,
  perspective: 900,
  depth: 0.86,
  blur: 0.6,
  glow: 0.55,
  opacity: 0.9,
  colors: ["#13e243", "#10b981", "#60a5fa", "#a78bfa", "#22d3ee"],
  background: "#050706",
  noise: 0.08,
};

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function pick(arr, t) {
  if (!arr || !arr.length) return t;
  return arr[Math.floor(Math.random() * arr.length)];
}

function rand(min, max) {
  return min + Math.random() * (max - min);
}

export function Hyperspeed({ effectOptions = {} }) {
  const opt = { ...DEFAULTS, ...(effectOptions || {}) };

  opt.density = clamp(Number(opt.density || DEFAULTS.density), 24, 600);
  opt.speed = clamp(Number(opt.speed || 1), 0.2, 4);
  opt.depth = clamp(Number(opt.depth || 0.86), 0.4, 1.2);
  opt.opacity = clamp(Number(opt.opacity || 0.9), 0.05, 1);
  opt.glow = clamp(Number(opt.glow || 0.55), 0, 1);
  opt.noise = clamp(Number(opt.noise || 0.08), 0, 0.35);

  const streaks = useMemo(() => {
    const items = [];
    for (let i = 0; i < opt.density; i++) {
      const w = rand(opt.minWidth, opt.maxWidth);
      const h = rand(opt.minLength, opt.maxLength);

      // spread: more dense in center for "warp tunnel"
      const x = rand(-10, 110);
      const y = rand(-120, 120);

      const dur = rand(0.55, 1.25) / opt.speed; // smaller = faster
      const delay = rand(0, 1.25);

      const alpha = rand(0.35, 1.0) * opt.opacity;

      const c = pick(opt.colors, "#10b981");

      // A little per-streak drift
      const drift = rand(-12, 12);

      items.push({
        id: `hs-${i}-${Math.random().toString(16).slice(2)}`,
        x,
        y,
        w,
        h,
        dur,
        delay,
        alpha,
        c,
        drift,
      });
    }
    return items;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    opt.density,
    opt.speed,
    opt.minWidth,
    opt.maxWidth,
    opt.minLength,
    opt.maxLength,
    opt.opacity,
    JSON.stringify(opt.colors || []),
  ]);

  const rootStyle = {
    "--hs-bg": opt.background,
    "--hs-tilt": `${opt.tilt}deg`,
    "--hs-persp": `${opt.perspective}px`,
    "--hs-depth": opt.depth,
    "--hs-blur": `${opt.blur}px`,
    "--hs-glow": opt.glow,
    "--hs-opacity": opt.opacity,
    "--hs-noise": opt.noise,
  };

  return (
    <div className="hs-root" style={rootStyle} aria-hidden="true">
      {/* base */}
      <div className="hs-base" />

      {/* tunnel vignette */}
      <div className="hs-vignette" />

      {/* streaks */}
      <div className="hs-layer">
        {streaks.map((s) => (
          <i
            key={s.id}
            className="hs-streak"
            style={{
              left: `${s.x}%`,
              top: `${s.y}%`,
              width: `${s.w}px`,
              height: `${s.h}px`,
              "--hs-c": s.c,
              "--hs-a": s.alpha,
              "--hs-dur": `${s.dur}s`,
              "--hs-delay": `${s.delay}s`,
              "--hs-drift": `${s.drift}px`,
            }}
          />
        ))}
      </div>

      {/* subtle noise */}
      <div className="hs-noise" />

      <style>{CSS}</style>
    </div>
  );
}

// default export too (so your earlier import style works)
export default Hyperspeed;

const CSS = `
  .hs-root{
    position:absolute;
    inset:0;
    overflow:hidden;
    pointer-events:none;
    background: var(--hs-bg);
  }

  .hs-base{
    position:absolute;
    inset:-20%;
    background:
      radial-gradient(70% 45% at 50% 0%,
        rgba(16,185,129,0.25),
        rgba(0,0,0,0) 60%),
      radial-gradient(45% 40% at 70% 30%,
        rgba(99,102,241,0.18),
        rgba(0,0,0,0) 60%),
      radial-gradient(50% 45% at 30% 25%,
        rgba(34,211,238,0.14),
        rgba(0,0,0,0) 62%),
      linear-gradient(180deg,
        rgba(0,0,0,0.25),
        rgba(0,0,0,0.6));
    transform: translateZ(0);
    filter: blur(0px);
  }

  .hs-vignette{
    position:absolute;
    inset:-10%;
    background:
      radial-gradient(55% 45% at 50% 45%,
        rgba(0,0,0,0) 0%,
        rgba(0,0,0,0) 42%,
        rgba(0,0,0,0.62) 72%,
        rgba(0,0,0,0.86) 100%);
    opacity: 0.9;
  }

  .hs-layer{
    position:absolute;
    inset:-30%;
    transform:
      perspective(var(--hs-persp))
      rotateZ(var(--hs-tilt))
      scale(var(--hs-depth));
    transform-origin: 50% 35%;
    filter: blur(var(--hs-blur));
  }

  .hs-streak{
    position:absolute;
    display:block;
    border-radius: 999px;
    opacity: var(--hs-a);
    background:
      linear-gradient(180deg,
        rgba(255,255,255,0) 0%,
        rgba(255,255,255,0.08) 20%,
        rgba(255,255,255,0.0) 40%),
      linear-gradient(180deg,
        rgba(0,0,0,0) 0%,
        var(--hs-c) 22%,
        rgba(0,0,0,0) 100%);
    box-shadow:
      0 0 calc(18px * var(--hs-glow)) rgba(255,255,255,0.15),
      0 0 calc(30px * var(--hs-glow)) color-mix(in srgb, var(--hs-c) 45%, transparent);
    animation:
      hs-fly var(--hs-dur) linear var(--hs-delay) infinite;
    will-change: transform, opacity;
  }

  @keyframes hs-fly{
    0%{
      transform: translate3d(calc(var(--hs-drift) * -1), -140vh, 0);
      opacity: 0;
    }
    10%{ opacity: var(--hs-a); }
    100%{
      transform: translate3d(var(--hs-drift), 160vh, 0);
      opacity: 0;
    }
  }

  .hs-noise{
    position:absolute;
    inset:0;
    opacity: var(--hs-noise);
    background-image:
      url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)' opacity='.55'/%3E%3C/svg%3E");
    background-size: 220px 220px;
    mix-blend-mode: overlay;
  }
`;
