"use client";
import { useRef } from "react";
import { gsap, useGSAP } from "@/motion/gsap";
import { MQ } from "@/motion/config";
import { whenFontsReady } from "@/motion/page";

const HOLD = 1.7; // seconds each word stays
const SWAP = 0.75; // seconds for the roll

/**
 * A word that rolls to the next one in place ("build → learn → compete"). All words share one grid cell, so the
 * slot is as wide as the longest word and nothing shifts. The outgoing word rolls up and fades while the incoming
 * one rolls in from below with a slight 3D tilt, overlapping so there is never an empty beat. Extra bottom
 * padding inside the mask keeps descenders (У, Р, Ү…) from being clipped. Screen readers get the list once;
 * reduced motion shows the first word only.
 */
export default function RotatingWords({ words, className = "" }: { words: string[]; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);

  useGSAP(() => {
    const items = gsap.utils.toArray<HTMLElement>("[data-word]");
    const mm = gsap.matchMedia();
    mm.add(MQ.motion, () => {
      gsap.set(items, { transformPerspective: 600, transformOrigin: "50% 60%" });
      gsap.set(items.slice(1), { yPercent: 100, rotationX: -50, opacity: 0 });
      const tl = gsap.timeline({ repeat: -1, paused: true });
      items.forEach((w, i) => {
        const next = items[(i + 1) % items.length];
        tl.to(w, { yPercent: -100, rotationX: 50, opacity: 0, duration: SWAP, ease: "power3.inOut" }, `+=${HOLD}`)
          .fromTo(next, { yPercent: 100, rotationX: -50, opacity: 0 }, { yPercent: 0, rotationX: 0, opacity: 1, duration: SWAP, ease: "power3.inOut", immediateRender: false }, "<0.1");
      });
      let live = true;
      // Start after the hero lines have had time to reveal.
      whenFontsReady().then(() => { if (live) gsap.delayedCall(1.2, () => live && tl.play()); });
      return () => { live = false; tl.kill(); };
    });
    return () => mm.revert();
  }, { scope: ref, dependencies: [words.join("|")] });

  return (
    <span ref={ref} className={`relative -mb-[0.2em] inline-grid overflow-hidden pb-[0.2em] align-bottom ${className}`}>
      <span className="sr-only">{words.join(", ")}</span>
      {words.map((w, i) => (
        <span key={w} data-word aria-hidden className="col-start-1 row-start-1 whitespace-nowrap" style={i ? { opacity: 0 } : undefined}>{w}</span>
      ))}
    </span>
  );
}
