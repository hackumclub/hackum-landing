"use client";
import { Calendar as CalendarIcon, X } from "lucide-react";
import { useId, useState } from "react";
import type { Locale } from "@/i18n/config";
import { isIsoDate, presetRange, type DateRange, type RangePreset } from "@/lib/date-range";
import { formatUb } from "@/lib/time";
import Calendar from "./Calendar";
import { controlClass } from "./Field";
import { chipClass } from "./control";
import PickerSurface from "./PickerSurface";

export type DateRangeLabels = {
  trigger: string; allDates: string; clear: string; close: string; custom: string; from: string; to: string; apply: string;
  errorOrder: string; errorInvalid: string; presets: Record<RangePreset, string>;
};

const DEFAULT_LABELS: Record<Locale, DateRangeLabels> = {
  en: {
    trigger: "Date range", allDates: "Any date", clear: "Clear date range", close: "Close", custom: "Custom", from: "From", to: "To", apply: "Apply",
    errorOrder: "The start date must be on or before the end date.", errorInvalid: "Enter both dates.",
    presets: { thisSemester: "This semester", lastSemester: "Last semester", last30: "Last 30 days", thisYear: "This year" },
  },
  mn: {
    trigger: "Огнооны завсар", allDates: "Бүх огноо", clear: "Огнооны шүүлтийг цэвэрлэх", close: "Хаах", custom: "Өөр завсар", from: "Эхлэх", to: "Дуусах", apply: "Хэрэглэх",
    errorOrder: "Эхлэх огноо дуусах огнооноос өмнө эсвэл ижил байх ёстой.", errorInvalid: "Хоёр огноог оруулна уу.",
    presets: { thisSemester: "Энэ улирал", lastSemester: "Өнгөрсөн улирал", last30: "Сүүлийн 30 хоног", thisYear: "Энэ жил" },
  },
};

const fmt = (iso: string, lang: Locale) => formatUb(new Date(`${iso}T04:00:00Z`), lang, { month: "short", day: "numeric", year: "numeric" });

/**
 * Date-range filter. Dates are UB calendar days ("YYYY-MM-DD", inclusive). Presets resolve on the UB calendar
 * (semesters via `semesterOf`); "Custom" is a range calendar (click the first and last day) plus two typed `YYYY-MM-DD` boxes, validated from ≤ to. `now` is injectable for tests.
 */
export default function DateRangePicker({ value, onChange, presets, lang, labels, now }: {
  value: DateRange | null; onChange: (v: DateRange | null) => void; presets: RangePreset[]; lang: Locale; labels?: Partial<DateRangeLabels>; now?: Date;
}) {
  const L = { ...DEFAULT_LABELS[lang], ...labels };
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(value?.from ?? "");
  const [to, setTo] = useState(value?.to ?? "");
  const [error, setError] = useState<string | null>(null);
  const errId = useId();

  const choose = (v: DateRange | null) => { onChange(v); setOpen(false); setError(null); };
  const pick = (p: RangePreset) => {
    const r = presetRange(p, now ?? new Date());
    setFrom(r.from); setTo(r.to);
    choose(r);
  };
  const apply = () => {
    if (!isIsoDate(from) || !isIsoDate(to)) return setError(L.errorInvalid);
    if (from > to) return setError(L.errorOrder);
    choose({ from, to });
  };
  // Calendar clicks: the first day starts a range, the second ends it (swapped if it is earlier); a third starts over.
  const clickDay = (iso: string) => {
    setError(null);
    if (isIsoDate(from) && !to) { if (iso < from) { setTo(from); setFrom(iso); } else setTo(iso); } else { setFrom(iso); setTo(""); }
  };
  const summary = value ? `${fmt(value.from, lang)} – ${fmt(value.to, lang)}` : L.allDates;
  const dateInput = controlClass("tnum font-normal");

  return (
    <div className="inline-flex items-center gap-1">
      <PickerSurface
        open={open} onOpenChange={(o) => { setOpen(o); if (o) { setFrom(value?.from ?? ""); setTo(value?.to ?? ""); setError(null); } }}
        title={L.trigger} closeLabel={L.close} autoFocusSelector='[data-iso][tabindex="0"]'
        trigger={
          <button type="button" aria-label={`${L.trigger}: ${summary}`} aria-haspopup="dialog" aria-expanded={open} className={chipClass(Boolean(value), "min-h-10 gap-2 px-4")}>
            <CalendarIcon aria-hidden="true" size={16} />
            <span>{summary}</span>
          </button>
        }
      >
        <div className="grid gap-3">
          <div className="flex flex-wrap gap-2">
            {presets.map((p) => (
              <button key={p} type="button" onClick={() => pick(p)} className={chipClass(false, "min-h-10")}>{L.presets[p]}</button>
            ))}
          </div>
          <fieldset className="grid gap-3 border-t border-line pt-3">
            <legend className="sr-only">{L.custom}</legend>
            <p className="text-sm font-bold">{L.custom}</p>
            <Calendar lang={lang} range={{ from: isIsoDate(from) ? from : null, to: isIsoDate(to) ? to : null }} onPick={clickDay} now={now} />
            <div className="grid grid-cols-2 gap-2">
              <label className="grid gap-1 text-sm font-semibold text-fg-muted">
                {L.from}
                <input type="text" inputMode="numeric" placeholder="2026-09-01" value={from} onChange={(e) => { setFrom(e.target.value); setError(null); }} aria-invalid={error ? true : undefined} aria-describedby={error ? errId : undefined} className={dateInput} />
              </label>
              <label className="grid gap-1 text-sm font-semibold text-fg-muted">
                {L.to}
                <input type="text" inputMode="numeric" placeholder="2026-12-31" value={to} onChange={(e) => { setTo(e.target.value); setError(null); }} aria-invalid={error ? true : undefined} aria-describedby={error ? errId : undefined} className={dateInput} />
              </label>
            </div>
            {error && <p id={errId} role="alert" className="text-sm font-semibold text-danger-fg">{error}</p>}
            <button type="button" onClick={apply} className="ops-gloss min-h-10 cursor-pointer rounded-full px-4 text-sm font-bold">{L.apply}</button>
          </fieldset>
        </div>
      </PickerSurface>
      {value && (
        <button type="button" aria-label={L.clear} title={L.clear} onClick={() => choose(null)} className="inline-grid size-10 cursor-pointer place-items-center rounded-full text-fg-muted hover:bg-neutral-soft hover:text-fg">
          <X aria-hidden="true" size={16} />
        </button>
      )}
    </div>
  );
}
