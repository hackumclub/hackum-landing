"use client";
import { useRef } from "react";
import { gsap, useGSAP } from "@/motion/gsap";
import { Draggable } from "@/motion/drag";
import { DUR, EASE, MQ, STAGGER } from "@/motion/config";
import { whenFontsReady } from "@/motion/page";
import Sticker from "./Sticker";
import type { StickerName } from "@/lib/manul";

export type Placed = { name: StickerName; className: string; rotate: number };

/**
 * Hero band. Once fonts are loaded, [data-rise] lines slide up from their masks and the
 * Мануул stickers slap on. Stickers can be dragged and thrown. The glow and sticker layer get ScrollSmoother
 * parallax (data-speed) on desktop; Draggable lives on the sticker itself so the two transforms never collide.
 */
export default function Lid({ stickers, children, className = "" }: { stickers: Placed[]; children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLElement>(null);

  useGSAP((_ctx, contextSafe) => {
    const root = ref.current;
    if (!root || !contextSafe) return;
    const rise = gsap.utils.toArray<HTMLElement>("[data-rise]");
    const cards = gsap.utils.toArray<HTMLElement>("[data-sticker]");
    const mm = gsap.matchMedia();
    mm.add(MQ.motion, () => {
      gsap.set(rise, { yPercent: 110, opacity: 0 });
      gsap.set(cards, { scale: 0, opacity: 0 });
      let live = true;
      whenFontsReady().then(contextSafe(() => {
        if (!live) return;
        gsap.timeline({ defaults: { ease: EASE.text } })
          .to(rise, { yPercent: 0, opacity: 1, duration: DUR.slow, stagger: STAGGER.lines })
          .to(cards, { scale: 1, opacity: 1, duration: 0.55, ease: "back.out(2.2)", stagger: 0.09 }, "-=0.45");
      }));
      return () => { live = false; };
    });
    let z = 10;
    const drags = Draggable.create(cards, {
      bounds: root,
      inertia: true,
      onPress() { gsap.set(this.target, { zIndex: ++z }); gsap.to(this.target, { scale: 1.08, duration: 0.2 }); },
      onRelease() { gsap.to(this.target, { scale: 1, duration: 0.3, ease: "back.out(3)" }); },
    });
    return () => { mm.revert(); drags.forEach((d) => d.kill()); };
  }, { scope: ref });

  return (
    <section ref={ref} className={`relative isolate overflow-hidden ${className}`}>
      {/* suppressHydrationWarning on the two data-speed layers: ScrollSmoother adds data-lag + an inline transform to them before React finishes hydrating. */}
      {/* Brand glow: the logo's gradient, blurred; drifts slower than the page. */}
      <div aria-hidden data-speed="0.8" suppressHydrationWarning className="pointer-events-none absolute -right-[12%] top-[8%] -z-10 h-[620px] w-[620px] rounded-full opacity-70 blur-[90px] [background:radial-gradient(circle_at_30%_25%,#00ab84_0%,transparent_45%),radial-gradient(circle_at_45%_45%,#e5bf03_0%,transparent_55%),radial-gradient(circle_at_40%_80%,#00ab84_0%,transparent_50%),radial-gradient(circle_at_75%_90%,#13a3ea_0%,transparent_45%)]" />
      {children}
      <div data-speed="0.9" suppressHydrationWarning className="pointer-events-none absolute inset-0 z-[5]">
        {stickers.map((s) => (
          <div key={s.name} data-sticker data-cursor="drag" className={`pointer-events-auto absolute cursor-grab touch-none active:cursor-grabbing ${s.className}`}>
            <Sticker name={s.name} eager className="w-full" style={{ rotate: `${s.rotate}deg` }} />
          </div>
        ))}
      </div>
    </section>
  );
}
