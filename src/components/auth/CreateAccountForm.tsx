"use client";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import QuestionFields, { validateAnswers } from "@/components/forms/QuestionFields";
import SchoolMajorFields from "@/components/profile/SchoolMajorFields";
import Button from "@/components/ui/Button";
import Field, { Input, Textarea } from "@/components/ui/Field";
import { copy } from "@/i18n/areas/public";
import { fill, href, type Locale } from "@/i18n/config";
import type { Answers, Question } from "@/lib/events/questions";
import type { AcademicInput } from "@/lib/mockdb/academic";
import type { JoinFieldErrors } from "@/lib/mockdb/ext-join";
import { createAccountAction, startJoinAction, type JoinFormInput } from "@/lib/server/auth-actions";
import CodeField from "./CodeField";
import DevCodeBox from "./DevCodeBox";
import { codeErrorKey, sendErrorKey } from "./errors";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const START: AcademicInput = { school_id: "num", school_name: "", major_track: "other", program_index: null, major_label: "" };

type Props = {
  lang: Locale;
  joinQuestions: Question[];
  membershipQuestions: Question[];
  /** A membership season is accepting applications right now (read on the server, per request). */
  applicationsOpen: boolean;
  next?: string | null;
};

/** NUM student who has said what they study: the only person who can also apply for membership while joining. */
const hasMajor = (a: AcademicInput) => a.school_id === "num" && (a.major_track !== "other" || a.major_label.trim() !== "" || !!a.program_index);

/**
 * "Join Hackum": one real form. Step 1 collects name, email, school/major, the club's own questions and (for NUM students)
 * an optional membership application; step 2 confirms the email with a code and creates the account in one server call.
 */
