import Link from "next/link";
import { AlertTriangle, ImageOff, Inbox, Languages, UserPlus, type LucideIcon } from "lucide-react";
import type { Dict } from "@/i18n";
import { fill, tf, type Locale } from "@/i18n/config";
import { plural } from "@/i18n/plural";
import { formatUb } from "@/lib/time";
import { kpiDelta, type AttentionKind, type Dashboard as Data, type UpcomingEvent } from "@/lib/admin/dashboard";
import { isAdminRouteReady } from "@/lib/admin/nav";
import KpiCard, { type Delta } from "@/components/ui/KpiCard";
import StatusPill from "@/components/ui/StatusPill";
import CapacityBar from "@/components/ui/CapacityBar";
import EmptyState from "@/components/ui/EmptyState";
import Skeleton from "@/components/ui/Skeleton";
import { ButtonLink } from "@/components/ui/Button";
import Sticker from "@/components/Sticker";

type T = Dict["admin"]["dashboard"];
const nf = (lang: Locale) => new Intl.NumberFormat(lang === "mn" ? "mn-MN" : "en-US");

function toDelta(t: T, current: number, previous: number): Delta {
  const d = kpiDelta(current, previous);
  if (d.kind === "new") return { text: t.deltaNew, trend: "up", good: true, srLabel: t.deltaSrNew };
  const sr = d.trend === "up" ? t.deltaSrUp : d.trend === "down" ? t.deltaSrDown : t.deltaSrFlat;
  return { text: d.text, trend: d.trend, good: d.trend !== "down", srLabel: fill(sr, { pct: d.text.replace(/^[+−]/, "") }) };
}

const ATTENTION_ICON: Record<AttentionKind, LucideIcon> = {
  failed_emails: AlertTriangle, pending_applications: Inbox, pending_members: UserPlus, missing_cover: ImageOff, needs_en: Languages,
};

