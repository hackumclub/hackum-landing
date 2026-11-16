"use client";
import { useId } from "react";
import { Users } from "lucide-react";
import Field, { Select } from "@/components/ui/Field";
import FilterChips from "@/components/ui/FilterChips";
import { cx } from "@/components/ui/cx";
import { tf, type L, type Locale } from "@/i18n/config";
import { plural } from "@/i18n/plural";
import { getDictionary } from "@/i18n";
import { AUDIENCE_KINDS, EVENT_STATUSES, type AudienceChoice, type AudienceKind, type EventStatus } from "@/lib/announce/compose-state";
import { copy } from "@/lib/announce/copy";
import { formatUbStable } from "@/lib/time";
import type { SizeState } from "./useAudienceSize";

export type EventOption = { id: string; title: L; startsAt: string };

function Count({ lang, state, hint }: { lang: Locale; state: SizeState; hint: string | null }) {
  const t = copy[lang].who;
  if (hint) return <span>{hint}</span>;
  if (state.status === "ready") {
    const { total, willReceive, optedOut } = state.size;
    return <span className="tnum font-semibold text-fg">{plural(lang, total, t.count, { total, will: willReceive, out: optedOut })}</span>;
  }
  if (state.status === "error") return <span className="text-danger-fg">{t.countFailed}</span>;
  return <span>{t.counting}</span>;
}

/** One card, radio semantics: a native radio stretched over the whole card, so click, keyboard and screen readers all work. */
function Card({ name, kind, selected, onSelect, lang, state, hint, children }: {
  name: string; kind: AudienceKind; selected: boolean; onSelect: () => void; lang: Locale; state: SizeState; hint: string | null; children?: React.ReactNode;
}) {
  const uid = useId();
  const t = copy[lang].who.cards[kind];
  return (
    <div className={cx(
      "relative rounded-[var(--radius-md)] border bg-panel transition-[border-color,box-shadow] duration-150",
      "has-[input:checked]:border-accent has-[input:checked]:bg-accent-soft has-[input:checked]:shadow-[var(--shadow-soft)]",
      "has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-[var(--ops-accent)]",
      selected ? "border-accent" : "border-line hover:border-line-strong/60",
    )}>
      <div className="relative flex items-start gap-3 p-4 md:p-5">
        <input
          type="radio" name={name} value={kind} checked={selected} onChange={onSelect}
          aria-labelledby={`${uid}-t`} aria-describedby={`${uid}-d`}
          className="absolute inset-0 z-10 m-0 h-full w-full cursor-pointer appearance-none rounded-[var(--radius-md)] opacity-0"
        />
        <span aria-hidden="true" className={cx("mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border-2", selected ? "border-accent" : "border-line-strong")}>
          {selected && <span className="size-2.5 rounded-full bg-accent" />}
        </span>
        <div className="min-w-0 flex-1">
          <p id={`${uid}-t`} className="text-base font-bold text-fg [overflow-wrap:anywhere]">{t.title}</p>
          <p id={`${uid}-d`} className="mt-0.5 grid gap-0.5 text-sm text-fg-muted">
            <span>{t.line}</span>
            <span className="flex items-center gap-1.5"><Users aria-hidden="true" size={14} className="shrink-0" /><Count lang={lang} state={state} hint={hint} /></span>
          </p>
        </div>
      </div>
      {children && <div className="relative z-20 grid gap-3 border-t border-line px-4 pt-3 pb-4 md:px-5 md:pb-5">{children}</div>}
    </div>
  );
}

export type SizeStates = Record<AudienceKind, SizeState>;

export default function AudienceCards({ lang, choice, onChange, events, states }: {
  lang: Locale; choice: AudienceChoice; onChange: (c: AudienceChoice) => void; events: EventOption[]; states: SizeStates;
}) {
  const t = copy[lang].who;
  const name = useId();
  const d = getDictionary(lang);
  const pick = (kind: AudienceKind) => onChange(kind === "event" ? { ...choice, kind, statuses: choice.statuses.length ? choice.statuses : ["going"] } : { ...choice, kind });
  const picked = choice.eventId !== "";
  const statusOptions = EVENT_STATUSES.map((s) => ({ value: s, label: d.status[s] }));
  return (
    <fieldset className="grid gap-3">
      <legend className="sr-only">{t.groupLabel}</legend>
      {AUDIENCE_KINDS.map((k) => (
        <Card key={k} name={name} kind={k} selected={choice.kind === k} onSelect={() => pick(k)} lang={lang} state={states[k]} hint={k === "event" && !picked ? t.pickEventFirst : null}>
          {k === "event" && choice.kind === "event" && (
            <>
              <Field label={t.event}>
                {(c) => (
                  <Select {...c} name="event" value={choice.eventId} onChange={(e) => onChange({ ...choice, kind: "event", eventId: e.target.value })} disabled={events.length === 0}>
                    <option value="">{events.length ? t.eventPlaceholder : t.noEvents}</option>
                    {events.map((e) => <option key={e.id} value={e.id}>{tf(e.title, lang)} · {formatUbStable(new Date(e.startsAt), lang, "date")}</option>)}
                  </Select>
                )}
              </Field>
              <div className="grid gap-1.5">
                <FilterChips label={t.statusesLabel} options={statusOptions} value={choice.statuses} onChange={(v) => onChange({ ...choice, kind: "event", statuses: EVENT_STATUSES.filter((s): s is EventStatus => v.includes(s)) })} />
                {choice.statuses.length === 0 && <p className="text-sm font-semibold text-danger-fg">{t.statusesHint}</p>}
              </div>
            </>
          )}
        </Card>
      ))}
    </fieldset>
  );
}
