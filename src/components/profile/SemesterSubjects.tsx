"use client";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition, type KeyboardEvent } from "react";
import { Loader2, X } from "lucide-react";
import type { MeCopy } from "@/i18n/areas/me";
import { fill, type Locale } from "@/i18n/config";
import { plural } from "@/i18n/plural";
import { setSemesterSubjectsAction } from "@/lib/me/profile-actions";
import type { SemesterVm } from "@/lib/me/profile-edit";
import { MAX_SUBJECTS, SUBJECT_MAX } from "@/lib/mockdb/academic";
import Button from "@/components/ui/Button";
import { controlClass } from "@/components/ui/Field";
import { cx } from "@/components/ui/cx";
import { useToast } from "@/components/me/Toast";

export type SemesterDraft = Pick<SemesterVm, "year" | "term" | "label" | "current"> & { subjects: string[]; shared: boolean };
export const sameSemester = (a: Pick<SemesterDraft, "subjects" | "shared">, b: Pick<SemesterDraft, "subjects" | "shared">) =>
  a.shared === b.shared && a.subjects.length === b.subjects.length && a.subjects.every((s, i) => s === b.subjects[i]);

/** Chip input: Enter or comma adds, Backspace on an empty box removes the last chip. Duplicates are ignored with a hint. */
export function ChipInput({ label, hint, subjects, onChange, c }: { label: string; hint: string; subjects: string[]; onChange: (next: string[]) => void; c: MeCopy["profile"] }) {
  const id = useId();
  const [text, setText] = useState("");
  const [note, setNote] = useState("");

  function add(raw: string) {
    const s = raw.trim();
    if (!s) { setText(""); return; }
    if (s.length > SUBJECT_MAX) { setNote(c.subjectLong); return; }
    if (subjects.some((x) => x.toLowerCase() === s.toLowerCase())) { setNote(fill(c.subjectDup, { subject: s })); setText(""); return; }
    if (subjects.length >= MAX_SUBJECTS) { setNote(c.subjectMax); return; }
    setNote("");
    setText("");
    onChange([...subjects, s]);
  }
  function key(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(text); }
    else if (e.key === "Backspace" && text === "" && subjects.length > 0) { e.preventDefault(); setNote(""); onChange(subjects.slice(0, -1)); }
  }
  return (
    <div className="grid gap-2">
      <label htmlFor={id} className="text-sm font-semibold text-fg">{label}</label>
      {subjects.length > 0 && (
        <ul aria-label={label} className="flex flex-wrap gap-2">
          {subjects.map((s) => (
            <li key={s} className="inline-flex min-h-11 max-w-full items-center gap-1 rounded-full bg-accent-soft pl-3.5 text-sm font-semibold text-accent-fg">
              <span className="[overflow-wrap:anywhere]">{s}</span>
              <button type="button" aria-label={fill(c.subjectRemove, { subject: s })} onClick={() => { setNote(""); onChange(subjects.filter((x) => x !== s)); }}
                className="grid size-11 shrink-0 cursor-pointer place-items-center rounded-full hover:bg-panel/60"><X aria-hidden="true" size={16} /></button>
            </li>
          ))}
        </ul>
      )}
      <input id={id} value={text} maxLength={SUBJECT_MAX + 20} onChange={(e) => { setText(e.target.value); setNote(""); }} onKeyDown={key} onBlur={() => add(text)}
        placeholder={c.subjectsPlaceholder} autoComplete="off" aria-describedby={`${id}-hint`} className={controlClass("min-h-11")} />
      <p id={`${id}-hint`} className="text-sm text-fg-muted">{hint}</p>
      <p role="status" className="text-sm font-semibold text-warn-fg empty:hidden">{note}</p>
    </div>
  );
}

function Switch({ label, sr, line, checked, onChange }: { label: string; sr: string; line: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex min-h-14 cursor-pointer items-center gap-3 py-1">
      <span className="grid flex-1 gap-0.5"><span className="font-semibold text-fg">{label}<span className="sr-only"> ({sr})</span></span><span className="text-sm text-fg-muted">{line}</span></span>
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
      <span aria-hidden="true" className="relative h-8 w-14 shrink-0 rounded-full bg-line-strong transition-colors duration-150 peer-checked:bg-accent peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent peer-checked:[&>span]:translate-x-6">
        <span className="absolute top-1 left-1 size-6 rounded-full bg-white shadow-sm transition-transform duration-150" />
      </span>
    </label>
  );
}

/**
 * One card per semester (the current one and the last three). Optional: nothing is shown to anyone until "Share on my
 * profile" is on, and then only to people the profile's visibility allows. Each card saves on its own.
 */
export default function SemesterSubjects({ lang, c, value, saved, onChange, onSaved }: {
  lang: Locale; c: MeCopy["profile"]; value: SemesterDraft[]; saved: SemesterDraft[];
  onChange: (index: number, next: SemesterDraft) => void; onSaved: (index: number, next: SemesterDraft) => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pendingIdx, setPendingIdx] = useState<number | null>(null);
  const [errors, setErrors] = useState<Record<number, string>>({});
  const [, start] = useTransition();

  function save(i: number) {
    const s = value[i];
    setPendingIdx(i);
    setErrors((e) => ({ ...e, [i]: "" }));
    start(async () => {
      const r = await setSemesterSubjectsAction(lang, { year: s.year, term: s.term, subjects: s.subjects, shared: s.shared });
      setPendingIdx(null);
      if (r.ok) { onSaved(i, { ...s, subjects: r.data.subjects, shared: r.data.shared }); toast(fill(c.subjectsSaved, { semester: s.label })); router.refresh(); }
      else setErrors((e) => ({ ...e, [i]: r.message }));
    });
  }

  return (
    <div className="grid gap-4">
      {value.map((s, i) => {
        const dirty = !sameSemester(s, saved[i]);
        const headingId = `sem-${s.year}-${s.term}`;
        return (
          <section key={headingId} aria-labelledby={headingId} className={cx("grid gap-3 rounded-[var(--radius-sm)] border p-4", s.current ? "border-line-strong bg-panel" : "border-line bg-panel-2")}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 id={headingId} className="text-base font-bold text-fg">{s.label}{s.current && <span className="ml-2 text-sm font-semibold text-accent-fg">{c.semCurrent}</span>}</h3>
              <span className="text-sm text-fg-muted tnum">{plural(lang, s.subjects.length, c.subjectsCount)}</span>
            </div>
            <ChipInput label={fill(c.subjectsLabel, { semester: s.label })} hint={c.subjectsHint} subjects={s.subjects} c={c} onChange={(subjects) => onChange(i, { ...s, subjects })} />
            {s.subjects.length === 0 && <p className="text-sm text-fg-muted">{c.subjectsEmpty}</p>}
            <Switch label={c.shareLabel} sr={s.label} line={s.shared ? c.shareOn : c.shareOff} checked={s.shared} onChange={(shared) => onChange(i, { ...s, shared })} />
            <div className="flex flex-wrap items-center gap-3">
              <Button type="button" size="lg" variant={dirty ? "primary" : "secondary"} disabled={!dirty || pendingIdx !== null} aria-busy={pendingIdx === i} onClick={() => save(i)}
                icon={pendingIdx === i ? <Loader2 aria-hidden="true" size={16} className="motion-safe:animate-spin" /> : undefined}>{c.subjectsSave}<span className="sr-only"> ({s.label})</span></Button>
              <p role="alert" className="text-sm font-semibold text-danger-fg empty:hidden">{errors[i]}</p>
            </div>
          </section>
        );
      })}
    </div>
  );
}
