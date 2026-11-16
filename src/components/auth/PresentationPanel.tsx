"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import Sticker from "@/components/Sticker";
import { cx } from "@/components/ui/cx";
import { copy } from "@/i18n/areas/public";
import { fill, tf, type Locale } from "@/i18n/config";
import { SLIDE_MS, SLIDES } from "./slides";

const query = "(prefers-reduced-motion: reduce)";
const subscribe = (cb: () => void) => { const m = window.matchMedia(query); m.addEventListener("change", cb); return () => m.removeEventListener("change", cb); };
const useReducedMotion = () => useSyncExternalStore(subscribe, () => window.matchMedia(query).matches, () => false);

/**
 * Three-slide presentation (large rounded brand-blue panel, from lg). Advances every 6 s; stops while the pointer or focus is
 * inside, when the visitor pauses it, and for good under `prefers-reduced-motion` (slides then change only on request).
 * Every slide stays in the DOM, stacked, so the panel never changes height; the inactive ones are inert.
 */
export default function PresentationPanel({ lang, className }: { lang: Locale; className?: string }) {
  const c = copy[lang].auth;
  const reduced = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [hover, setHover] = useState(false);
  const [focus, setFocus] = useState(false);
  const [paused, setPaused] = useState(false);
  const playing = !reduced && !paused && !hover && !focus;

  useEffect(() => {
    if (!playing) return;
    const id = setTimeout(() => setIndex((i) => (i + 1) % SLIDES.length), SLIDE_MS);
    return () => clearTimeout(id);
  }, [playing, index]);

  const go = (n: number) => setIndex((n + SLIDES.length) % SLIDES.length);
  const btn = "grid size-11 cursor-pointer place-items-center rounded-full text-[var(--ops-on-stage)] ring-1 ring-white/40 transition-colors hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";

  return (
    <section
      aria-roledescription="carousel"
      aria-label={c.slidesLabel}
      className={cx("ops-stage flex flex-col justify-between gap-6 p-8 xl:p-10", className)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => setFocus(true)}
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setFocus(false); }}
    >
      <div className="relative z-10 flex items-center gap-2 text-sm font-bold text-[var(--ops-on-stage-lead)]">
        {/* eslint-disable-next-line @next/next/no-img-element -- 128px brand mark */}
        <img src="/img/brand/logo-128.png" alt="" width={28} height={28} className="size-7" />
        Hackum
      </div>

      <div aria-live={playing ? "off" : "polite"} className="relative z-10 grid flex-1 [&>*]:col-start-1 [&>*]:row-start-1">
        {SLIDES.map((s, i) => {
          const active = i === index;
          return (
            <div
              key={i}
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} / ${SLIDES.length}`}
              aria-hidden={active ? undefined : true}
              inert={!active}
              className={cx("grid content-center justify-items-start gap-6 transition-opacity duration-500 motion-reduce:transition-none", active ? "opacity-100" : "pointer-events-none opacity-0")}
            >
              <Sticker name={s.sticker} sizes="240px" eager={i === 0} className="w-48 -rotate-3 xl:w-60" />
              <div className="grid gap-3">
                <h2 className="max-w-md font-display text-[clamp(28px,3vw,42px)] leading-[1.08] font-black [overflow-wrap:anywhere]">{tf(s.title, lang)}</h2>
                <p className="max-w-md text-lg text-[var(--ops-on-stage-lead)]">{tf(s.body, lang)}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="relative z-10 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2" role="group" aria-label={c.slidesLabel}>
          {SLIDES.map((_, i) => (
            <button key={i} type="button" aria-label={fill(c.slideGo, { n: i + 1 })} aria-current={i === index ? "true" : undefined} onClick={() => go(i)}
              className="grid h-11 w-8 cursor-pointer place-items-center focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-white">
              <span className={cx("block h-2 rounded-full transition-all duration-300 motion-reduce:transition-none", i === index ? "w-8 bg-white" : "w-2 bg-white/50")} />
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {!reduced && (
            <button type="button" aria-label={paused ? c.slidePlay : c.slidePause} onClick={() => setPaused((p) => !p)} className={btn}>
              {paused ? <Play aria-hidden size={18} /> : <Pause aria-hidden size={18} />}
            </button>
          )}
          <button type="button" aria-label={c.slidePrev} onClick={() => go(index - 1)} className={btn}><ChevronLeft aria-hidden size={20} /></button>
          <button type="button" aria-label={c.slideNext} onClick={() => go(index + 1)} className={btn}><ChevronRight aria-hidden size={20} /></button>
        </div>
      </div>
    </section>
  );
}
