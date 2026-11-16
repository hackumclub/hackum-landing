"use client";
import { useId, useMemo, useState, type ReactNode } from "react";
import type { Locale } from "@/i18n/config";
import { cx } from "@/components/ui/cx";
import ChartFigure, { type Tone } from "./ChartFigure";
import PatternDefs from "./PatternDefs";
import { arcPath, foldSlices, pctText, shareOf, type Slice } from "./scale";
import { BG, hatchCss, STROKE, type Hue } from "./tokens";

const R = 58, STROKE_W = 22, GAP = 0.04;
const HUES: Hue[] = [1, 2, 3, 4, 5];

/**
 * Share of a whole as a ring: at most 5 marks (the 4 largest + "Other" in the neutral hue, hatched), the total in the
 * centre, and a legend that carries every name, count and percentage (so no slice is identified by colour alone).
 */
export default function DonutChart({ lang, title, takeaway, data, centreLabel, otherLabel, tableHead, size = "md", as, actions, tone }: {
  lang: Locale; title: string; takeaway: string; data: Slice[]; centreLabel: string; otherLabel: string; tableHead: [string, string, string];
  size?: "sm" | "md"; as?: "h2" | "h3"; actions?: ReactNode; tone?: Tone;
}) {
  const uid = useId().replace(/:/g, "");
  const nf = useMemo(() => new Intl.NumberFormat(lang === "mn" ? "mn-MN" : "en-US"), [lang]);
  const [hover, setHover] = useState<number | null>(null);
  const slices = foldSlices(data.filter((d) => Number.isFinite(d.value) && d.value > 0), 4, otherLabel);
  const total = slices.reduce((s, d) => s + d.value, 0);
  const empty = total <= 0;
  const hue = (i: number, s: Slice): Hue => (s.key === "other" && slices.length === 5 && i === 4 ? 5 : HUES[i]);

  const arcs = slices.map((s, i) => {
    const start = slices.slice(0, i).reduce((sum, x) => sum + (x.value / total) * Math.PI * 2, 0);
    const sweepAll = (s.value / total) * Math.PI * 2;
    const gap = slices.length > 1 ? Math.min(GAP, sweepAll / 3) : 0;
    return arcPath(80, 80, R, start + gap / 2, start + sweepAll - gap / 2);
  });

  return (
    <ChartFigure lang={lang} title={title} takeaway={takeaway} as={as} actions={actions} tone={tone} empty={empty}
      table={{ head: tableHead, rows: slices.map((s) => [s.label, s.value, pctText(shareOf(s.value, total))]) }}>
      {(a11y) => (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
          <PatternDefs id={uid} hues={[5]} />
          <svg {...a11y} viewBox="0 0 160 160" className={cx("shrink-0", size === "sm" ? "size-32" : "size-40")} style={{ overflow: "visible" }}>
            <circle cx="80" cy="80" r={R} fill="none" strokeWidth={STROKE_W} className="stroke-neutral-soft" />
            {slices.map((s, i) => {
              const h = hue(i, s);
              return (
                <path
                  key={s.key} d={arcs[i]} fill="none" strokeWidth={hover === i ? STROKE_W + 4 : STROKE_W} strokeLinecap="butt"
                  className={cx(h !== 5 || s.key !== "other" ? STROKE[h] : undefined, "transition-[stroke-width,opacity] duration-150", hover !== null && hover !== i && "opacity-50")}
                  style={s.key === "other" && h === 5 ? { stroke: `url(#${uid}-5)` } : undefined}
                  onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)}
                >
                  <title>{`${s.label}: ${nf.format(s.value)} (${pctText(shareOf(s.value, total))})`}</title>
                </path>
              );
            })}
            <text data-total x="80" y="82" textAnchor="middle" fontSize={26} className="fill-fg font-display font-black tnum">{nf.format(total)}</text>
            <text x="80" y="100" textAnchor="middle" fontSize={11} className="fill-fg-muted">{centreLabel}</text>
          </svg>
          <ul className="grid min-w-[12rem] flex-1 gap-1.5">
            {slices.map((s, i) => {
              const h = hue(i, s);
              const hatched = s.key === "other" && h === 5;
              return (
                <li key={s.key} onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)} className="flex items-baseline gap-2 text-sm">
                  <span aria-hidden="true" className={cx("size-3 shrink-0 translate-y-0.5 rounded-[3px]", !hatched && BG[h])} style={hatched ? { backgroundImage: hatchCss(5), outline: "1px solid var(--ops-c5)" } : undefined} />
                  <span className="min-w-0 flex-1 text-fg [overflow-wrap:anywhere]">{s.label}</span>
                  <span className="tnum font-bold text-fg">{nf.format(s.value)}</span>
                  <span className="tnum w-10 text-right text-fg-muted">{pctText(shareOf(s.value, total))}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </ChartFigure>
  );
}
