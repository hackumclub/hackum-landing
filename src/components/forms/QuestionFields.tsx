"use client";
import { useId } from "react";
import { copy } from "@/i18n/areas/public";
import { tf, type Locale } from "@/i18n/config";
import Field, { Input, Select, Textarea } from "@/components/ui/Field";
import { cx } from "@/components/ui/cx";
import { LONG_MAX, parseAnswers, SHORT_MAX, URL_MAX, type Answers, type Question } from "@/lib/events/questions";

export type QuestionFieldsProps = {
  questions: Question[];
  answers: Answers;
  onChange(next: Answers): void;
  /** Machine code per question id (`required | too_long | bad_url | bad_option | invalid`), e.g. from `validateAnswers` or a server action. */
  errors?: Record<string, string>;
  lang: Locale;
  className?: string;
};

/** Client-side check with the same schema the server uses (`answersSchema`), so the two never disagree. `{}` means valid. */
export function validateAnswers(questions: Question[], answers: Answers): Record<string, string> {
  const r = parseAnswers(questions, answers);
  return r.ok ? {} : r.errors;
}

const boxClass = "size-5 shrink-0 rounded-[var(--radius-sm)] border border-line-strong accent-[var(--ops-accent)] aria-[invalid=true]:border-danger-fg";
const optionRow = "flex min-h-11 cursor-pointer items-center gap-3 rounded-[var(--radius-sm)] border border-line bg-panel px-3 py-2 text-sm text-fg has-[:checked]:border-[var(--ops-accent)] has-[:checked]:bg-accent-soft";

/**
 * Renders every question type of an event / form definition (short, long, url, select, multi, checkbox) with a visible
 * label, `aria-invalid` and the error next to the control. Answers refer to options by index ("0", "1", …), so option
 * labels can be edited without breaking old answers. Controlled: the parent owns `answers`.
 */
export default function QuestionFields({ questions, answers, onChange, errors, lang, className }: QuestionFieldsProps) {
  const c = copy[lang].questionFields;
  const set = (id: string, value: string | string[] | boolean | undefined) => {
    const next: Answers = { ...answers };
    if (value === undefined) delete next[id]; else next[id] = value;
    onChange(next);
  };
  const message = (id: string) => (errors?.[id] ? (c.errors[errors[id]] ?? c.errors.invalid) : undefined);
  const label = (q: Question) => tf(q.label, lang) || q.label.mn;
  const optional = (q: Question) => (q.required ? undefined : <span className="font-normal text-fg-muted"> ({c.optional})</span>);

  return (
    <div className={cx("grid gap-4", className)}>
      {questions.map((q) => {
        const err = message(q.id);
        const raw = answers[q.id];
        switch (q.type) {
          case "short":
          case "url":
            return (
              <Field key={q.id} label={<>{label(q)}{optional(q)}</>} required={q.required} error={err}>
                {(ctl) => (
                  <Input {...ctl} name={q.id} className="min-h-11" value={typeof raw === "string" ? raw : ""} maxLength={q.type === "url" ? URL_MAX : SHORT_MAX}
                    type={q.type === "url" ? "url" : "text"} inputMode={q.type === "url" ? "url" : undefined} autoComplete="off"
                    onChange={(e) => set(q.id, e.target.value)} />
                )}
              </Field>
            );
          case "long":
            return (
              <Field key={q.id} label={<>{label(q)}{optional(q)}</>} required={q.required} error={err}>
                {(ctl) => <Textarea {...ctl} name={q.id} value={typeof raw === "string" ? raw : ""} maxLength={LONG_MAX} onChange={(e) => set(q.id, e.target.value)} />}
              </Field>
            );
          case "select":
            return (
              <Field key={q.id} label={<>{label(q)}{optional(q)}</>} required={q.required} error={err}>
                {(ctl) => (
                  <Select {...ctl} name={q.id} className="min-h-11" value={typeof raw === "string" ? raw : ""} onChange={(e) => set(q.id, e.target.value === "" ? undefined : e.target.value)}>
                    <option value="">{c.select}</option>
                    {(q.options ?? []).map((o, i) => <option key={i} value={String(i)}>{tf(o, lang) || o.mn}</option>)}
                  </Select>
                )}
              </Field>
            );
          case "multi":
            return <MultiField key={q.id} q={q} value={Array.isArray(raw) ? raw : []} error={err} lang={lang} legend={<>{label(q)}{optional(q)}</>} onChange={(v) => set(q.id, v.length ? v : undefined)} />;
          case "checkbox":
            return <CheckField key={q.id} q={q} checked={raw === true} error={err} text={label(q)} onChange={(v) => set(q.id, v)} />;
        }
      })}
    </div>
  );
}

function MultiField({ q, value, error, lang, legend, onChange }: { q: Question; value: string[]; error?: string; lang: Locale; legend: React.ReactNode; onChange(v: string[]): void }) {
  const id = useId();
  const errorId = error ? `${id}-error` : undefined;
  return (
    <fieldset aria-describedby={errorId} aria-invalid={error ? true : undefined} aria-required={q.required || undefined} className="grid gap-2 border-0 p-0">
      <legend className="mb-1.5 p-0 text-sm font-semibold text-fg">{legend}{q.required && <span aria-hidden="true" className="text-danger-fg"> *</span>}</legend>
      {(q.options ?? []).map((o, i) => {
        const key = String(i);
        return (
          <label key={i} className={optionRow}>
            <input type="checkbox" name={q.id} value={key} checked={value.includes(key)} aria-invalid={error ? true : undefined} className={boxClass}
              onChange={(e) => onChange(e.target.checked ? [...value, key].sort((a, b) => Number(a) - Number(b)) : value.filter((v) => v !== key))} />
            <span>{tf(o, lang) || o.mn}</span>
          </label>
        );
      })}
      {error && <p id={errorId} className="text-sm font-semibold text-danger-fg">{error}</p>}
    </fieldset>
  );
}

function CheckField({ q, checked, error, text, onChange }: { q: Question; checked: boolean; error?: string; text: string; onChange(v: boolean): void }) {
  const id = useId();
  const errorId = error ? `${id}-error` : undefined;
  return (
    <div className="grid gap-1.5">
      <label className={optionRow}>
        <input type="checkbox" name={q.id} checked={checked} aria-invalid={error ? true : undefined} aria-describedby={errorId} aria-required={q.required || undefined} className={boxClass} onChange={(e) => onChange(e.target.checked)} />
        <span>{text}{q.required && <span aria-hidden="true" className="text-danger-fg"> *</span>}</span>
      </label>
      {error && <p id={errorId} className="text-sm font-semibold text-danger-fg">{error}</p>}
    </div>
  );
}
