"use client";
import { useRef, type ElementType } from "react";
import { gsap, ScrollTrigger, useGSAP } from "@/motion/gsap";
import { SplitText } from "@/motion/split";
import { DUR, EASE, MQ, REVEAL_START, STAGGER } from "@/motion/config";
import { whenFontsReady } from "@/motion/page";

type Mode = "lines" | "words" | "fade" | "scrub";

/** "Join the [Hackum] community" → text with <mark class="kw">Hackum</mark> (blue + underline sweep). */
export function rich(text: string) {
  return text.split(/(\[[^\]]+\])/g).map((part, i) =>
    part.startsWith("[") && part.endsWith("]") ? <mark key={i} className="kw">{part.slice(1, -1)}</mark> : part);
}

/**
 * SplitText reveal. Modes (see docs/motion-plan.md):
 *  - lines: masked line slide-up (hero/page titles)   - words: masked word reveal (section titles)
 *  - fade: line fade + slide (paragraphs)              - scrub: word opacity 20%→100% tied to scroll
 * `hero` plays as soon as fonts are ready instead of waiting for scroll.
 * Text stays readable without JS (hidden by CSS only when scripting is enabled and motion is allowed, until split), SplitText's aria="auto"
 * keeps the real string for screen readers, and autoSplit re-splits on resize / font load (Cyrillic-safe:
 * we split words and lines, never characters).
 */
export default function Split({ as: Tag = "p", mode = "words", hero = false, className, children, id }: {
  as?: ElementType; mode?: Mode; hero?: boolean; className?: string; children: string; id?: string;
}) {
  const ref = useRef<HTMLElement>(null);

  useGSAP((_ctx, contextSafe) => {
    const el = ref.current;
    if (!el || !contextSafe) return;
    const done = () => { el.dataset.splitReady = "1"; el.dataset.in = "1"; };
    const mm = gsap.matchMedia();
    mm.add(MQ.reduce, done);
    mm.add(MQ.motion, () => {
      let split: SplitText | null = null;
      let live = true;
      const start = contextSafe(() => {
        if (!live) return;
        split = SplitText.create(el, {
          // Only modes that animate lines pay for line detection (it measures every word); word modes split words only.
          type: mode === "lines" || mode === "fade" ? "lines" : "words",
          mask: mode === "lines" ? "lines" : mode === "words" ? "words" : undefined,
          autoSplit: true,
          aria: "auto",
          onSplit(self) {
            el.dataset.splitReady = "1";
            const st = hero ? undefined : { trigger: el, start: REVEAL_START, once: true };
            const mark = () => { el.dataset.in = "1"; };
            if (mode === "lines") return gsap.from(self.lines, { yPercent: 110, duration: DUR.slow, ease: EASE.text, stagger: STAGGER.lines, scrollTrigger: st, onComplete: mark });
            if (mode === "words") return gsap.from(self.words, { yPercent: 110, duration: DUR.base, ease: EASE.text, stagger: STAGGER.words, scrollTrigger: st, onComplete: mark });
            if (mode === "fade") return gsap.from(self.lines, { y: 18, opacity: 0, duration: DUR.base, ease: EASE.ui, stagger: 0.06, scrollTrigger: st, onComplete: mark });
            mark();
            return gsap.from(self.words, { opacity: 0.2, ease: "none", stagger: 0.1, scrollTrigger: { trigger: el, start: "top 80%", end: "bottom 45%", scrub: true } });
          },
        });
      });
      // Hero text splits right away; everything else splits just before it nears the viewport, so the page load
      // doesn't pay for measuring every paragraph on the page up front.
      const begin = () => { whenFontsReady().then(start); };
      const gate = hero ? null : ScrollTrigger.create({ trigger: el, start: "top bottom+=400", once: true, onEnter: begin });
      if (hero) begin();
      return () => { live = false; gate?.kill(); split?.revert(); };
    });
    return () => mm.revert();
  }, { scope: ref, dependencies: [children, mode, hero] });

  return <Tag ref={ref} id={id} data-split={mode} className={className}>{rich(children)}</Tag>;
}
