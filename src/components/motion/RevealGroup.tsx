"use client";
import { useRef, type ElementType } from "react";
import { gsap, ScrollTrigger, useGSAP } from "@/motion/gsap";
import { DUR, EASE, MQ, STAGGER } from "@/motion/config";

/** Staggered entrance for a list/grid: direct children fade and slide up in batches as they enter. */
export default function RevealGroup({ as: Tag = "div", className, children }: { as?: ElementType; className?: string; children: React.ReactNode }) {
  const ref = useRef<HTMLElement>(null);

  useGSAP(() => {
    const items = ref.current ? Array.from(ref.current.children) : [];
    const mm = gsap.matchMedia();
    mm.add(MQ.motion, () => {
      gsap.set(items, { y: 36, opacity: 0 });
      const triggers = ScrollTrigger.batch(items, {
        start: "top 90%",
        once: true,
        onEnter: (batch) => gsap.to(batch, { y: 0, opacity: 1, duration: DUR.base, ease: EASE.ui, stagger: STAGGER.cards, overwrite: true, clearProps: "transform,opacity" }),
      });
      return () => triggers.forEach((t) => t.kill());
    });
    return () => mm.revert();
  }, { scope: ref });

  return <Tag ref={ref} className={className}>{children}</Tag>;
}