export default function CreateAccountForm({ lang, joinQuestions, membershipQuestions, applicationsOpen, next }: Props) {
  const c = copy[lang].join;
  const fe = c.fieldErrors;
  const formRef = useRef<HTMLFormElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<"form" | "code">("form");
  const [nameMn, setNameMn] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [email, setEmail] = useState("");
  const [academic, setAcademic] = useState<AcademicInput>(START);
  const [answers, setAnswers] = useState<Answers>({});
  const [motivation, setMotivation] = useState("");
  const [membershipAnswers, setMembershipAnswers] = useState<Answers>({});
  const [errors, setErrors] = useState<JoinFieldErrors>({});
  const [formError, setFormError] = useState<string>();
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState<string>();
  const [devCode, setDevCode] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [focusTick, setFocusTick] = useState(0);

  const canApply = hasMajor(academic);
  const applying = canApply && applicationsOpen && motivation.trim().length > 0;
  const notice = academic.school_id !== "num" ? "guest" : canApply ? "num" : "unknown";

  const payload = useMemo((): JoinFormInput => ({
    lang, email: email.trim(), name: { mn: nameMn, en: nameEn }, academic, answers,
    motivation: canApply && applicationsOpen ? motivation : "", team_interest: [], membership_answers: membershipAnswers, next,
  }), [lang, email, nameMn, nameEn, academic, answers, motivation, canApply, applicationsOpen, membershipAnswers, next]);

  // After a failed submit, move focus to the first invalid control (a group's first input when the group is invalid).
  useEffect(() => {
    if (focusTick === 0) return;
    const bad = formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]');
    (bad?.tagName === "FIELDSET" ? bad.querySelector<HTMLElement>("input") : bad)?.focus();
  }, [focusTick]);
  useEffect(() => { if (step === "code") codeRef.current?.focus(); }, [step]);

  const clientCheck = (): JoinFieldErrors => {
    const e: JoinFieldErrors = {};
    if (!nameMn.trim() && !nameEn.trim()) e.name = "required";
    if (!EMAIL.test(email.trim())) e.email = "invalid";
    if (academic.school_id === "other" && !academic.school_name.trim()) e.school_name = "required";
    const a = validateAnswers(joinQuestions, answers);
    if (Object.keys(a).length) e.answers = a;
    if (applying) {
      const m = motivation.trim();
      if (m.length < 10) e.motivation = "too_short";
      else if (m.length > 1000) e.motivation = "too_long";
      const x = validateAnswers(membershipQuestions, membershipAnswers);
      if (Object.keys(x).length) e.membership_answers = x;
    }
    return e;
  };
  const hasErrors = (e: JoinFieldErrors) => Object.keys(e).length > 0;

  const submit = () => {
    setFormError(undefined);
    const local = clientCheck();
    setErrors(local);
    if (hasErrors(local)) { setFormError(c.fixErrors); setFocusTick((n) => n + 1); return; }
    start(async () => {
      const r = await startJoinAction(payload);
      if (!r.ok) {
        if (r.fields) { setErrors(r.fields); setFormError(c.fixErrors); setFocusTick((n) => n + 1); }
        else setFormError(copy[lang].auth.errors[sendErrorKey(r.error)]);
        return;
      }
      setDevCode(r.devCode ?? null);
      setCode("");
      setCodeError(undefined);
      setStep("code");
    });
  };

  const create = () => {
    if (!/^\d{6}$/.test(code)) { setCodeError(copy[lang].auth.errors.codeRequired); codeRef.current?.focus(); return; }
    setCodeError(undefined);
    start(async () => {
      const r = await createAccountAction({ ...payload, code });
      if (r.fields) { setErrors(r.fields); setStep("form"); setFormError(c.fixErrors); setFocusTick((n) => n + 1); return; }
      setCodeError(copy[lang].auth.errors[codeErrorKey(r.error)]);
      codeRef.current?.focus();
    });
  };

  const resend = () => {
    start(async () => {
      const r = await startJoinAction(payload);
      if (!r.ok) { setCodeError(copy[lang].auth.errors[sendErrorKey(r.error)]); return; }
      setDevCode(r.devCode ?? null);
      setCode("");
      setCodeError(undefined);
      codeRef.current?.focus();
    });
  };

  const shell = "grid gap-6 rounded-[28px] border border-line bg-panel p-6 shadow-[var(--shadow-card)] sm:p-8";
  const section = "grid gap-4 border-0 p-0";
  const legend = "mb-1 p-0 font-display text-lg font-black text-fg";
  const signInHref = next ? `${href(lang, "/sign-in")}?next=${encodeURIComponent(next)}` : href(lang, "/sign-in");

  if (step === "code") {
    return (
      <form noValidate onSubmit={(e) => { e.preventDefault(); create(); }} className={shell}>
        <div className="grid gap-2">
          <h2 className="font-display text-2xl font-black text-fg">{c.codeTitle}</h2>
          <p className="text-fg-muted">{fill(c.codeLead, { email: email.trim() })}</p>
        </div>
        <CodeField ref={codeRef} label={c.codeLabel} error={codeError} value={code} onChange={setCode} />
        {devCode && <DevCodeBox code={devCode} text={c.devCode} note={c.devNote} />}
        <Button type="submit" size="lg" disabled={pending} className="w-full">{pending ? c.creating : c.create}</Button>
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <button type="button" disabled={pending} onClick={resend} className="min-h-11 cursor-pointer font-semibold text-accent-fg underline decoration-2 underline-offset-4">{c.resend}</button>
          <button type="button" onClick={() => setStep("form")} className="min-h-11 cursor-pointer font-semibold text-fg-muted underline decoration-2 underline-offset-4">{c.back}</button>
        </div>
      </form>
    );
  }

  const academicErrors: Partial<Record<keyof AcademicInput, string>> = {};
  for (const k of ["school_id", "school_name", "major_track", "major_label"] as const) if (errors[k]) academicErrors[k] = fe[errors[k]!] ?? fe.invalid;

  return (
    <form ref={formRef} noValidate onSubmit={(e) => { e.preventDefault(); submit(); }} className={shell}>
      <div className="grid gap-3">
        <p className="text-sm font-bold text-fg-muted">{c.kicker}</p>
        <h1 className="font-display text-[clamp(28px,4vw,38px)] leading-tight font-black text-fg [overflow-wrap:anywhere]">{c.title}</h1>
        <p className="text-fg-muted">{c.lead}</p>
        <p className="text-sm text-fg-muted">{c.signInPrompt}{" "}<Link href={signInHref} className="inline-flex min-h-11 items-center font-bold text-accent-fg underline decoration-2 underline-offset-4">{c.signInLink}</Link></p>
      </div>
      {formError && <p role="alert" className="rounded-[var(--radius-md)] bg-danger-soft px-4 py-3 text-sm font-semibold text-danger-fg">{formError}</p>}

      <fieldset className={section}>
        <legend className={legend}>{c.aboutYou}</legend>
        <Field label={c.nameMn} hint={c.nameMnHint} error={errors.name ? fe[errors.name] ?? fe.invalid : undefined} required>
          {(ctl) => <Input {...ctl} name="name_mn" autoComplete="name" maxLength={80} className="min-h-11" value={nameMn} onChange={(e) => setNameMn(e.target.value)} />}
        </Field>
        <Field label={c.nameEn}>
          {(ctl) => <Input {...ctl} name="name_en" autoComplete="off" maxLength={80} className="min-h-11" value={nameEn} onChange={(e) => setNameEn(e.target.value)} />}
        </Field>
        <Field label={c.email} hint={c.emailHint} error={errors.email ? c.emailInvalid : undefined} required>
          {(ctl) => <Input {...ctl} name="email" type="email" autoComplete="email" inputMode="email" maxLength={254} className="min-h-11" value={email} onChange={(e) => setEmail(e.target.value)} />}
        </Field>
      </fieldset>

      <fieldset className={section}>
        <legend className={legend}>{c.school}</legend>
        <SchoolMajorFields value={academic} onChange={setAcademic} lang={lang} errors={academicErrors} />
      </fieldset>

      {joinQuestions.length > 0 && (
        <fieldset className={section}>
          <legend className={legend}>{c.questions}</legend>
          <QuestionFields questions={joinQuestions} answers={answers} onChange={setAnswers} errors={errors.answers} lang={lang} />
        </fieldset>
      )}

      {canApply && (
        <fieldset className={section}>
          <legend className={legend}>{c.membership}</legend>
          {applicationsOpen ? (
            <>
              <p className="text-sm text-fg-muted">{c.membershipLead}</p>
              <Field label={c.motivation} hint={c.motivationHint} error={errors.motivation ? fe[errors.motivation] ?? fe.invalid : undefined}>
                {(ctl) => <Textarea {...ctl} name="motivation" maxLength={1000} value={motivation} onChange={(e) => setMotivation(e.target.value)} />}
              </Field>
              {applying && membershipQuestions.length > 0 && (
                <QuestionFields questions={membershipQuestions} answers={membershipAnswers} onChange={setMembershipAnswers} errors={errors.membership_answers} lang={lang} />
              )}
            </>
          ) : <p className="rounded-[var(--radius-sm)] bg-accent-soft px-3 py-2 text-sm text-fg">{c.membershipClosed}</p>}
        </fieldset>
      )}

      {/* Said before the button, in a live region, so nobody finds out after submitting that they join as a guest. */}
      <div aria-live="polite" data-join-notice={notice}>
        {notice === "guest" && (
          <div className="grid gap-1 rounded-[var(--radius-md)] border border-line-strong bg-warn-soft px-4 py-3 text-sm text-fg">
            <p className="font-bold">{c.guestTitle}</p>
            <p>{c.guestBody}</p>
          </div>
        )}
        {notice === "num" && <p className="rounded-[var(--radius-md)] bg-accent-soft px-4 py-3 text-sm text-fg">{c.guestNum}</p>}
        {notice === "unknown" && <p className="rounded-[var(--radius-md)] bg-accent-soft px-4 py-3 text-sm text-fg">{c.guestUnknown}</p>}
      </div>

      <Button type="submit" size="lg" disabled={pending} className="w-full">{pending ? c.sending : c.submit}</Button>
    </form>
  );
}
