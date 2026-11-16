"use client";
import { CalendarDays } from "lucide-react";
import { useState } from "react";
import type { Locale } from "@/i18n/config";
import { dayLabel, isIso, todayIso, type Iso } from "@/lib/calendar";
import Calendar from "./Calendar";
import { controlClass } from "./Field";
import PickerSurface from "./PickerSurface";
import { cx } from "./cx";

const LABELS = {
  en: { pick: "Pick a date", today: "Today", clear: "Clear", typed: "Date (YYYY-MM-DD)", invalid: "Use the format YYYY-MM-DD.", close: "Close", title: "Choose a date" },
  mn: { pick: "Огноо сонгох", today: "Өнөөдөр", clear: "Арилгах", typed: "Огноо (ЖЖЖЖ-СС-ӨӨ)", invalid: "ЖЖЖЖ-СС-ӨӨ хэлбэрээр бичнэ үү.", close: "Хаах", title: "Огноо сонгох" },
} as const;

/**
 * Themed single-date control: a field-styled button that opens the `Calendar` (popover from md, bottom sheet on
 * phones) with a typed `YYYY-MM-DD` box for keyboard and paste. Values are UB calendar days. Pass the `Field`
 * control props (`id`, `aria-*`) straight through so the label, hint and error stay wired to the button.
 */
export default function DatePicker({ id, value, onChange, lang, min, max, clearable = false, placeholder, now, className, ...aria }: {
  id?: string; value: Iso | null; onChange: (v: Iso | null) => void; lang: Locale; min?: Iso; max?: Iso; clearable?: boolean; placeholder?: string;
  now?: Date; className?: string; "aria-describedby"?: string; "aria-invalid"?: boolean; required?: boolean;
}) {
  const L = LABELS[lang];
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState<string | null>(null);
  const [typedError, setTypedError] = useState(false);
  const pick = (v: Iso | null) => { onChange(v); setOpen(false); setTyped(null); setTypedError(false); };
  const commitTyped = () => {
    const v = (typed ?? "").trim();
    if (v === "" && clearable) return pick(null);
    if (isIso(v) && !(min && v < min) && !(max && v > max)) return pick(v);
    setTypedError(true);
  };
  return (
    <PickerSurface
      open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setTyped(null); setTypedError(false); } }} title={L.title} closeLabel={L.close} autoFocusSelector='[data-iso][tabindex="0"]'
      trigger={
        <button
          type="button" id={id} aria-haspopup="dialog" aria-expanded={open} aria-describedby={aria["aria-describedby"]}
          className={controlClass(cx("flex cursor-pointer items-center justify-between gap-2 text-left", aria["aria-invalid"] && "border-danger-fg", className))}
        >
          <span className={value ? "text-fg" : "text-fg-muted"}>{value ? dayLabel(value, lang) : placeholder ?? L.pick}</span>
          <CalendarDays aria-hidden="true" size={18} className="shrink-0 text-fg-muted" />
        </button>
      }
    >
      <div className="grid gap-3">
        <label className="grid gap-1 text-xs font-semibold text-fg-muted">
          {L.typed}
          <input
            type="text" inputMode="numeric" placeholder="2026-11-16" value={typed ?? value ?? ""} aria-invalid={typedError || undefined}
            onChange={(e) => { setTyped(e.target.value); setTypedError(false); }}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commitTyped(); } }}
            onBlur={() => { if (typed !== null && typed !== (value ?? "")) commitTyped(); }}
            className={controlClass("tnum font-normal")}
          />
          {typedError && <span role="alert" className="text-sm font-semibold text-danger-fg">{L.invalid}</span>}
        </label>
        <Calendar lang={lang} value={value} min={min} max={max} now={now} onPick={(iso) => pick(iso)} />
        <div className="flex items-center justify-between gap-2">
          <button type="button" onClick={() => { const t = todayIso(now); if (!(min && t < min) && !(max && t > max)) pick(t); }} className="min-h-10 cursor-pointer rounded-full px-3 text-sm font-semibold text-accent-fg hover:bg-accent-soft">{L.today}</button>
          {clearable && value && <button type="button" onClick={() => pick(null)} className="min-h-10 cursor-pointer rounded-full px-3 text-sm font-semibold text-fg-muted hover:bg-neutral-soft hover:text-fg">{L.clear}</button>}
        </div>
      </div>
    </PickerSurface>
  );
}
