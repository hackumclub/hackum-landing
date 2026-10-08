"use client";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { gsap } from "@/motion/gsap";
import { fill } from "@/i18n/config";

export type StackPhoto = { src: string; alt: string };

// Resting tilt per depth (front → back), echoing the stacked cards in the Figma "Desktop - 1" frame.
const TILT = [-3, 7, -10];

/** Tilted stack of photos; fans out once on load, click/Enter brings the next photo to the front. */
export default function PhotoStack({ photos, label, className = "" }: { photos: StackPhoto[]; label: string; className?: string }) {
  const [order, setOrder] = useState(() => photos.map((_, i) => i));
  const ref = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!ref.current || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = gsap.context(() => {
      gsap.from("[data-card]", { rotation: 0, y: 40, opacity: 0, duration: 0.9, ease: "back.out(1.6)", stagger: { each: 0.12, from: "end" } });
    }, ref);
    return () => ctx.revert();
  }, []);

  const next = () => setOrder((o) => [...o.slice(1), o[0]]);
  const front = photos[order[0]];

  return (
    <button
      ref={ref}
      type="button"
      onClick={next}
      aria-label={fill(label, { alt: front.alt })}
      data-cursor="view"
      className={`group relative block aspect-[4/3] w-full cursor-pointer rounded-[26px] focus-visible:outline-4 focus-visible:outline-offset-8 focus-visible:outline-brand ${className}`}
    >
      {order.map((idx, depth) => {
        const p = photos[idx];
        return (
          <span
            key={p.src}
            data-card
            aria-hidden={depth > 0}
            style={{ zIndex: photos.length - depth, transform: `rotate(${TILT[depth % TILT.length]}deg)` }}
            className="absolute inset-0 overflow-hidden rounded-[26px] border-[6px] border-white bg-lav shadow-card transition-transform duration-500 ease-out"
          >
            <Image src={p.src} alt={depth === 0 ? p.alt : ""} fill sizes="(min-width: 768px) 480px, 90vw" className="object-cover" />
          </span>
        );
      })}
    </button>
  );
}
