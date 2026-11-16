"use client";
import Link from "next/link";
import { CalendarClock, CheckCircle2, FileText, ListChecks, Rocket, Ticket, Users, type LucideIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { fill, href, tf, type L, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n";
import { copy } from "@/i18n/areas/admin-events";
import { plural } from "@/i18n/plural";
import { createEventAction, previewEventChangeAction, updateEventAction } from "@/lib/events/actions";
import {
  AUDIENCES, changedFields, defaultState, KINDS, MODES, REG_MODES, slugify, stateFromEvent, TEAM_MODES, toInput, validate, type FieldChange, type FormErrors, type FormState,
} from "@/lib/events/admin-form";
import type { EventInput } from "@/lib/mockdb/events";
import type { EventRow } from "@/lib/mockdb/types";
import BilingualField from "@/components/ui/BilingualField";
import Button, { buttonClass } from "@/components/ui/Button";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import DateTimeField from "@/components/ui/DateTimeField";
import Field, { Input, Select } from "@/components/ui/Field";
import { posterSrc, POSTER_LIBRARY } from "@/lib/events/posters";
import Poster from "./Poster";
import QuestionBuilder from "./QuestionBuilder";
import EventPreview from "./EventPreview";
import Segmented from "./Segmented";
import StagedChangeDialog from "./StagedChangeDialog";
import { useToast } from "./Toast";

const DAY = 86_400_000;

function Section({ icon: Icon, title, hint, children }: { icon: LucideIcon; title: string; hint?: string; children: ReactNode }) {
  const id = `sec-${title.replace(/\W+/g, "-")}`;
  return (
    <section aria-labelledby={id} className="grid gap-4 rounded-[var(--radius-md)] border border-line bg-panel p-4 md:p-5">
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-full bg-accent-soft text-accent-fg"><Icon size={18} /></span>
        <div className="grid min-w-0 gap-0.5">
          <h2 id={id} className="font-display text-lg font-bold text-fg">{title}</h2>
          {hint && <p className="text-sm text-fg-muted">{hint}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

/**
 * One form for "new" and "edit". Validation mirrors the rule (which only answers "invalid"), so every error is explained
 * next to its field. Editing a published event stages the change: preview first, then a before/after review if people
 * would be told.
 */
export default function EventForm({ lang, event, takenSlugs, answered, nowIso }: { lang: Locale; event: EventRow | null; takenSlugs: string[]; answered: number; nowIso: string }) {
  const t = copy[lang].form;
  const d = getDictionary(lang);
  const router = useRouter();
  const [pending, start] = useTransition();
  const { show, node } = useToast(copy[lang].regs.toast.close);
  const formRef = useRef<HTMLFormElement>(null);

  const [s, setS] = useState<FormState>(() => (event ? stateFromEvent(event) : defaultState(new Date(nowIso))));
  // What the form looked like when it was last saved (or loaded): "unsaved changes" is any difference from this.
  const [baseline, setBaseline] = useState(() => JSON.stringify(s));
  const dirty = JSON.stringify(s) !== baseline;
  const [attempted, setAttempted] = useState(false);
  const [tick, setTick] = useState(0);
  const [serverSlug, setServerSlug] = useState<string | null>(null);
  const [posterBroken, setPosterBroken] = useState(false);
  const [staged, setStaged] = useState<{ input: EventInput; snapshot: string; changes: FieldChange[]; willNotify: number } | null>(null);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setS((p) => ({ ...p, [key]: value }));
  const setTitle = (title: L) => setS((p) => ({ ...p, title, slug: p.slugTouched ? p.slug : slugify(title) }));
  const setRegMode = (reg_mode: FormState["reg_mode"]) =>
    setS((p) => ({ ...p, reg_mode, decision_deadline: reg_mode === "application" && !p.decision_deadline && p.starts_at ? new Date(p.starts_at.getTime() - 7 * DAY) : p.decision_deadline }));
  const setTeamMode = (team_mode: FormState["team_mode"]) =>
    setS((p) => ({ ...p, team_mode, ...(team_mode !== "none" && p.team_size_min === 1 && p.team_size_max === 1 ? { team_size_min: 2, team_size_max: 4 } : {}) }));

  const errors: FormErrors = attempted ? { ...validate(s, { takenSlugs }), ...(serverSlug !== null && serverSlug === s.slug.trim() ? { slug: "slug_taken" } : {}) } : {};
  const err = (key: string) => (errors[key] ? t.errors[errors[key]] : undefined);
  const errorCount = Object.keys(errors).length;

  useEffect(() => {
    if (tick > 0) formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [tick]);

  // Closing the tab or reloading with edits that were never saved asks first (in-app Cancel has its own dialog).
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const fail = (code: string) => {
    if (code === "conflict") { setServerSlug(s.slug.trim()); setAttempted(true); setTick((n) => n + 1); }
    else show(t.server[code] ?? t.server.generic, "error");
  };

  const save = async (input: EventInput, snapshot: string) => {
    if (!event) {
      const r = await createEventAction(input);
      if (r.ok) { setBaseline(snapshot); router.push(`${href(lang, `/admin/events/${r.data.id}`)}?created=1`); }
      else fail(r.error);
      return;
    }
    const r = await updateEventAction(event.id, input);
    if (r.ok) { setBaseline(snapshot); show(t.saved); router.refresh(); }
    else fail(r.error);
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAttempted(true);
    if (Object.keys(validate(s, { takenSlugs })).length > 0) { setTick((n) => n + 1); return; }
    const input = toInput(s, event);
    const snapshot = JSON.stringify(s);
    start(async () => {
      if (event?.status === "published") {
        const p = await previewEventChangeAction(event.id, input);
        if (!p.ok) return fail(p.error);
        if (p.data.willNotify > 0) { setStaged({ input, snapshot, changes: changedFields(event, input), willNotify: p.data.willNotify }); return; }
      }
      await save(input, snapshot);
    });
  };

  const title = tf(s.title, lang).trim() || copy[lang].preview.untitled;
  const showVenue = s.mode !== "online";
  const showOnline = s.mode !== "offline";
  const application = s.reg_mode === "application";
  const isLive = !!event && event.status !== "draft";
  const coverPath = s.cover_path.trim();
  const coverMissing = coverPath !== "" && (posterSrc(coverPath) === null || posterBroken);
  const saveDisabled = pending || (!!event && !dirty);

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      <form ref={formRef} noValidate onSubmit={onSubmit} className="grid min-w-0 gap-4">
        <Section icon={FileText} title={t.sections.basics}>
          <Field label={t.kind}>
            {(c) => <Select {...c} value={s.kind} onChange={(e) => set("kind", e.target.value as FormState["kind"])}>{KINDS.map((k) => <option key={k} value={k}>{d.admin.kinds[k]}</option>)}</Select>}
          </Field>
          <BilingualField name="title" label={t.title} value={s.title} onChange={setTitle} labels={d.ui.bilingual} error={err("title")} />
          <BilingualField name="tagline" label={t.tagline} value={s.tagline} onChange={(v) => set("tagline", v)} labels={d.ui.bilingual} required="none" />
          <BilingualField name="description" label={t.description} value={s.description} onChange={(v) => set("description", v)} labels={d.ui.bilingual} multiline required="none" />
        </Section>

        <Section icon={CalendarClock} title={t.sections.whenWhere}>
          <div className="grid gap-4 md:grid-cols-2">
            <DateTimeField name="starts_at" label={t.starts} tzLabel={d.ui.tz} value={s.starts_at} onChange={(v) => set("starts_at", v)} error={err("starts_at")} required />
            <DateTimeField name="ends_at" label={t.ends} tzLabel={d.ui.tz} value={s.ends_at} onChange={(v) => set("ends_at", v)} error={err("ends_at")} required />
          </div>
          <Segmented legend={t.mode} name="mode" value={s.mode} onChange={(v) => set("mode", v)} options={MODES.map((m) => ({ value: m, label: t.modes[m] }))} />
          {showVenue && (
            <div className="grid gap-4 md:grid-cols-2">
              <Field label={t.venueName}>{(c) => <Input {...c} name="venue_name" value={s.venue_name} onChange={(e) => set("venue_name", e.target.value)} />}</Field>
              <Field label={t.venueAddress}>{(c) => <Input {...c} name="venue_address" value={s.venue_address} onChange={(e) => set("venue_address", e.target.value)} />}</Field>
            </div>
          )}
          {showOnline && (
            <Field label={t.onlineUrl} required error={err("online_url")} hint={t.onlineHint}>
              {(c) => <Input {...c} name="online_url" type="url" inputMode="url" placeholder="https://" value={s.online_url} onChange={(e) => set("online_url", e.target.value)} />}
            </Field>
          )}
        </Section>

        <Section icon={Ticket} title={t.sections.registration}>
          <Field label={t.audience} className="md:max-w-xs">
            {(c) => <Select {...c} value={s.audience} onChange={(e) => set("audience", e.target.value as FormState["audience"])}>{AUDIENCES.map((a) => <option key={a} value={a}>{t.audiences[a]}</option>)}</Select>}
          </Field>
          <div className="grid items-start gap-4 md:grid-cols-2">
            <Field label={t.capacity} error={err("capacity")}>
              {(c) => (
                <Input {...c} name="capacity" inputMode="numeric" value={s.unlimited ? "" : s.capacity} disabled={s.unlimited} onChange={(e) => set("capacity", e.target.value)} />
              )}
            </Field>
            <div className="grid gap-2 md:pt-7">
              <label className="flex min-h-10 items-center gap-2 text-sm font-semibold text-fg">
                <input type="checkbox" checked={s.unlimited} onChange={(e) => setS((p) => ({ ...p, unlimited: e.target.checked, capacity: !e.target.checked && p.capacity.trim() === "" ? "50" : p.capacity }))} className="size-4 accent-[var(--ops-accent)]" />
                {t.unlimited}
              </label>
              <label className="flex min-h-10 items-center gap-2 text-sm font-semibold text-fg">
                <input type="checkbox" checked={s.waitlist} disabled={s.unlimited} onChange={(e) => set("waitlist", e.target.checked)} className="size-4 accent-[var(--ops-accent)]" />
                {t.waitlist}
              </label>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <DateTimeField name="reg_opens_at" label={t.regOpens} tzLabel={d.ui.tz} hint={t.optional} value={s.reg_opens_at} onChange={(v) => set("reg_opens_at", v)} error={err("reg_opens_at")} />
            <DateTimeField name="reg_closes_at" label={t.regCloses} tzLabel={d.ui.tz} hint={t.optional} value={s.reg_closes_at} onChange={(v) => set("reg_closes_at", v)} error={err("reg_closes_at")} />
          </div>
          <Segmented
            cards legend={t.regMode} name="reg_mode" value={s.reg_mode} onChange={setRegMode}
            options={REG_MODES.map((m) => ({ value: m, label: t.regModes[m], hint: t.regModeHints[m] }))}
          />
          {application && (
            <DateTimeField name="decision_deadline" label={t.decision} tzLabel={d.ui.tz} hint={t.decisionHint} value={s.decision_deadline} onChange={(v) => set("decision_deadline", v)} error={err("decision_deadline")} required />
          )}
        </Section>

        {application && (
          <>
            <Section icon={ListChecks} title={t.sections.questions}>
              <QuestionBuilder lang={lang} value={s.questions} onChange={(qs) => set("questions", qs)} errors={errors} answered={answered} />
            </Section>
            <Section icon={Users} title={t.sections.teams}>
              <Segmented legend={t.teamMode} name="team_mode" value={s.team_mode} onChange={setTeamMode} options={TEAM_MODES.map((m) => ({ value: m, label: t.teamModes[m] }))} />
              {s.team_mode !== "none" && (
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label={t.teamMin} error={err("team_size")}>
                    {(c) => <Input {...c} name="team_size_min" type="number" min={1} max={10} value={s.team_size_min} onChange={(e) => set("team_size_min", Number(e.target.value))} />}
                  </Field>
                  <Field label={t.teamMax}>
                    {(c) => <Input {...c} name="team_size_max" type="number" min={1} max={10} value={s.team_size_max} onChange={(e) => set("team_size_max", Number(e.target.value))} />}
                  </Field>
                </div>
              )}
            </Section>
          </>
        )}

        <Section icon={Rocket} title={t.sections.publishing} hint={t.publishing.slugIntro}>
          <p className={`rounded-[var(--radius-sm)] px-3 py-2 text-sm font-semibold ${isLive ? "bg-ok-soft text-ok-fg" : "bg-neutral-soft text-fg"}`}>
            {isLive ? fill(t.publishing.live, { slug: event?.slug ?? s.slug }) : t.publishing.draft}
          </p>
          <Field
            label={t.slug} required error={err("slug")} hint={fill(t.slugHint, { slug: s.slug.trim() || "…" })}
            labelAction={s.slugTouched && slugify(s.title) && slugify(s.title) !== s.slug ? (
              <Button size="sm" variant="ghost" onClick={() => setS((p) => ({ ...p, slug: slugify(p.title), slugTouched: false }))}>{t.slugSuggest}</Button>
            ) : undefined}
          >
            {(c) => <Input {...c} name="slug" value={s.slug} spellCheck={false} autoCapitalize="none" onChange={(e) => setS((p) => ({ ...p, slug: e.target.value, slugTouched: true }))} />}
          </Field>
          <div className="grid gap-3">
            <div className="flex items-start gap-3">
              <Poster path={coverPath} sizes="96px" className="aspect-[4/5] w-20 sm:w-24" onBroken={setPosterBroken} />
              <div className="grid min-w-0 flex-1 gap-1">
                <Field label={t.cover} hint={coverPath === "" ? t.publishing.posterEmpty : t.coverHint}>
                  {(c) => <Input {...c} name="cover_path" value={s.cover_path} spellCheck={false} onChange={(e) => { setPosterBroken(false); set("cover_path", e.target.value); }} />}
                </Field>
                {coverMissing && <p className="text-sm font-semibold text-warn-fg">{t.publishing.posterBroken}</p>}
              </div>
            </div>
            <fieldset className="grid gap-1.5">
              <legend className="mb-0.5 text-sm font-semibold text-fg">{t.publishing.posterLibrary}</legend>
              <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pt-1 pb-2">
                {POSTER_LIBRARY.map((p) => {
                  const on = coverPath === p.path;
                  return (
                    <button
                      key={p.id} type="button" aria-pressed={on} aria-label={fill(t.publishing.posterPick, { name: p.name })}
                      onClick={() => { setPosterBroken(false); set("cover_path", on ? "" : p.path); }}
                      className={`cursor-pointer rounded-[var(--radius-sm)] p-0.5 ${on ? "ring-2 ring-accent" : "ring-1 ring-line hover:ring-line-strong"}`}
                    >
                      <Poster path={p.path} sizes="64px" className="aspect-[4/5] w-12" />
                    </button>
                  );
                })}
              </div>
            </fieldset>
          </div>
        </Section>

        <div data-testid="form-bar" className="sticky bottom-3 z-20 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-[var(--radius-md)] border border-line-strong bg-panel p-3 shadow-[var(--shadow-card)]">
          <div className="grid min-w-0 gap-0.5">
            <p role="status" className="text-sm font-semibold text-danger-fg">{attempted && errorCount > 0 ? plural(lang, errorCount, t.errorSummary) : ""}</p>
            {!(attempted && errorCount > 0) && (
              dirty ? (
                <p className="flex items-center gap-2 text-sm font-semibold text-fg"><span aria-hidden="true" className="size-2.5 rounded-full bg-warn-fg" />{t.unsaved}</p>
              ) : event ? (
                <p className="flex items-center gap-2 text-sm text-fg-muted"><CheckCircle2 aria-hidden="true" size={16} />{t.allSaved}</p>
              ) : (
                <p className="text-sm text-fg-muted">{t.createsDraft}</p>
              )
            )}
          </div>
          <div className="ml-auto flex items-center gap-2">
            {dirty ? (
              <ConfirmDialog
                trigger={<Button variant="ghost">{t.cancel}</Button>}
                title={t.discard.title} body={fill(t.discard.body, { title })} confirmLabel={t.discard.confirm} cancelLabel={t.discard.keep} tone="danger"
                onConfirm={() => router.push(href(lang, "/admin/events"))}
              />
            ) : (
              <Link href={href(lang, "/admin/events")} className={buttonClass("ghost")}>{t.cancel}</Link>
            )}
            <Button type="submit" disabled={saveDisabled} title={event && !dirty ? t.noChanges : undefined}>{pending ? t.saving : event ? t.save : t.create}</Button>
          </div>
        </div>
      </form>

      <EventPreview lang={lang} state={s} publicSlug={event?.slug ?? null} isDraft={!event || event.status === "draft"} />

      {staged && event && (
        <StagedChangeDialog
          open onOpenChange={(o) => { if (!o) setStaged(null); }} lang={lang} title={title} willNotify={staged.willNotify} changes={staged.changes}
          onConfirm={() => { const { input, snapshot } = staged; setStaged(null); start(() => save(input, snapshot)); }}
        />
      )}
      {node}
    </div>
  );
}
