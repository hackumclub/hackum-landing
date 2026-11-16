"use client";
import { ChevronDown, ChevronUp, Plus, Trash2, X } from "lucide-react";
import { fill, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n";
import { copy } from "@/i18n/areas/admin-events";
import { MAX_QUESTIONS, type Question } from "@/lib/events/questions";
import { moveQuestion, newQuestion, QUESTION_TYPES, type FormErrors } from "@/lib/events/admin-form";
import BilingualField from "@/components/ui/BilingualField";
import Button from "@/components/ui/Button";
import Field, { Input, Select } from "@/components/ui/Field";
import IconButton from "@/components/ui/IconButton";

/** Add, reorder, edit and remove registration questions (≤ 20). Ids are generated (q1, q2, …) and never change. */
export default function QuestionBuilder({ lang, value, onChange, errors, answered }: {
  lang: Locale; value: Question[]; onChange: (qs: Question[]) => void; errors: FormErrors; answered: number;
}) {
  const t = copy[lang].questions;
  const f = copy[lang].form;
  const d = getDictionary(lang);
  const update = (i: number, patch: Partial<Question>) => onChange(value.map((q, j) => (j === i ? { ...q, ...patch } : q)));
  const setType = (i: number, type: Question["type"]) => {
    const q = value[i];
    const hasOptions = type === "select" || type === "multi";
    update(i, { type, options: hasOptions ? q.options ?? newQuestion([], type).options : undefined });
  };
  const err = (code: string | undefined) => (code ? f.errors[code] : undefined);

  return (
    <div className="grid gap-4">
      <p className="text-sm text-fg-muted">{fill(t.line, { max: MAX_QUESTIONS })}</p>
      {answered > 0 && <p role="note" className="rounded-[var(--radius-sm)] border border-line bg-warn-soft px-3 py-2 text-sm text-warn-fg">{fill(t.answered, { n: answered })}</p>}
      {errors.questions && <p className="text-sm font-semibold text-danger-fg">{err(errors.questions)}</p>}
      {value.length === 0 && <p className="rounded-[var(--radius-sm)] border border-dashed border-line-strong px-3 py-4 text-sm text-fg-muted">{t.empty}</p>}

      <ol className="grid gap-4">
        {value.map((q, i) => (
          <li key={q.id} className="grid gap-4 rounded-[var(--radius-md)] border border-line bg-panel-2 p-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <h3 className="text-sm font-bold text-fg">{fill(t.number, { n: i + 1 })}</h3>
              <div className="flex flex-wrap items-end gap-3">
                <Field label={t.type} className="w-48">
                  {(c) => (
                    <Select {...c} value={q.type} onChange={(e) => setType(i, e.target.value as Question["type"])}>
                      {QUESTION_TYPES.map((type) => <option key={type} value={type}>{t.types[type]}</option>)}
                    </Select>
                  )}
                </Field>
                <label className="flex min-h-10 items-center gap-2 text-sm font-semibold text-fg">
                  <input type="checkbox" checked={q.required} onChange={(e) => update(i, { required: e.target.checked })} className="size-4 accent-[var(--ops-accent)]" />
                  {t.required}
                </label>
                <div className="flex">
                  <IconButton label={t.up} icon={<ChevronUp size={18} />} disabled={i === 0} onClick={() => onChange(moveQuestion(value, i, -1))} />
                  <IconButton label={t.down} icon={<ChevronDown size={18} />} disabled={i === value.length - 1} onClick={() => onChange(moveQuestion(value, i, 1))} />
                  <IconButton label={t.remove} icon={<Trash2 size={18} />} onClick={() => onChange(value.filter((_, j) => j !== i))} />
                </div>
              </div>
            </div>

            <BilingualField
              name={`question-${q.id}`} label={t.label} value={q.label} onChange={(label) => update(i, { label })}
              labels={{ ...d.ui.bilingual }} error={err(errors[`q${i}.label`])}
            />

            {(q.type === "select" || q.type === "multi") && (
              <fieldset className="grid gap-2">
                <legend className="mb-1 text-sm font-bold text-fg">{t.options}</legend>
                {(q.options ?? []).map((o, j) => (
                  <div key={j} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-center gap-2">
                    <Input
                      aria-label={`${fill(t.option, { n: j + 1 })} · ${d.ui.bilingual.mn}`} lang="mn" value={o.mn}
                      aria-invalid={errors[`q${i}.options`] && !o.mn.trim() ? true : undefined}
                      onChange={(e) => update(i, { options: (q.options ?? []).map((x, k) => (k === j ? { ...x, mn: e.target.value } : x)) })}
                    />
                    <Input
                      aria-label={`${fill(t.option, { n: j + 1 })} · ${d.ui.bilingual.en}`} lang="en" value={o.en}
                      onChange={(e) => update(i, { options: (q.options ?? []).map((x, k) => (k === j ? { ...x, en: e.target.value } : x)) })}
                    />
                    <IconButton
                      label={`${t.removeOption}: ${fill(t.option, { n: j + 1 })}`} icon={<X size={16} />} disabled={(q.options ?? []).length <= 2}
                      onClick={() => update(i, { options: (q.options ?? []).filter((_, k) => k !== j) })}
                    />
                  </div>
                ))}
                {errors[`q${i}.options`] && <p className="text-sm font-semibold text-danger-fg">{err(errors[`q${i}.options`])}</p>}
                <div>
                  <Button size="sm" variant="secondary" icon={<Plus aria-hidden="true" size={14} />} disabled={(q.options ?? []).length >= 20} onClick={() => update(i, { options: [...(q.options ?? []), { mn: "", en: "" }] })}>
                    {t.addOption}
                  </Button>
                </div>
              </fieldset>
            )}
          </li>
        ))}
      </ol>

      <div>
        <Button variant="secondary" icon={<Plus aria-hidden="true" size={16} />} disabled={value.length >= MAX_QUESTIONS} onClick={() => onChange([...value, newQuestion(value.map((q) => q.id), "short")])}>
          {t.add}
        </Button>
      </div>
    </div>
  );
}
