import Image from "next/image";
import type { ReactNode } from "react";
import KpiCard from "@/components/ui/KpiCard";
import { cx } from "@/components/ui/cx";
import PrintStyles from "./PrintStyles";
import ReportProvider from "./ReportProvider";
import ReportToolbar from "./ReportToolbar";
import type { Kpi } from "@/lib/admin/report-view";
import type { Locale } from "@/i18n/config";

/**
 * One report page's frame: the export toolbar (screen only), then the document with the brand header (repeated on every
 * printed page) and its sections. `name` is the file-name base of the images, `title` the document (= PDF file) title.
 */
export function ReportDocument({ lang, name, title, kind, heading, meta, generated, children }: {
  lang: Locale; name: string; title: string; kind: string; heading: string; meta: ReactNode; generated: string; children: ReactNode;
}) {
  return (
    <ReportProvider lang={lang} name={name} title={title}>
      <PrintStyles />
      <div data-report-root="" className="grid min-w-0 gap-6">
        <ReportToolbar />
        <div className="report-frame grid min-w-0 gap-6">
          <div className="report-running">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-[var(--radius-md)] border border-line bg-panel p-4 md:p-5">
              <Image src="/img/brand/logo-128.png" alt="" width={44} height={44} className="rounded-full" />
              <div className="grid min-w-0 flex-1 gap-0.5">
                <p className="text-sm font-semibold text-fg-muted">{kind}</p>
                <h2 className="font-display text-xl font-black text-fg [overflow-wrap:anywhere] md:text-2xl">{heading}</h2>
                <p className="text-sm text-fg-muted">{meta}</p>
              </div>
              <p className="text-sm text-fg-muted">{generated}</p>
            </div>
          </div>
          <div className="report-body grid min-w-0 gap-6">{children}</div>
        </div>
      </div>
    </ReportProvider>
  );
}

/** A titled block of the document. Sections after the first start on a new printed page. */
export function ReportSection({ id, title, children, className }: { id: string; title: string; children: ReactNode; className?: string }) {
  return (
    <section aria-labelledby={id} className={cx("report-section grid min-w-0 content-start gap-4", className)}>
      <h2 id={id} className="font-display text-lg font-black text-fg">{title}</h2>
      {children}
    </section>
  );
}

export function ReportKpis({ items }: { items: Kpi[] }) {
  return (
    <ul className="report-kpis grid grid-cols-2 gap-3 sm:grid-cols-4">
      {items.map((k) => (
        <li key={k.key} className="report-card min-w-0 [&>div]:h-full">
          <KpiCard label={k.label} value={k.value} hint={k.hint} />
        </li>
      ))}
    </ul>
  );
}

export type ReportColumn = { key: string; header: string; numeric?: boolean };
/** Plain semantic table for a printed report (no sorting, no paging, rows never split). `cells` are rendered as given. */
export function ReportTable({ caption, columns, rows }: { caption: string; columns: ReportColumn[]; rows: { id: string; cells: Record<string, ReactNode> }[] }) {
  return (
    <div className="report-scroll overflow-x-auto rounded-[var(--radius-md)] border border-line bg-panel">
      <table className="w-full min-w-[32rem] border-collapse text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-line-strong text-left text-fg-muted">
            {columns.map((c) => <th key={c.key} scope="col" className={cx("px-3 py-2.5 font-semibold", c.numeric && "text-right")}>{c.header}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-line last:border-b-0">
              {columns.map((c, i) => {
                const Cell = i === 0 ? "th" : "td";
                return <Cell key={c.key} {...(i === 0 ? { scope: "row" as const } : {})} className={cx("px-3 py-2.5 align-top text-fg", i === 0 ? "text-left font-semibold [overflow-wrap:anywhere]" : "font-normal", c.numeric && "tnum text-right")}>{r.cells[c.key]}</Cell>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
