"use client";
import { useMemo, type ReactNode } from "react";
import type { Locale } from "@/i18n/config";
import ChartFigure, { type Tone } from "./ChartFigure";
import type { Slice } from "./scale";

/**
 * A row of labelled cells (weekday, month) tinted by intensity. The tint is a mix of the blue chart token into the
 * panel, capped so the number inside always keeps AA contrast in light and dark; the number is the real encoding.
 */
export default function HeatStrip({ lang, title, takeaway, cells, tableHead, columns, as, actions, tone }: {
  lang: Locale; title: string; takeaway: string; cells: Slice[]; tableHead: [string, string]; columns?: number; as?: "h2" | "h3"; actions?: ReactNode; tone?: Tone;
}) {
  const nf = useMemo(() => new Intl.NumberFormat(lang === "mn" ? "mn-MN" : "en-US"), [lang]);
  const top = Math.max(0, ...cells.map((c) => (Number.isFinite(c.value) ? c.value : 0)));
  const empty = cells.length === 0 || top <= 0;
  const cols = columns ?? Math.min(cells.length || 1, 7);
  const tint = (v: number) => (v > 0 && top > 0 ? `color-mix(in srgb, var(--ops-c1) ${Math.round(8 + (v / top) * 30)}%, var(--ops-panel))` : "var(--ops-panel-2)");
  return (
    <ChartFigure lang={lang} title={title} takeaway={takeaway} as={as} actions={actions} tone={tone} empty={empty}
      table={{ head: tableHead, rows: cells.map((c) => [c.label, c.value]) }}>
      {(a11y) => (
        <div {...a11y} data-cells className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
          {cells.map((c) => (
            <div key={c.key} className="grid min-w-0 content-center gap-0.5 rounded-[var(--radius-sm)] border border-line px-1 py-2.5 text-center" style={{ background: tint(c.value) }}>
              <span className="text-xs font-semibold text-fg [overflow-wrap:anywhere]">{c.label}</span>
              <span className="tnum font-display text-lg font-black text-fg">{nf.format(c.value)}</span>
            </div>
          ))}
        </div>
      )}
    </ChartFigure>
  );
}
