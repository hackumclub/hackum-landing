import { Info } from "lucide-react";
import type { Dict } from "@/i18n";
import { fill, type Locale } from "@/i18n/config";
import { copy } from "@/i18n/areas/analytics";
import AreaChart, { type AreaPoint } from "@/components/charts/AreaChart";
import BarChart from "@/components/charts/BarChart";
import DonutChart from "@/components/charts/DonutChart";
import FunnelChart from "@/components/charts/FunnelChart";
import HeatStrip from "@/components/charts/HeatStrip";
import { pctText, shareOf } from "@/components/charts/scale";
import KpiCard, { type Delta } from "@/components/ui/KpiCard";
import Skeleton from "@/components/ui/Skeleton";
import { byMonth, byWeekday, cohortLabel, countDelta, rateDelta, topEvents } from "@/lib/admin/analytics-view";
import { rangeDays, type DateRange } from "@/lib/date-range";
import type { Analytics } from "@/lib/mockdb/analytics";
import type { Db } from "@/lib/mockdb/types";
import { MAJOR_TRACKS, SCHOOLS } from "@/lib/num/schools";
import { semesterLabel } from "@/lib/semester";
import { formatUb } from "@/lib/time";
import ExportCsv from "./ExportCsv";
import { NumbersTable, TopEventsTable } from "./Tables";

type C = (typeof copy)["en"];
export type View = {
  lang: Locale; d: Dict; c: C; range: DateRange; prev: DateRange; a: Analytics; p: Analytics; db: Db;
  rate: number | null; prevRate: number | null;
};

const nfFor = (lang: Locale) => new Intl.NumberFormat(lang === "mn" ? "mn-MN" : "en-US");
const day = (iso: string) => new Date(`${iso}T04:00:00Z`); // 12:00 in UB: safely inside the calendar day
export const fmtDay = (iso: string, lang: Locale, opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }) => formatUb(day(iso), lang, opts);
const Grid = ({ children, split = false }: { children: React.ReactNode; split?: boolean }) => (
  <div className={split ? "grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]" : "grid grid-cols-1 items-start gap-6 lg:grid-cols-2"}>{children}</div>
);

export function Overview({ v }: { v: View }) {
  const { lang, c, a, p, range, prev } = v;
  const n = nfFor(lang);
  const ds = { ...c.kpi };
  const events = a.bySemester.reduce((s, r) => s + r.events, 0);
  const prevEvents = p.bySemester.reduce((s, r) => s + r.events, 0);
  const rd = rateDelta(v.rate, v.prevRate, ds);
  const deltas: { events: Delta; registered: Delta; going: Delta; attended: Delta; rate?: Delta } = {
    events: countDelta(events, prevEvents, ds), registered: countDelta(a.funnel.registered, p.funnel.registered, ds),
    going: countDelta(a.funnel.going, p.funnel.going, ds), attended: countDelta(a.funnel.attended, p.funnel.attended, ds), rate: rd,
  };

  const points: AreaPoint[] = a.registrationsByDay.map((r) => ({ key: r.day, label: fmtDay(r.day, lang), short: fmtDay(r.day, lang, lang === "mn" ? { month: "numeric", day: "numeric" } : undefined), value: r.n }));
  const total = points.reduce((s, r) => s + r.value, 0);
  const peak = points.reduce((best, r) => (r.value > best.value ? r : best), { label: "—", value: 0 } as AreaPoint);
  const wk = byWeekday(a.registrationsByDay);
  const wkTop = wk.indexOf(Math.max(...wk));

  return (
    <div className="grid gap-6">
      <section aria-labelledby="kpis" className="grid gap-3">
        <h2 id="kpis" className="sr-only">{c.kpi.group}</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5 [&>*:last-child]:max-lg:col-span-2">
          <KpiCard icon="calendar" tone="yellow" label={c.kpi.events} value={n.format(events)} delta={deltas.events} hint={c.kpi.eventsHint} />
          <KpiCard icon="ticket" tone="blue" label={c.kpi.registered} value={n.format(a.funnel.registered)} delta={deltas.registered} hint={c.kpi.registeredHint} />
          <KpiCard icon="users" tone="green" label={c.kpi.going} value={n.format(a.funnel.going)} delta={deltas.going} hint={c.kpi.goingHint} />
          <KpiCard icon="medal" tone="ember" label={c.kpi.attended} value={n.format(a.funnel.attended)} delta={deltas.attended} hint={c.kpi.attendedHint} />
          <KpiCard icon="target" tone="blue" label={c.kpi.showRate} value={v.rate === null ? c.kpi.none : pctText(v.rate)} delta={deltas.rate} hint={c.kpi.showRateHint} />
        </div>
        <p className="text-sm text-fg-muted">{fill(c.page.compare, { n: rangeDays(range), from: fmtDay(prev.from, lang, { month: "short", day: "numeric", year: "numeric" }), to: fmtDay(prev.to, lang, { month: "short", day: "numeric", year: "numeric" }) })}</p>
      </section>

      <Grid split>
        <AreaChart
          lang={lang} tone="blue" title={c.overview.areaTitle} seriesLabel={c.overview.areaSeries} tableHead={[c.overview.areaHead[0], c.overview.areaHead[1]]}
          takeaway={fill(c.overview.areaTakeaway, { n: n.format(total), day: peak.label, peak: n.format(peak.value) })} points={points}
          actions={<ExportCsv series={a.registrationsByDay} range={range} head={c.export.head} file={c.export.file} label={c.export.label} />}
        />
        <FunnelChart
          lang={lang} tone="green" title={c.overview.funnelTitle} tableHead={[c.overview.funnelHead[0], c.overview.funnelHead[1], c.overview.funnelHead[2]]}
          takeaway={fill(c.overview.funnelTakeaway, { registered: n.format(a.funnel.registered), going: n.format(a.funnel.going), attended: n.format(a.funnel.attended) })}
          steps={[{ key: "registered", label: c.overview.funnelSteps.registered, value: a.funnel.registered }, { key: "going", label: c.overview.funnelSteps.going, value: a.funnel.going }, { key: "attended", label: c.overview.funnelSteps.attended, value: a.funnel.attended }]}
        />
      </Grid>
      <HeatStrip
        lang={lang} tone="yellow" title={c.overview.weekdayTitle} tableHead={[c.overview.weekdayHead[0], c.overview.weekdayHead[1]]}
        takeaway={fill(c.overview.weekdayTakeaway, { day: c.overview.weekdaysFull[wkTop], n: n.format(wk[wkTop]) })}
        cells={wk.map((value, i) => ({ key: String(i), label: c.overview.weekdays[i], value }))}
      />
    </div>
  );
}

