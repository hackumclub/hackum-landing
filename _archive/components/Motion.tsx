"use client";
import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);
const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Fade/slide children (or itself) in on scroll. */
export function Reveal({ children, className, stagger = 0, y = 32 }: { children: React.ReactNode; className?: string; stagger?: number; y?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (reduced() || !ref.current) return;
    const ctx = gsap.context(() => {
      const targets = stagger ? Array.from(ref.current!.children) : ref.current;
      gsap.from(targets, { opacity: 0, y, duration: 0.8, ease: "power3.out", stagger, scrollTrigger: { trigger: ref.current, start: "top 85%", once: true } });
    }, ref);
    return () => ctx.revert();
  }, [stagger, y]);
  return <div ref={ref} className={className}>{children}</div>;
}

/** Endless gentle float/rotate for decorative shapes. */
export function Float({ children, className, amp = 12, dur = 3, rotate = 0 }: { children: React.ReactNode; className?: string; amp?: number; dur?: number; rotate?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (reduced() || !ref.current) return;
    const t = gsap.to(ref.current, { y: amp, rotation: rotate, duration: dur, ease: "sine.inOut", yoyo: true, repeat: -1, delay: Math.random() });
    return () => { t.kill(); };
  }, [amp, dur, rotate]);
  return <div ref={ref} className={className} aria-hidden>{children}</div>;
}

/** Counts up to `to` when scrolled into view; renders the final value without JS/with reduced motion. */
export function CountUp({ to, suffix = "" }: { to: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current; if (!el || reduced()) return;
    const o = { v: 0 };
    const t = gsap.to(o, { v: to, duration: 1.6, ease: "power2.out", scrollTrigger: { trigger: el, start: "top 90%", once: true }, onUpdate: () => { el.textContent = Math.round(o.v).toLocaleString("en-US") + suffix; } });
    return () => { t.scrollTrigger?.kill(); t.kill(); };
  }, [to, suffix]);
  return <span ref={ref}>{to.toLocaleString("en-US")}{suffix}</span>;
}
