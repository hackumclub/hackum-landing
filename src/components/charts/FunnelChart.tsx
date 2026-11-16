"use client";
import { useMemo, type ReactNode } from "react";
import { fill, type Locale } from "@/i18n/config";
import ChartFigure, { type Tone } from "./ChartFigure";
import { chartCopy } from "./copy";
import { funnelSteps, pctText, type Slice } from "./scale";

/** Ordered steps (registered → going → attended): bar length is the share of the first step, text says % of the previous one. */
export default function FunnelChart({ lang, title, takeaway, steps, tableHead, as, actions, tone }: {
  lang: Locale; title: string; takeaway: string; steps: Slice[]; tableHead: [string, string, string]; as?: "h2" | "h3"; actions?: ReactNode; tone?: Tone;
}) {
  const nf = useMemo(() => new Intl.NumberFormat(lang === "mn" ? "mn-MN" : "en-US"), [lang]);
  const rows = funnelSteps(steps);
  const empty = rows.length === 0 || !(rows[0].value > 0);
  return (
    <ChartFigure lang={lang} title={title} takeaway={takeaway} as={as} actions={actions} tone={tone} empty={empty}
      table={{ head: tableHead, rows: rows.map((r) => [r.label, r.value, pctText(r.ofPrevious)]) }}>
      {(a11y) => (
        <div {...a11y}><ol className="grid gap-4">
          {rows.map((r) => (
            <li key={r.key} className="grid gap-1.5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                <span className="text-sm font-semibold text-fg [overflow-wrap:anywhere]">{r.label}</span>
                <span className="text-sm">
                  <span className="tnum font-display text-lg font-black text-fg">{nf.format(r.value)}</span>
                  {r.ofPrevious !== null && <span className="tnum ml-2 text-fg-muted">{fill(chartCopy[lang].ofPrevious, { pct: pctText(r.ofPrevious) })}</span>}
                </span>
              </div>
              <svg width="100%" height="16" aria-hidden="true" focusable="false" className="block" style={{ width: "100%" }}>
                <rect width="100%" height="16" rx="4" className="fill-neutral-soft" />
                {r.ofFirst !== null && r.ofFirst > 0 && <rect width={`${Math.max(1.5, r.ofFirst * 100)}%`} height="16" rx="4" className="fill-c1" />}
              </svg>
            </li>
          ))}
        </ol></div>
      )}
    </ChartFigure>
  );
}
