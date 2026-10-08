"use client";
import { useEffect, useRef, type CSSProperties } from "react";
import Link from "next/link";
import { gsap } from "@/motion/gsap";
import { EASE, MQ } from "@/motion/config";
import Split from "./motion/Split";
import type { Locale } from "@/i18n/config";
import type { Dict } from "@/i18n";
import type { IgPost } from "@/lib/feed";
import InstagramPreview from "./InstagramPreview";
import Icon3D from "./Icon3D";

// 3D icons (3dicons.co, CC0). `d` = parallax depth. Three groups:
//  - corner: sit in the corners of the blue band and bleed past its rounded edges (clipped by the band)
//  - card:   overlay the corners of the glass card, on top of it
//  - edge:   scattered along the sides
type Icon = { name: string; s: number; d: number; style: CSSProperties; hideSm?: boolean; rot?: number };
const CORNER: Icon[] = [
  { name: "rocket", s: 150, d: 1.3, style: { left: "0.5%", top: "-1%" }, rot: -14 },
  { name: "trophy", s: 140, d: 1.1, style: { right: "0.5%", top: "-1%" }, rot: 12 },
  { name: "coffee", s: 130, d: 1.0, style: { left: "0.5%", bottom: "-2%" }, rot: 10 },
  { name: "fire", s: 130, d: 1.2, style: { right: "0.5%", bottom: "-3%" }, rot: -8 },
];
const CARD: Icon[] = [
  { name: "chat", s: 92, d: 0.5, style: { left: -38, top: -38 }, rot: -12 },
  { name: "star", s: 84, d: 0.6, style: { right: -34, top: -34 }, rot: 14 },
  { name: "bulb", s: 92, d: 0.5, style: { left: -36, bottom: -40 }, rot: 8, hideSm: true },
  { name: "medal", s: 92, d: 0.6, style: { right: -38, bottom: -40 }, rot: -10, hideSm: true },
];
const EDGE: Icon[] = [
  { name: "computer", s: 120, d: 0.8, style: { left: "9%", top: "58%" }, hideSm: true },
  { name: "calendar", s: 86, d: 0.7, style: { right: "12%", top: "14%" }, hideSm: true },
  { name: "puzzle", s: 80, d: 0.9, style: { right: "7%", top: "52%" }, hideSm: true },
  { name: "mic", s: 84, d: 1.3, style: { left: "22%", bottom: "6%" }, hideSm: true },
];

function Ic({ ic }: { ic: Icon }) {
  return (
    <div data-icon data-depth={ic.d} aria-hidden className={`pointer-events-none absolute ${ic.hideSm ? "hidden md:block" : ""}`}
      style={{ ...ic.style, width: ic.s * 0.62, height: ic.s * 0.62 }}>
      <Icon3D name={ic.name} sizes={`${ic.s}px`} style={{ rotate: `${ic.rot ?? 0}deg` }}
        className="h-full w-full scale-[1.6] drop-shadow-[0_18px_22px_rgb(0_40_70/0.45)]" />
    </div>
  );
}

/** Devfolio-style community CTA: a glass card whose corners (and the band's corners) are overlaid by floating 3D icons. */
export default function JoinSection({ lang, dict, ig, igUrl, posts, joinHref }: {
  lang: Locale; dict: Dict["join"]; ig: Dict["instagram"]; igUrl: string; posts: IgPost[]; joinHref: string;
}) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const mm = gsap.matchMedia();
    // Entrance + float for anyone with motion; mouse-depth parallax only with a hover pointer.
    mm.add(MQ.motion, () => {
      const icons = gsap.utils.toArray<HTMLElement>("[data-icon]", root);
      // Entrance: pop in when the section scrolls into view.
      gsap.from(icons, { scale: 0, opacity: 0, duration: 0.7, ease: EASE.pop, stagger: 0.05, scrollTrigger: { trigger: root, start: "top 75%", once: true } });
      // Idle float, each on its own rhythm.
      icons.forEach((el, i) => {
        gsap.to(el.firstElementChild, { y: i % 2 ? 14 : -14, rotation: i % 3 ? 6 : -6, duration: 2.6 + (i % 4) * 0.5, ease: EASE.float, yoyo: true, repeat: -1 });
      });
    });
    mm.add(MQ.full, () => {
      const icons = gsap.utils.toArray<HTMLElement>("[data-icon]", root);
      // Mouse parallax by depth.
      const movers = icons.map((el) => ({ d: Number(el.dataset.depth), x: gsap.quickTo(el, "x", { duration: 0.8, ease: "power3" }), y: gsap.quickTo(el, "y", { duration: 0.8, ease: "power3" }) }));
      const onMove = (e: PointerEvent) => {
        const b = root.getBoundingClientRect();
        const nx = (e.clientX - b.left) / b.width - 0.5, ny = (e.clientY - b.top) / b.height - 0.5;
        movers.forEach((m) => { m.x(nx * 40 * m.d); m.y(ny * 30 * m.d); });
      };
      root.addEventListener("pointermove", onMove);
      return () => root.removeEventListener("pointermove", onMove);
    });
    return () => mm.revert();
  }, []);

  return (
    <section ref={ref} className="relative mx-2 rounded-[40px] bg-[radial-gradient(120%_90%_at_50%_0%,#13a3ea_0%,#0085ca_45%,#005b8c_100%)] px-6 py-28 text-white md:mx-4 md:py-40">
      {/* Decoration layer is clipped to the rounded band so corner icons bleed off its edges; the card and its Instagram phone are not clipped. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden rounded-[40px]">
        <div className="absolute inset-0 opacity-[0.07] [background-image:radial-gradient(circle_at_center,#fff_1.5px,transparent_2px)] [background-size:26px_26px]" />
        {CORNER.map((ic) => <Ic key={ic.name} ic={ic} />)}
        {EDGE.map((ic) => <Ic key={ic.name} ic={ic} />)}
      </div>
      <div data-ig-anchor className="glass-plain relative z-10 mx-auto max-w-[640px] rounded-[32px] px-6 py-12 text-center md:px-12">
        {CARD.map((ic) => <Ic key={ic.name} ic={ic} />)}
        <p className="font-bold text-white/75">{dict.kicker}</p>
        <Split as="h2" className="mt-3 font-display text-[clamp(34px,5vw,60px)] font-black leading-[1.02]">{dict.title}</Split>
        <p className="mx-auto mt-5 max-w-md text-lg text-white/85">{dict.lead}</p>
        <div className="mt-9 flex flex-wrap justify-center gap-3">
          <Link href={joinHref} className="btn-white rounded-full px-7 py-3.5">{dict.cta}</Link>
          <InstagramPreview url={igUrl} posts={posts} lang={lang} dict={ig} label={dict.follow} />
        </div>
      </div>
    </section>
  );
}
