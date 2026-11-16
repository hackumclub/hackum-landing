"use client";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import type { MeCopy } from "@/i18n/areas/me";
import { switchLocale, type L, type Locale } from "@/i18n/config";
import { completeOnboardingAction } from "@/lib/me/actions";
import BilingualField from "@/components/ui/BilingualField";
import Button from "@/components/ui/Button";
import Field, { Input, Select } from "@/components/ui/Field";
import { cx } from "@/components/ui/cx";
import Sticker from "@/components/Sticker";
import { useFocusFirstError } from "./focus";

type Errors = Partial<Record<"name" | "school" | "gradYear" | "form", string>>;

/** First-run profile: name (Mongolian required, English optional), school, graduation year, language. */
export default function OnboardingForm({ lang, c, bilingual, next, initial }: {
  lang: Locale; c: MeCopy["onboarding"]; bilingual: { mn: string; en: string; copy: string; enMissing: string }; next: string;
  initial: { mn: string; en: string; school: string; gradYear: number };
}) {
  const router = useRouter();
  const form = useRef<HTMLFormElement>(null);
  const [name, setName] = useState<L>({ mn: initial.mn, en: initial.en });
  const [school, setSchool] = useState(initial.school);
  const [year, setYear] = useState(String(initial.gradYear));
  const [locale, setLocale] = useState<Locale>(lang);
  const [errors, setErrors] = useState<Errors>({});
  const [pending, start] = useTransition();
  useFocusFirstError(form, errors);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const found: Errors = {};
    if (!name.mn.trim()) found.name = c.errName;
    if (school.trim().length < 1 || school.trim().length > 80) found.school = c.errSchool;
    const y = Number(year);
    if (!Number.isInteger(y) || y < 2000 || y > 2040) found.gradYear = c.errYear;
    setErrors(found);
    if (Object.keys(found).length) return;
    start(async () => {
      const r = await completeOnboardingAction({ name: { mn: name.mn.trim(), en: name.en.trim() }, school: school.trim(), grad_year: y, locale });
      if (r.ok) router.replace(switchLocale(next, locale));
      else setErrors({ form: r.error === "unauthenticated" ? c.errLogin : r.error === "invalid" ? c.errSchool : c.errLogin });
    });
  }

  const years = Array.from({ length: 41 }, (_, i) => 2000 + i);
  return (
    <form ref={form} onSubmit={submit} noValidate className="grid gap-5 rounded-[var(--radius-md)] border border-line bg-panel p-5 md:p-6">
      <div className="flex items-center gap-4">
        <Sticker name="wave" label={c.wave} className="w-20 shrink-0" sizes="80px" eager />
        <div className="grid gap-1">
          <h1 className="font-display text-2xl font-bold text-fg">{c.title}</h1>
          <p className="text-sm text-fg-muted">{c.lead}</p>
        </div>
      </div>

      <BilingualField name="name" label={c.name} value={name} onChange={setName} labels={bilingual} error={errors.name} />
      <Field label={c.school} required hint={c.schoolHint} error={errors.school}>
        {(ctl) => <Input {...ctl} name="school" autoComplete="organization" value={school} onChange={(e) => setSchool(e.target.value)} className="min-h-11" />}
      </Field>
      <Field label={c.gradYear} required hint={c.gradYearHint} error={errors.gradYear}>
        {(ctl) => <Select {...ctl} name="grad_year" value={year} onChange={(e) => setYear(e.target.value)} className="min-h-11">{years.map((y) => <option key={y} value={y}>{y}</option>)}</Select>}
      </Field>
      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-semibold text-fg">{c.language}</legend>
        <div className="grid grid-cols-2 gap-2">
          {(["mn", "en"] as const).map((l) => (
            <label key={l} className={cx("flex min-h-11 cursor-pointer items-center justify-center rounded-[var(--radius-sm)] border px-3 text-sm font-semibold has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent", locale === l ? "border-accent bg-accent-soft text-accent-fg" : "border-line bg-panel-2 text-fg")}>
              <input type="radio" name="locale" value={l} checked={locale === l} onChange={() => setLocale(l)} className="sr-only" />
              {l === "mn" ? c.langMn : c.langEn}
            </label>
          ))}
        </div>
      </fieldset>

      <p role="alert" className="text-sm font-semibold text-danger-fg empty:hidden">{errors.form}</p>
      <Button type="submit" size="lg" disabled={pending} aria-busy={pending}>{pending ? c.saving : c.submit}</Button>
    </form>
  );
}
