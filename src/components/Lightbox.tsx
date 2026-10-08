// Client-only: imported from client components (Timeline), so no "use client" entry of its own.
import { useCallback, useEffect, useRef } from "react";
import Image, { getImageProps } from "next/image";
import { gsap } from "@/motion/gsap";
import { EASE, MQ } from "@/motion/config";

export type LightboxItem = { src: string; alt: string; caption: string };

// Optimized responsive srcset for the large view. width/height only seed the srcset; CSS keeps the natural ratio.
const full = (it: LightboxItem) => {
  const { props } = getImageProps({ src: it.src, alt: it.alt, width: 1600, height: 1200, sizes: "(min-width: 1000px) 980px, 94vw" });
  return { src: props.src, srcSet: props.srcSet, sizes: props.sizes, alt: props.alt, decoding: "async" as const };
};

/**
 * Full-size viewer on a native <dialog> (focus trap, Esc, backdrop click closes).
 * Opens with a zoom from the clicked card (`origin` rect → final size), then: counter, thumbnail strip,
 * ← → keys, swipe on touch. Reduced motion: plain fade.
 */
export default function Lightbox({ items, index, onIndex, origin, labels }: {
  items: LightboxItem[];
  index: number | null;
  onIndex: (i: number | null) => void;
  origin?: DOMRect | null;
  labels: { close: string; prev: string; next: string };
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const img = useRef<HTMLImageElement>(null);
  const strip = useRef<HTMLOListElement>(null);
  const first = useRef(true);
  const swipe = useRef<number | null>(null);
  const open = index !== null;
  const item = open ? items[index] : null;

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) { first.current = true; d.showModal(); }
    if (!open && d.open) d.close();
  }, [open]);

  // Entrance: zoom out of the clicked card on first open, slide between items afterwards.
  useEffect(() => {
    const el = img.current;
    if (!el || !open) return;
    const reduce = window.matchMedia(MQ.reduce).matches;
    const run = () => {
      if (reduce) { gsap.fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.2 }); return; }
      const to = el.getBoundingClientRect();
      if (first.current && origin && to.width) {
        gsap.fromTo(el, {
          x: origin.left + origin.width / 2 - (to.left + to.width / 2),
          y: origin.top + origin.height / 2 - (to.top + to.height / 2),
          scale: Math.min(origin.width / to.width, origin.height / to.height), opacity: 0.6,
        }, { x: 0, y: 0, scale: 1, opacity: 1, duration: 0.6, ease: EASE.text });
      } else {
        gsap.fromTo(el, { scale: 0.96, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.35, ease: EASE.ui });
      }
      first.current = false;
    };
    if (el.complete) run(); else el.addEventListener("load", run, { once: true });
    strip.current?.querySelector(`[data-i="${index}"]`)?.scrollIntoView({ block: "nearest", inline: "center", behavior: reduce ? "auto" : "smooth" });
  }, [index, open, origin]);

  const step = useCallback((by: number) => {
    if (index === null) return;
    onIndex((index + by + items.length) % items.length);
  }, [index, items.length, onIndex]);

  const btn = "grid h-10 w-10 place-items-center rounded-full transition hover:bg-white/15";

  return (
    <dialog
      ref={ref}
      onClose={() => onIndex(null)}
      onClick={(e) => { if (e.target === ref.current) onIndex(null); }}
      onKeyDown={(e) => { if (e.key === "ArrowRight") step(1); if (e.key === "ArrowLeft") step(-1); }}
      className="m-auto max-h-none max-w-none overflow-visible bg-transparent p-0 backdrop:bg-ink/85 backdrop:backdrop-blur-md"
    >
      {item ? (
        <figure className="flex max-h-[94vh] w-[min(94vw,980px)] flex-col items-center gap-3">
          <div className="relative grid w-full place-items-center"
            onPointerDown={(e) => { swipe.current = e.clientX; }}
            onPointerUp={(e) => { if (swipe.current !== null && Math.abs(e.clientX - swipe.current) > 50) step(e.clientX < swipe.current ? 1 : -1); swipe.current = null; }}>
            {/* Plain <img> fed by next/image's optimizer (getImageProps): keeps natural sizing for the zoom-from-card maths. */}
            {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text -- alt comes from full() */}
            <img ref={img} key={item.src} {...full(item)} draggable={false}
              className="max-h-[70vh] w-auto max-w-full select-none rounded-[18px] object-contain shadow-[0_40px_80px_-30px_rgb(0_0_0/0.8)]" />
            <button type="button" onClick={() => step(-1)} aria-label={labels.prev} className={`glass-dark absolute left-2 top-1/2 -translate-y-1/2 text-white md:-left-14 ${btn}`}>‹</button>
            <button type="button" onClick={() => step(1)} aria-label={labels.next} className={`glass-dark absolute right-2 top-1/2 -translate-y-1/2 text-white md:-right-14 ${btn}`}>›</button>
          </div>
          <figcaption className="glass-dark flex w-full items-center justify-between gap-3 rounded-full py-1.5 pl-5 pr-1.5 text-white">
            <span className="text-sm font-semibold">{item.caption}</span>
            <span className="flex items-center gap-2">
              <span className="text-xs font-bold tabular-nums text-white/60">{(index ?? 0) + 1} / {items.length}</span>
              <button type="button" onClick={() => onIndex(null)} aria-label={labels.close} autoFocus className={btn}>✕</button>
            </span>
          </figcaption>
          <ol ref={strip} className="no-scrollbar flex w-full gap-2 overflow-x-auto px-1 pb-1">
            {items.map((it, i) => (
              <li key={it.src} data-i={i} className="shrink-0">
                <button type="button" onClick={() => onIndex(i)} aria-label={it.caption} aria-current={i === index ? "true" : undefined}
                  className={`block h-14 w-14 overflow-hidden rounded-lg ring-2 transition ${i === index ? "opacity-100 ring-brand" : "opacity-50 ring-transparent hover:opacity-90"}`}>
                  <Image src={it.src} alt="" width={56} height={56} sizes="56px" className="h-full w-full object-cover" />
                </button>
              </li>
            ))}
          </ol>
        </figure>
      ) : null}
    </dialog>
  );
}
