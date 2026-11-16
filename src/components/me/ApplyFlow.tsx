"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import { ArrowLeft, Check, Loader2, Pencil } from "lucide-react";
import type { MeCopy } from "@/i18n/areas/me";
import { fill, tf, type Locale } from "@/i18n/config";
import { LONG_MAX, parseAnswers, SHORT_MAX, URL_MAX, type Answers, type Question } from "@/lib/events/questions";
import { applyToEvent } from "@/lib/me/actions";
import { checkTeamCode } from "@/lib/me/actions-extra";
import Button, { ButtonLink } from "@/components/ui/Button";
import Field, { Input, Select, Textarea } from "@/components/ui/Field";
import { cx } from "@/components/ui/cx";
import Sticker from "@/components/Sticker";
import CopyButton from "./CopyButton";
import { useFocusFirstError } from "./focus";

type Step = "answers" | "team" | "review";
type TeamMode = "none" | "optional" | "required";
type Team = { mode: "create" | "join" | "solo"; name: string; code: string };
type CodeResult = Awaited<ReturnType<typeof checkTeamCode>>;
type Done = { status: string; teamId?: string; inviteCode?: string };

const CODE_SHAPE = /^[A-Z0-9-]{3,16}$/;
const maxFor = (q: Question) => (q.type === "long" ? LONG_MAX : q.type === "url" ? URL_MAX : SHORT_MAX);

