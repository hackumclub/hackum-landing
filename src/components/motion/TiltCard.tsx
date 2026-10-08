"use client";
import { useRef } from "react";
import { gsap, useGSAP } from "@/motion/gsap";
import { MQ } from "@/motion/config";

/**
 * Pointer tilt (±max°) with a #0085CA glass shine that follows the cursor. Desktop hover pointers only;
 * touch and reduced motion get a plain card. Animates transform and opacity only.
 */
export default function TiltCard({ children, className = "", max = 6 }: { children: React.ReactNode; className?: string; max?: number }) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    const el = ref.current;
    const shine = el?.querySelector<HTMLElement>("[data-shine]");
    if (!el || !shine) return;
    const mm = gsap.matchMedia();
    mm.add(MQ.full, () => {
      gsap.set(el, { transformPerspective: 900, transformStyle: "preserve-3d" });
      const rx = gsap.quickTo(el, "rotationX", { duration: 0.5, ease: "power3" });
      const ry = gsap.quickTo(el, "rotationY", { duration: 0.5, ease: "power3" });
      const move = (e: PointerEvent) => {
        const b = el.getBoundingClientRect();
        const px = (e.clientX - b.left) / b.width, py = (e.clientY - b.top) / b.height;
        ry((px - 0.5) * 2 * max); rx(-(py - 0.5) * 2 * max);
        shine.style.setProperty("--mx", `${px * 100}%`); shine.style.setProperty("--my", `${py * 100}%`);
      };
      const enter = () => gsap.to(shine, { opacity: 1, duration: 0.3 });
      const leave = () => { rx(0); ry(0); gsap.to(shine, { opacity: 0, duration: 0.4 }); };
      el.addEventListener("pointermove", move);
      el.addEventListener("pointerenter", enter);
      el.addEventListener("pointerleave", leave);
      return () => { el.removeEventListener("pointermove", move); el.removeEventListener("pointerenter", enter); el.removeEventListener("pointerleave", leave); };
    });
    return () => mm.revert();
  }, { scope: ref });

  return (
    <div ref={ref} className={`relative ${className}`}>
      {children}
      <span data-shine aria-hidden className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 mix-blend-soft-light [background:radial-gradient(420px_circle_at_var(--mx,50%)_var(--my,50%),rgb(0_133_202/0.55),transparent_45%)]" />
    </div>
  );
}
