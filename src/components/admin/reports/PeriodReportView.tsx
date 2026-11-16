import Link from "next/link";
import { fill, href, tf, type Locale } from "@/i18n/config";
import { copy } from "@/i18n/areas/admin-reports";
import AreaChart from "@/components/charts/AreaChart";
import BarChart from "@/components/charts/BarChart";
import EmptyState from "@/components/ui/EmptyState";
import DownloadChartImage from "@/components/reports/DownloadChartImage";
import { ReportDocument, ReportKpis, ReportSection, ReportTable } from "@/components/reports/ReportParts";
import { cohortLabel } from "@/lib/admin/analytics-view";
import { docTitle, npsOrNa, pctOrNa, periodKpis, ratingOrNa, ratioOf } from "@/lib/admin/report-view";
import type { PeriodReport } from "@/lib/mockdb/reports";
import type { Db } from "@/lib/mockdb/types";
import { semesterLabel } from "@/lib/semester";
import { formatUbStable } from "@/lib/time";

const dayAt = (day: string) => new Date(`${day}T04:00:00Z`);
const Empty = ({ e }: { e: { title: string; line: string } }) => <EmptyState sticker="search" title={e.title} line={e.line} />;

/** The printable semester / year report. Same page on screen and on paper; every chart has its own image download. */
export default function PeriodReportView({ report, db, now, lang }: { report: PeriodReport; db: Db; now: Date; lang: Locale }) {
  const c = copy[lang];
  const p = c.period;
  const nf = new Intl.NumberFormat(lang === "mn" ? "mn-MN" : "en-US");
  const { range, analytics: a } = report;
  const dl = (chart: string, chartTitle: string) => <DownloadChartImage chart={chart} chartTitle={chartTitle} />;
  const rangeText = fill(c.doc.range, { from: formatUbStable(dayAt(range.from), lang, "date"), to: formatUbStable(dayAt(range.to), lang, "date") });

  const points = a.registrationsByDay.map((r) => ({ key: r.day, label: formatUbStable(dayAt(r.day), lang, "short"), short: formatUbStable(dayAt(r.day), lang, "short"), value: r.n }));
  const total = points.reduce((s, r) => s + r.value, 0);
  const peak = points.reduce((best, r) => (r.value > best.value ? r : best), { label: c.na, value: 0 });
  const semesters = a.bySemester.map((s) => ({ ...s, label: semesterLabel({ year: s.year, term: s.term }, lang) }));
  const topSem = semesters.reduce<(typeof semesters)[number] | null>((m, s) => (m === null || s.attended > m.attended ? s : m), null);

  return (
    <ReportDocument
      lang={lang} name={`${range.from}_${range.to}`} title={docTitle(c.doc.title, `${range.from} – ${range.to}`)} kind={c.doc.periodReport} heading={rangeText}
      meta={p.events.title} generated={fill(c.doc.generated, { when: formatUbStable(now, lang, "datetime") })}
    >
      <ReportSection id="p-summary" title={p.sections.summary}>
        <ReportKpis items={periodKpis(report, db, c)} />
        <AreaChart
          lang={lang} as="h3" tone="blue" title={p.days.title} seriesLabel={p.days.series} tableHead={p.days.head} points={points} actions={dl("registrations", p.days.title)}
          takeaway={fill(p.days.takeaway, { n: nf.format(total), day: peak.label, peak: nf.format(peak.value) })}
        />
      </ReportSection>

      <ReportSection id="p-events" title={p.sections.events}>
        {report.events.length === 0 ? <Empty e={p.events.empty} /> : (
          <ReportTable
            caption={p.events.caption}
            columns={[
              { key: "event", header: p.events.cols.event }, { key: "date", header: p.events.cols.date },
              { key: "attended", header: p.events.cols.attended, numeric: true }, { key: "registered", header: p.events.cols.registered, numeric: true },
              { key: "rating", header: p.events.cols.rating, numeric: true }, { key: "nps", header: p.events.cols.nps, numeric: true }, { key: "responses", header: p.events.cols.responses, numeric: true },
            ]}
            rows={report.events.map((e) => ({
              id: e.id,
              cells: {
                event: <Link href={href(lang, `/admin/events/${e.id}/report`)} aria-label={fill(p.events.open, { title: tf(e.title, lang) })} className="text-accent-fg hover:underline">{tf(e.title, lang)}</Link>,
                date: <span className="whitespace-nowrap">{formatUbStable(new Date(e.starts_at), lang, "date")}</span>,
                attended: nf.format(e.attended), registered: nf.format(e.registered), rating: ratingOrNa(e.rating, c.na), nps: npsOrNa(e.nps, c.na), responses: nf.format(e.responses),
              },
            }))}
          />
        )}
      </ReportSection>

      <ReportSection id="p-compare" title={p.sections.compare}>
        {semesters.length === 0 ? <Empty e={p.compare.empty} /> : (
          <>
            <BarChart
              lang={lang} as="h3" tone="blue" title={p.compare.chartTitle} groupHeader={p.compare.group} orientation="vertical" actions={dl("semesters", p.compare.chartTitle)}
              takeaway={topSem ? fill(p.compare.takeaway, { semester: topSem.label, n: nf.format(topSem.attended) }) : p.compare.chartTitle}
              series={[{ key: "registrations", label: p.compare.seriesRegistrations, color: 1 }, { key: "attended", label: p.compare.seriesAttended, color: 3, pattern: true }]}
              groups={semesters.map((s) => ({ key: `${s.year}-${s.term}`, label: s.label, values: [s.registrations, s.attended] }))}
            />
            <ReportTable
              caption={p.compare.caption}
              columns={[{ key: "semester", header: p.compare.cols.semester }, { key: "events", header: p.compare.cols.events, numeric: true }, { key: "registrations", header: p.compare.cols.registrations, numeric: true }, { key: "attended", header: p.compare.cols.attended, numeric: true }]}
              rows={semesters.map((s) => ({ id: `${s.year}-${s.term}`, cells: { semester: s.label, events: nf.format(s.events), registrations: nf.format(s.registrations), attended: nf.format(s.attended) } }))}
            />
          </>
        )}
      </ReportSection>

      <ReportSection id="p-people" title={p.sections.people}>
        <h3 className="text-base font-bold text-fg">{p.retention.title}</h3>
        {a.retention.length === 0 ? <Empty e={p.retention.empty} /> : (
          <ReportTable
            caption={p.retention.caption}
            columns={[{ key: "cohort", header: p.retention.cols.cohort }, { key: "total", header: p.retention.cols.total, numeric: true }, { key: "returned", header: p.retention.cols.returned, numeric: true }, { key: "rate", header: p.retention.cols.rate, numeric: true }]}
            rows={a.retention.map((r) => ({ id: r.cohort, cells: { cohort: cohortLabel(r.cohort, lang), total: nf.format(r.total), returned: nf.format(r.returned), rate: pctOrNa(ratioOf(r.returned, r.total), c.na) } }))}
          />
        )}
        <h3 className="text-base font-bold text-fg">{p.polls.title}</h3>
        {report.polls.length === 0 ? <Empty e={p.polls.empty} /> : (
          <ReportTable
            caption={p.polls.caption}
            columns={[{ key: "poll", header: p.polls.cols.poll }, { key: "voted", header: p.polls.cols.voted, numeric: true }, { key: "eligible", header: p.polls.cols.eligible, numeric: true }, { key: "turnout", header: p.polls.cols.turnout, numeric: true }]}
            rows={report.polls.map((x) => ({ id: x.id, cells: { poll: tf(x.title, lang), voted: nf.format(x.voters), eligible: nf.format(x.eligible), turnout: pctOrNa(x.turnout, c.na) } }))}
          />
        )}
      </ReportSection>
    </ReportDocument>
  );
}
