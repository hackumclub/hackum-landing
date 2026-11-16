"use client";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";
import { CalendarRange, Pencil, Plus } from "lucide-react";
import Button from "@/components/ui/Button";
import DateTimeField from "@/components/ui/DateTimeField";
import Drawer from "@/components/ui/Drawer";
import EmptyState from "@/components/ui/EmptyState";
import Field, { Input } from "@/components/ui/Field";
import { cx } from "@/components/ui/cx";
import StatusPill from "@/components/ui/StatusPill";
import type { Status } from "@/lib/status";
import { fill, tf, type L, type Locale } from "@/i18n/config";
import type { AreaCopy } from "@/i18n/areas/admin-members";
import { upsertSeasonAction } from "@/lib/members/actions";
import { validateSeason, type SeasonErrors } from "@/lib/members/format";
import { formatUbStable } from "@/lib/time";
import { CARD } from "@/components/admin/members/card";
import { NoticeBanner, errorText, focusFirstInvalid, type Notice } from "@/components/admin/members/shared";
import type { SeasonDto } from "./data";
import Tag from "@/components/ui/Tag";

type Form = { year: string; label: L; opens: Date | null; closes: Date | null; current: boolean };
const EMPTY: Form = { year: "", label: { mn: "", en: "" }, opens: null, closes: null, current: false };
// Application-window states reuse the shared pill tones: open = ok, scheduled = accent, closed / not set = neutral.
const WINDOW_PILL: Record<SeasonDto["window"], Status> = { open: "approved", scheduled: "published", closed: "archived", none: "draft" };