export function EventsTab({ v }: { v: View }) {
  const { lang, c, a, d, range, db } = v;
  const rated = a.showRateByKind.filter((k) => k.rate !== null);
  const best = rated.reduce<(typeof rated)[number] | null>((m, k) => (m === null || (k.rate ?? 0) > (m.rate ?? 0) ? k : m), null);
  const rows = topEvents(db, range).map((e) => ({
    id: e.id, href: `/${lang}/admin/events/${e.id}`, title: e.title[lang].trim() || e.title.mn, kind: e.kind, kindLabel: d.admin.kinds[e.kind],
    date: fmtDay(e.startsAt.slice(0, 10), lang, { month: "short", day: "numeric", year: "numeric" }), startsAt: e.startsAt, registered: e.registered, attended: e.attended, rate: pctText(e.rate),
  }));
  return (
    <div className="grid gap-6">
      <BarChart
        lang={lang} tone="green" title={c.events.rateTitle} groupHeader={c.events.rateGroup} max={1} unit="percent"
        takeaway={best ? fill(c.events.rateTakeaway, { kind: d.admin.kinds[best.kind], pct: pctText(best.rate) }) : c.events.rateNone}
        series={[{ key: "rate", label: c.events.rateSeries, color: 3 }]}
        groups={a.showRateByKind.map((k) => ({ key: k.kind, label: d.admin.kinds[k.kind], values: [k.rate] }))}
      />
      <section aria-labelledby="top-events" className="grid gap-3">
        <h2 id="top-events" className="text-base font-bold text-fg">{c.events.topTitle}</h2>
        <TopEventsTable rows={rows} lang={lang} caption={c.events.topCaption} cols={c.events.cols} emptyTitle={c.events.emptyTitle} emptyLine={c.events.emptyLine} />
      </section>
    </div>
  );
}

export function MembersTab({ v }: { v: View }) {
  const { lang, c, a } = v;
  const n = nfFor(lang);
  const total = a.membersBySchool.reduce((s, r) => s + r.n, 0);
  const schoolName = (id: string) => (id === "unknown" ? c.members.unknown : SCHOOLS.find((s) => s.id === id)?.name[lang] ?? id);
  const trackName = (id: string) => (id === "unknown" ? c.members.unknown : MAJOR_TRACKS.find((t) => t.id === id)?.name[lang] ?? id);
  const topSchool = a.membersBySchool[0];
  const topTrack = a.membersByTrack.find((t) => t.track !== "unknown") ?? a.membersByTrack[0];
  return (
    <div className="grid gap-6">
      <div className="flex items-start gap-3 rounded-[var(--radius-md)] bg-accent-soft p-4 text-sm text-fg">
        <Info aria-hidden="true" size={18} className="mt-0.5 shrink-0 text-accent-fg" />
        <p><span className="font-semibold">{c.members.note}</span> <span className="text-fg-muted">{c.members.snapshot}</span></p>
      </div>
      <Grid>
        <DonutChart
          lang={lang} tone="blue" title={c.members.schoolTitle} centreLabel={c.members.schoolCentre} otherLabel={c.members.otherSchools} tableHead={[c.members.schoolHead[0], c.members.schoolHead[1], c.members.schoolHead[2]]}
          takeaway={topSchool ? fill(c.members.schoolTakeaway, { n: n.format(topSchool.n), total: n.format(total), school: schoolName(topSchool.school_id) }) : c.members.snapshot}
          data={a.membersBySchool.map((r) => ({ key: r.school_id, label: schoolName(r.school_id), value: r.n }))}
        />
        <BarChart
          lang={lang} tone="yellow" title={c.members.trackTitle} groupHeader={c.members.trackGroup}
          takeaway={topTrack ? fill(c.members.trackTakeaway, { track: trackName(topTrack.track), n: n.format(topTrack.n) }) : c.members.snapshot}
          series={[{ key: "n", label: c.members.trackSeries, color: 1 }]}
          groups={a.membersByTrack.map((r) => ({ key: r.track, label: trackName(r.track), values: [r.n] }))}
        />
      </Grid>
    </div>
  );
}

