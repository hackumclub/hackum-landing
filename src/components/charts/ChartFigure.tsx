"use client";
import { useId, type ReactNode } from "react";
import Sticker from "@/components/Sticker";
import type { Locale } from "@/i18n/config";
import { cx } from "@/components/ui/cx";
import { chartCopy } from "./copy";
import { BG, hatchCss, type Hue } from "./tokens";

export type ChartTable = { head: string[]; rows: (string | number)[][] };
export type LegendItem = { label: string; color: Hue; pattern?: boolean };
export type A11y = { role: "img"; "aria-labelledby": string };
export type Tone = "none" | "blue" | "yellow" | "green" | "ember";

// Same corner washes as KpiCard: the figure keeps a calm panel behind the marks, the tone only tints the corner.
const WASH: Record<Tone, string> = {
  none: "bg-panel",
  blue: "bg-[radial-gradient(120%_90%_at_100%_0%,var(--ops-accent-soft),var(--ops-panel)_58%)]",
  yellow: "bg-[radial-gradient(120%_90%_at_100%_0%,var(--ops-warn-soft),var(--ops-panel)_58%)]",
  green: "bg-[radial-gradient(120%_90%_at_100%_0%,var(--ops-ok-soft),var(--ops-panel)_58%)]",
  ember: "bg-[radial-gradient(120%_90%_at_100%_0%,var(--ops-ember-soft),var(--ops-panel)_58%)]",
};

/**
 * Wrapper every chart sits in: title, one-sentence takeaway, the drawing (`role="img"` named by both), a legend that
 * is always text (never colour alone), and a visually-hidden table with the exact numbers. When `empty`, the drawing
 * is replaced by a "no data for this range" state with the mascot; the table stays for assistive tech.
 */
export default function ChartFigure({ lang, title, takeaway, table, empty, legend, as: Heading = "h2", actions, tone = "none", className, children }: {
  lang: Locale; title: string; takeaway: string; table: ChartTable; empty: boolean; legend?: LegendItem[]; as?: "h2" | "h3";
  actions?: ReactNode; tone?: Tone; className?: string; children: (a11y: A11y) => ReactNode;
}) {
  const uid = useId().replace(/:/g, "");
  const titleId = `${uid}-t`, descId = `${uid}-d`;
  const c = chartCopy[lang];
  return (
    <figure aria-labelledby={titleId} className={cx("relative m-0 grid min-w-0 content-start gap-3 rounded-[var(--radius-md)] p-4 shadow-[var(--shadow-card)] md:p-5", WASH[tone], className)}>
      <figcaption className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <Heading id={titleId} className="text-base font-bold text-fg">{title}</Heading>
          <p id={descId} className="mt-0.5 text-sm text-fg-muted">{takeaway}</p>
        </div>
        {actions}
      </figcaption>
      {!empty && legend && legend.length >= 2 && (
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-fg">
          {legend.map((l) => (
            <li key={l.label} className="inline-flex items-center gap-2">
              <span aria-hidden="true" className={cx("size-3 shrink-0 rounded-[3px]", !l.pattern && BG[l.color])} style={l.pattern ? { backgroundImage: hatchCss(l.color), outline: "1px solid", outlineColor: `var(--ops-c${l.color})` } : undefined} />
              {l.label}
            </li>
          ))}
        </ul>
      )}
      {empty ? (
        <div className="grid justify-items-center gap-1 py-6 text-center">
          <Sticker name="search" className="w-20" sizes="80px" />
          <p className="mt-2 font-display text-base font-bold text-fg">{c.noDataTitle}</p>
          <p className="max-w-xs text-sm text-fg-muted">{c.noDataLine}</p>
        </div>
      ) : (
        children({ role: "img", "aria-labelledby": `${titleId} ${descId}` })
      )}
      <div className="sr-only"><table>
        <caption>{title}</caption>
        <thead><tr>{table.head.map((h, i) => <th key={i} scope="col">{h}</th>)}</tr></thead>
        <tbody>
          {table.rows.map((r, i) => (
            <tr key={i}>
              <th scope="row">{r[0]}</th>
              {r.slice(1).map((cell, j) => <td key={j}>{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table></div>
    </figure>
  );
}
