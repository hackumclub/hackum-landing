"use client";
import { useMemo, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import type { Locale } from "@/i18n/config";
import ChartFigure, { type Tone } from "./ChartFigure";
import { chartCopy } from "./copy";
import { clamp, niceScale } from "./scale";
import { useWidth } from "./useWidth";

export type AreaPoint = { key: string; /** Tooltip and table row name, e.g. "Nov 3". */ label: string; /** Axis tick text. */ short: string; value: number };

const PAD = { l: 40, r: 16, t: 22, b: 28 };

/**
 * Time series as a straight-segment polyline over a light area (no smoothing: it would invent values between days).
 * Y ticks at round numbers, the last value labelled directly, and a crosshair tooltip on hover or arrow keys. The
 * focus stop is one element over the plot (Left/Right/Home/End), not a tab stop per day.
 */
export default function AreaChart({ lang, title, takeaway, points, seriesLabel, tableHead, as, actions, tone, height = 220 }: {
  lang: Locale; title: string; takeaway: string; points: AreaPoint[]; seriesLabel: string; tableHead: [string, string];
  as?: "h2" | "h3"; actions?: ReactNode; tone?: Tone; height?: number;
}) {
  const c = chartCopy[lang];
  const nf = useMemo(() => new Intl.NumberFormat(lang === "mn" ? "mn-MN" : "en-US"), [lang]);
  const [ref, measured] = useWidth<HTMLDivElement>(640);
  const [active, setActive] = useState<number | null>(null);
  const n = points.length;
  const empty = n === 0 || points.every((p) => !(p.value > 0));

  const W = Math.max(280, measured);
  const plotW = W - PAD.l - PAD.r, plotH = height - PAD.t - PAD.b;
  const { max, ticks } = niceScale(Math.max(0, ...points.map((p) => (Number.isFinite(p.value) ? p.value : 0))));
  const x = (i: number) => (n <= 1 ? PAD.l + plotW / 2 : PAD.l + (i / (n - 1)) * plotW);
  const y = (v: number) => PAD.t + plotH * (1 - clamp(Number.isFinite(v) ? v : 0, 0, max) / max);
  const line = points.map((p, i) => `${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
  const area = n > 1 ? `${line} ${x(n - 1).toFixed(1)},${y(0).toFixed(1)} ${x(0).toFixed(1)},${y(0).toFixed(1)}` : "";
  const tickCount = Math.min(n, Math.max(2, Math.floor(plotW / 84)));
  const xTicks = n <= 1 ? [0] : [...new Set(Array.from({ length: tickCount }, (_, k) => Math.round((k * (n - 1)) / (tickCount - 1))))];
  const last = points[n - 1];

  const at = (e: PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const f = r.width > 0 ? (e.clientX - r.left) / r.width : 0;
    setActive(n <= 1 ? 0 : clamp(Math.round(f * (n - 1)), 0, n - 1));
  };
  const onKey = (e: KeyboardEvent) => {
    const cur = active ?? n - 1;
    const next = e.key === "ArrowRight" ? cur + 1 : e.key === "ArrowLeft" ? cur - 1 : e.key === "Home" ? 0 : e.key === "End" ? n - 1 : null;
    if (next === null) return;
    e.preventDefault();
    setActive(clamp(next, 0, n - 1));
  };
  const act = active !== null ? points[active] : null;

  return (
    <ChartFigure lang={lang} title={title} takeaway={takeaway} as={as} actions={actions} tone={tone} empty={empty}
      table={{ head: tableHead, rows: points.map((p) => [p.label, p.value]) }}>
      {(a11y) => (
        <div ref={ref} className="relative">
          <svg {...a11y} viewBox={`0 0 ${W} ${height}`} width="100%" style={{ display: "block", height: "auto", overflow: "visible" }}>
            {ticks.map((t) => (
              <g key={t}>
                <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} className={t === 0 ? "stroke-line-strong" : "stroke-line"} strokeWidth={1} />
                <text x={PAD.l - 8} y={y(t) + 4} textAnchor="end" fontSize={12} className="fill-fg-muted tnum">{nf.format(t)}</text>
              </g>
            ))}
            {xTicks.map((i, k) => (
              <text key={i} x={x(i)} y={height - 8} fontSize={12} className="fill-fg-muted tnum" textAnchor={n === 1 ? "middle" : k === 0 ? "start" : k === xTicks.length - 1 ? "end" : "middle"}>{points[i].short}</text>
            ))}
            {area && <polygon points={area} className="fill-c1/15" />}
            {n > 1 && <polyline points={line} fill="none" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" className="stroke-c1" />}
            {last && (
              <>
                <circle cx={x(n - 1)} cy={y(last.value)} r={4} strokeWidth={2} className="fill-c1 stroke-panel" />
                <text data-last-label x={x(n - 1)} y={y(last.value) - 10} textAnchor={n === 1 ? "middle" : "end"} fontSize={12} fontWeight={700} strokeWidth={3} paintOrder="stroke" className="fill-fg stroke-panel tnum">{nf.format(last.value)}</text>
              </>
            )}
            {act && active !== null && (
              <>
                <line x1={x(active)} x2={x(active)} y1={PAD.t} y2={PAD.t + plotH} strokeWidth={1} strokeDasharray="3 3" className="stroke-line-strong" />
                <circle cx={x(active)} cy={y(act.value)} r={5} strokeWidth={2} className="fill-c1 stroke-panel" />
              </>
            )}
          </svg>
          <div
            role="group" tabIndex={0} aria-label={c.inspect}
            onPointerMove={at} onPointerDown={at} onPointerLeave={(e) => { if (document.activeElement !== e.currentTarget) setActive(null); }}
            onFocus={() => setActive((a) => a ?? n - 1)} onBlur={() => setActive(null)} onKeyDown={onKey}
            className="absolute cursor-crosshair rounded-[var(--radius-sm)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ops-accent)]"
            style={{ left: `${(PAD.l / W) * 100}%`, right: `${(PAD.r / W) * 100}%`, top: `${(PAD.t / height) * 100}%`, bottom: `${(PAD.b / height) * 100}%`, touchAction: "pan-y" }}
          />
          {act && active !== null && (
            <div
              role="tooltip" aria-live="polite"
              className="pointer-events-none absolute z-10 rounded-[var(--radius-sm)] border border-line bg-panel px-3 py-1.5 text-sm text-fg shadow-[var(--shadow-soft)]"
              style={{ left: clamp(x(active), 70, W - 70), top: Math.max(0, y(act.value) - 14), transform: "translate(-50%, -100%)" }}
            >
              <span className="font-semibold">{act.label}</span>
              <span className="text-fg-muted">: </span>
              <span className="tnum font-bold">{nf.format(act.value)}</span>
              <span className="text-fg-muted"> {seriesLabel.toLowerCase()}</span>
            </div>
          )}
        </div>
      )}
    </ChartFigure>
  );
}
