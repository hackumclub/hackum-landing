"use client";
import { useId, useMemo, type ReactNode } from "react";
import type { Locale } from "@/i18n/config";
import ChartFigure, { type Tone } from "./ChartFigure";
import PatternDefs from "./PatternDefs";
import { pctText } from "./scale";
import { FILL, type Hue } from "./tokens";

export type BarSeries = { key: string; label: string; color: Hue; /** Hatched fill: the second encoding next to colour. */ pattern?: boolean };
export type BarGroup = { key: string; label: string; /** One value per series; null = not applicable (drawn as "—"). */ values: (number | null)[] };

const num = (v: number | null): v is number => v !== null && Number.isFinite(v);
const TRACK = "fill-neutral-soft";

/**
 * Horizontal (default: long labels wrap, never truncate) or vertical grouped bars. Bars sit on a 4px-rounded data end,
 * direct value labels, and a legend whenever there are two or more series. `max` pins the scale (e.g. 1 for rates).
 */
export default function BarChart({ lang, title, takeaway, groups, series, groupHeader, orientation = "horizontal", unit = "number", max, as, actions, tone }: {
  lang: Locale; title: string; takeaway: string; groups: BarGroup[]; series: BarSeries[]; groupHeader: string; orientation?: "horizontal" | "vertical";
  unit?: "number" | "percent"; max?: number; as?: "h2" | "h3"; actions?: ReactNode; tone?: Tone;
}) {
  const uid = useId().replace(/:/g, "");
  const nf = useMemo(() => new Intl.NumberFormat(lang === "mn" ? "mn-MN" : "en-US"), [lang]);
  const fmt = (v: number) => (unit === "percent" ? pctText(v) : nf.format(v));
  const all = groups.flatMap((g) => g.values).filter(num);
  const top = max ?? Math.max(0, ...all);
  const empty = groups.length === 0 || all.every((v) => !(v > 0));
  const share = (v: number | null) => (num(v) && top > 0 ? Math.min(100, Math.max(0, (v / top) * 100)) : 0);
  const fillOf = (s: BarSeries) => (s.pattern ? undefined : FILL[s.color]);
  const styleOf = (s: BarSeries) => (s.pattern ? { fill: `url(#${uid}-${s.color})`, stroke: `var(--ops-c${s.color})`, strokeWidth: 1 } : undefined);
  const hatch = series.filter((s) => s.pattern).map((s) => s.color);

  return (
    <ChartFigure lang={lang} title={title} takeaway={takeaway} as={as} actions={actions} tone={tone} empty={empty}
      legend={series.map((s) => ({ label: s.label, color: s.color, pattern: s.pattern }))}
      table={{ head: [groupHeader, ...series.map((s) => s.label)], rows: groups.map((g) => [g.label, ...series.map((_, i) => (num(g.values[i]) ? fmt(g.values[i]!) : "—"))]) }}>
      {(a11y) => (
        <div {...a11y}>
          {hatch.length > 0 && <PatternDefs id={uid} hues={hatch} />}
          {orientation === "horizontal" ? (
            <ul className="grid gap-3.5">
              {groups.map((g) => (
                <li key={g.key} className="grid gap-1.5 sm:grid-cols-[minmax(7rem,13rem)_minmax(0,1fr)] sm:items-center sm:gap-x-4">
                  <span className="text-sm font-semibold text-fg [overflow-wrap:anywhere]">{g.label}</span>
                  <div className="grid gap-1.5">
                    {series.map((s, i) => {
                      const v = g.values[i] ?? null;
                      const w = share(v);
                      return (
                        <div key={s.key} className="flex items-center gap-2">
                          <svg width="100%" height="14" aria-hidden="true" focusable="false" className="block min-w-0 flex-1" style={{ width: "100%" }}>
                            <rect width="100%" height="14" rx="4" className={TRACK} />
                            {w > 0 && <rect width={`${Math.max(w, 1.5)}%`} height="14" rx="4" className={fillOf(s)} style={styleOf(s)} />}
                          </svg>
                          <span className="tnum w-14 shrink-0 text-right text-sm font-bold text-fg">{num(v) ? fmt(v) : "—"}</span>
                        </div>
                      );
                    })}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${groups.length}, minmax(0, 1fr))` }}>
              {groups.map((g) => {
                const slot = 100 / Math.max(1, series.length);
                const barW = slot * 0.62;
                const H = 168, headroom = 22;
                return (
                  <div key={g.key} className="grid min-w-0 content-end gap-2">
                    <svg width="100%" height={H} aria-hidden="true" focusable="false" className="block" style={{ width: "100%" }}>
                      <line x1="0" x2="100%" y1={H - 0.5} y2={H - 0.5} className="stroke-line-strong" strokeWidth={1} />
                      {series.map((s, i) => {
                        const v = g.values[i] ?? null;
                        const h = (share(v) / 100) * (H - headroom);
                        const cx = slot * i + slot / 2;
                        return (
                          <g key={s.key}>
                            {h > 0 && <rect x={`${cx - barW / 2}%`} width={`${barW}%`} y={H - h} height={h + 4} rx="4" className={fillOf(s)} style={styleOf(s)} />}
                            <text x={`${cx}%`} y={Math.max(13, H - h - 6)} textAnchor="middle" fontSize={12} fontWeight={700} className="fill-fg tnum">{num(v) ? fmt(v) : "—"}</text>
                          </g>
                        );
                      })}
                    </svg>
                    <span className="text-center text-sm font-semibold text-fg [overflow-wrap:anywhere]">{g.label}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </ChartFigure>
  );
}
