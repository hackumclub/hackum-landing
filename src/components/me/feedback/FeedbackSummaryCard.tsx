import { Lock, Star } from "lucide-react";
import { fill } from "@/i18n/config";
import type { EventFeedback } from "@/lib/mockdb/types";
import { Card } from "../parts";
import type { FeedbackCopy } from "./copy";

/** Read-only view of the person's OWN answer once the survey has closed. Nobody else's answers are ever passed in. */
export default function FeedbackSummaryCard({ answer, c }: { answer: EventFeedback; c: FeedbackCopy }) {
  const text = (v: string) => v.trim() || null;
  return (
    <Card as="section" className="grid gap-4 p-4 md:p-6">
      <h2 className="font-display text-lg font-bold text-fg">{c.yourAnswer}</h2>
      <dl className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1">
          <dt className="text-sm font-semibold text-fg-muted">{c.summaryRating}</dt>
          <dd className="flex items-center gap-2 font-bold text-fg">
            <span aria-hidden="true" className="flex">{Array.from({ length: 5 }, (_, i) => <Star key={i} size={20} className={i < answer.rating ? "fill-warn-fg text-warn-fg" : "text-fg-muted"} />)}</span>
            <span className="tnum">{fill(c.summaryOutOf5, { n: answer.rating })} · {c.ratingWords[answer.rating - 1]}</span>
          </dd>
        </div>
        <div className="grid gap-1">
          <dt className="text-sm font-semibold text-fg-muted">{c.summaryNps}</dt>
          <dd className="font-bold text-fg tnum">{fill(c.summaryOutOf10, { n: answer.nps })}</dd>
        </div>
        {([[c.wellLabel, answer.went_well], [c.improveLabel, answer.improve]] as const).map(([label, value]) => (
          <div key={label} className="grid gap-1 sm:col-span-2">
            <dt className="text-sm font-semibold text-fg-muted">{label}</dt>
            <dd className={text(value) ? "whitespace-pre-line text-fg [overflow-wrap:anywhere]" : "text-fg-muted"}>{text(value) ?? c.summaryNone}</dd>
          </div>
        ))}
      </dl>
      <p className="flex items-center gap-2 text-sm text-fg-muted"><Lock aria-hidden="true" size={16} className="shrink-0" />{answer.anonymous ? c.summaryAnon : c.summaryNamed} · {c.summaryPrivate}</p>
    </Card>
  );
}
