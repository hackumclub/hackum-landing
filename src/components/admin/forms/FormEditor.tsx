"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { CheckCircle2 } from "lucide-react";
import { type Locale } from "@/i18n/config";
import { copy } from "@/i18n/areas/admin-events";
import { plural } from "@/i18n/plural";
import { validateQuestions } from "@/lib/events/admin-form";
import type { Question } from "@/lib/events/questions";
import { updateFormAction } from "@/lib/forms/actions";
import Button from "@/components/ui/Button";
import QuestionBuilder from "@/components/admin/events/QuestionBuilder";
import { useToast } from "@/components/admin/events/Toast";
import FormPreview from "./FormPreview";

/**
 * Editor for the membership and join forms: the same question rows the event form uses, a live preview of what the
 * person filling the form sees, and one Save. Question ids are generated (q1, q2, …) and never reused, so renaming or
 * removing a question can never attach somebody's old answer to a different one.
 */
export default function FormEditor({ lang, formId, initial, answered, reservedIds }: {
  lang: Locale; formId: "membership_application" | "join"; initial: Question[]; answered: number; reservedIds: string[];
}) {
  const t = copy[lang].forms.editor;
  const router = useRouter();
  const [pending, start] = useTransition();
  const { show, node } = useToast(copy[lang].regs.toast.close);
  const formRef = useRef<HTMLFormElement>(null);
  const [qs, setQs] = useState<Question[]>(initial);
  const [baseline, setBaseline] = useState(() => JSON.stringify(initial));
  const [attempted, setAttempted] = useState(false);
  const [tick, setTick] = useState(0);
  const dirty = JSON.stringify(qs) !== baseline;
  const errors = attempted ? validateQuestions(qs) : {};
  const errorCount = Object.keys(errors).length;

  useEffect(() => {
    if (tick > 0) formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [tick]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAttempted(true);
    if (Object.keys(validateQuestions(qs)).length > 0) { setTick((n) => n + 1); return; }
    const snapshot = JSON.stringify(qs);
    start(async () => {
      const r = await updateFormAction(formId, qs);
      if (r.ok) { setBaseline(snapshot); setAttempted(false); show(t.saved); router.refresh(); }
      else show(t.server[r.error] ?? t.server.generic, "error");
    });
  };

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
      <form ref={formRef} noValidate onSubmit={onSubmit} className="grid min-w-0 gap-4">
        <section aria-labelledby="form-editor-title" className="grid gap-4 rounded-[var(--radius-md)] border border-line bg-panel p-4 md:p-5">
          <div className="grid gap-1">
            <h2 id="form-editor-title" className="font-display text-lg font-bold text-fg">{t.title}</h2>
            <p className="text-sm text-fg-muted">{t.line}</p>
          </div>
          {answered > 0 && <p role="note" className="rounded-[var(--radius-sm)] border border-line bg-warn-soft px-3 py-2 text-sm text-warn-fg">{plural(lang, answered, t.answered)}</p>}
          <QuestionBuilder lang={lang} value={qs} onChange={setQs} errors={errors} answered={answered} reservedIds={reservedIds} showAnswered={false} />
        </section>

        <div data-testid="form-bar" className="sticky bottom-3 z-20 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-[var(--radius-md)] border border-line bg-panel p-3 shadow-[var(--shadow-float)]">
          <div className="grid min-w-0 gap-0.5">
            <p role="status" className="text-sm font-semibold text-danger-fg">{attempted && errorCount > 0 ? plural(lang, errorCount, t.errorSummary) : ""}</p>
            {!(attempted && errorCount > 0) && (dirty
              ? <p className="flex items-center gap-2 text-sm font-semibold text-fg"><span aria-hidden="true" className="size-2.5 rounded-full bg-warn-fg" />{t.unsaved}</p>
              : <p className="flex items-center gap-2 text-sm text-fg-muted"><CheckCircle2 aria-hidden="true" size={16} />{t.allSaved}</p>)}
          </div>
          <Button type="submit" disabled={pending || !dirty} title={!dirty ? t.noChanges : undefined}>{pending ? t.saving : t.save}</Button>
        </div>
      </form>

      <FormPreview lang={lang} questions={qs} />
      {node}
    </div>
  );
}
