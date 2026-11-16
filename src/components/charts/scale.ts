// Pure geometry and arithmetic for the hand-rolled charts. Everything here is total: no input produces NaN or Infinity.

export type NiceScale = { max: number; ticks: number[] };

/** Axis maximum and tick values at round numbers (1, 2, 5 × 10ⁿ). Small or empty data still gets integer ticks 0..n. */
export function niceScale(maxIn: number, n = 4): NiceScale {
  const m = Number.isFinite(maxIn) && maxIn > 0 ? maxIn : 0;
  let step = 1;
  if (m > n) {
    const raw = m / n;
    const pow = 10 ** Math.floor(Math.log10(raw));
    const f = raw / pow;
    step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * pow;
  }
  return { max: step * n, ticks: Array.from({ length: n + 1 }, (_, i) => i * step) };
}

/** part ÷ whole, or null when there is no whole to divide by. */
export const shareOf = (part: number, whole: number): number | null => (whole > 0 && Number.isFinite(part) ? part / whole : null);
export const pctText = (share: number | null): string => (share === null ? "—" : `${Math.round(share * 100)}%`);

export type Slice = { key: string; label: string; value: number };

/** Largest `keep` slices as they are; everything after them becomes one "Other" slice (a 6th hue is never invented). */
export function foldSlices(data: Slice[], keep: number, otherLabel: string): Slice[] {
  const sorted = [...data].sort((a, b) => b.value - a.value);
  if (sorted.length <= keep + 1) return sorted;
  const rest = sorted.slice(keep);
  return [...sorted.slice(0, keep), { key: "other", label: otherLabel, value: rest.reduce((s, r) => s + r.value, 0) }];
}

const f = (n: number) => (Math.abs(n) < 5e-4 ? 0 : n).toFixed(3);
/** SVG arc path along a circle; angles in radians clockwise from 12 o'clock. A full turn is drawn as two half arcs. */
export function arcPath(cx: number, cy: number, r: number, a0: number, a1: number): string {
  const pt = (a: number) => `${f(cx + r * Math.sin(a))} ${f(cy - r * Math.cos(a))}`;
  const sweep = Math.max(0, a1 - a0);
  if (sweep >= Math.PI * 2 - 1e-6) return `M ${pt(a0)} A ${r} ${r} 0 1 1 ${pt(a0 + Math.PI)} A ${r} ${r} 0 1 1 ${pt(a0)}`;
  return `M ${pt(a0)} A ${r} ${r} 0 ${sweep > Math.PI ? 1 : 0} 1 ${pt(a0 + sweep)}`;
}

export type FunnelStep = Slice & { ofPrevious: number | null; ofFirst: number | null };
/** Each step's share of the step before it (null when that one is empty) and of the first step. */
export function funnelSteps(steps: Slice[]): FunnelStep[] {
  return steps.map((s, i) => ({ ...s, ofPrevious: i === 0 ? null : shareOf(s.value, steps[i - 1].value), ofFirst: shareOf(s.value, steps[0]?.value ?? 0) }));
}

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
