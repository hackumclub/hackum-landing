"use client";
import Link from "next/link";
import DataTable, { type Column } from "@/components/ui/DataTable";
import Tag from "@/components/ui/Tag";
import { eventKindIcon } from "@/components/ui/icons";
import EmptyState from "@/components/ui/EmptyState";
import type { EventKind } from "@/lib/mockdb/types";

const nf = (lang: string) => new Intl.NumberFormat(lang === "mn" ? "mn-MN" : "en-US");

export type TopEventRow = { id: string; href: string; title: string; kind: EventKind; kindLabel: string; date: string; startsAt: string; registered: number; attended: number; rate: string };
export function TopEventsTable({ rows, lang, caption, cols, emptyTitle, emptyLine }: {
  rows: TopEventRow[]; lang: string; caption: string; emptyTitle: string; emptyLine: string;
  cols: { event: string; kind: string; date: string; registered: string; attended: string; rate: string };
}) {
  const n = nf(lang);
  const columns: Column<TopEventRow>[] = [
    { key: "event", header: cols.event, cell: (r) => <Link href={r.href} className="font-semibold text-accent-fg [overflow-wrap:anywhere] hover:underline">{r.title}</Link>, sortValue: (r) => r.title },
    { key: "kind", header: cols.kind, hideBelow: "md", cell: (r) => <Tag icon={eventKindIcon(r.kind)}>{r.kindLabel}</Tag> },
    { key: "date", header: cols.date, hideBelow: "sm", cell: (r) => <span className="whitespace-nowrap">{r.date}</span>, sortValue: (r) => r.startsAt },
    { key: "registered", header: cols.registered, numeric: true, cell: (r) => <span className="tnum">{n.format(r.registered)}</span>, sortValue: (r) => r.registered },
    { key: "attended", header: cols.attended, numeric: true, hideBelow: "sm", cell: (r) => <span className="tnum">{n.format(r.attended)}</span>, sortValue: (r) => r.attended },
    { key: "rate", header: cols.rate, numeric: true, hideBelow: "md", cell: (r) => <span className="tnum">{r.rate}</span> },
  ];
  return <DataTable rows={rows} columns={columns} getId={(r) => r.id} caption={caption} empty={<EmptyState sticker="search" title={emptyTitle} line={emptyLine} />} />;
}

export type SimpleRow = { id: string; cells: string[] };
/** Plain numeric table (semester summary, retention): first column is the row name, the rest are right-aligned numbers. */
export function NumbersTable({ rows, head, caption, empty }: { rows: SimpleRow[]; head: string[]; caption: string; empty: { title: string; line: string } }) {
  const columns: Column<SimpleRow>[] = head.map((h, i) => ({
    key: `c${i}`, header: h, numeric: i > 0,
    cell: (r) => (i === 0 ? <span className="font-semibold text-fg [overflow-wrap:anywhere]">{r.cells[0]}</span> : <span className="tnum">{r.cells[i]}</span>),
  }));
  return <DataTable rows={rows} columns={columns} getId={(r) => r.id} caption={caption} empty={<EmptyState sticker="search" title={empty.title} line={empty.line} />} />;
}
