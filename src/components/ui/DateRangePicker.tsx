"use client";
import * as P from "@radix-ui/react-popover";
import { Calendar, X } from "lucide-react";
import { useId, useState } from "react";
import type { Locale } from "@/i18n/config";
import { isIsoDate, presetRange, type DateRange, type RangePreset } from "@/lib/date-range";
import { formatUb } from "@/lib/time";
import { cx } from "./cx";
import { useOpsPortal } from "./OpsRoot";

export type DateRangeLabels = {
  trigger: string; allDates: string; clear: string; custom: string; from: string; to: string; apply: string;
  errorOrder: string; errorInvalid: string; presets: Record<RangePreset, string>;
};

const DEFAULT_LABELS: Record<Locale, DateRangeLabels> = {
  en: {
    trigger: "Date range", allDates: "Any date", clear: "Clear date range", custom: "Custom", from: "From", to: "To", apply: "Apply",
    errorOrder: "The start date must be on or before the end date.", errorInvalid: "Enter both dates.",
    presets: { thisSemester: "This semester", lastSemester: "Last semester", last30: "Last 30 days", thisYear: "This year" },
  },
  mn: {
    trigger: "Огнооны завсар", allDates: "Бүх огноо", clear: "Огнооны шүүлтийг цэвэрлэх", custom: "Өөр завсар", from: "Эхлэх", to: "Дуусах", apply: "Хэрэглэх",
    errorOrder: "Эхлэх огноо дуусах огнооноос өмнө эсвэл ижил байх ёстой.", errorInvalid: "Хоёр огноог оруулна уу.",
    presets: { thisSemester: "Энэ улирал", lastSemester: "Өнгөрсөн улирал", last30: "Сүүлийн 30 хоног", thisYear: "Энэ жил" },
  },
};

const fmt = (iso: string, lang: Locale) => formatUb(new Date(`${iso}T04:00:00Z`), lang, { month: "short", day: "numeric", year: "numeric" });

/**
 * Date-range filter. Dates are UB calendar days ("YYYY-MM-DD", inclusive). Presets resolve on the UB calendar
 * (semesters via `semesterOf`); "Custom" is two native date inputs validated from ≤ to. `now` is injectable for tests.
 */
export default function DateRangePicker({ value, onChange, presets, lang, labels, now }: {
  value: DateRange | null; onChange: (v: DateRange | null) => void; presets: RangePreset[]; lang: Locale; labels?: Partial<DateRangeLabels>; now?: Date;
}) {
  const L = { ...DEFAULT_LABELS[lang], ...labels };
  const container = useOpsPortal();
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
  const summary = value ? `${fmt(value.from, lang)} – ${fmt(value.to, lang)}` : L.allDates;

  return (
    <div className="inline-flex items-center gap-1">
      <P.Root open={open} onOpenChange={(o) => { setOpen(o); if (o) { setFrom(value?.from ?? ""); setTo(value?.to ?? ""); setError(null); } }}>
        <P.Trigger
          aria-label={`${L.trigger}: ${summary}`}
          className={cx(
            "inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-full border px-4 text-sm font-semibold transition-colors duration-150",
            value ? "border-accent bg-accent-soft text-accent-fg" : "border-line-strong bg-panel text-fg hover:bg-panel-2",
          )}
        >
          <Calendar aria-hidden="true" size={16} />
          <span>{summary}</span>
        </P.Trigger>
        <P.Portal container={container}>
          <P.Content align="start" sideOffset={8} className="z-50 grid w-[min(20rem,92vw)] gap-3 rounded-[var(--radius-md)] border border-line bg-panel p-4 text-fg shadow-[var(--shadow-float)]">
            <div className="flex flex-wrap gap-2">
              {presets.map((p) => (
                <button key={p} type="button" onClick={() => pick(p)} className="min-h-10 cursor-pointer rounded-full border border-line-strong bg-panel px-3 text-sm font-semibold text-fg hover:bg-panel-2">
                  {L.presets[p]}
                </button>
              ))}
            </div>
            <fieldset className="grid gap-2 border-t border-line pt-3">
              <legend className="sr-only">{L.custom}</legend>
              <p className="text-sm font-bold">{L.custom}</p>
              <div className="grid grid-cols-2 gap-2">
                <label className="grid gap-1 text-sm font-semibold text-fg-muted">
                  {L.from}
                  <input type="date" value={from} max={to || undefined} onChange={(e) => { setFrom(e.target.value); setError(null); }} aria-invalid={error ? true : undefined} aria-describedby={error ? errId : undefined} className="min-h-10 rounded-[var(--radius-sm)] border border-line-strong bg-panel px-2 text-fg" />
                </label>
                <label className="grid gap-1 text-sm font-semibold text-fg-muted">
                  {L.to}
                  <input type="date" value={to} min={from || undefined} onChange={(e) => { setTo(e.target.value); setError(null); }} aria-invalid={error ? true : undefined} aria-describedby={error ? errId : undefined} className="min-h-10 rounded-[var(--radius-sm)] border border-line-strong bg-panel px-2 text-fg" />
                </label>
              </div>
              {error && <p id={errId} role="alert" className="text-sm font-semibold text-danger-fg">{error}</p>}
              <button type="button" onClick={apply} className="ops-gloss min-h-10 cursor-pointer rounded-full px-4 text-sm font-bold">{L.apply}</button>
            </fieldset>
          </P.Content>
        </P.Portal>
      </P.Root>
      {value && (
        <button type="button" aria-label={L.clear} title={L.clear} onClick={() => choose(null)} className="inline-grid size-10 cursor-pointer place-items-center rounded-full text-fg-muted hover:bg-neutral-soft hover:text-fg">
          <X aria-hidden="true" size={16} />
        </button>
      )}
    </div>
  );
}
