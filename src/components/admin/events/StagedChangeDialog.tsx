"use client";
import * as AD from "@radix-ui/react-alert-dialog";
import { fill, tf, type L, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n";
import { copy } from "@/i18n/areas/admin-events";
import { plural } from "@/i18n/plural";
import type { DiffKey, FieldChange } from "@/lib/events/admin-form";
import { formatUb } from "@/lib/time";
import { buttonClass } from "@/components/ui/Button";
import { useOpsPortal } from "@/components/ui/OpsRoot";

const DATE_KEYS: DiffKey[] = ["starts_at", "ends_at", "reg_opens_at", "reg_closes_at", "decision_deadline"];
const clip = (s: string) => (s.length > 140 ? `${s.slice(0, 137)}…` : s);

/** One value as a person reads it: UB time, localised enum names, "Yes/No", "N questions". */
function show(key: DiffKey, v: unknown, lang: Locale): string {
  const t = copy[lang].staged;
  const f = copy[lang].form;
  const d = getDictionary(lang);
  if (key === "capacity") return typeof v === "number" ? String(v) : f.unlimited;
  if (v === null || v === undefined || v === "") return t.empty;
  if (DATE_KEYS.includes(key)) return formatUb(new Date(String(v)), lang, { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
  switch (key) {
    case "title": case "tagline": case "description": {
      const l = v as L;
      return clip(l.en.trim() && l.en !== l.mn ? `${l.mn} / ${l.en}` : tf(l, lang));
    }
    case "kind": return d.admin.kinds[v as keyof typeof d.admin.kinds];
    case "mode": return f.modes[v as keyof typeof f.modes];
    case "audience": return f.audiences[v as keyof typeof f.audiences];
    case "reg_mode": return f.regModes[v as keyof typeof f.regModes];
    case "team_mode": return f.teamModes[v as keyof typeof f.teamModes];
    case "waitlist": return v ? t.yes : t.no;
    case "questions": return plural(lang, (v as unknown[]).length, t.questions);
    default: return clip(String(v));
  }
}

/**
 * Staged edit of a published event: before/after for every changed field and how many people get an updated invite.
 * Controlled (the form decides when to open it after previewEventChange), unlike ConfirmDialog which owns its trigger.
 */
export default function StagedChangeDialog({ open, onOpenChange, lang, title, willNotify, changes, onConfirm }: {
  open: boolean; onOpenChange: (o: boolean) => void; lang: Locale; title: string; willNotify: number; changes: FieldChange[]; onConfirm: () => void;
}) {
  const t = copy[lang].staged;
  const container = useOpsPortal();
  return (
    <AD.Root open={open} onOpenChange={onOpenChange}>
      <AD.Portal container={container}>
        <AD.Overlay className="fixed inset-0 z-50 bg-[rgb(7_27_41/0.55)]" />
        <AD.Content className="fixed top-1/2 left-1/2 z-50 grid max-h-[88dvh] w-[min(94vw,38rem)] -translate-x-1/2 -translate-y-1/2 gap-4 overflow-y-auto rounded-[var(--radius-md)] border border-line bg-panel p-6 text-fg shadow-[var(--shadow-card)]">
          <AD.Title className="font-display text-lg font-bold">{fill(t.title, { title })}</AD.Title>
          <AD.Description className="text-sm font-semibold text-fg">{willNotify > 0 ? plural(lang, willNotify, t.notify) : t.none}</AD.Description>
          <ul className="grid gap-3">
            {changes.map((c) => (
              <li key={c.key} className="grid gap-1.5 rounded-[var(--radius-sm)] border border-line bg-panel-2 p-3 text-sm">
                <p className="flex flex-wrap items-center gap-2 font-bold">
                  {t.fields[c.key]}
                  {c.notifies && <span className="rounded-full bg-ember-soft px-2 py-0.5 text-xs font-bold text-ember-fg">{t.notifies}</span>}
                </p>
                <dl className="grid gap-1 sm:grid-cols-2 sm:gap-3">
                  <div><dt className="text-xs font-semibold text-fg-muted">{t.before}</dt><dd className="break-words text-fg-muted line-through decoration-1">{show(c.key, c.before, lang)}</dd></div>
                  <div><dt className="text-xs font-semibold text-fg-muted">{t.after}</dt><dd className="font-semibold break-words text-fg">{show(c.key, c.after, lang)}</dd></div>
                </dl>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap justify-end gap-2">
            <AD.Cancel className={buttonClass("secondary")}>{t.cancel}</AD.Cancel>
            <AD.Action className={buttonClass("primary")} onClick={onConfirm}>{willNotify > 0 ? t.confirm : copy[lang].form.save}</AD.Action>
          </div>
        </AD.Content>
      </AD.Portal>
    </AD.Root>
  );
}