/** Hackathon application: answers → team → review → success. Mirrors parseAnswers on the client; maps every server error to specific copy. */
export default function ApplyFlow({ lang, eventId, slug, title, questions, teamMode, min, max, deadline, prefillCode, c, errorsCopy, signInHref, statusSlot }: {
  lang: Locale; eventId: string; slug: string; title: string; questions: Question[]; teamMode: TeamMode; min: number; max: number;
  deadline: string | null; prefillCode: string | null; c: MeCopy["apply"]; errorsCopy: MeCopy["errors"]; signInHref: string;
  /** When the person already has a registration the page passes its status view; a just-finished local success still wins over it. */
  statusSlot?: ReactNode;
}) {
  const steps = useMemo<Step[]>(() => [...(questions.length ? ["answers" as const] : []), ...(teamMode !== "none" ? ["team" as const] : []), "review"], [questions.length, teamMode]);
  const [idx, setIdx] = useState(0);
  const step = steps[idx];
  const [answers, setAnswers] = useState<Answers>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [team, setTeam] = useState<Team>({ mode: prefillCode ? "join" : teamMode === "required" ? "create" : "solo", name: "", code: prefillCode ?? "" });
  const [teamErrors, setTeamErrors] = useState<{ name?: string; code?: string }>({});
  const [codeCheck, setCodeCheck] = useState<{ code: string; res: CodeResult } | null>(null);
  const [topError, setTopError] = useState<string | null>(null);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [done, setDone] = useState<Done | null>(null);
  const [pending, start] = useTransition();
  const form = useRef<HTMLFormElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const moved = useRef(false);

  const errorSet = useMemo(() => ({ ...fieldErrors, ...teamErrors }), [fieldErrors, teamErrors]);
  // Declared before the error-focus hook so a step change lands on the heading first and a failed submit then moves to the first error.
  useEffect(() => { if (moved.current) heading.current?.focus(); moved.current = true; }, [idx, done]);
  useFocusFirstError(form, errorSet);

  // Live code check: debounce, then ask the server. State is derived (a stale result for an older code is ignored).
  const normalized = team.code.trim().toUpperCase();
  const shaped = CODE_SHAPE.test(normalized);
  useEffect(() => {
    if (team.mode !== "join" || !shaped) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      const res = await checkTeamCode({ eventId, code: normalized });
      if (!cancelled) setCodeCheck({ code: normalized, res });
    }, 350);
    return () => { cancelled = true; clearTimeout(t); };
  }, [team.mode, shaped, normalized, eventId]);
  const checked = codeCheck && codeCheck.code === normalized ? codeCheck.res : null;
  const codeMsg: { tone: "idle" | "busy" | "ok" | "bad"; text: string } = (() => {
    if (team.mode !== "join" || !normalized) return { tone: "idle", text: "" };
    if (!shaped) return { tone: "bad", text: c.codeInvalid };
    if (!checked) return { tone: "busy", text: c.codeChecking };
    if (checked.ok) return { tone: "ok", text: fill(c.codeOk, checked.data) };
    switch (checked.error) {
      case "not_found": return { tone: "bad", text: c.codeNotFound };
      case "closed": return { tone: "bad", text: c.codeClosed };
      case "full": return { tone: "bad", text: fill(c.codeFull, { max }) };
      case "invalid": return { tone: "bad", text: c.codeInvalid };
      case "unauthenticated": return { tone: "bad", text: errorsCopy.unauthenticated };
      default: return { tone: "bad", text: c.err.server };
    }
  })();

  const label = (q: Question) => tf(q.label, lang);
  const setAnswer = (id: string, v: string | string[] | boolean) => setAnswers((a) => ({ ...a, [id]: v }));
  const qMessage = (q: Question, code: string) => fill(c.q[code as keyof typeof c.q] ?? c.q.invalid, { label: label(q), max: maxFor(q) });

  function validateAnswers(): boolean {
    const r = parseAnswers(questions, answers);
    setFieldErrors(r.ok ? {} : r.errors);
    return r.ok;
  }
  function validateTeam(): boolean {
    const e: { name?: string; code?: string } = {};
    if (team.mode === "create" && (team.name.trim().length < 2 || team.name.trim().length > 40)) e.name = c.teamNameErr;
    if (team.mode === "join") {
      if (!normalized) e.code = c.codeNeeded;
      else if (codeMsg.tone !== "ok") e.code = codeMsg.tone === "busy" ? c.codeUnchecked : codeMsg.text;
    }
    setTeamErrors(e);
    return Object.keys(e).length === 0;
  }

  const teamChoice = () =>
    teamMode === "none" ? undefined
      : team.mode === "create" ? ({ mode: "create", name: team.name.trim() } as const)
        : team.mode === "join" ? ({ mode: "join", code: normalized } as const)
          : ({ mode: "solo" } as const);

  function submit() {
    setTopError(null);
    setNeedsLogin(false);
    start(async () => {
      const r = await applyToEvent({ eventId, answers, team: teamChoice() });
      if (r.ok) { setDone(r.data); return; }
      if (r.error === "invalid" && "fields" in r) {
        setFieldErrors(r.fields);
        setIdx(steps.indexOf("answers") >= 0 ? steps.indexOf("answers") : 0);
        return;
      }
      const goTeam = () => { const i = steps.indexOf("team"); if (i >= 0) setIdx(i); };
      switch (r.error) {
        case "invalid": goTeam(); setTeamErrors(team.mode === "create" ? { name: c.teamNameErr } : {}); setTopError(c.err.invalid); break;
        case "conflict":
          if (team.mode === "create") { goTeam(); setTeamErrors({ name: c.teamNameTaken }); } else setTopError(c.err.conflict);
          break;
        case "not_found": if (team.mode === "join") { goTeam(); setTeamErrors({ code: c.codeNotFound }); } else setTopError(c.err.not_found); break;
        case "full": if (team.mode === "join") { goTeam(); setTeamErrors({ code: fill(c.codeFull, { max }) }); } else setTopError(c.err.full); break;
        case "unauthenticated": setNeedsLogin(true); setTopError(c.err.unauthenticated); break;
        case "closed": case "forbidden": case "rate_limited": setTopError(c.err[r.error]); break;
        default: setTopError(c.err.server);
      }
    });
  }

  function advance() {
    setTopError(null);
    if (step === "answers" && !validateAnswers()) return;
    if (step === "team" && !validateTeam()) return;
    if (step === "review") { submit(); return; }
    setIdx((i) => i + 1);
  }

  if (done) return <Success lang={lang} slug={slug} title={title} done={done} deadline={deadline} c={c} headingRef={heading} />;
  if (statusSlot) return <>{statusSlot}</>;

  const errorCount = Object.keys(fieldErrors).length;
  return (
    <form ref={form} noValidate onSubmit={(e) => { e.preventDefault(); advance(); }} className="grid gap-5">
      <div className="grid gap-2">
        <p className="text-sm font-semibold text-fg-muted tnum">{fill(c.stepOf, { n: idx + 1, total: steps.length })} · {c.steps[step]}</p>
        <div aria-hidden="true" className="h-1.5 overflow-hidden rounded-full bg-neutral-soft"><div className="h-full rounded-full bg-accent transition-[width] duration-200" style={{ width: `${((idx + 1) / steps.length) * 100}%` }} /></div>
      </div>
      <h1 ref={heading} tabIndex={-1} className="font-display text-2xl font-bold text-fg outline-none">{title}</h1>

      {step === "answers" && (
        <div className="grid gap-4 rounded-[var(--radius-md)] border border-line bg-panel p-4 md:p-5">
          <div className="grid gap-1"><h2 className="font-display text-lg font-bold text-fg">{c.answersTitle}</h2><p className="text-sm text-fg-muted">{c.answersLine}</p></div>
          {errorCount > 0 && <p role="alert" className="rounded-[var(--radius-sm)] bg-danger-soft px-3 py-2 text-sm font-bold text-danger-fg">{fill(c.errorsTitle, { n: errorCount })}</p>}
          {questions.map((q) => (
            <QuestionField key={q.id} q={q} lang={lang} value={answers[q.id]} error={fieldErrors[q.id] ? qMessage(q, fieldErrors[q.id]) : undefined} onChange={(v) => setAnswer(q.id, v)} c={c} />
          ))}
        </div>
      )}

      {step === "team" && (
        <fieldset className="grid gap-4 rounded-[var(--radius-md)] border border-line bg-panel p-4 md:p-5">
          <legend className="sr-only">{c.teamTitle}</legend>
          <div className="grid gap-1">
            <h2 className="font-display text-lg font-bold text-fg">{c.teamTitle}</h2>
            <p className="text-sm text-fg-muted">{fill(c.teamLine, { min, max })} {teamMode === "required" ? c.teamRequired : c.teamOptional}</p>
          </div>
          <div role="radiogroup" aria-label={c.teamTitle} className="grid gap-2 sm:grid-cols-3">
            {(["create", "join", ...(teamMode === "optional" ? ["solo" as const] : [])] as const).map((m) => (
              <label key={m} className={cx("flex min-h-11 cursor-pointer items-center justify-center rounded-[var(--radius-sm)] border px-3 text-center text-sm font-semibold has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent", team.mode === m ? "border-accent bg-accent-soft text-accent-fg" : "border-line-strong text-fg")}>
                <input type="radio" name="team-mode" value={m} checked={team.mode === m} onChange={() => { setTeam((t) => ({ ...t, mode: m })); setTeamErrors({}); }} className="sr-only" />
                {m === "create" ? c.teamCreate : m === "join" ? c.teamJoin : c.teamSolo}
              </label>
            ))}
          </div>
          {team.mode === "create" && (
            <Field label={c.teamName} required hint={c.teamNameHint} error={teamErrors.name}>
              {(ctl) => <Input {...ctl} name="team_name" autoComplete="off" value={team.name} onChange={(e) => { setTeam({ ...team, name: e.target.value }); setTeamErrors({}); }} className="min-h-11" />}
            </Field>
          )}
          {team.mode === "join" && (
            <div className="grid gap-1.5">
              <Field label={c.teamCode} required hint={c.teamCodeHint} error={teamErrors.code}>
                {(ctl) => <Input {...ctl} name="team_code" autoComplete="off" autoCapitalize="characters" spellCheck={false} value={team.code} onChange={(e) => { setTeam({ ...team, code: e.target.value }); setTeamErrors({}); }} className="min-h-11 tnum" />}
              </Field>
              <p role="status" className={cx("flex min-h-5 items-center gap-1.5 text-sm font-semibold", codeMsg.tone === "ok" ? "text-ok-fg" : codeMsg.tone === "bad" ? "text-danger-fg" : "text-fg-muted")}>
                {codeMsg.tone === "busy" && <Loader2 aria-hidden="true" size={14} className="motion-safe:animate-spin" />}
                {codeMsg.tone === "ok" && <Check aria-hidden="true" size={14} />}
                {codeMsg.text}
              </p>
            </div>
          )}
          {team.mode === "solo" && <p className="text-sm text-fg-muted">{c.soloLine}</p>}
        </fieldset>
      )}

      {step === "review" && (
        <div className="grid gap-4 rounded-[var(--radius-md)] border border-line bg-panel p-4 md:p-5">
          <div className="grid gap-1"><h2 className="font-display text-lg font-bold text-fg">{c.reviewTitle}</h2><p className="text-sm text-fg-muted">{c.reviewLine}</p></div>
          <dl className="grid gap-3">
            {questions.map((q) => (
              <div key={q.id} className="grid gap-0.5">
                <dt className="text-sm font-semibold text-fg-muted">{label(q)}</dt>
                <dd className="text-sm whitespace-pre-wrap text-fg">{answerText(q, answers[q.id], lang, c)}</dd>
              </div>
            ))}
            {teamMode !== "none" && (
              <div className="grid gap-0.5">
                <dt className="text-sm font-semibold text-fg-muted">{c.reviewTeam}</dt>
                <dd className="text-sm text-fg">{team.mode === "create" ? fill(c.reviewNewTeam, { name: team.name.trim() }) : team.mode === "join" ? fill(c.reviewJoinTeam, { code: normalized }) : c.reviewNoTeam}</dd>
              </div>
            )}
          </dl>
          {steps.length > 1 && <div className="flex gap-2">{steps.slice(0, -1).map((s, i) => <Button key={s} type="button" variant="ghost" size="lg" icon={<Pencil aria-hidden="true" size={14} />} onClick={() => setIdx(i)}>{c.reviewEdit}: {c.steps[s]}</Button>)}</div>}
        </div>
      )}

      {topError && (
        <p role="alert" className="rounded-[var(--radius-sm)] bg-danger-soft px-3 py-2 text-sm font-bold text-danger-fg">
          {topError} {needsLogin && <Link href={signInHref} className="underline">{errorsCopy.unauthenticated}</Link>}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {idx > 0 && <Button type="button" variant="secondary" size="lg" icon={<ArrowLeft aria-hidden="true" size={16} />} onClick={() => { setTopError(null); setIdx((i) => i - 1); }}>{c.back}</Button>}
        <Button type="submit" size="lg" disabled={pending} aria-busy={pending} className="flex-1 sm:flex-none">{step === "review" ? (pending ? c.submitting : c.submit) : c.next}</Button>
      </div>
    </form>
  );
}

function answerText(q: Question, v: Answers[string] | undefined, lang: Locale, c: MeCopy["apply"]): string {
  if (q.type === "checkbox") return v === true ? c.yes : c.no;
  if (q.type === "select") return typeof v === "string" && q.options?.[Number(v)] ? tf(q.options[Number(v)], lang) : c.noAnswer;
  if (q.type === "multi") return Array.isArray(v) && v.length ? v.map((i) => (q.options?.[Number(i)] ? tf(q.options[Number(i)], lang) : i)).join(", ") : c.noAnswer;
  return typeof v === "string" && v.trim() ? v.trim() : c.noAnswer;
}

function QuestionField({ q, lang, value, error, onChange, c }: {
  q: Question; lang: Locale; value: Answers[string] | undefined; error?: string; onChange: (v: string | string[] | boolean) => void; c: MeCopy["apply"];
}) {
  const title = (
    <>{tf(q.label, lang)}{!q.required && <span className="font-normal text-fg-muted"> ({c.optional})</span>}</>
  );
  const str = typeof value === "string" ? value : "";
  switch (q.type) {
    case "short": case "url":
      return (
        <div data-qid={q.id}>
          <Field label={title} required={q.required} error={error}>
            {(ctl) => <Input {...ctl} name={q.id} type={q.type === "url" ? "url" : "text"} inputMode={q.type === "url" ? "url" : undefined} autoComplete="off" value={str} onChange={(e) => onChange(e.target.value)} className="min-h-11" />}
          </Field>
        </div>
      );
    case "long":
      return (
        <div data-qid={q.id}>
          <Field label={title} required={q.required} error={error} hint={<span className={cx("tnum", str.length > LONG_MAX && "font-bold text-danger-fg")}>{fill(c.counter, { n: str.length, max: LONG_MAX })}</span>}>
            {(ctl) => <Textarea {...ctl} name={q.id} value={str} onChange={(e) => onChange(e.target.value)} rows={5} />}
          </Field>
        </div>
      );
    case "select":
      return (
        <div data-qid={q.id}>
          <Field label={title} required={q.required} error={error}>
            {(ctl) => (
              <Select {...ctl} name={q.id} value={str} onChange={(e) => onChange(e.target.value)} className="min-h-11">
                <option value="">{c.selectPlaceholder}</option>
                {(q.options ?? []).map((o, i) => <option key={i} value={String(i)}>{tf(o, lang)}</option>)}
              </Select>
            )}
          </Field>
        </div>
      );
    case "multi": {
      const picked = Array.isArray(value) ? value : [];
      const errId = `${q.id}-err`;
      return (
        <fieldset data-qid={q.id} className="grid gap-2">
          <legend className="mb-1 text-sm font-semibold text-fg">{title}{q.required && <span aria-hidden="true" className="text-danger-fg"> *</span>}</legend>
          {(q.options ?? []).map((o, i) => (
            <label key={i} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-[var(--radius-sm)] border border-line-strong px-3 text-sm text-fg">
              <input type="checkbox" name={q.id} value={String(i)} checked={picked.includes(String(i))} aria-invalid={error && i === 0 ? true : undefined} aria-describedby={error ? errId : undefined}
                onChange={(e) => onChange(e.target.checked ? [...picked, String(i)] : picked.filter((x) => x !== String(i)))} className="size-5 accent-accent" />
              {tf(o, lang)}
            </label>
          ))}
          {error && <p id={errId} className="text-sm font-semibold text-danger-fg">{error}</p>}
        </fieldset>
      );
    }
    case "checkbox": {
      const errId = `${q.id}-err`;
      return (
        <div data-qid={q.id} className="grid gap-1.5">
          <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-[var(--radius-sm)] border border-line-strong px-3 text-sm text-fg">
            <input type="checkbox" name={q.id} checked={value === true} aria-invalid={error ? true : undefined} aria-describedby={error ? errId : undefined} onChange={(e) => onChange(e.target.checked)} className="size-5 accent-accent" />
            <span>{title}{q.required && <span aria-hidden="true" className="text-danger-fg"> *</span>}</span>
          </label>
          {error && <p id={errId} className="text-sm font-semibold text-danger-fg">{error}</p>}
        </div>
      );
    }
  }
}

function Success({ lang, slug, title, done, deadline, c, headingRef }: { lang: Locale; slug: string; title: string; done: Done; deadline: string | null; c: MeCopy["apply"]; headingRef: React.RefObject<HTMLHeadingElement | null> }) {
  const link = done.inviteCode ? `/${lang}/me/events/${slug}/apply?code=${done.inviteCode}` : null;
  return (
    <div className="grid gap-5">
      <div className="grid justify-items-center gap-2 rounded-[var(--radius-md)] border border-line bg-panel px-6 py-8 text-center">
        <Sticker name="yell" className="w-24" sizes="96px" />
        <h1 ref={headingRef} tabIndex={-1} className="font-display text-2xl font-bold text-fg outline-none">{c.successTitle}</h1>
        <p className="max-w-md text-sm text-fg-muted">{fill(c.successLine, { title })}</p>
      </div>
      {done.inviteCode && link && (
        <section aria-labelledby="invite" className="grid gap-3 rounded-[var(--radius-md)] border border-line bg-panel p-4">
          <h2 id="invite" className="font-display text-lg font-bold text-fg">{c.inviteTitle}</h2>
          <p className="text-sm text-fg-muted">{c.inviteLine}</p>
          <p data-testid="invite-code" className="font-display text-3xl font-bold text-fg tnum">{done.inviteCode}</p>
          <div className="flex flex-wrap gap-2">
            <CopyButton value={done.inviteCode} label={c.copy} copiedLabel={c.copied} />
            <CopyButton value={link} label={c.copyLink} copiedLabel={c.copied} variant="ghost" />
          </div>
        </section>
      )}
      <section aria-labelledby="next" className="grid gap-2 rounded-[var(--radius-md)] border border-line bg-panel p-4">
        <h2 id="next" className="font-display text-lg font-bold text-fg">{c.nextTitle}</h2>
        <ul className="grid gap-1.5 text-sm text-fg">
          <li className="flex gap-2"><Check aria-hidden="true" size={16} className="mt-0.5 shrink-0 text-ok-fg" />{deadline ? fill(c.nextDeadline, { date: deadline }) : c.nextNoDeadline}</li>
          <li className="flex gap-2"><Check aria-hidden="true" size={16} className="mt-0.5 shrink-0 text-ok-fg" />{c.nextCalendar}</li>
        </ul>
      </section>
      <div className="flex flex-wrap gap-2">
        {done.teamId && <ButtonLink href={`/${lang}/me/teams/${done.teamId}`} size="lg">{c.openTeam}</ButtonLink>}
        <ButtonLink href={`/${lang}/me/events?tab=applied`} size="lg" variant={done.teamId ? "secondary" : "primary"}>{c.toEvents}</ButtonLink>
      </div>
    </div>
  );
}
