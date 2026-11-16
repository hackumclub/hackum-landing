import { fill, tf, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n";
import { copy } from "@/i18n/areas/admin-reports";
import { plural } from "@/i18n/plural";
import AreaChart from "@/components/charts/AreaChart";
import BarChart from "@/components/charts/BarChart";
import DonutChart from "@/components/charts/DonutChart";
import FunnelChart from "@/components/charts/FunnelChart";
import EmptyState from "@/components/ui/EmptyState";
import DownloadChartImage from "@/components/reports/DownloadChartImage";
import NpsMeter from "@/components/reports/NpsMeter";
import { ReportDocument, ReportKpis, ReportSection } from "@/components/reports/ReportParts";
import { docTitle, eventKpis, npsOrNa, ratingBars } from "@/lib/admin/report-view";
import type { EventReport } from "@/lib/mockdb/reports";
import type { EventRow } from "@/lib/mockdb/types";
import { MAJOR_TRACKS, SCHOOLS } from "@/lib/num/schools";
import { formatUbStable } from "@/lib/time";

const MAX_COMMENTS = 24;
const Grid = ({ children }: { children: React.ReactNode }) => <div className="report-grid grid grid-cols-1 items-start gap-6 lg:grid-cols-2">{children}</div>;
const dayAt = (day: string) => new Date(`${day}T04:00:00Z`); // noon in Ulaanbaatar: inside the calendar day

/** The printable event report: every section reads the same `EventReport` the rule builds, so the page and the PDF cannot disagree. */
export default function EventReportView({ report, event, now, lang }: { report: EventReport; event: EventRow; now: Date; lang: Locale }) {
  const c = copy[lang];
  const e = c.event;
  const d = getDictionary(lang);
  const nf = new Intl.NumberFormat(lang === "mn" ? "mn-MN" : "en-US");
  const title = tf(event.title, lang);
  const f = report.feedback;
  const dl = (chart: string, chartTitle: string) => <DownloadChartImage chart={chart} chartTitle={chartTitle} />;

  const schoolName = (id: string) => (id === "unknown" ? e.unknown : SCHOOLS.find((s) => s.id === id)?.name[lang] ?? id);
  const trackName = (id: string) => (id === "unknown" ? e.unknown : MAJOR_TRACKS.find((t) => t.id === id)?.name[lang] ?? id);
  const topSchool = report.attendeesBySchool[0];
  const topTrack = report.attendeesByTrack.find((t) => t.track !== "unknown") ?? report.attendeesByTrack[0];
  const points = report.registrationsByDay.map((r) => ({ key: r.day, label: formatUbStable(dayAt(r.day), lang, "short"), short: formatUbStable(dayAt(r.day), lang, "short"), value: r.n }));
  const total = points.reduce((s, r) => s + r.value, 0);
  const peak = points.reduce((best, r) => (r.value > best.value ? r : best), { label: c.na, value: 0 });
  const nv = report.newVsReturning;

  const comments = (kind: "well" | "improve") => f.comments.filter((x) => x.kind === kind).slice(0, MAX_COMMENTS);
  const commentList = (kind: "well" | "improve", head: string, none: string) => {
    const list = comments(kind);
    return (
      <section aria-label={head} className="grid min-w-0 content-start gap-3">
        <h3 className="text-base font-bold text-fg">{head}</h3>
        {list.length === 0 ? <p className="text-sm text-fg-muted">{none}</p> : (
          <ul className="grid gap-3">
            {list.map((x, i) => (
              <li key={`${x.at}-${i}`} className="report-comment rounded-[var(--radius-sm)] border border-line bg-panel-2 p-3">
                <p className="text-sm whitespace-pre-line text-fg [overflow-wrap:anywhere]">{x.text}</p>
                <p className="mt-1.5 text-xs text-fg-muted">{x.author ? tf(x.author, lang) || c.anonymous : c.anonymous} · {formatUbStable(new Date(x.at), lang, "date")}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    );
  };

  return (
    <ReportDocument
      lang={lang} name={event.slug} title={docTitle(c.doc.title, title)} kind={c.doc.eventReport} heading={title}
      meta={[formatUbStable(new Date(event.starts_at), lang, "dayLong"), d.admin.kinds[event.kind], c.doc.scope[event.school_scope]].join(" · ")}
      generated={fill(c.doc.generated, { when: formatUbStable(now, lang, "datetime") })}
    >
      <ReportSection id="r-summary" title={e.sections.summary}>
        <ReportKpis items={eventKpis(report, c)} />
        <Grid>
          <FunnelChart
            lang={lang} as="h3" tone="green" title={e.funnel.title} tableHead={e.funnel.head} actions={dl("funnel", e.funnel.title)}
            takeaway={fill(e.funnel.takeaway, { registered: nf.format(report.funnel.registered), attended: nf.format(report.funnel.attended), noShow: nf.format(report.funnel.no_show), waitlisted: nf.format(report.funnel.waitlisted) })}
            steps={[
              { key: "registered", label: e.funnel.steps.registered, value: report.funnel.registered },
              { key: "going", label: e.funnel.steps.going, value: report.funnel.going },
              { key: "attended", label: e.funnel.steps.attended, value: report.funnel.attended },
            ]}
          />
          <AreaChart
            lang={lang} as="h3" tone="blue" title={e.days.title} seriesLabel={e.days.series} tableHead={e.days.head} points={points} actions={dl("registrations", e.days.title)}
            takeaway={fill(e.days.takeaway, { n: nf.format(total), day: peak.label, peak: nf.format(peak.value) })}
          />
        </Grid>
      </ReportSection>

      <ReportSection id="r-audience" title={e.sections.audience}>
        <Grid>
          <DonutChart
            lang={lang} as="h3" tone="blue" title={e.school.title} centreLabel={e.school.centre} otherLabel={e.school.other} tableHead={e.school.head} actions={dl("school", e.school.title)}
            takeaway={topSchool ? fill(e.school.takeaway, { school: schoolName(topSchool.school_id), n: nf.format(topSchool.n) }) : e.school.none}
            data={report.attendeesBySchool.map((r) => ({ key: r.school_id, label: schoolName(r.school_id), value: r.n }))}
          />
          <BarChart
            lang={lang} as="h3" tone="yellow" title={e.track.title} groupHeader={e.track.group} actions={dl("track", e.track.title)}
            takeaway={topTrack ? fill(e.track.takeaway, { track: trackName(topTrack.track), n: nf.format(topTrack.n) }) : e.school.none}
            series={[{ key: "n", label: e.track.series, color: 1 }]}
            groups={report.attendeesByTrack.map((r) => ({ key: r.track, label: trackName(r.track), values: [r.n] }))}
          />
        </Grid>
        <DonutChart
          lang={lang} as="h3" tone="green" size="sm" title={e.fresh.title} centreLabel={e.fresh.centre} otherLabel={e.fresh.other} tableHead={e.fresh.head} actions={dl("new-returning", e.fresh.title)}
          takeaway={fill(e.fresh.takeaway, { returning: nf.format(nv.returning), fresh: nf.format(nv.new) })}
          data={[{ key: "new", label: e.fresh.new, value: nv.new }, { key: "returning", label: e.fresh.returning, value: nv.returning }]}
        />
      </ReportSection>

      <ReportSection id="r-feedback" title={e.sections.feedback}>
        {f.n === 0 ? (
          <EmptyState sticker="feedback" title={e.feedback.empty.title} line={e.feedback.empty.line} />
        ) : (
          <>
            <Grid>
              <BarChart
                lang={lang} as="h3" tone="yellow" title={e.feedback.ratingTitle} groupHeader={e.feedback.ratingGroup} max={Math.max(1, ...f.distribution)} actions={dl("rating", e.feedback.ratingTitle)}
                takeaway={fill(e.feedback.ratingTakeaway, { avg: f.avgRating === null ? c.na : f.avgRating.toFixed(1), n: nf.format(f.n) })}
                series={[{ key: "n", label: e.feedback.ratingSeries, color: 2 }]}
                groups={ratingBars(f.distribution, (n) => plural(lang, n, e.feedback.star))}
              />
              <NpsMeter
                lang={lang} as="h3" tone="green" title={e.feedback.npsTitle} nps={f.nps} tableHead={e.feedback.npsHead} valueLabel={e.feedback.npsValue} scale={e.feedback.npsScale} na={c.na} actions={dl("nps", e.feedback.npsTitle)}
                takeaway={fill(e.feedback.npsTakeaway, { nps: npsOrNa(f.nps, c.na) })}
              />
            </Grid>
            <h3 className="font-display text-base font-black text-fg">{e.feedback.commentsTitle}</h3>
            <div className="report-grid grid grid-cols-1 items-start gap-6 md:grid-cols-2">
              {commentList("well", e.feedback.well, e.feedback.noWell)}
              {commentList("improve", e.feedback.improve, e.feedback.noImprove)}
            </div>
          </>
        )}
      </ReportSection>
    </ReportDocument>
  );
}