export default function SeasonsManager({ seasons, lang, c, common, tz, closeLabel }: {
  seasons: SeasonDto[]; lang: Locale; c: AreaCopy["settings"]["seasons"]; common: AreaCopy["common"]; tz: string; closeLabel: string;
}) {
  const router = useRouter();
  const [saving, startTransition] = useTransition();
  const [mode, setMode] = useState<"new" | number | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [errors, setErrors] = useState<SeasonErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const current = seasons.find((s) => s.isCurrent);
  const editing = typeof mode === "number" ? seasons.find((s) => s.year === mode) : undefined;
  const years = useMemo(() => seasons.map((s) => s.year), [seasons]);
  const date = (iso: string | null) => (iso ? formatUbStable(new Date(iso), lang, "date") : "");

  const openNew = () => { setForm({ ...EMPTY, year: String(Math.max(...years, new Date().getFullYear()) + 1) }); setErrors({}); setFormError(null); setMode("new"); };
  const openEdit = (s: SeasonDto) => {
    setForm({ year: String(s.year), label: s.label, opens: s.opensAt ? new Date(s.opensAt) : null, closes: s.closesAt ? new Date(s.closesAt) : null, current: s.isCurrent });
    setErrors({}); setFormError(null); setMode(s.year);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const found = validateSeason({ year: form.year, labelMn: form.label.mn, opens: form.opens, closes: form.closes }, years, editing !== undefined);
    setErrors(found);
    setFormError(null);
    if (Object.keys(found).length) { queueMicrotask(() => focusFirstInvalid(formRef.current)); return; }
    startTransition(async () => {
      const label = form.label.mn.trim();
      const r = await upsertSeasonAction({
        year: Number(form.year), label: { mn: label, en: form.label.en.trim() }, is_current: form.current,
        application_opens_at: form.opens?.toISOString() ?? null, application_closes_at: form.closes?.toISOString() ?? null,
      });
      if (!r.ok) { setFormError(errorText(common.errors, r.error)); return; }
      setNotice({ tone: "ok", text: fill(c.saved, { label }) });
      setMode(null);
      router.refresh();
    });
  };

  const lockedCurrent = editing?.isCurrent === true;
  const other = current && current.year !== editing?.year ? tf(current.label, lang) : null;
  const yearErr = errors.year === "yearTaken" ? fill(c.errors.yearTaken, { year: form.year }) : errors.year ? c.errors.year : undefined;
  const windowErr = errors.window ? c.errors[errors.window] : undefined;

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-base font-bold text-fg">{c.title}</h2>
        <Button icon={<Plus aria-hidden="true" size={16} />} onClick={openNew}>{c.create}</Button>
      </div>
      <NoticeBanner notice={notice} onDismiss={() => setNotice(null)} dismissLabel={common.dismiss} />
      {seasons.length === 0 ? (
        <EmptyState sticker="build" title={c.emptyTitle} line={c.emptyLine} action={<Button onClick={openNew}>{c.create}</Button>} />
      ) : (
        <ol aria-label={c.caption} className="relative ml-2 grid gap-3 border-l-2 border-line pl-6 md:ml-3 md:pl-8">
          {seasons.map((s) => (
            <li key={s.year} data-testid="season-item" data-current={s.isCurrent ? "true" : undefined} className="relative">
              <span aria-hidden="true" className={cx("absolute top-6 -left-[33px] size-4 rounded-full border-2 md:-left-[41px]", s.isCurrent ? "border-accent bg-accent ring-4 ring-accent-soft" : s.window === "open" ? "border-ok-fg bg-panel" : "border-line-strong bg-panel")} />
              <div className={cx(CARD, "flex items-start justify-between gap-3 p-4 md:items-center md:p-5", s.isCurrent && "border-accent bg-[radial-gradient(120%_140%_at_100%_0%,var(--ops-accent-soft),var(--ops-panel)_70%)]")}>
                <div className="flex min-w-0 items-center gap-4">
                  <span className="tnum font-display text-3xl font-black text-fg md:text-4xl">{s.year}</span>
                  <div className="grid min-w-0 gap-1">
                    <p className="flex flex-wrap items-center gap-2 font-semibold [overflow-wrap:anywhere] text-fg">
                      {tf(s.label, lang)}
                      {s.isCurrent && <Tag tone="accent">{c.currentBadge}</Tag>}
                    </p>
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-fg-muted">
                      <StatusPill status={WINDOW_PILL[s.window]} label={c.window[s.window]} />
                      {s.opensAt && s.closesAt && <span className="inline-flex items-center gap-1"><CalendarRange aria-hidden="true" size={14} />{fill(c.range, { from: date(s.opensAt), to: date(s.closesAt) })}</span>}
                    </p>
                  </div>
                </div>
                <Button size="md" variant="secondary" icon={<Pencil aria-hidden="true" size={14} />} onClick={() => openEdit(s)} aria-label={fill(c.editSeason, { label: tf(s.label, lang) })} className="shrink-0 max-sm:size-10 max-sm:px-0"><span className="max-sm:hidden">{c.edit}</span></Button>
              </div>
            </li>
          ))}
        </ol>
      )}

      <Drawer open={mode !== null} onOpenChange={(o) => { if (!o) setMode(null); }} title={editing ? c.drawerTitleEdit : c.drawerTitleNew} description={c.drawerDescription} closeLabel={closeLabel}>
        <form ref={formRef} onSubmit={submit} noValidate className="grid gap-4">
          {formError && <p role="alert" className="rounded-[var(--radius-sm)] bg-danger-soft px-3 py-2 text-sm font-semibold text-danger-fg">{formError}</p>}
          <Field label={c.year} required error={yearErr} hint={editing ? c.yearHint : undefined}>
            {(ctl) => <Input {...ctl} name="year" inputMode="numeric" value={form.year} disabled={editing !== undefined} onChange={(e) => setForm({ ...form, year: e.target.value })} className="max-w-32" />}
          </Field>
          <Field label={`${c.label} · Монгол`} required error={errors.label ? c.errors.label : undefined}>
            {(ctl) => <Input {...ctl} name="label.mn" lang="mn" value={form.label.mn} onChange={(e) => setForm({ ...form, label: { ...form.label, mn: e.target.value } })} />}
          </Field>
          <Field label={`${c.label} · English`}>
            {(ctl) => <Input {...ctl} name="label.en" lang="en" value={form.label.en} onChange={(e) => setForm({ ...form, label: { ...form.label, en: e.target.value } })} />}
          </Field>
          <fieldset className="grid gap-3">
            <legend className="mb-1 text-sm font-bold text-fg">{c.columns.window}</legend>
            <DateTimeField lang={lang} name="opens" label={c.opens} tzLabel={tz} value={form.opens} onChange={(d) => setForm({ ...form, opens: d })} hint={c.windowHint} error={windowErr} />
            <DateTimeField lang={lang} name="closes" label={c.closes} tzLabel={tz} value={form.closes} onChange={(d) => setForm({ ...form, closes: d })} />
          </fieldset>
          <div className="grid gap-1">
            <label className="flex min-h-10 cursor-pointer items-center gap-2.5 text-sm font-semibold text-fg">
              <input type="checkbox" name="current" checked={form.current} disabled={lockedCurrent} onChange={(e) => setForm({ ...form, current: e.target.checked })} className="size-4 accent-[var(--ops-accent)]" />
              {c.makeCurrent}
            </label>
            <p className="text-sm text-fg-muted">{lockedCurrent ? c.makeCurrentLocked : other ? fill(c.makeCurrentHint, { label: other }) : ""}</p>
          </div>
          <div className="sticky -bottom-4 z-10 -mx-4 -mb-4 flex flex-wrap justify-end gap-2 border-t border-line bg-panel px-4 py-4">
            <Button variant="secondary" onClick={() => setMode(null)}>{c.cancel}</Button>
            <Button type="submit" disabled={saving}>{saving ? common.saving : common.save}</Button>
          </div>
        </form>
      </Drawer>
    </div>
  );
}
