// Chart colours are the `c1…c5` tokens (blue, yellow, green, ember, neutral) from globals.css, which are AA against
// the panel in light and dark. Class names are spelled out so Tailwind sees them. c5 (neutral) is reserved for "Other".
export type Hue = 1 | 2 | 3 | 4 | 5;
export const FILL: Record<Hue, string> = { 1: "fill-c1", 2: "fill-c2", 3: "fill-c3", 4: "fill-c4", 5: "fill-c5" };
export const STROKE: Record<Hue, string> = { 1: "stroke-c1", 2: "stroke-c2", 3: "stroke-c3", 4: "stroke-c4", 5: "stroke-c5" };
export const BG: Record<Hue, string> = { 1: "bg-c1", 2: "bg-c2", 3: "bg-c3", 4: "bg-c4", 5: "bg-c5" };
export const VAR: Record<Hue, string> = { 1: "var(--ops-c1)", 2: "var(--ops-c2)", 3: "var(--ops-c3)", 4: "var(--ops-c4)", 5: "var(--ops-c5)" };

/** Texture for the second encoding channel (colour-blind, print, forced colours): 45° hatch in the series colour. */
export const hatchCss = (h: Hue) => `repeating-linear-gradient(45deg, ${VAR[h]} 0 2px, var(--ops-panel) 2px 5px)`;
