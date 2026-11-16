import Link from "next/link";
import { AlertTriangle, ChevronRight, ImageOff, Inbox, Languages, UserPlus, type LucideIcon } from "lucide-react";
import type { Dict } from "@/i18n";
import { fill, tf, type Locale } from "@/i18n/config";
import { plural } from "@/i18n/plural";
import { formatUb } from "@/lib/time";
import { kpiDelta, type AttentionKind, type Dashboard as Data, type UpcomingEvent } from "@/lib/admin/dashboard";
import type { AttentionLink } from "@/lib/admin/attention-links";
import type { Analytics } from "@/lib/mockdb/analytics";
import { copy } from "@/i18n/areas/analytics";
import AreaChart from "@/components/charts/AreaChart";
import BarChart from "@/components/charts/BarChart";
import DonutChart from "@/components/charts/DonutChart";
import FunnelChart from "@/components/charts/FunnelChart";
import SegmentedTabs from "@/components/ui/SegmentedTabs";
import { MAJOR_TRACKS, SCHOOLS } from "@/lib/num/schools";
import { isAdminRouteReady, type AdminNavKey } from "@/lib/admin/nav";
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

/** Which admin section fixes each kind of item: a row only becomes a link when that section exists. */
const ATTENTION_SECTION: Record<AttentionKind, AdminNavKey> = {
  failed_emails: "comms", pending_applications: "events", pending_members: "members", missing_cover: "events", needs_en: "events",
};

type CardTone = "blue" | "green" | "ember" | "yellow";
// Tinted by meaning, like the KPI cards: a solid soft header band and a wash that fades into the panel over most of the card.
const CARD: Record<CardTone, { body: string; head: string }> = {
  blue: { body: "bg-[linear-gradient(165deg,var(--ops-accent-soft)_0%,var(--ops-panel)_85%)]", head: "bg-accent-soft" },
  green: { body: "bg-[linear-gradient(165deg,var(--ops-ok-soft)_0%,var(--ops-panel)_85%)]", head: "bg-ok-soft" },
  ember: { body: "bg-[linear-gradient(165deg,var(--ops-ember-soft)_0%,var(--ops-panel)_85%)]", head: "bg-ember-soft" },
  yellow: { body: "bg-[linear-gradient(165deg,var(--ops-warn-soft)_0%,var(--ops-panel)_85%)]", head: "bg-warn-soft" },
};

