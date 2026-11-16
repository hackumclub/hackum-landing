"use client";
import { useState } from "react";
import type { Locale } from "@/i18n/config";
import { copy } from "@/i18n/areas/admin-events";
import type { Answers, Question } from "@/lib/events/questions";
import QuestionFields from "@/components/forms/QuestionFields";

/** What the person filling the form sees: the real `QuestionFields` on the questions being edited. Answers stay in this tab. */
export default function FormPreview({ lang, questions }: { lang: Locale; questions: Question[] }) {
  const t = copy[lang].forms.editor;
  const [answers, setAnswers] = useState<Answers>({});
  return (
    <aside aria-labelledby="form-preview-title" className="grid content-start gap-3 rounded-[var(--radius-md)] border border-line bg-panel p-4 xl:sticky xl:top-20 xl:self-start">
      <div className="grid gap-1">
        <h2 id="form-preview-title" className="font-display text-lg font-bold text-fg">{t.previewTitle}</h2>
        <p className="text-sm text-fg-muted">{t.previewHint}</p>
      </div>
      {questions.length === 0 ? (
        <p className="rounded-[var(--radius-sm)] border border-dashed border-line px-3 py-4 text-sm text-fg-muted">{t.previewEmpty}</p>
      ) : (
        <QuestionFields questions={questions} answers={answers} onChange={setAnswers} lang={lang} />
      )}
    </aside>
  );
}
