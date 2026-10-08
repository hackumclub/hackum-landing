"use client";
import Image from "next/image";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { gsap, useGSAP } from "@/motion/gsap";
import { EASE, MQ } from "@/motion/config";
import type { Locale } from "@/i18n/config";
import type { Dict } from "@/i18n";
import type { IgPost } from "@/lib/feed";

const HOVER = "(hover: hover) and (pointer: fine)";
const subscribe = (cb: () => void) => { const m = window.matchMedia(HOVER); m.addEventListener("change", cb); return () => m.removeEventListener("change", cb); };
/** True only on devices with a real hover pointer; false during SSR. */
const useHoverPointer = () => useSyncExternalStore(subscribe, () => window.matchMedia(HOVER).matches, () => false);

// Story highlights shown under the bio (labels are event names, so they stay as-is in both languages).
const HIGHLIGHTS = ["Hackathon", "C Battle", "Workshop", "Meetup", "Trips"];
const PHONE_W = 280;
const PHONE_H = 560;
const GAP = 28;

type Pos = { left: number; top: number };

/**
 * "Follow on Instagram" button. On hover/focus (hover pointers only) a phone slides up with a slight tilt beside
 * the nearest `[data-ig-anchor]` card (so it never covers the headline), showing a scrollable @hackumclub profile
 * that gently auto-scrolls until the visitor scrolls it. If there is no room beside the card, or on touch devices,
 * it is just the link. Feed data comes from src/lib/feed.ts (swap for the Graph API later).
 */