function SectionCard({ id, title, action, className, tone = "blue", children }: { id: string; title: string; action?: React.ReactNode; className?: string; tone?: CardTone; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className={`overflow-hidden rounded-[var(--radius-md)] shadow-[var(--shadow-card)] ${CARD[tone].body} ${className ?? ""}`}>
      <div className={`flex min-h-12 items-center justify-between gap-3 px-4 ${CARD[tone].head}`}>
        <h2 id={id} className="text-base font-bold text-fg">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function EventRow({ e, lang, t, d, linked }: { e: UpcomingEvent; lang: Locale; t: T; d: Dict; linked: boolean }) {
  const title = tf(e.title, lang);
  const body = (
    <>
      <time dateTime={e.startsAt.toISOString()} className="grid h-14 w-16 shrink-0 content-center rounded-[var(--radius-sm)] bg-panel text-center leading-tight shadow-[var(--shadow-soft)]">
        <span className="text-xs font-semibold whitespace-nowrap text-accent-fg">{formatUb(e.startsAt, lang, { month: "short" })}</span>
        <span className="tnum font-display text-xl font-bold text-fg">{formatUb(e.startsAt, lang, { day: "numeric" })}</span>
      </time>
      <div className="grid min-w-0 flex-1 grid-cols-1 gap-1.5">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className="min-w-0 font-semibold text-fg [overflow-wrap:anywhere]">{title}</p>
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
    </>
  );
  return (
    <li className="border-t border-line/60 first:border-t-0">
      {linked ? (
        <Link href={`/${lang}/admin/events/${e.id}`} className="group flex items-center gap-3 px-4 py-3 transition-colors duration-150 hover:bg-panel-2">
          {body}
          <ChevronRight aria-hidden="true" size={18} className="shrink-0 text-fg-muted transition-transform duration-150 group-hover:translate-x-0.5" />
        </Link>
      ) : (
        <div className="flex gap-3 px-4 py-3">{body}</div>
      )}
    </li>
  );
}

export type SemesterView = { key: "this" | "last"; label: string };

function AttentionRow({ a, lang, t, c }: { a: AttentionLink; lang: Locale; t: T; c: (typeof copy)["en"]["dashboard"] }) {
  const Icon = ATTENTION_ICON[a.kind];
  const urgent = a.kind === "failed_emails";
  const label = plural(lang, a.count, t.attentionItems[a.kind]);
  const sub = a.eventTitle ? fill(c.reviewIn, { event: tf(a.eventTitle, lang) }) : null;
  const chip = (
    <span aria-hidden="true" className={urgent ? "grid size-9 shrink-0 place-items-center rounded-full bg-panel text-danger-fg shadow-[var(--shadow-soft)]" : "grid size-9 shrink-0 place-items-center rounded-full bg-panel text-accent-fg shadow-[var(--shadow-soft)]"}>
      <Icon size={16} />
    </span>
  );
  const text = (
    <span className="min-w-0 flex-1">
      <span className="block text-sm font-semibold text-fg">{label}</span>
      {sub && <span className="block text-xs text-fg-muted [overflow-wrap:anywhere]">{sub}</span>}
    </span>
  );
  return (
    <li className="border-t border-line/70 first:border-t-0">
      {isAdminRouteReady(lang, ATTENTION_SECTION[a.kind]) ? (
        <Link href={a.href} className="group flex min-h-14 items-center gap-3 px-4 py-2.5 transition-colors duration-150 hover:bg-panel-2/70">
          {chip}{text}
          <ChevronRight aria-hidden="true" size={18} className="shrink-0 text-fg-muted transition-transform duration-150 group-hover:translate-x-0.5" />
        </Link>
      ) : (
        <div className="flex min-h-14 items-center gap-3 px-4 py-2.5">{chip}{text}</div>
      )}
      {a.more > 0 && a.moreHref && (
        <div className="px-4 pb-3 pl-[4.25rem]">
          <Link href={a.moreHref} aria-label={`${fill(c.more, { n: a.more })}: ${fill(c.moreLabel, { n: a.more })}`} className="inline-flex min-h-10 items-center rounded-full bg-panel px-3 text-xs font-bold text-accent-fg hover:underline">
            {fill(c.more, { n: a.more })}
          </Link>
        </div>
      )}
    </li>
  );
}

/** Registrations, funnel and who-the-people-are for one semester: the same charts as /admin/analytics. */
function SemesterCharts({ a, lang }: { a: Analytics; lang: Locale }) {
  const c = copy[lang];
  const ov = c.overview;
  const n = nf(lang);
  const fd = (iso: string, o?: Intl.DateTimeFormatOptions) => formatUb(new Date(`${iso}T04:00:00Z`), lang, o ?? { month: "short", day: "numeric" });
  const points = a.registrationsByDay.map((r) => ({ key: r.day, label: fd(r.day), short: fd(r.day, lang === "mn" ? { month: "numeric", day: "numeric" } : undefined), value: r.n }));
  const total = points.reduce((s, r) => s + r.value, 0);
  const peak = points.reduce((b, r) => (r.value > b.value ? r : b), { label: "—", value: 0, key: "", short: "" });
  const schoolName = (id: string) => (id === "unknown" ? c.members.unknown : SCHOOLS.find((s) => s.id === id)?.name[lang] ?? id);
  const trackName = (id: string) => (id === "unknown" ? c.members.unknown : MAJOR_TRACKS.find((x) => x.id === id)?.name[lang] ?? id);
  const people = a.membersBySchool.reduce((s, r) => s + r.n, 0);
  const topSchool = a.membersBySchool[0];
  const topTrack = a.membersByTrack.find((x) => x.track !== "unknown") ?? a.membersByTrack[0];
  return (
    <div className="grid gap-6">
      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <AreaChart
          as="h3" tone="blue" lang={lang} title={c.dashboard.areaTitle} seriesLabel={ov.areaSeries} tableHead={[ov.areaHead[0], ov.areaHead[1]]} points={points}
          takeaway={fill(ov.areaTakeaway, { n: n.format(total), day: peak.label, peak: n.format(peak.value) })}
        />
        <FunnelChart
          as="h3" tone="green" lang={lang} title={c.dashboard.funnelTitle} tableHead={[ov.funnelHead[0], ov.funnelHead[1], ov.funnelHead[2]]}
          takeaway={fill(ov.funnelTakeaway, { registered: n.format(a.funnel.registered), going: n.format(a.funnel.going), attended: n.format(a.funnel.attended) })}
          steps={[{ key: "registered", label: ov.funnelSteps.registered, value: a.funnel.registered }, { key: "going", label: ov.funnelSteps.going, value: a.funnel.going }, { key: "attended", label: ov.funnelSteps.attended, value: a.funnel.attended }]}
        />
      </div>
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
        <DonutChart
          as="h3" tone="yellow" size="sm" lang={lang} title={c.dashboard.schoolTitle} centreLabel={c.members.schoolCentre} otherLabel={c.members.otherSchools} tableHead={[c.members.schoolHead[0], c.members.schoolHead[1], c.members.schoolHead[2]]}
          takeaway={topSchool ? fill(c.members.schoolTakeaway, { n: n.format(topSchool.n), total: n.format(people), school: schoolName(topSchool.school_id) }) : c.members.snapshot}
          data={a.membersBySchool.map((r) => ({ key: r.school_id, label: schoolName(r.school_id), value: r.n }))}
        />
        <BarChart
          as="h3" tone="ember" lang={lang} title={c.dashboard.trackTitle} groupHeader={c.members.trackGroup}
          takeaway={topTrack ? fill(c.members.trackTakeaway, { track: trackName(topTrack.track), n: n.format(topTrack.n) }) : c.members.snapshot}
          series={[{ key: "n", label: c.members.trackSeries, color: 1 }]}
          groups={a.membersByTrack.map((r) => ({ key: r.track, label: trackName(r.track), values: [r.n] }))}
        />
      </div>
    </div>
  );
}

/** The dashboard body: KPI row, needs-attention, upcoming events, then the semester charts. Server-rendered; charts hydrate for tooltips. */
export default function Dashboard({ data, attention, analytics, semester, lang, d }: {
  data: Data; attention: AttentionLink[]; analytics: Analytics; semester: SemesterView; lang: Locale; d: Dict;
}) {
  const t = d.admin.dashboard;
  const c = copy[lang].dashboard;
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
        <SectionCard id="upcoming" tone="blue" className="order-2 xl:order-1" title={t.upcoming} action={eventsReady ? <Link href={`/${lang}/admin/events`} className="text-sm font-semibold text-accent-fg hover:underline">{t.allEvents}</Link> : undefined}>
          {data.upcoming.length === 0 ? (
            <div className="p-4">
              <EmptyState sticker="rsvp" title={t.emptyUpcomingTitle} line={t.emptyUpcomingLine}
                action={eventsReady ? <ButtonLink href={`/${lang}/admin/events/new`}>{t.createEvent}</ButtonLink> : undefined} />
            </div>
          ) : (
            <ul>{data.upcoming.map((e) => <EventRow key={e.id} e={e} lang={lang} t={t} d={d} linked={eventsReady} />)}</ul>
          )}
        </SectionCard>

        <SectionCard id="attention" tone={attention.length === 0 ? "green" : "ember"} className="order-1 xl:order-2" title={t.attention}>
          {attention.length === 0 ? (
            <div className="grid justify-items-center gap-2 px-4 py-8 text-center">
              <Sticker name="sleepy" className="w-20" sizes="80px" />
              <p className="font-display font-bold text-fg">{t.allClearTitle}</p>
              <p className="max-w-xs text-sm text-fg-muted">{t.allClearLine}</p>
            </div>
          ) : (
            <ul>{attention.map((a) => <AttentionRow key={a.kind} a={a} lang={lang} t={t} c={c} />)}</ul>
          )}
        </SectionCard>
      </div>

      <section aria-labelledby="semester" className="grid gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="semester" className="font-display text-xl font-bold text-fg">{c.sectionTitle}</h2>
            <p className="text-sm text-fg-muted">{semester.label}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <SegmentedTabs
              ariaLabel={c.semesterGroup} value={semester.key}
              items={[{ key: "this", label: c.this }, { key: "last", label: c.last }]}
              hrefs={{ this: `/${lang}/admin`, last: `/${lang}/admin?sem=last` }}
            />
            <ButtonLink href={`/${lang}/admin/analytics`} variant="secondary" size="sm">{c.openAnalytics}</ButtonLink>
          </div>
        </div>
        <SemesterCharts a={analytics} lang={lang} />
      </section>
    </div>
  );
}

/** Same footprint as the loaded dashboard, so nothing jumps when data arrives (CLS ≈ 0). */
export function DashboardSkeleton({ label }: { label: string }) {
  return (
    <div className="grid grid-cols-1 gap-6" role="status" aria-live="polite">
      <span className="sr-only">{label}</span>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[118px] rounded-[var(--radius-md)]" />)}
      </div>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Skeleton className="h-80 rounded-[var(--radius-md)]" />
        <Skeleton className="h-64 rounded-[var(--radius-md)]" />
      </div>
      <Skeleton className="h-12" />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <Skeleton className="h-[330px] rounded-[var(--radius-md)]" />
        <Skeleton className="h-[330px] rounded-[var(--radius-md)]" />
      </div>
    </div>
  );
}
