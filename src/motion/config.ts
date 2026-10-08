// Shared motion vocabulary so every animation feels like the same site.
export const DUR = { fast: 0.35, base: 0.6, slow: 0.9 } as const;
export const EASE = { text: "power4.out", ui: "power3.out", inOut: "power2.inOut", pop: "back.out(1.7)", float: "sine.inOut" } as const;
export const STAGGER = { words: 0.04, lines: 0.08, cards: 0.06 } as const;

/** gsap.matchMedia() conditions. "full" = desktop with a hover pointer; "lite" = touch/mobile; "reduce" = reduced motion. */
export const MQ = {
  full: "(min-width: 768px) and (hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)",
  lite: "((max-width: 767px) or (hover: none)) and (prefers-reduced-motion: no-preference)",
  motion: "(prefers-reduced-motion: no-preference)",
  reduce: "(prefers-reduced-motion: reduce)",
} as const;

/** ScrollTrigger start for "reveal when it enters the viewport". */
export const REVEAL_START = "top 85%";
