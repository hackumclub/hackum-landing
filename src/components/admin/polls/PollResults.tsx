import { EyeOff } from "lucide-react";
import { fill, tf, type Locale } from "@/i18n/config";
import { copy } from "@/i18n/areas/admin-polls";
import { pctText } from "@/components/charts/scale";
import BarChart from "@/components/charts/BarChart";
import EmptyState from "@/components/ui/EmptyState";
import KpiCard from "@/components/ui/KpiCard";
import type { PollResultsView } from "@/lib/mockdb/polls";
import { pollResultsToCsv } from "@/lib/polls/csv";
import { formatUbStable } from "@/lib/time";
import ExportPollCsv from "./ExportPollCsv";
import VotersTable from "./VotersTable";

/** Results tab: turnout, votes per option, and (non-anonymous polls only) who voted. Staff view: `view.voterList` is null for anonymous polls. */
export default function PollResults({ view, lang }: { view: PollResultsView; lang: Locale }) {
  const t = copy[lang].results;
  const { poll } = view;
  const nf = new Intl.NumberFormat(lang === "mn" ? "mn-MN" : "en-US");
  const tallies = view.tallies ?? [];
  const label = (id: string) => { const o = poll.options.find((x) => x.id === id); return o ? tf(o.label, lang) : id; };
  const top = tallies.reduce<(typeof tallies)[number] | null>((m, x) => (x.votes > (m?.votes ?? 0) ? x : m), null);
  const csv = pollResultsToCsv(poll, view, lang);
  const file = `${t.csvFile}-${poll.id}.csv`;
  const rows = (view.voterList ?? []).map((v) => ({ id: v.profile_id, name: tf(v.name, lang) || t.unnamed, choices: v.option_ids.map(label).join(", ") }));
  const none = view.voters === 0;

  return (
    <div className="grid gap-6">
      <section aria-label={t.turnout} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <KpiCard icon="users" tone="green" label={t.turnout} value={view.turnout === null ? "—" : pctText(view.turnout)} hint={view.eligible ? fill(t.turnoutHint, { voters: nf.format(view.voters), eligible: nf.format(view.eligible) }) : t.turnoutNone} />
        <KpiCard icon="ticket" tone="blue" label={t.chartSeries} value={nf.format(view.voters)} hint={poll.multi ? t.multiNote : undefined} />
        <KpiCard icon="clock" tone="yellow" label={t.closesLabel} value={poll.closes_at ? formatUbStable(new Date(poll.closes_at), lang, "datetimeShort") : t.noClose} />
      </section>

      {none ? (
        <EmptyState sticker="queue" title={t.noVotes.title} line={poll.status === "draft" ? t.noVotes.draftLine : t.noVotes.line} />
      ) : (
        <BarChart
          lang={lang} tone="blue" title={t.chartTitle} groupHeader={t.chartGroup}
          takeaway={top ? fill(t.chartTakeaway, { top: label(top.option_id), n: nf.format(top.votes) }) : t.chartNone}
          series={[{ key: "votes", label: t.chartSeries, color: 1 }]}
          groups={tallies.map((x) => ({ key: x.option_id, label: label(x.option_id), values: [x.votes] }))}
        />
      )}

      <section aria-labelledby="voters-h" className="grid gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="grid gap-0.5">
            <h2 id="voters-h" className="text-base font-bold text-fg">{t.votersTitle}</h2>
            {view.voterList && <p className="text-sm text-fg-muted">{t.votersLine}</p>}
          </div>
          <ExportPollCsv csv={csv} file={file} label={t.exportCsv} />
        </div>
        {view.voterList ? (
          <VotersTable rows={rows} caption={t.votersCaption} cols={t.cols} empty={t.votersEmpty} />
        ) : (
          <p role="note" className="flex items-start gap-3 rounded-[var(--radius-sm)] border border-line bg-accent-soft px-4 py-3 text-sm text-fg">
            <EyeOff aria-hidden="true" size={18} className="mt-0.5 shrink-0 text-accent-fg" />{t.anonymous}
          </p>
        )}
      </section>
    </div>
  );
}
