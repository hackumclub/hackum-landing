"use client";
import { useRef } from "react";
import { gsap, useGSAP } from "@/motion/gsap";
import { DUR, EASE, MQ } from "@/motion/config";

/**
 * Count-up stat: the number climbs from 0 when it scrolls into view, then its label fades in.
 * Server HTML already holds the final value (no JS → correct number); tabular digits avoid width jumps.
 */
export default function Counter({ value, suffix = "", label, className = "", numClass = "", labelClass = "" }: {
  value: number; suffix?: string; label: string; className?: string; numClass?: string; labelClass?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);

  useGSAP(() => {
    const el = ref.current;
    const num = el?.querySelector<HTMLElement>("[data-num]");
    const lab = el?.querySelector<HTMLElement>("[data-label]");
    if (!el || !num || !lab) return;
    const mm = gsap.matchMedia();
    mm.add(MQ.motion, () => {
      const o = { v: 0 };
      gsap.timeline({ scrollTrigger: { trigger: el, start: "top 98%", once: true } })
        .to(o, { v: value, duration: DUR.slow * 1.6, ease: "power2.out", onUpdate: () => { num.textContent = `${Math.round(o.v)}${suffix}`; } })
        .from(lab, { opacity: 0, y: 8, duration: DUR.fast, ease: EASE.ui }, "-=0.6");
    });
    return () => mm.revert();
  }, { scope: ref, dependencies: [value, suffix] });

  return (
    <span ref={ref} className={className}>
      <span data-num className={`tabular-nums ${numClass}`}>{value}{suffix}</span>
      {" "}
      <span data-label className={labelClass}>{label}</span>
    </span>
  );
}
