"use client";
import { useMemo, useState } from "react";
import { ArrowRight } from "lucide-react";
import { ButtonLink } from "@/components/ui/Button";
import DataTable, { type Column } from "@/components/ui/DataTable";
import Drawer from "@/components/ui/Drawer";
import EmptyState from "@/components/ui/EmptyState";
import type { Locale } from "@/i18n/config";
import { plural } from "@/i18n/plural";
import type { AreaCopy } from "@/i18n/areas/admin-members";
import { relativeTime } from "@/lib/members/format";
import { formatUb } from "@/lib/time";
import { PersonCell } from "@/components/admin/members/shared";
import type { AuditRowDto } from "./data";

export default function AuditTable({ rows, total, now: nowIso, lang, c, common, closeLabel, clearHref, filtered }: {
  rows: AuditRowDto[]; total: number; now: string; lang: Locale; c: AreaCopy["audit"]; common: AreaCopy["common"]; closeLabel: string; clearHref: string; filtered: boolean;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const now = useMemo(() => new Date(nowIso), [nowIso]);
  const open = rows.find((r) => r.id === openId) ?? null;
  const abs = (iso: string) => formatUb(new Date(iso), lang, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

  const columns: Column<AuditRowDto>[] = [
    { key: "actor", header: c.columns.actor, sortValue: (r) => r.actor.toLowerCase(), cell: (r) => <PersonCell name={r.actor} size={28} /> },
    {
      key: "action", header: c.columns.action, sortValue: (r) => r.action,
      cell: (r) => <button type="button" onClick={() => setOpenId(r.id)} aria-label={`${r.action}: ${r.entity}`} className="max-w-[18rem] cursor-pointer text-left font-semibold text-fg underline-offset-2 hover:text-accent-fg hover:underline">{r.action}</button>,
    },
    { key: "entity", header: c.columns.entity, hideBelow: "md", sortValue: (r) => r.entity, cell: (r) => <span className="block max-w-[20rem] truncate text-fg-muted" title={r.entity}>{r.entity}</span> },
    {
      key: "time", header: c.columns.time, hideBelow: "sm", sortValue: (r) => Date.parse(r.at),
      cell: (r) => <time dateTime={r.at} className="grid whitespace-nowrap"><span>{abs(r.at)}</span><span className="text-xs text-fg-muted">{relativeTime(new Date(r.at), now, lang)}</span></time>,
    },
  ];

  return (
    <div className="grid gap-3">
      <p aria-live="polite" className="tnum text-sm font-semibold text-fg-muted">{plural(lang, total, common.results)}</p>
      <DataTable<AuditRowDto> rows={rows} columns={columns} getId={(r) => r.id} caption={c.caption}
        empty={<EmptyState sticker="sleepy" title={c.emptyTitle} line={c.emptyLine} action={filtered ? <ButtonLink variant="secondary" href={clearHref}>{c.emptyAction}</ButtonLink> : undefined} />} />

      <Drawer open={open !== null} onOpenChange={(o) => { if (!o) setOpenId(null); }} title={c.drawer.title} description={c.drawer.description} closeLabel={closeLabel}>
        {open && (
          <div className="grid gap-5">
            <dl className="grid gap-2 text-sm">
              {([[c.drawer.who, open.actor], [c.drawer.what, open.action], [c.columns.entity, open.entity], [c.drawer.when, `${abs(open.at)} · ${relativeTime(new Date(open.at), now, lang)}`]] as const).map(([k, v]) => (
                <div key={k} className="grid grid-cols-[6rem_minmax(0,1fr)] gap-2"><dt className="text-fg-muted">{k}</dt><dd className="font-semibold break-words text-fg">{v}</dd></div>
              ))}
            </dl>
            <section className="grid gap-2 border-t border-line pt-4">
              <h3 className="font-display text-sm font-bold text-fg">{c.drawer.changes}</h3>
              {open.diff.length === 0 ? <p className="text-sm text-fg-muted">{c.drawer.noChanges}</p> : (
                <ul className="grid gap-2">
                  {open.diff.map((d) => (
                    <li key={d.key} className="grid gap-1 rounded-[var(--radius-sm)] border border-line bg-panel-2 p-3 text-sm">
                      <span className="font-semibold text-fg">{d.label}</span>
                      {d.changed ? (
                        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="sr-only">{c.drawer.before}:</span>
                          <span className="rounded bg-danger-soft px-1.5 py-0.5 break-words text-danger-fg line-through decoration-1">{d.before}</span>
                          <ArrowRight aria-hidden="true" size={14} className="shrink-0 text-fg-muted" />
                          <span className="sr-only">{c.drawer.after}:</span>
                          <span className="rounded bg-ok-soft px-1.5 py-0.5 font-semibold break-words text-ok-fg">{d.after}</span>
                        </span>
                      ) : (
                        <span className="break-words text-fg"><span className="sr-only">{c.drawer.set}: </span>{d.after}</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
      </Drawer>
    </div>
  );
}