export default function InstagramPreview({ url, posts, lang, dict, label, compact = false }: {
  url: string; posts: IgPost[]; lang: Locale; dict: Dict["instagram"]; label: string; compact?: boolean;
}) {
  const [pos, setPos] = useState<Pos | null>(null);
  const open = pos !== null;
  const hover = useHoverPointer();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const phone = useRef<HTMLDivElement>(null);
  const feed = useRef<HTMLDivElement>(null);
  const auto = useRef<gsap.core.Tween | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  // Place the phone just outside the left or right edge of the anchor card, centred on it and kept in view.
  const place = (): Pos | null => {
    const w = wrap.current;
    if (!w) return null;
    const me = w.getBoundingClientRect();
    const a = (w.closest("[data-ig-anchor]") ?? w).getBoundingClientRect();
    const fitsRight = a.right + GAP + PHONE_W <= window.innerWidth - 12;
    const fitsLeft = a.left - GAP - PHONE_W >= 12;
    if (!fitsRight && !fitsLeft) return null;
    const x = fitsRight ? a.right + GAP : a.left - GAP - PHONE_W;
    const wantY = a.top + a.height / 2 - PHONE_H / 2;
    const y = Math.min(Math.max(wantY, 84), Math.max(84, window.innerHeight - PHONE_H - 16));
    return { left: x - me.left, top: y - me.top };
  };

  const show = () => { if (timer.current) clearTimeout(timer.current); if (hover && !open) setPos(place()); };
  const hide = () => { if (timer.current) clearTimeout(timer.current); timer.current = setTimeout(() => setPos(null), 450); };

  useGSAP(() => {
    const el = phone.current, f = feed.current;
    if (!el || !f) return;
    const reduce = window.matchMedia(MQ.reduce).matches;
    if (open) {
      gsap.set(el, { display: "block" });
      if (reduce) gsap.fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.2 });
      else gsap.fromTo(el, { y: 60, opacity: 0, rotationX: 18, rotationZ: -8, scale: 0.86, transformPerspective: 900 },
        { y: 0, opacity: 1, rotationX: 0, rotationZ: -3, scale: 1, duration: 0.65, ease: EASE.text });
      if (!reduce) {
        // Idle auto-scroll through the feed; any manual wheel/touch stops it.
        auto.current = gsap.to(f, { scrollTop: () => f.scrollHeight - f.clientHeight, duration: 22, ease: "none", delay: 1.2 });
        const stop = () => auto.current?.kill();
        f.addEventListener("wheel", stop, { passive: true, once: true });
        f.addEventListener("touchstart", stop, { passive: true, once: true });
      }
    } else {
      auto.current?.kill();
      gsap.to(el, { y: 30, opacity: 0, rotationZ: -6, scale: 0.92, duration: reduce ? 0.1 : 0.3, ease: EASE.ui, onComplete: () => { gsap.set(el, { display: "none" }); f.scrollTop = 0; } });
    }
  }, { dependencies: [open], scope: wrap });

  const alt = (p: IgPost) => (lang === "en" ? p.altEn : p.alt);

  return (
    <div ref={wrap} className="relative inline-block" onPointerEnter={show} onPointerLeave={hide} onFocus={show}
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) hide(); }}
      onKeyDown={(e) => { if (e.key === "Escape") setPos(null); }}>
      <a href={url} target="_blank" rel="noopener noreferrer" aria-describedby={hover ? "ig-preview" : undefined}
        className={`btn-glass inline-flex items-center gap-2.5 rounded-full ${compact ? "px-5 py-2.5 text-[15px]" : "px-7 py-3.5"}`}>
        <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current stroke-2"><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1" className="fill-current" /></svg>
        {label}
      </a>

      {hover ? (
        <div id="ig-preview" role="tooltip" aria-label={dict.preview} className="absolute z-30" style={{ width: PHONE_W, left: pos?.left ?? 0, top: pos?.top ?? 0 }}>
          <div ref={phone} style={{ display: "none" }} className={open ? "pointer-events-auto" : "pointer-events-none"}>
            <div className="rounded-[46px] bg-ink p-[10px] shadow-[0_50px_90px_-30px_rgb(0_0_0/0.7)] ring-1 ring-white/15">
              <div className="relative overflow-hidden rounded-[36px] bg-white text-ink" style={{ height: PHONE_H - 20 }}>
                {/* status bar + dynamic island */}
                <div aria-hidden className="absolute inset-x-0 top-0 z-10 flex h-9 items-center justify-between bg-white/90 px-6 text-[11px] font-bold backdrop-blur">
                  <span>9:41</span>
                  <span className="h-5 w-20 rounded-full bg-ink" />
                  <span className="flex items-center gap-1"><span className="h-2 w-3 rounded-[2px] bg-ink" /><span className="h-2.5 w-5 rounded-[3px] border border-ink" /></span>
                </div>
                <div ref={feed} className="no-scrollbar h-full overflow-y-auto overscroll-contain pt-10" tabIndex={open ? 0 : -1}>
                  <div className="flex items-center justify-between px-4 pb-1">
                    <span className="text-[15px] font-bold">hackumclub</span>
                    <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current stroke-2"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
                  </div>
                  <div className="flex items-center gap-5 px-4 py-2">
                    <span className="rounded-full bg-[conic-gradient(#0085ca,#00ab84,#e5bf03,#0085ca)] p-[2.5px]">
                      {/* eslint-disable-next-line @next/next/no-img-element -- brand mark */}
                      <img src="/img/brand/logo-128.png" alt="" width={68} height={68} className="h-[68px] w-[68px] rounded-full border-[3px] border-white bg-white" />
                    </span>
                    <div className="text-center">
                      <p className="font-bold leading-none">{posts.length}</p>
                      <p className="mt-1 text-[11px] text-muted">{dict.posts}</p>
                    </div>
                  </div>
                  <div className="px-4 pb-3 text-[12.5px] leading-snug">
                    <p className="font-bold">{dict.name}</p>
                    <p className="text-muted">{dict.bio}</p>
                  </div>
                  <ul aria-hidden className="no-scrollbar flex gap-3 overflow-x-auto px-4 pb-3">
                    {HIGHLIGHTS.map((h, i) => (
                      <li key={h} className="flex w-14 shrink-0 flex-col items-center gap-1">
                        <span className="h-14 w-14 overflow-hidden rounded-full border-2 border-white ring-1 ring-ink/15">
                          <Image src={posts[(i * 3) % posts.length].src} alt="" width={56} height={56} sizes="56px" className="h-full w-full object-cover" />
                        </span>
                        <span className="w-full truncate text-center text-[10px]">{h}</span>
                      </li>
                    ))}
                  </ul>
                  <div aria-hidden className="flex border-t border-ink/10">
                    <span className="flex-1 border-b-2 border-ink py-2"><svg viewBox="0 0 24 24" className="mx-auto h-4 w-4 fill-none stroke-current stroke-2"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /></svg></span>
                    <span className="flex-1 py-2 text-ink/40"><svg viewBox="0 0 24 24" className="mx-auto h-4 w-4 fill-none stroke-current stroke-2"><rect x="3" y="3" width="18" height="18" rx="4" /><path d="m10 9 5 3-5 3z" /></svg></span>
                  </div>
                  <ul className="grid grid-cols-3 gap-0.5">
                    {posts.map((p) => (
                      <li key={p.src} className="group/post relative aspect-[4/5] overflow-hidden bg-fur">
                        <a href={p.url} target="_blank" rel="noopener noreferrer" tabIndex={open ? 0 : -1} aria-label={alt(p)} className="block h-full">
                          <Image src={p.src} alt="" fill sizes="90px" className="object-cover transition duration-500 group-hover/post:scale-110" />
                          <span aria-hidden className="absolute inset-0 bg-ink/0 transition group-hover/post:bg-ink/25" />
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
