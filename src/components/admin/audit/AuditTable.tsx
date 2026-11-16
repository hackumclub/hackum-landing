"use client";
import { useMemo, useState } from "react";
import { ArrowRight, CalendarDays, CircleDot, ClipboardCheck, Mail, ShieldCheck, Users, type LucideIcon } from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import { ButtonLink } from "@/components/ui/Button";
import Drawer from "@/components/ui/Drawer";
import EmptyState from "@/components/ui/EmptyState";
import { cx } from "@/components/ui/cx";
import type { Locale } from "@/i18n/config";
import { plural } from "@/i18n/plural";
import type { AreaCopy } from "@/i18n/areas/admin-members";
import { dayRelation, groupByDay, relativeTime, type AuditGroup } from "@/lib/members/format";
import { formatUb } from "@/lib/time";
import { CARD } from "@/components/admin/members/card";
import type { AuditRowDto } from "./data";

const GROUP_ICON: Record<AuditGroup, LucideIcon> = { events: CalendarDays, registrations: ClipboardCheck, members: Users, staff: ShieldCheck, email: Mail, other: CircleDot };

/** The sentence starts with the actor's name (every template and the fallback do), so the name can be set in bold. */
function Sentence({ row }: { row: AuditRowDto }) {
  return row.sentence.startsWith(row.actor)
    ? <><strong className="font-bold">{row.actor}</strong>{row.sentence.slice(row.actor.length)}</>
    : <>{row.sentence}</>;
}

/**
 * The audit log as a story of days: sticky day headers, one sentence per change ("Dev organizer approved Anuujin’s
 * membership"), a time on the right, and a drawer with the exact before → after values.
 */
export default function AuditTable({ rows, total, now: nowIso, lang, c, common, closeLabel, clearHref, filtered, homeHref }: {
  rows: AuditRowDto[]; total: number; now: string; lang: Locale; c: AreaCopy["audit"]; common: AreaCopy["common"]; closeLabel: string; clearHref: string; filtered: boolean; homeHref: string;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const now = useMemo(() => new Date(nowIso), [nowIso]);
  const open = rows.find((r) => r.id === openId) ?? null;
  const days = useMemo(() => groupByDay(rows), [rows]);
  const abs = (iso: string) => formatUb(new Date(iso), lang, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  const clock = (iso: string) => formatUb(new Date(iso), lang, { hour: "2-digit", minute: "2-digit" });
  const dayTitle = (key: string, firstAt: string) => {
    const rel = dayRelation(key, now);
    const date = formatUb(new Date(firstAt), lang, { weekday: "long", month: "long", day: "numeric" });
    return rel === "date" ? date : `${c[rel]} · ${date}`;
  };

  return (
    <div className="grid gap-3">
      <p aria-live="polite" className="tnum text-sm font-semibold text-fg-muted">{plural(lang, total, common.results)}</p>
      {rows.length === 0 ? (
        filtered
          ? <EmptyState sticker="search" title={c.emptyTitle} line={c.emptyLine} action={<ButtonLink variant="secondary" href={clearHref}>{c.emptyAction}</ButtonLink>} />
          : <EmptyState sticker="writing" title={c.emptyAllTitle} line={c.emptyAllLine} action={<ButtonLink variant="secondary" href={homeHref}>{c.emptyAllAction}</ButtonLink>} />
      ) : (
        <ol className="grid gap-4" aria-label={c.caption}>
          {days.map((d) => (
            <li key={d.key} className={cx(CARD, "relative")}>
              <h3 className="sticky top-[4.75rem] z-10 flex items-center justify-between gap-3 rounded-t-[var(--radius-md)] border-b border-line bg-panel-2 px-4 py-2.5 text-sm font-bold text-fg">
                <span>{dayTitle(d.key, d.items[0]!.at)}</span>
                <span className="tnum rounded-full bg-neutral-soft px-2 py-0.5 text-xs font-bold text-fg">{d.items.length}</span>
              </h3>
              <ul>
                {d.items.map((r) => {
                  const Icon = GROUP_ICON[r.group];
                  return (
                    <li key={r.id} className="border-t border-line first:border-t-0">
                      <button type="button" onClick={() => setOpenId(r.id)} data-group={r.group}
                        className="grid min-h-14 w-full cursor-pointer grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 text-left transition-colors duration-150 hover:bg-panel-2">
                        <span className="relative">
                          <Avatar name={r.actor} size={40} />
                          <span aria-hidden="true" className="absolute -right-1.5 -bottom-1.5 grid size-[18px] place-items-center rounded-full bg-accent text-on-accent ring-2 ring-panel"><Icon size={10} /></span>
                        </span>
                        <span className="min-w-0 text-sm text-fg [overflow-wrap:anywhere]"><Sentence row={r} /></span>
                        <time dateTime={r.at} title={abs(r.at)} className="tnum text-right text-xs whitespace-nowrap text-fg-muted">{clock(r.at)}</time>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ol>
      )}

      <Drawer open={open !== null} onOpenChange={(o) => { if (!o) setOpenId(null); }} title={c.drawer.title} description={c.drawer.description} closeLabel={closeLabel}>
        {open && (
          <div className="grid gap-5">
            <div className="flex items-start gap-3 rounded-[var(--radius-md)] bg-accent-soft p-4">
              <Avatar name={open.actor} size={44} />
              <div className="grid min-w-0 gap-1">
                <p className="text-base text-fg [overflow-wrap:anywhere]"><Sentence row={open} /></p>
                <p className="text-sm text-fg-muted">{abs(open.at)} · {relativeTime(new Date(open.at), now, lang)}</p>
              </div>
            </div>
            <dl className="grid gap-2 text-sm">
              {([[c.drawer.who, open.actor], [c.drawer.what, open.action], [c.columns.entity, open.entity]] as const).map(([k, v]) => (
                <div key={k} className="grid grid-cols-[6rem_minmax(0,1fr)] gap-2"><dt className="text-fg-muted">{k}</dt><dd className="font-semibold break-words text-fg">{v}</dd></div>
              ))}
            </dl>
            <section className="grid gap-2 border-t border-line pt-4">
              <h3 className="font-display text-sm font-bold text-fg">{c.drawer.changes}</h3>
              {open.diff.length === 0 ? <p className="text-sm text-fg-muted">{c.drawer.noChanges}</p> : (
                <ul className="grid gap-3">
                  {open.diff.map((d) => (
                    <li key={d.key} className="grid gap-2 rounded-[var(--radius-sm)] border border-line bg-panel-2 p-3 text-sm">
                      <span className="font-semibold text-fg">{d.label}</span>
                      {d.changed ? (
                        <span className="grid items-center gap-2 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
                          <span className="rounded-[var(--radius-sm)] bg-danger-soft px-2.5 py-1.5 break-words text-danger-fg line-through decoration-1"><span className="sr-only">{c.drawer.before}:</span>{d.before}</span>
                          <ArrowRight aria-hidden="true" size={16} className="shrink-0 rotate-90 justify-self-center text-fg-muted sm:rotate-0" />
                          <span className="rounded-[var(--radius-sm)] bg-ok-soft px-2.5 py-1.5 font-semibold break-words text-ok-fg"><span className="sr-only">{c.drawer.after}:</span>{d.after}</span>
                        </span>
                      ) : (
                        <span className="rounded-[var(--radius-sm)] bg-panel px-2.5 py-1.5 break-words text-fg"><span className="sr-only">{c.drawer.set}: </span>{d.after}</span>
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
