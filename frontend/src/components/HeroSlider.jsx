/* eslint-disable no-unused-vars */
// components/HeroSlider.jsx
import { useEffect, useMemo, useRef, useState, useCallback } from "react";

const SLIDE_INTERVAL_MS = 6000;

/**
 * Props:
 * - slides: array (same as before)
 * - className: extra classes for the outer <section>
 * - fullscreen: boolean → if true, the slider fills the viewport (minus topOffset)
 * - topOffset: number → pixels to subtract for fixed nav height (default 0)
 */
export default function HeroSlider({
  slides = [],
  className = "",
  fullscreen = false,
  topOffset = 0,
}) {
  const [index, setIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const timerRef = useRef(null);
  const rafRef = useRef(null);
  const rootRef = useRef(null);
  const startedAtRef = useRef(0);
  const pausedRef = useRef(false);

  const prefersReducedMotion = useMemo(
    () => window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches,
    []
  );

  const goTo = useCallback(
    (i) => setIndex((prev) => (i + slides.length) % slides.length),
    [slides.length]
  );
  const next = useCallback(() => goTo(index + 1), [index, goTo]);
  const prev = useCallback(() => goTo(index - 1), [index, goTo]);

  // progress (kept in sync with autoplay)
  const startProgress = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    startedAtRef.current = performance.now();
    setProgress(0);
    const loop = (now) => {
      if (pausedRef.current || prefersReducedMotion) return;
      const elapsed = now - startedAtRef.current;
      const pct = Math.min(100, (elapsed / SLIDE_INTERVAL_MS) * 100);
      setProgress(pct);
      if (pct < 100) rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
  }, [prefersReducedMotion]);

  // autoplay
  useEffect(() => {
    if (!slides.length || prefersReducedMotion) return;
    clearInterval(timerRef.current);
    timerRef.current = setInterval(next, SLIDE_INTERVAL_MS);
    startProgress();
    return () => clearInterval(timerRef.current);
  }, [index, slides.length, prefersReducedMotion, next, startProgress]);

  const pause = () => {
    pausedRef.current = true;
    clearInterval(timerRef.current);
    cancelAnimationFrame(rafRef.current);
  };
  const resume = () => {
    if (prefersReducedMotion) return;
    pausedRef.current = false;
    clearInterval(timerRef.current);
    timerRef.current = setInterval(next, SLIDE_INTERVAL_MS);
    startProgress();
  };

  // swipe
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    let startX = 0,
      dx = 0;
    const onStart = (e) => {
      startX = e.touches[0].clientX;
      dx = 0;
      pause();
    };
    const onMove = (e) => {
      dx = e.touches[0].clientX - startX;
    };
    const onEnd = () => {
      if (Math.abs(dx) > 50) dx < 0 ? next() : prev();
      resume();
    };
    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: true });
    el.addEventListener("touchend", onEnd);
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
    };
  }, [next, prev]);

  // parallax
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    let raf;
    const onMove = (e) => {
      if (prefersReducedMotion) return;
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = (e.clientX - cx) / rect.width;
      const dy = (e.clientY - cy) / rect.height;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const active = el.querySelector("[data-active='true'] .js-parallax");
        if (active)
          active.style.transform = `translate(${dx * 10}px, ${
            dy * 8
          }px) scale(1.06)`;
      });
    };
    const reset = () => {
      const active = el.querySelector("[data-active='true'] .js-parallax");
      if (active) active.style.transform = "translate(0,0) scale(1.06)";
    };
    el.addEventListener("mousemove", onMove);
    el.addEventListener("mouseleave", reset);
    return () => {
      el.removeEventListener("mousemove", onMove);
      el.removeEventListener("mouseleave", reset);
    };
  }, [index, prefersReducedMotion]);

  if (!slides.length) return null;

  // dynamic height if fullscreen
  const sliderStyle = fullscreen
    ? { height: "75dvh", minHeight: "40px" } // HERE CHANGED
    : { height: `calc(100dvh - ${topOffset || 0}px)` };
  return (
    <section
      ref={rootRef}
      className={`relative w-full overflow-hidden h-[75vh] min-h-[480px] ${className}`}
      aria-roledescription="carousel"
      aria-label="Featured content"
      onMouseEnter={pause}
      onMouseLeave={resume}
    >
      {/* Slides */}
      <ul className="relative h-full">
        {slides.map((s, i) => {
          const active = i === index;
          return (
            <li
              key={i}
              data-active={active ? "true" : "false"}
              className={`absolute inset-0 transition-opacity duration-700 ease-in-out
                     ${active ? "opacity-100" : "opacity-0"}`}
            >
              {/* background */}
              <img
                src={s.image}
                alt={s.alt || ""}
                className="h-full w-full object-cover"
              />

              {/* overlay text */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center text-white px-4">
                  <h2 className="text-4xl md:text-6xl font-bold">{s.title}</h2>
                  {s.subtitle && (
                    <p className="mt-3 text-lg md:text-xl">{s.subtitle}</p>
                  )}
                  {!!s.ctas?.length && (
                    <div className="mt-6 flex flex-wrap justify-center gap-3">
                      {s.ctas.map((c, idx) => (
                        <a
                          key={idx}
                          href={c.href}
                          className="px-5 py-2.5 rounded bg-white/80 text-black font-semibold hover:bg-white transition"
                        >
                          {c.label}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {/* arrows */}
      <button
        onClick={prev}
        aria-label="Previous slide"
        className="absolute left-4 top-1/2 -translate-y-1/2
               text-white/70 hover:text-white text-3xl font-light"
      >
        ‹
      </button>
      <button
        onClick={next}
        aria-label="Next slide"
        className="absolute right-4 top-1/2 -translate-y-1/2
               text-white/70 hover:text-white text-3xl font-light"
      >
        ›
      </button>

      {/* dots */}
      <div className="absolute bottom-6 left-0 right-0 flex justify-center gap-2">
        {slides.map((_, i) => (
          <button
            key={i}
            onClick={() => goTo(i)}
            aria-label={`Go to slide ${i + 1}`}
            aria-current={i === index ? "true" : "false"}
            className={`h-1 w-6 rounded-full transition-colors
                   ${
                     i === index
                       ? "bg-white/80"
                       : "bg-white/30 hover:bg-white/50"
                   }`}
          />
        ))}
      </div>
    </section>
  );
}
