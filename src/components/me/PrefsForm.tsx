"use client";
import { usePathname, useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import type { MeCopy } from "@/i18n/areas/me";
import { switchLocale, type Locale } from "@/i18n/config";
import type { NotifPrefs, Visibility } from "@/lib/mockdb/types";
import { updatePrefsAction } from "@/lib/me/actions";
import { cx } from "@/components/ui/cx";
import { IconCard } from "./parts";
import { useToast } from "./Toast";

type State = { prefs: NotifPrefs; locale: Locale; visibility: Visibility };

function Toggle({ label, line, checked, onChange }: { label: string; line: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex min-h-14 cursor-pointer items-center gap-3 py-2">
      <span className="grid flex-1 gap-0.5"><span className="font-semibold text-fg">{label}</span><span className="text-sm text-fg-muted">{line}</span></span>
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
      <span aria-hidden="true" className="relative h-8 w-14 shrink-0 rounded-full bg-line-strong transition-colors duration-150 peer-checked:bg-accent peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent peer-checked:[&>span]:translate-x-6">
        <span className="absolute top-1 left-1 size-6 rounded-full bg-white shadow-sm transition-transform duration-150" />
      </span>
    </label>
  );
}

function Choice<T extends string>({ name, legend, value, options, onChange, cols, hideLegend }: { name: string; legend: string; hideLegend?: boolean; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; cols: string }) {
  return (
    <fieldset className="grid gap-2">
      <legend className={hideLegend ? "sr-only" : "mb-1 text-sm font-semibold text-fg"}>{legend}</legend>
      <div className={cx("grid gap-2", cols)}>
        {options.map((o) => (
          <label key={o.value} className={cx("flex min-h-12 cursor-pointer items-center justify-center rounded-[var(--radius-sm)] border-2 px-3 text-center text-sm font-semibold has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent", value === o.value ? "border-accent bg-accent-soft text-accent-fg" : "border-line bg-panel-2 text-fg")}>
            <input type="radio" name={name} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} className="sr-only" />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/**
 * Notification toggles, language and profile visibility. Every change is applied on screen at once (optimistic) and saved
 * with the complete set; if the save fails the control snaps back and says so. "Saved" is announced politely.
 */
export default function PrefsForm({ lang, initial, c }: { lang: Locale; initial: State; c: MeCopy["settings"] }) {
  const router = useRouter();
  const path = usePathname();
  const [state, setState] = useState(initial);
  const toast = useToast();
  const good = useRef(initial);
  const seq = useRef(0);
  const [, start] = useTransition();

  function save(next: State) {
    setState(next);
    const id = ++seq.current;
    start(async () => {
      const r = await updatePrefsAction({ notif_prefs: next.prefs, locale: next.locale, visibility: next.visibility });
      if (id !== seq.current) return; // a newer change superseded this one
      if (r.ok) {
        good.current = next;
        toast(c.saved);
        if (next.locale !== lang) router.replace(switchLocale(path, next.locale));
      } else {
        setState(good.current);
        toast(c.saveFailed);
      }
    });
  }
  return (
    <>
      <IconCard id="notif" icon="bell" tone="warn" title={c.notifTitle} line={c.notifLine}>
        <div className="grid divide-y divide-line">
          <Toggle label={c.reminders} line={c.remindersLine} checked={state.prefs.reminders} onChange={(v) => save({ ...state, prefs: { ...state.prefs, reminders: v } })} />
          <Toggle label={c.updates} line={c.updatesLine} checked={state.prefs.updates} onChange={(v) => save({ ...state, prefs: { ...state.prefs, updates: v } })} />
          <Toggle label={c.announcements} line={c.announcementsLine} checked={state.prefs.announcements} onChange={(v) => save({ ...state, prefs: { ...state.prefs, announcements: v } })} />
        </div>
      </IconCard>

      <IconCard id="lang" icon="chat" tone="accent" title={c.langTitle} line={c.langLine}>
        <Choice name="locale" hideLegend legend={c.langTitle} value={state.locale} cols="grid-cols-2"
          options={[{ value: "mn", label: "Монгол" }, { value: "en", label: "English" }]} onChange={(locale) => save({ ...state, locale })} />
      </IconCard>

      <IconCard id="privacy" icon="lock" tone="ok" title={c.privTitle} line={c.visLine}>
        <Choice name="visibility" legend={c.visTitle} value={state.visibility} cols="grid-cols-3"
          options={(["public", "members", "private"] as const).map((v) => ({ value: v, label: c.vis[v] }))} onChange={(visibility) => save({ ...state, visibility })} />
        <p className="rounded-[var(--radius-sm)] bg-panel-2 px-3 py-2 text-sm text-fg-muted">{c.visHelp[state.visibility]}</p>
      </IconCard>
    </>
  );
}
