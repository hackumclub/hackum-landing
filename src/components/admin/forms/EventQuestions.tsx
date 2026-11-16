import { Pencil } from "lucide-react";
import { href, tf, type Locale } from "@/i18n/config";
import { copy } from "@/i18n/areas/admin-events";
import type { Question } from "@/lib/events/questions";
import { ButtonLink } from "@/components/ui/Button";
import Tag from "@/components/ui/Tag";

/** An event's registration questions, read-only. They are edited on the event itself, next to the registration mode they depend on. */
export default function EventQuestions({ lang, eventId, questions }: { lang: Locale; eventId: string; questions: Question[] }) {
  const t = copy[lang].forms.eventForm;
  const q = copy[lang].questions;
  return (
    <section aria-labelledby="event-questions-title" className="grid gap-4 rounded-[var(--radius-md)] border border-line bg-panel p-4 md:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-1">
          <h2 id="event-questions-title" className="font-display text-lg font-bold text-fg">{copy[lang].forms.editor.title}</h2>
          <p className="max-w-prose text-sm text-fg-muted">{t.line}</p>
        </div>
        <ButtonLink href={href(lang, `/admin/events/${eventId}`)} icon={<Pencil aria-hidden="true" size={16} />}>{t.edit}</ButtonLink>
      </div>
      {questions.length === 0 ? (
        <p className="rounded-[var(--radius-sm)] border border-dashed border-line px-3 py-4 text-sm text-fg-muted">{t.empty}</p>
      ) : (
        <ol className="grid gap-3">
          {questions.map((x, i) => (
            <li key={x.id} className="grid gap-2 rounded-[var(--radius-sm)] border border-line bg-panel-2 p-3">
              <p className="flex flex-wrap items-center gap-2">
                <span className="tnum text-sm font-semibold text-fg-muted">{i + 1}.</span>
                <span className="font-bold break-words text-fg">{tf(x.label, lang)}</span>
                <Tag>{q.types[x.type]}</Tag>
                <Tag tone={x.required ? "accent" : "neutral"}>{x.required ? t.required : t.optional}</Tag>
              </p>
              {x.options && x.options.length > 0 && <p className="text-sm break-words text-fg-muted">{x.options.map((o) => tf(o, lang)).join(" · ")}</p>}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
