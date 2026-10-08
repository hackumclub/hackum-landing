"use client";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { gsap } from "@/motion/gsap";
import { EASE, MQ } from "@/motion/config";
import type { Milestone, Shot } from "@/lib/club";
import type { Locale } from "@/i18n/config";
import type { Dict } from "@/i18n";
import Lightbox, { type LightboxItem } from "./Lightbox";
import Split from "./motion/Split";

type Media = Record<number, { front: Shot; back?: Shot }>;
// Pinned-photo feel: each column leans a little differently.
const TILT = [-3, 2, -1.5, 3, -2.5, 1.5];

/**
 * "Our story": one equally sized square stack per year on a dark band. The back card (poster or second
 * photo) peeks out and slides forward on hover; clicking opens the lightbox. Desktop + motion: the band
 * pins and vertical scroll scrubs the track, a giant year follows the focused column, a gradient rail fills.
 */
export default function Timeline({ items, media, lang, dict, joinHref }: {
  items: Milestone[]; media: Media; lang: Locale; dict: Dict["timeline"]; joinHref: string;
}) {
  const years = useMemo(() => {
    const by = new Map<number, Milestone[]>();
    for (const m of items) by.set(m.year, [...(by.get(m.year) ?? []), m]);
    return [...by.entries()].map(([year, list]) => ({ year, list, m: media[year] }));
  }, [items, media]);
  // Flat list for the lightbox, remembering where each year's front card starts.
  const { shots, startOf } = useMemo(() => {
    const shots: LightboxItem[] = [];
    const startOf: Record<number, number> = {};
    for (const { year, m } of years) {
      if (!m) continue;
      startOf[year] = shots.length;
      for (const s of [m.front, m.back]) if (s) shots.push({ src: s.src, alt: s.alt[lang], caption: `${year} · ${s.alt[lang]}` });
    }
    return { shots, startOf };
  }, [years, lang]);
  const [box, setBox] = useState<number | null>(null);
  const [origin, setOrigin] = useState<DOMRect | null>(null);

  const first = years[0]?.year, last = years[years.length - 1]?.year ?? 0;
  const wrap = useRef<HTMLDivElement>(null);
  const view = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLOListElement>(null);
  const big = useRef<HTMLSpanElement>(null);
  const fill = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const w = wrap.current, v = view.current, t = track.current;
    if (!w || !v || !t) return;
    const mm = gsap.matchMedia();
    mm.add("(min-width: 768px) and (prefers-reduced-motion: no-preference)", () => {
      v.style.overflow = "hidden";
      const cols = gsap.utils.toArray<HTMLElement>("[data-col]", t);
      const ticks = gsap.utils.toArray<HTMLElement>("[data-tick]", w);
      // Layout is measured once per refresh (resize / fonts / images), never inside the per-frame onUpdate:
      // reading offsetLeft after the gsap.set below would force a synchronous layout on every scroll frame.
      let distance = 0, viewW = 0, centres: number[] = [];
      const measure = () => {
        distance = t.scrollWidth - v.clientWidth;
        viewW = v.clientWidth;
        centres = cols.map((c) => c.offsetLeft + c.offsetWidth / 2);
      };
      measure();
      const dist = () => { measure(); return distance; };
      const setFill = gsap.quickSetter(fill.current, "scaleX");
      let active = -1;
      const texts = cols.map((c) => c.querySelectorAll("[data-txt]"));
      gsap.set(texts.flatMap((t) => Array.from(t)), { opacity: 0.35 });
      const setActive = (i: number) => {
        if (i === active || !big.current) return;
        if (active >= 0) { cols[active]?.removeAttribute("data-active"); gsap.to(texts[active], { opacity: 0.35, duration: 0.3 }); }
        // Active year: its poster slides out (CSS on [data-active]) while its year + titles rise in.
        cols[i]?.setAttribute("data-active", "");
        gsap.fromTo(texts[i], { y: 14, opacity: 0.35 }, { y: 0, opacity: 1, duration: 0.45, ease: EASE.ui, stagger: 0.06, overwrite: true });
        active = i;
        const y = cols[i]?.dataset.year ?? "";
        gsap.fromTo(big.current, { yPercent: 18, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.35, ease: "power2.out", onStart: () => { big.current!.textContent = y; } });
        ticks.forEach((el) => el.toggleAttribute("data-on", el.dataset.tick === y));
      };
      const scrub = gsap.to(t, {
        x: () => -dist(),
        ease: "none",
        scrollTrigger: {
          trigger: w, start: "top 72px", end: () => `+=${dist() * 1.15}`, pin: true, scrub: 0.7, invalidateOnRefresh: true,
          // ScrollSmoother transforms the content, so pins must be transform-based while it is active.
          pinType: window.matchMedia(MQ.full).matches ? "transform" : "fixed",
          onRefresh: measure,
          onUpdate(self) {
            setFill(self.progress);
            // Active year = column whose centre is nearest the viewport centre (cached geometry only).
            const focus = self.progress * distance + viewW / 2;
            let i = 0, best = Infinity;
            for (let k = 0; k < centres.length; k++) { const d = Math.abs(centres[k] - focus); if (d < best) { best = d; i = k; } }
            setActive(i);
          },
        },
      });
      cols.forEach((c, k) => {
        const stack = c.querySelector("[data-stack]");
        if (!stack) return;
        gsap.fromTo(stack, { scale: 0.82, rotation: TILT[k % TILT.length] * 3, opacity: 0.35 }, {
          scale: 1, rotation: TILT[k % TILT.length], opacity: 1, ease: "none",
          scrollTrigger: { trigger: c, containerAnimation: scrub, start: "left 95%", end: "left 50%", scrub: true },
        });
      });
      setActive(0);
      return () => { v.style.overflow = ""; ticks.forEach((el) => el.removeAttribute("data-on")); cols.forEach((c) => c.removeAttribute("data-active")); };
    });
    return () => mm.revert();
  }, []);

  const card = "absolute inset-0 overflow-hidden rounded-[16px] border-[5px] border-white bg-ink-2 shadow-[0_24px_40px_-16px_rgb(0_0_0/0.6)]";
  const badge = (s: Shot) => s.kind === "poster" ? <span className="absolute bottom-2 left-2 rounded-full bg-white px-2.5 py-0.5 text-[11px] font-bold text-ink">{dict.poster}</span> : null;

  return (
    <div ref={wrap} className="relative mx-2 flex flex-col overflow-hidden rounded-[40px] bg-ink py-14 text-white md:mx-4 md:h-[calc(100svh-80px)] md:py-10">
      <div aria-hidden className="pointer-events-none absolute -left-40 -top-40 h-[520px] w-[520px] rounded-full bg-[radial-gradient(circle,rgb(0_133_202/0.45),transparent_65%)] blur-2xl" />
      <div className="relative mx-auto flex w-full max-w-[1200px] items-end justify-between gap-6 px-6">
        <div>
          <p className="font-bold text-white/60">{first}–{last}</p>
          <Split as="h2" id="memories" className="mt-2 font-display text-[clamp(32px,4.4vw,56px)] font-black leading-none">{dict.title}</Split>
        </div>
        <span ref={big} aria-hidden className="hidden font-display text-[clamp(80px,12vw,180px)] font-black leading-[0.8] text-white/[0.09] md:block">{first}</span>
      </div>

      <div ref={view} className="no-scrollbar relative mt-10 flex-1 overflow-x-auto md:mt-6" role="region" aria-label={dict.region} tabIndex={0}>
        <ol ref={track} className="flex h-full w-max items-center gap-12 px-6 md:gap-20 md:px-[max(24px,calc((100vw-1200px)/2))]">
          {years.map(({ year, list, m }, k) => (
            <li key={year} data-col data-year={year} className={`group/col flex w-[240px] shrink-0 flex-col md:w-[290px] ${m?.back ? "md:mr-[110px]" : ""}`}>
              <div data-stack className="relative aspect-square w-full" style={{ rotate: `${TILT[k % TILT.length]}deg` }}>
                {m ? (
                  <button type="button" onClick={(ev) => { setOrigin(ev.currentTarget.querySelector("[data-front]")?.getBoundingClientRect() ?? null); setBox(startOf[year]); }} data-cursor="view"
                    aria-label={`${dict.open}: ${m.front.alt[lang]}`} className="group absolute inset-0 rounded-[16px]">
                    {m.back ? (
                      <span className={`${card} translate-x-5 -translate-y-4 rotate-[7deg] transition-transform duration-500 ease-out group-hover:-translate-y-2 group-hover:translate-x-[38%] group-hover:rotate-[10deg] group-focus-visible:translate-x-[38%] group-data-[active]/col:-translate-y-2 group-data-[active]/col:translate-x-[38%] group-data-[active]/col:rotate-[10deg]`}>
                        <Image src={m.back.src} alt="" fill sizes="(min-width: 768px) 290px, 240px" className="object-cover" />
                        {badge(m.back)}
                      </span>
                    ) : null}
                    <span data-front className={`${card} transition-transform duration-500 ease-out group-hover:-translate-x-3 group-hover:-rotate-2 group-data-[active]/col:-translate-x-3 group-data-[active]/col:-rotate-2`}>
                      <Image src={m.front.src} alt="" fill sizes="(min-width: 768px) 290px, 240px" className="object-cover" />
                      {badge(m.front)}
                    </span>
                  </button>
                ) : (
                  <div className="glass-dark absolute inset-0 flex flex-col justify-between rounded-[16px] p-6">
                    {/* eslint-disable-next-line @next/next/no-img-element -- brand mark */}
                    <img src="/img/brand/logo-128.png" alt="" width={48} height={48} className="h-12 w-12" />
                    <p className="font-display text-2xl font-black leading-tight">{list[0].title[lang]}</p>
                  </div>
                )}
              </div>
              <p data-txt className="mt-6 font-display text-4xl font-black">{year}</p>
              <ul className="mt-2 space-y-1.5">
                {list.map((x) => (
                  <li key={x.title.en} data-txt className="leading-snug">
                    <span className="font-bold">{x.title[lang]}</span>
                    {x.note ? <span className="text-white/60"> · {x.note[lang]}</span> : null}
                  </li>
                ))}
              </ul>
            </li>
          ))}
          <li className="flex w-[240px] shrink-0 flex-col items-start md:w-[290px]">
            <div className="glass-dark grid aspect-square w-full place-items-center rounded-[16px]">
              <Image src="/img/brand/logo-512.png" alt="" width={512} height={512} sizes="144px" className="h-36 w-36" />
            </div>
            <p className="mt-6 font-display text-4xl font-black">{last + 1}</p>
            <p className="mt-2 text-lg font-bold">{dict.next}</p>
            <Link href={joinHref} className="btn-primary btn-flat mt-5 rounded-full px-6 py-3">{dict.nextCta}</Link>
          </li>
        </ol>
      </div>

      <div aria-hidden className="relative mx-auto mt-8 hidden w-full max-w-[1200px] px-6 md:block">
        <div className="relative h-1 rounded-full bg-white/15">
          <div ref={fill} className="absolute inset-0 origin-left scale-x-0 rounded-full bg-[linear-gradient(90deg,#0085ca,#00ab84_55%,#e5bf03)]" />
        </div>
        <ol className="mt-3 flex justify-between text-xs font-bold text-white/40">
          {years.map(({ year }) => <li key={year} data-tick={year} className="transition-colors data-[on]:text-white">{year}</li>)}
        </ol>
      </div>

      <Lightbox items={shots} index={box} onIndex={setBox} origin={origin} labels={{ close: dict.close, prev: dict.prevShot, next: dict.nextShot }} />
    </div>
  );
}