export function SemestersTab({ v }: { v: View }) {
  const { lang, c, a } = v;
  const n = nfFor(lang);
  const s = c.semesters;
  const label = (r: { year: number; term: "autumn" | "spring" }) => semesterLabel(r, lang);
  const bestSem = a.bySemester.reduce<(typeof a.bySemester)[number] | null>((m, r) => (m === null || r.registrations > m.registrations ? r : m), null);
  const months = byMonth(a.registrationsByDay);
  const multiYear = new Set(months.map((m) => m.month.slice(0, 4))).size > 1;
  const monthCells = months.map((m) => ({ key: m.month, label: formatUb(day(`${m.month}-15`), lang, multiYear ? { month: "short", year: "2-digit" } : { month: "short" }), value: m.n }));
  const monthTop = months.reduce((b, m) => (m.n > b.n ? m : b), { month: "", n: 0 });
  return (
    <div className="grid gap-6">
      <p className="text-sm text-fg-muted">{s.hint}</p>
      <BarChart
        lang={lang} tone="blue" orientation="vertical" title={s.compareTitle} groupHeader={s.group}
        takeaway={bestSem ? fill(s.compareTakeaway, { semester: label(bestSem), n: n.format(bestSem.registrations) }) : s.hint}
        series={[{ key: "registrations", label: s.registrations, color: 1 }, { key: "attended", label: s.attended, color: 3, pattern: true }]}
        groups={a.bySemester.map((r) => ({ key: `${r.year}-${r.term}`, label: label(r), values: [r.registrations, r.attended] }))}
      />
      <NumbersTable
        caption={s.summaryCaption} head={[s.cols.semester, s.cols.events, s.cols.registered, s.cols.attended]} empty={{ title: s.retentionEmptyTitle, line: s.retentionEmptyLine }}
        rows={a.bySemester.map((r) => ({ id: `${r.year}-${r.term}`, cells: [label(r), n.format(r.events), n.format(r.registrations), n.format(r.attended)] }))}
      />
      <HeatStrip
        lang={lang} tone="yellow" title={s.monthTitle} tableHead={[s.monthHead[0], s.monthHead[1]]} columns={monthCells.length <= 8 ? Math.max(1, monthCells.length) : 6}
        takeaway={monthTop.n > 0 ? fill(s.monthTakeaway, { month: formatUb(day(`${monthTop.month}-15`), lang, { month: "long" }), n: n.format(monthTop.n) }) : s.hint}
        cells={monthCells}
      />
      <section aria-labelledby="retention" className="grid gap-3">
        <h2 id="retention" className="text-base font-bold text-fg">{s.retentionTitle}</h2>
        <p className="max-w-3xl text-sm text-fg-muted">{s.retentionDefinition}</p>
        <NumbersTable
          caption={s.retentionCaption} head={[s.retentionCols.cohort, s.retentionCols.returned, s.retentionCols.total, s.retentionCols.rate]} empty={{ title: s.retentionEmptyTitle, line: s.retentionEmptyLine }}
          rows={a.retention.map((r) => ({ id: r.cohort, cells: [cohortLabel(r.cohort, lang), n.format(r.returned), n.format(r.total), pctText(shareOf(r.returned, r.total))] }))}
        />
      </section>
    </div>
  );
}

/** Same footprint as the loaded Overview (controls, KPI row, two charts), so nothing jumps when data arrives. */
export function AnalyticsSkeleton({ label }: { label: string }) {
  return (
    <div className="grid gap-6" role="status" aria-live="polite">
      <span className="sr-only">{label}</span>
      <div className="grid gap-3"><Skeleton className="h-10 w-72 rounded-full" /><Skeleton className="h-12 w-full max-w-xl rounded-full" /></div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-[118px] rounded-[var(--radius-md)]" />)}</div>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <Skeleton className="h-[330px] rounded-[var(--radius-md)]" />
        <Skeleton className="h-[330px] rounded-[var(--radius-md)]" />
      </div>
      <Skeleton className="h-28 rounded-[var(--radius-md)]" />
    </div>
  );
}
