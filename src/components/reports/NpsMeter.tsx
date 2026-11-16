"use client";
import type { ReactNode } from "react";
import type { Locale } from "@/i18n/config";
import ChartFigure, { type Tone } from "@/components/charts/ChartFigure";
import { clamp } from "@/components/charts/scale";
import { npsOrNa } from "@/lib/admin/report-view";

const W = 320, X0 = 16, X1 = 304, MID = (X0 + X1) / 2, Y = 56, H = 14;

/**
 * NPS on its -100 … +100 scale: a track with the zero tick, the bar from zero to the score and a marker, the score as
 * a big number. The number and the table carry the value; position and sign are the second cue next to colour.
 */
export default function NpsMeter({ lang, title, takeaway, nps, tableHead, valueLabel, scale, na, as, actions, tone }: {
  lang: Locale; title: string; takeaway: string; nps: number | null; tableHead: [string, string]; valueLabel: string;
  scale: { low: string; mid: string; high: string }; na: string; as?: "h2" | "h3"; actions?: ReactNode; tone?: Tone;
}) {
  const text = npsOrNa(nps, na);
  const x = nps === null ? MID : MID + (clamp(nps, -100, 100) / 100) * (MID - X0);
  return (
    <ChartFigure lang={lang} title={title} takeaway={takeaway} as={as} actions={actions} tone={tone} empty={nps === null} table={{ head: tableHead, rows: [[valueLabel, text]] }}>
      {(a11y) => (
        <svg {...a11y} viewBox={`0 0 ${W} 100`} width="100%" style={{ display: "block", height: "auto", maxWidth: 480 }}>
          <rect x={X0} y={Y} width={X1 - X0} height={H} rx={7} className="fill-neutral-soft" />
          <rect x={Math.min(MID, x)} y={Y} width={Math.abs(x - MID)} height={H} rx={nps === 0 ? 0 : 7} className={(nps ?? 0) >= 0 ? "fill-c3" : "fill-c4"} />
          <line x1={MID} x2={MID} y1={Y - 4} y2={Y + H + 4} strokeWidth={2} className="stroke-line-strong" />
          <circle cx={x} cy={Y + H / 2} r={9} strokeWidth={3} className="fill-fg stroke-panel" />
          <text x={clamp(x, 40, W - 40)} y={34} textAnchor="middle" fontSize={26} fontWeight={900} className="fill-fg font-display tnum">{text}</text>
          {([[X0, "start", scale.low], [MID, "middle", scale.mid], [X1, "end", scale.high]] as const).map(([px, anchor, label]) => (
            <text key={label} x={px} y={Y + H + 22} textAnchor={anchor} fontSize={12} className="fill-fg-muted tnum">{label}</text>
          ))}
        </svg>
      )}
    </ChartFigure>
  );
}
