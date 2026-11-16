import { fill, href, type Locale } from "@/i18n/config";
import { copy } from "@/i18n/areas/admin-events";
import { plural } from "@/i18n/plural";
import type { eventAnalytics } from "@/lib/events/admin-analytics";
import { formatUb } from "@/lib/time";
import { ButtonLink } from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import KpiCard from "@/components/ui/KpiCard";

type Analytics = ReturnType<typeof eventAnalytics>;

function Card({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="grid content-start gap-4 rounded-[var(--radius-md)] border border-line bg-panel p-4 md:p-5">
      <h2 id={id} className="font-display text-base font-bold text-fg">{title}</h2>
      {children}
    </section>
  );
}

/** Horizontal bar with the number written next to it: the bar is never the only way to read the value. */
function BarRow({ label, value, max, tone, suffix }: { label: string; value: number; max: number; tone: "bg-c1" | "bg-c3" | "bg-c4" | "bg-c5"; suffix?: string }) {
  const pct = max > 0 ? Math.max((value / max) * 100, value > 0 ? 2 : 0) : 0;
  return (
    <li className="grid gap-1">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="min-w-0 break-words text-fg">{label}</span>
        <span className="tnum shrink-0 font-bold text-fg">{value}{suffix && <span className="font-normal text-fg-muted"> {suffix}</span>}</span>
      </div>
      <div aria-hidden="true" className="h-3 overflow-hidden rounded-full bg-neutral-soft"><div className={`h-full rounded-full ${tone}`} style={{ width: `${pct}%` }} /></div>
    </li>
  );
}

/** Server-rendered, no client JS: KPI cards, funnel, new vs returning, by school, registrations per day. */
export default function AnalyticsView({ a, lang, eventId, slug, published, application }: { a: Analytics; lang: Locale; eventId: string; slug: string; published: boolean; application: boolean }) {
  const t = copy[lang].analytics;
  const n = new Intl.NumberFormat(lang === "mn" ? "mn-MN" : "en-US");

  if (!a.hasData) {
    return (
      <EmptyState
        sticker="laptop" title={t.empty.title} line={t.empty.line}
        action={published
          ? <ButtonLink href={href(lang, `/events/${slug}`)} target="_blank" rel="noopener noreferrer">{t.empty.viewPublic}</ButtonLink>
          : <ButtonLink href={href(lang, `/admin/events/${eventId}`)}>{t.empty.editEvent}</ButtonLink>}
      />
    );
  }

  const { stats, funnel, bySchool, perDay, split } = a;
  const funnelMax = Math.max(...funnel.map((f) => f.value), 1);
  const schoolMax = Math.max(...bySchool.map((s) => s.n), 1);
  const splitTotal = split.new + split.returning;
  const total = perDay.reduce((s, p) => s + p.n, 0);
  const peak = perDay.reduce((best, p) => (p.n > best.n ? p : best), perDay[0]);
  const dayLabel = (day: string) => formatUb(new Date(`${day}T12:00:00+08:00`), lang, { month: "short", day: "numeric" });
  const W = 300, H = 64, bw = W / perDay.length;
  const top = Math.max(peak.n, 1);

  return (
    <div className="grid grid-cols-1 gap-4">
      <section aria-labelledby="kpis">
        <h2 id="kpis" className="sr-only">{t.kpis}</h2>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(11rem,1fr))] gap-3">
          <KpiCard label={t.registered} value={n.format(stats.registered)} hint={t.registeredHint} />
          <KpiCard label={t.going} value={n.format(stats.going + stats.attended)} hint={fill(t.goingHint, { n: stats.attended })} />
          <KpiCard label={t.waitlisted} value={n.format(stats.waitlisted)} />
          {application && <KpiCard label={t.applied} value={n.format(stats.applied)} />}
          {a.showRate !== null && <KpiCard label={t.showRate} value={`${Math.round(a.showRate * 100)}%`} hint={t.showRateHint} />}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card id="funnel" title={t.funnel}>
          <ul className="grid gap-3">
            {funnel.map((f) => <BarRow key={f.key} label={t.stages[f.key]} value={f.value} max={funnelMax} tone="bg-c1" suffix={f.key !== "registered" && stats.registered > 0 ? `· ${Math.round((f.value / stats.registered) * 100)}%` : undefined} />)}
          </ul>
          {stats.attended === 0 && <p className="text-sm text-fg-muted">{t.attendedNone}</p>}
        </Card>

        <Card id="split" title={t.split}>
          {splitTotal === 0 ? (
            <p className="text-sm text-fg-muted">{t.attendedNone}</p>
          ) : (
            <>
              <div aria-hidden="true" className="flex h-4 overflow-hidden rounded-full bg-neutral-soft">
                <div className="h-full bg-c1" style={{ width: `${(split.new / splitTotal) * 100}%` }} />
                <div className="h-full bg-c3" style={{ width: `${(split.returning / splitTotal) * 100}%` }} />
              </div>
              <ul className="grid gap-2 text-sm">
                {[{ label: t.splitNew, v: split.new, tone: "bg-c1" }, { label: t.splitReturning, v: split.returning, tone: "bg-c3" }].map((x) => (
                  <li key={x.label} className="flex items-center gap-2">
                    <span aria-hidden="true" className={`size-3 shrink-0 rounded-sm ${x.tone}`} />
                    <span className="flex-1 text-fg">{x.label}</span>
                    <span className="tnum font-bold text-fg">{x.v} <span className="font-normal text-fg-muted">· {Math.round((x.v / splitTotal) * 100)}%</span></span>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-fg-muted">{t.splitHint}</p>
            </>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card id="school" title={t.bySchool}>
          <ul className="grid gap-3">
            {bySchool.map((s, i) => (
              <BarRow key={`${s.school}-${i}`} label={s.other ? t.other : s.school ?? t.unknownSchool} value={s.n} max={schoolMax} tone={s.other || s.school === null ? "bg-c5" : "bg-c1"} suffix={plural(lang, s.n, t.people).replace(/^\d+\s*/, "")} />
            ))}
          </ul>
        </Card>

        <Card id="perday" title={t.perDay}>
          <p className="text-sm text-fg">{total === 0 ? t.perDayNone : fill(t.perDaySummary, { n: total, peak: peak.n, day: dayLabel(peak.day) })}</p>
          <svg viewBox={`0 0 ${W} ${H}`} aria-hidden="true" className="h-16 w-full" preserveAspectRatio="none">
            {perDay.map((p, i) => {
              const h = (p.n / top) * (H - 6);
              return <rect key={p.day} x={i * bw + 1} y={H - 1 - Math.max(h, p.n > 0 ? 2 : 0)} width={bw - 2} height={Math.max(h, p.n > 0 ? 2 : 0)} className="fill-c1" />;
            })}
            <line x1="0" x2={W} y1={H - 0.5} y2={H - 0.5} className="stroke-line-strong" strokeWidth="1" />
          </svg>
          <div className="flex justify-between text-xs text-fg-muted"><span>{dayLabel(perDay[0].day)}</span><span>{dayLabel(perDay[perDay.length - 1].day)}</span></div>
        </Card>
      </div>
    </div>
  );
}
