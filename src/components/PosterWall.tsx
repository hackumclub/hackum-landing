"use client";
import Image from "next/image";
import { useEffect, useRef } from "react";
import { Draggable } from "@/motion/drag";
import type { Poster } from "@/lib/posters";

/**
 * A horizontal wall of real club posters. Native scroll (touch, trackpad, keyboard) everywhere;
 * with a fine pointer it can also be grabbed and thrown (GSAP Draggable on scrollLeft).
 */
export default function PosterWall({ posters, label }: { posters: Poster[]; label: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !window.matchMedia("(pointer: fine)").matches) return;
    const [d] = Draggable.create(el, { type: "scrollLeft", inertia: true, cursor: "grab", activeCursor: "grabbing", allowContextMenu: true, dragClickables: true });
    return () => { d.kill(); };
  }, []);

  return (
    <div ref={ref} tabIndex={0} role="region" aria-label={label} data-cursor="drag" className="overflow-x-auto pb-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <ul className="flex w-max items-end gap-5 px-6 md:px-[max(24px,calc((100vw-1200px)/2))]">
        {posters.map((p, i) => (
          <li key={p.src} className="shrink-0" style={{ rotate: `${i % 2 ? 1.5 : -1.5}deg` }}>
            <Image src={p.src} alt={p.alt} width={p.w} height={p.h} draggable={false}
              sizes="(min-width: 768px) 380px, 300px"
              className="h-[300px] w-auto select-none rounded-[14px] shadow-card md:h-[380px]" />
          </li>
        ))}
      </ul>
    </div>
  );
}
