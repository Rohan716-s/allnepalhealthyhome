"use client";

import {
  createElement,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ElementType,
  type CSSProperties,
  type ReactNode,
} from "react";

type AnimationProps = {
  animation?: string;
  duration?: number;
  delay?: number;
  easing?: string;
  className?: string;
};

function graphemes(value: string) {
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    const Segmenter = (Intl as typeof Intl & {
      Segmenter?: new (locales?: string[], options?: { granularity: "grapheme" }) => {
        segment(input: string): Iterable<{ segment: string }>;
      };
    }).Segmenter;
    if (Segmenter) return [...new Segmenter([], { granularity: "grapheme" }).segment(value)].map((item) => item.segment);
  }
  return Array.from(value);
}

const textAnimationClass: Record<string, string> = {
  FADE: "hero-fade",
  FADE_UP: "hero-slide-up",
  FADE_DOWN: "hero-slide-down",
  FADE_LEFT: "hero-slide-left",
  FADE_RIGHT: "hero-slide-right",
  SLIDE_UP: "hero-slide-up",
  SLIDE_DOWN: "hero-slide-down",
  SLIDE_LEFT: "hero-slide-left",
  SLIDE_RIGHT: "hero-slide-right",
  SOFT_REVEAL: "hero-soft-reveal",
  BLUR_REVEAL: "hero-blur-reveal",
  ZOOM_IN: "hero-zoom-in",
};

export function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return reduced;
}

export function AnimatedText({
  text,
  animation = "FADE_UP",
  duration = 650,
  delay = 0,
  easing = "ease-out",
  className,
  as = "span",
}: AnimationProps & { text: string; as?: ElementType }) {
  const reduced = useReducedMotion();
  const normalized = animation.toUpperCase();
  const unitMode = normalized === "WORD_REVEAL" ? "word" : normalized === "LETTER_REVEAL" || normalized === "CHARACTER_REVEAL" ? "grapheme" : "whole";
  const units = useMemo(() => (unitMode === "grapheme" ? graphemes(text) : text.split(/(\s+)/)), [text, unitMode]);
  if (reduced || normalized === "NONE" || unitMode === "whole") {
    if (reduced || normalized === "NONE") return createElement(as, { className, "aria-label": text }, text);
    return createElement(as, { className: `${className ?? ""} ${textAnimationClass[normalized] ?? "hero-slide-up"}`, "aria-label": text, style: { animationDuration: `${duration}ms`, animationDelay: `${delay}ms`, animationTimingFunction: easing, animationFillMode: "both" } }, text);
  }
  return createElement(
    as,
    { className, "aria-label": text },
    units.map((unit, index) => unit.trim() ? (
      <span
        key={`${unit}-${index}`}
        aria-hidden="true"
        className="hero-text-unit"
        style={{
          animationName: "hero-text-unit-in",
          animationDuration: `${duration}ms`,
          animationDelay: `${delay + index * (unitMode === "grapheme" ? 28 : 78)}ms`,
          animationTimingFunction: easing,
          animationFillMode: "both",
        }}
      >{unit}</span>
    ) : <span key={`${unit}-${index}`} aria-hidden="true">{unit}</span>),
  );
}

export function TypewriterText({ text, duration = 900, delay = 0, className, as = "span" }: Omit<AnimationProps, "animation" | "easing"> & { text: string; as?: ElementType }) {
  const reduced = useReducedMotion();
  const instant = duration <= 0;
  const characters = useMemo(() => graphemes(text), [text]);
  const targetRef = useRef<HTMLSpanElement>(null);
  const [progress, setProgress] = useState({ text, started: false, count: 0 });
  const started = !reduced && progress.text === text && progress.started;
  const count = reduced || instant ? characters.length : progress.text === text ? progress.count : 0;
  useEffect(() => {
    if (reduced || instant) return;
    const node = targetRef.current;
    const start = () => setProgress({ text, started: true, count: 0 });
    if (!node || typeof IntersectionObserver === "undefined") {
      const frame = window.requestAnimationFrame(start);
      return () => window.cancelAnimationFrame(frame);
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { start(); observer.disconnect(); }
    }, { threshold: 0.2 });
    observer.observe(node);
    return () => observer.disconnect();
  }, [instant, reduced, text]);
  useEffect(() => {
    if (reduced || instant || !started) return;
    let timer: number | undefined;
    const start = window.setTimeout(() => {
      let next = 0;
      timer = window.setInterval(() => {
        next += 1;
        setProgress((current) => current.text === text ? { ...current, count: next } : current);
        if (next >= characters.length && timer) window.clearInterval(timer);
      }, Math.max(18, duration / Math.max(characters.length, 1)));
    }, delay);
    return () => { window.clearTimeout(start); if (timer) window.clearInterval(timer); };
  }, [characters.length, delay, duration, instant, reduced, started, text]);
  if (instant) {
    return createElement(as, { className, "aria-label": text }, text);
  }
  return createElement(as, { className, "aria-label": text }, <span ref={targetRef} className="relative inline-block align-baseline"><span aria-hidden="true" className={reduced ? undefined : "invisible select-none"}>{text}</span>{!reduced && <span className="absolute inset-0" aria-hidden="true">{characters.slice(0, count).join("")}<span className="typewriter-cursor" /></span>}</span>);
}

export function ScrollReveal({ children, animation = "FADE_UP", duration = 650, delay = 0, className }: AnimationProps & { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    if (reduced || animation === "NONE") {
      const frame = window.requestAnimationFrame(() => setVisible(true));
      return () => window.cancelAnimationFrame(frame);
    }
    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const frame = window.requestAnimationFrame(() => setVisible(false));
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setVisible(true); observer.disconnect(); }
    }, { threshold: 0.12, rootMargin: "0px 0px -40px" });
    observer.observe(node);
    return () => { window.cancelAnimationFrame(frame); observer.disconnect(); };
  }, [animation, reduced]);
  return <div ref={ref} className={`${className ?? ""} motion-reveal motion-reveal-${animation.toLowerCase()} ${visible ? "motion-reveal-visible" : "motion-reveal-hidden"}`} style={{ "--motion-duration": `${duration}ms`, "--motion-delay": `${delay}ms` } as CSSProperties}>{children}</div>;
}

export function AnimatedCounter({ value, duration = 900, className }: { value: number; duration?: number; className?: string }) {
  const reduced = useReducedMotion();
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    if (reduced) return;
    const started = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - started) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(value * eased));
      if (progress < 1) frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [duration, reduced, value]);
  return <span className={className}>{(reduced ? value : display).toLocaleString("en-IN")}</span>;
}
