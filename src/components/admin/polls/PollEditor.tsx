"use client";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import { CheckCircle2, ChevronDown, ChevronUp, Info, Lock, Plus, Trash2 } from "lucide-react";
import { fill, href, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n";
import { copy } from "@/i18n/areas/admin-polls";
import { plural } from "@/i18n/plural";
import { createPollAction, updatePollAction } from "@/lib/polls/actions";
import { pollMessage } from "@/lib/polls/errors";
import {
  AUDIENCES, clampMax, MAX_OPTIONS, MIN_OPTIONS, moveOption, nextOptionId, sameDraft, toInput, validateDraft, VISIBILITIES, type PollDraft,
} from "@/lib/polls/form";
import type { AudienceCounts } from "@/lib/polls/rows";
import BilingualField from "@/components/ui/BilingualField";
import Button, { ButtonLink } from "@/components/ui/Button";
import DateTimeField from "@/components/ui/DateTimeField";
import Field, { Input, Select } from "@/components/ui/Field";
import IconButton from "@/components/ui/IconButton";
import { useToast } from "@/components/admin/events/Toast";

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="grid gap-4 rounded-[var(--radius-md)] border border-line bg-panel p-4 md:p-5">
      <div className="grid gap-0.5">
        <h2 className="text-base font-bold text-fg">{title}</h2>
        {hint && <p className="text-sm text-fg-muted">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

const choiceCls = "flex min-h-11 cursor-pointer items-start gap-3 rounded-[var(--radius-sm)] border border-line p-3 has-[:checked]:border-line-strong has-[:checked]:bg-accent-soft has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-70";

/**
 * Create or edit one poll. `voters > 0` freezes the ballot (options, choice type, audience, anonymity), exactly as the
 * rule does (`conflict`), and says why. Save → `createPollAction` / `updatePollAction`; a new poll starts as a draft.
 */
export default function PollEditor({ lang, pollId, initial, counts, voters }: { lang: Locale; pollId?: string; initial: PollDraft; counts: AudienceCounts; voters: number }) {
  const t = copy[lang].editor;
  const d = getDictionary(lang);
  const router = useRouter();
  const [pending, start] = useTransition();
  const { show, node } = useToast(d.ui.close);
  const [draft, setDraft] = useState<PollDraft>(initial);
  const [saved, setSaved] = useState<PollDraft>(initial);
  const [attempted, setAttempted] = useState(false);
  const [focusTick, setFocusTick] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);
  // Every option id handed out in this session: delete-then-add never reuses one (votes refer to option ids).
  const seen = useRef(new Set(initial.options.map((o) => o.id)));
  useEffect(() => { for (const o of draft.options) seen.current.add(o.id); }, [draft.options]);

  const locked = voters > 0;
  const errors = useMemo(() => (attempted ? validateDraft(draft) : {}), [attempted, draft]);
  const errorCount = Object.keys(errors).length;
  const dirty = !sameDraft(draft, saved);
  const set = <K extends keyof PollDraft>(k: K, v: PollDraft[K]) => setDraft((s) => ({ ...s, [k]: v }));
  const msg = (code: string | undefined) => (code ? t.errors[code] : undefined);

  // After a failed attempt, move focus to the first invalid control.
  useEffect(() => {
    if (focusTick > 0) formRef.current?.querySelector<HTMLElement>("[aria-invalid='true']")?.focus();
  }, [focusTick]);

  const setOptions = (options: PollDraft["options"]) => setDraft((s) => ({ ...s, options, maxChoices: clampMax(s.maxChoices, options.length) }));
  const audienceN = counts[draft.audience];

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setAttempted(true);
    if (Object.keys(validateDraft(draft)).length > 0) { setFocusTick((n) => n + 1); return; }
    const input = toInput(draft);
    start(async () => {
      if (pollId) {
        const r = await updatePollAction(pollId, input);
        if (r.ok) { setSaved(draft); show(t.saved); router.refresh(); }
        else show(pollMessage(r.error, lang, "save"), "error");
      } else {
        const r = await createPollAction(input);
        if (r.ok) router.push(`${href(lang, `/admin/polls/${r.data.id}`)}?tab=settings&created=1`);
        else show(pollMessage(r.error, lang, "save"), "error");
      }
    });
  };

  return (
    <form ref={formRef} onSubmit={submit} noValidate className="grid gap-6" aria-label={pollId ? t.sections.basics : t.newTitle}>
      {locked && (
        <p role="note" className="flex items-start gap-3 rounded-[var(--radius-sm)] border border-line bg-warn-soft px-4 py-3 text-sm text-warn-fg">
          <Lock aria-hidden="true" size={18} className="mt-0.5 shrink-0" />{plural(lang, voters, t.lockedReason)}
        </p>
      )}

      <Section title={t.sections.basics}>
        <BilingualField name="title" label={t.title} value={draft.title} onChange={(v) => set("title", v)} labels={d.ui.bilingual} error={msg(errors.title)} />
        <BilingualField name="description" label={t.description} value={draft.description} onChange={(v) => set("description", v)} labels={d.ui.bilingual} multiline required="none" error={msg(errors.description)} />
      </Section>

      <Section title={t.sections.options} hint={t.optionsLine}>
        {errors.options && <p role="alert" className="text-sm font-semibold text-danger-fg">{msg(errors.options)}</p>}
        <ol className="grid gap-3">
          {draft.options.map((o, i) => {
            const n = i + 1;
            const bad = errors[`option.${i}`], badEn = errors[`optionEn.${i}`];
            return (
              <li key={o.id} className="grid gap-2 rounded-[var(--radius-md)] border border-line bg-panel-2 p-3">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
                  <Input
                    aria-label={fill(t.optionNameMn, { n })} lang="mn" value={o.label.mn} readOnly={locked} aria-invalid={bad ? true : undefined}
                    onChange={(e) => setOptions(draft.options.map((x, j) => (j === i ? { ...x, label: { ...x.label, mn: e.target.value } } : x)))}
                  />
                  <div className="row-start-1 col-start-2 flex md:col-start-3">
                    <IconButton label={fill(t.moveUp, { n })} icon={<ChevronUp size={18} />} disabled={locked || i === 0} onClick={() => setOptions(moveOption(draft.options, i, -1))} />
                    <IconButton label={fill(t.moveDown, { n })} icon={<ChevronDown size={18} />} disabled={locked || i === draft.options.length - 1} onClick={() => setOptions(moveOption(draft.options, i, 1))} />
                    <IconButton label={fill(t.removeOption, { n })} icon={<Trash2 size={18} />} disabled={locked || draft.options.length <= MIN_OPTIONS} onClick={() => setOptions(draft.options.filter((_, j) => j !== i))} />
                  </div>
                  <Input
                    aria-label={fill(t.optionNameEn, { n })} lang="en" value={o.label.en} readOnly={locked} aria-invalid={badEn ? true : undefined} className="col-span-1 md:col-start-2 md:row-start-1"
                    onChange={(e) => setOptions(draft.options.map((x, j) => (j === i ? { ...x, label: { ...x.label, en: e.target.value } } : x)))}
                  />
                </div>
                {(bad || badEn) && <p className="text-sm font-semibold text-danger-fg">{msg(bad ?? badEn)}</p>}
              </li>
            );
          })}
        </ol>
        <div>
          <Button
            variant="secondary" size="sm" icon={<Plus aria-hidden="true" size={14} />} disabled={locked || draft.options.length >= MAX_OPTIONS}
            onClick={() => setOptions([...draft.options, { id: nextOptionId(seen.current), label: { mn: "", en: "" } }])}
          >
            {t.addOption}
          </Button>
        </div>
      </Section>

      <Section title={t.sections.rules}>
        <fieldset className="grid gap-2" disabled={locked}>
          <legend className="mb-1 text-sm font-bold text-fg">{t.choice}</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {([false, true] as const).map((multi) => (
              <label key={String(multi)} className={choiceCls}>
                <input type="radio" name="choice" checked={draft.multi === multi} onChange={() => setDraft((s) => ({ ...s, multi, maxChoices: multi ? clampMax(Math.max(2, s.maxChoices), s.options.length) : 1 }))} className="mt-0.5 size-4 accent-[var(--ops-accent)]" />
                <span className="text-sm font-semibold text-fg">{multi ? t.multi : t.single}</span>
              </label>
            ))}
          </div>
          {draft.multi && (
            <Field label={t.maxChoices} error={msg(errors.maxChoices)} className="max-w-xs">
              {(c) => (
                <Input {...c} type="number" inputMode="numeric" min={1} max={draft.options.length} value={Number.isFinite(draft.maxChoices) ? draft.maxChoices : ""} disabled={locked}
                  onChange={(e) => set("maxChoices", e.target.value === "" ? Number.NaN : Number(e.target.value))} />
              )}
            </Field>
          )}
        </fieldset>

        <fieldset className="grid gap-2" disabled={locked}>
          <legend className="mb-1 text-sm font-bold text-fg">{t.audience}</legend>
          <div className="grid gap-2 md:grid-cols-3">
            {AUDIENCES.map((a) => (
              <label key={a} className={choiceCls}>
                <input type="radio" name="audience" checked={draft.audience === a} onChange={() => set("audience", a)} className="mt-0.5 size-4 accent-[var(--ops-accent)]" />
                <span className="grid gap-0.5">
                  <span className="text-sm font-semibold text-fg">{copy[lang].audience[a]}</span>
                  <span className="text-sm text-fg-muted">{t.audienceHint[a]}</span>
                </span>
              </label>
            ))}
          </div>
          <p role="status" className="flex items-center gap-2 text-sm font-semibold text-fg"><Info aria-hidden="true" size={16} className="text-accent-fg" />{plural(lang, audienceN, t.audienceCount)}</p>
        </fieldset>

        <div className="grid gap-1.5">
          <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-semibold text-fg has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-70">
            <input type="checkbox" role="switch" checked={draft.anonymous} disabled={locked} onChange={(e) => set("anonymous", e.target.checked)} aria-describedby="anon-explain" className="size-5 accent-[var(--ops-accent)]" />
            {t.anonymous}
          </label>
          <p id="anon-explain" className="text-sm text-fg-muted">{draft.anonymous ? t.anonymousOn : t.anonymousOff}</p>
        </div>

        <Field label={t.resultsLabel} hint={t.resultsHint} className="max-w-md">
          {(c) => (
            <Select {...c} value={draft.results} onChange={(e) => set("results", e.target.value as PollDraft["results"])}>
              {VISIBILITIES.map((v) => <option key={v} value={v}>{t.results[v]}</option>)}
            </Select>
          )}
        </Field>
      </Section>

      <Section title={t.sections.schedule}>
        <div className="grid gap-4 md:grid-cols-2">
          <DateTimeField name="opens_at" label={t.opens} tzLabel={d.ui.tz} hint={t.opensHint} value={draft.opensAt ? new Date(draft.opensAt) : null} onChange={(v) => set("opensAt", v ? v.toISOString() : null)} error={msg(errors.opens)} />
          <DateTimeField name="closes_at" label={t.closes} tzLabel={d.ui.tz} hint={t.closesHint} value={draft.closesAt ? new Date(draft.closesAt) : null} onChange={(v) => set("closesAt", v ? v.toISOString() : null)} error={msg(errors.closes)} />
        </div>
      </Section>

      <div data-testid="form-bar" className="sticky bottom-3 z-20 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-[var(--radius-md)] border border-line bg-panel p-3 shadow-[var(--shadow-float)]">
        <div className="grid min-w-0 gap-0.5">
          {attempted && errorCount > 0 ? (
            <p role="alert" className="text-sm font-semibold text-danger-fg">{t.errorsTitle} ({errorCount})</p>
          ) : dirty ? (
            <p role="status" className="flex items-center gap-2 text-sm font-semibold text-fg"><span aria-hidden="true" className="size-2.5 rounded-full bg-warn-fg" />{t.dirty}</p>
          ) : pollId ? (
            <p role="status" className="flex items-center gap-2 text-sm text-fg-muted"><CheckCircle2 aria-hidden="true" size={16} />{t.saved}</p>
          ) : null}
        </div>
        <div className="ml-auto flex items-center gap-2">
          {!pollId && <ButtonLink href={href(lang, "/admin/polls")} variant="ghost">{d.ui.cancel}</ButtonLink>}
          <Button type="submit" disabled={pending || (!!pollId && !dirty)}>{pending ? t.saving : pollId ? t.save : t.create}</Button>
        </div>
      </div>
      {node}
    </form>
  );
}
