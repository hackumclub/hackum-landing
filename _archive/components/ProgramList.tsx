"use client";
import { useState } from "react";
import type { Poster } from "@/lib/posters";

export type Program = { title: string; desc: string; poster: Poster };

/**
 * Programs as a ruled list. On desktop a sticky poster beside the list shows the real poster
 * of whichever row is hovered or focused; on mobile each row carries its own thumbnail.
 */
export default function ProgramList({ items }: { items: Program[] }) {
  const [active, setActive] = useState(0);
  return (
    <div className="mt-12 grid gap-12 md:grid-cols-[1.4fr_1fr]">
      <ul className="border-t-2 border-ink">
        {items.map((p, i) => (
          <li key={p.title}>
            <button
              type="button"
              onMouseEnter={() => setActive(i)}
              onFocus={() => setActive(i)}
              onClick={() => setActive(i)}
              aria-pressed={active === i}
              className="group grid w-full grid-cols-[1fr_auto] items-center gap-4 border-b-2 border-ink/10 py-6 text-left md:grid-cols-1"
            >
              <span>
                <span className={`block font-display text-2xl font-black transition-colors md:text-[30px] ${active === i ? "text-ink" : "text-ink/45 group-hover:text-ink"}`}>{p.title}</span>
                <span className="mt-1.5 block max-w-[46ch] text-muted">{p.desc}</span>
              </span>
              {/* eslint-disable-next-line @next/next/no-img-element -- mobile thumbnail of the same poster */}
              <img src={p.poster.src} alt="" aria-hidden loading="lazy" className="h-20 w-16 rounded-lg object-cover md:hidden" />
            </button>
          </li>
        ))}
      </ul>
      <div className="relative hidden md:block">
        <div className="sticky top-24 aspect-[4/5] w-full">
          {items.map((p, i) => (
            // eslint-disable-next-line @next/next/no-img-element -- stacked posters crossfade on hover
            <img key={p.title} src={p.poster.src} alt={active === i ? p.poster.alt : ""} aria-hidden={active !== i}
              className={`absolute inset-0 m-auto h-auto max-h-full w-auto max-w-full rounded-[22px] shadow-card transition duration-500 ease-out ${active === i ? "rotate-0 scale-100 opacity-100" : "rotate-2 scale-95 opacity-0"}`} />
          ))}
        </div>
      </div>
    </div>
  );
}
