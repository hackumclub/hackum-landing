"use client";
import { usePathname, useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { Check } from "lucide-react";
import type { MeCopy } from "@/i18n/areas/me";
import { switchLocale, type Locale } from "@/i18n/config";
import type { NotifPrefs, Visibility } from "@/lib/mockdb/types";
import { updatePrefsAction } from "@/lib/me/actions";
import { cx } from "@/components/ui/cx";

type State = { prefs: NotifPrefs; locale: Locale; visibility: Visibility };
type Status = "idle" | "saving" | "saved" | "error";

function Toggle({ label, line, checked, onChange }: { label: string; line: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex min-h-14 cursor-pointer items-center gap-3 py-2">
      <span className="grid flex-1 gap-0.5"><span className="font-semibold text-fg">{label}</span><span className="text-sm text-fg-muted">{line}</span></span>
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
      <span aria-hidden="true" className="relative h-7 w-12 shrink-0 rounded-full bg-line-strong transition-colors duration-150 peer-checked:bg-accent peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent peer-checked:[&>span]:translate-x-5">
        <span className="absolute top-0.5 left-0.5 size-6 rounded-full bg-panel transition-transform duration-150" />
      </span>
    </label>
  );
}

function Choice<T extends string>({ name, legend, value, options, onChange, cols }: { name: string; legend: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; cols: string }) {
  return (
    <fieldset className="grid gap-2">
      <legend className="mb-1 text-sm font-semibold text-fg">{legend}</legend>
      <div className={cx("grid gap-2", cols)}>
        {options.map((o) => (
          <label key={o.value} className={cx("flex min-h-11 cursor-pointer items-center justify-center rounded-[var(--radius-sm)] border px-3 text-center text-sm font-semibold has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent", value === o.value ? "border-accent bg-accent-soft text-accent-fg" : "border-line-strong text-fg")}>
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
  const [status, setStatus] = useState<Status>("idle");
  const good = useRef(initial);
  const seq = useRef(0);
  const [, start] = useTransition();

  function save(next: State) {
    setState(next);
    setStatus("saving");
    const id = ++seq.current;
    start(async () => {
      const r = await updatePrefsAction({ notif_prefs: next.prefs, locale: next.locale, visibility: next.visibility });
      if (id !== seq.current) return; // a newer change superseded this one
      if (r.ok) {
        good.current = next;
        setStatus("saved");
        if (next.locale !== lang) router.replace(switchLocale(path, next.locale));
      } else {
        setState(good.current);
        setStatus("error");
      }
    });
  }
  const statusText = status === "saving" ? c.saving : status === "saved" ? c.saved : status === "error" ? c.saveFailed : "";

  return (
    <div className="grid gap-5 rounded-[var(--radius-md)] border border-line bg-panel p-4 md:p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-lg font-bold text-fg">{c.notifTitle}</h2>
        <p role="status" className={cx("inline-flex min-h-6 items-center gap-1 text-sm font-semibold", status === "error" ? "text-danger-fg" : "text-ok-fg")}>
          {status === "saved" && <Check aria-hidden="true" size={14} />}{statusText}
        </p>
      </div>
      <div className="grid divide-y divide-line">
        <Toggle label={c.reminders} line={c.remindersLine} checked={state.prefs.reminders} onChange={(v) => save({ ...state, prefs: { ...state.prefs, reminders: v } })} />
        <Toggle label={c.updates} line={c.updatesLine} checked={state.prefs.updates} onChange={(v) => save({ ...state, prefs: { ...state.prefs, updates: v } })} />
        <Toggle label={c.announcements} line={c.announcementsLine} checked={state.prefs.announcements} onChange={(v) => save({ ...state, prefs: { ...state.prefs, announcements: v } })} />
      </div>
      <p className="text-sm text-fg-muted">{c.notifLine}</p>

      <div className="grid gap-1 border-t border-line pt-5">
        <Choice name="locale" legend={c.langTitle} value={state.locale} cols="grid-cols-2"
          options={[{ value: "mn", label: "Монгол" }, { value: "en", label: "English" }]} onChange={(locale) => save({ ...state, locale })} />
        <p className="text-sm text-fg-muted">{c.langLine}</p>
      </div>

      <div className="grid gap-1 border-t border-line pt-5">
        <Choice name="visibility" legend={c.visTitle} value={state.visibility} cols="grid-cols-3"
          options={(["public", "members", "private"] as const).map((v) => ({ value: v, label: c.vis[v] }))} onChange={(visibility) => save({ ...state, visibility })} />
        <p className="text-sm text-fg-muted">{c.visLine} {c.visHelp[state.visibility]}</p>
      </div>
    </div>
  );
}