function SectionCard({ id, title, action, className, children }: { id: string; title: string; action?: React.ReactNode; className?: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className={`rounded-[var(--radius-md)] border border-line bg-panel ${className ?? ""}`}>
      <div className="flex min-h-12 items-center justify-between gap-3 border-b border-line px-4">
        <h2 id={id} className="text-base font-bold text-fg">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function EventRow({ e, lang, t, d }: { e: UpcomingEvent; lang: Locale; t: T; d: Dict }) {
  const title = tf(e.title, lang);
  return (
    <li className="flex gap-3 border-t border-line px-4 py-3 first:border-t-0">
      <time dateTime={e.startsAt.toISOString()} className="grid h-14 w-16 shrink-0 content-center rounded-[var(--radius-sm)] bg-panel-2 text-center leading-tight">
        <span className="text-xs font-semibold whitespace-nowrap text-fg-muted">{formatUb(e.startsAt, lang, { month: "short" })}</span>
        <span className="tnum font-display text-xl font-bold text-fg">{formatUb(e.startsAt, lang, { day: "numeric" })}</span>
      </time>
      <div className="grid min-w-0 flex-1 grid-cols-1 gap-1.5">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className="min-w-0 truncate font-semibold text-fg" title={title}>{title}</p>
          <StatusPill status={e.status} label={d.status[e.status]} />
        </div>
        <p className="text-sm text-fg-muted">
          {d.admin.kinds[e.kind]} · {formatUb(e.startsAt, lang, { weekday: "short", hour: "2-digit", minute: "2-digit" })}
        </p>
        {e.regMode === "application" ? (
          <p className="text-sm font-semibold text-accent-fg">{plural(lang, e.applied, t.applied)}</p>
        ) : (
          <CapacityBar
            value={e.going}
            max={e.capacity}
            label={e.capacity === null ? fill(t.noLimit, { n: e.going }) : fill(t.seats, { n: e.going, max: e.capacity })}
            className="max-w-xs"
          />
        )}
      </div>
    </li>
  );
}

/** The dashboard body: KPI row, upcoming events, needs-attention. Server-rendered; no client JS. */
export default function Dashboard({ data, lang, d }: { data: Data; lang: Locale; d: Dict }) {
  const t = d.admin.dashboard;
  const n = nf(lang);
  const { kpis } = data;
  const eventsReady = isAdminRouteReady(lang, "events");
  return (
    <div className="grid grid-cols-1 gap-6">
      <section aria-labelledby="kpis">
        <h2 id="kpis" className="sr-only">{t.kpis}</h2>
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <KpiCard icon="users" tone="blue" label={t.activeMembers} value={n.format(kpis.activeMembers90d)} hint={t.activeMembersHint} />
          <KpiCard icon="calendar" tone="yellow" label={t.upcomingEvents} value={n.format(kpis.upcomingEvents)} hint={t.upcomingEventsHint} />
          <KpiCard icon="ticket" tone="green" label={t.rsvps} value={n.format(kpis.rsvps30d)} delta={toDelta(t, kpis.rsvps30d, kpis.rsvpsPrev30d)} hint={fill(t.rsvpsHint, { n: n.format(kpis.rsvpsPrev30d) })} />
          <KpiCard icon="id" tone="ember" label={t.people} value={n.format(kpis.membersTotal + kpis.guestsTotal)} hint={fill(t.peopleHint, { members: n.format(kpis.membersTotal), guests: n.format(kpis.guestsTotal) })} />
        </div>
      </section>

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <SectionCard id="upcoming" className="order-2 xl:order-1" title={t.upcoming} action={eventsReady ? <Link href={`/${lang}/admin/events`} className="text-sm font-semibold text-accent-fg hover:underline">{t.allEvents}</Link> : undefined}>
          {data.upcoming.length === 0 ? (
            <div className="p-4">
              <EmptyState sticker="rsvp" title={t.emptyUpcomingTitle} line={t.emptyUpcomingLine}
                action={eventsReady ? <ButtonLink href={`/${lang}/admin/events/new`}>{t.createEvent}</ButtonLink> : undefined} />
            </div>
          ) : (
            <ul>{data.upcoming.map((e) => <EventRow key={e.id} e={e} lang={lang} t={t} d={d} />)}</ul>
          )}
        </SectionCard>

        <SectionCard id="attention" className="order-1 xl:order-2" title={t.attention}>
          {data.attention.length === 0 ? (
            <div className="grid justify-items-center gap-2 px-4 py-8 text-center">
              <Sticker name="sleepy" className="w-20" sizes="80px" />
              <p className="font-display font-bold text-fg">{t.allClearTitle}</p>
              <p className="max-w-xs text-sm text-fg-muted">{t.allClearLine}</p>
            </div>
          ) : (
            <ul>
              {data.attention.map((a) => {
                const Icon = ATTENTION_ICON[a.kind];
                const urgent = a.kind === "failed_emails";
                return (
                  <li key={a.kind} className="flex min-h-12 items-center gap-3 border-t border-line px-4 py-2.5 first:border-t-0">
                    <span aria-hidden="true" className={urgent ? "grid size-8 place-items-center rounded-full bg-danger-soft text-danger-fg" : "grid size-8 place-items-center rounded-full bg-neutral-soft text-fg"}>
                      <Icon size={16} />
                    </span>
                    <span className="text-sm text-fg">{plural(lang, a.count, t.attentionItems[a.kind])}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </SectionCard>
      </div>
    </div>
  );
}

/** Same footprint as the loaded dashboard, so nothing jumps when data arrives (CLS ≈ 0). */
export function DashboardSkeleton({ label }: { label: string }) {
  return (
    <div className="grid grid-cols-1 gap-6" role="status" aria-live="polite">
      <span className="sr-only">{label}</span>
      <Skeleton className="h-12" />
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[118px] rounded-[var(--radius-md)]" />)}
      </div>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Skeleton className="h-80 rounded-[var(--radius-md)]" />
        <Skeleton className="h-64 rounded-[var(--radius-md)]" />
      </div>
    </div>
  );
}
