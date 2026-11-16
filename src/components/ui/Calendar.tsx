"use client";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { Locale } from "@/i18n/config";
import {
  addDays, addMonths, clampIso, dayName, endOfMonth, endOfWeek, isBetween, monthTitle, monthWeeks, startOfMonth, startOfWeek,
  todayIso, weekdayLong, weekdayShort, type Iso,
} from "@/lib/calendar";
import { cx } from "./cx";

const LABELS = { en: { prev: "Previous month", next: "Next month", today: "today" }, mn: { prev: "Өмнөх сар", next: "Дараагийн сар", today: "өнөөдөр" } } as const;

export type CalendarProps = {
  lang: Locale;
  /** Single selection (a `DatePicker`). */
  value?: Iso | null;
  /** Range selection (a `DateRangePicker`): both ends are tinted and the days between get the soft fill. */
  range?: { from: Iso | null; to: Iso | null };
  onPick: (iso: Iso) => void;
  min?: Iso;
  max?: Iso;
  /** Injectable "now" for tests; the today marker is the UB calendar day. */
  now?: Date;
  className?: string;
};

/**
 * Themed month grid (ARIA grid pattern). Monday first, UB calendar days as `YYYY-MM-DD`. One day is tabbable (roving
 * tabindex); arrows move by day/week, Home/End jump to the start/end of the week, PageUp/PageDown move a month
 * (Shift: a year), Enter/Space picks. Days outside min/max stay focusable but are `aria-disabled` and cannot be picked.
 */
export default function Calendar({ lang, value = null, range, onPick, min, max, now, className }: CalendarProps) {
  const L = LABELS[lang];
  const today = todayIso(now);
  const anchor = value ?? range?.from ?? range?.to ?? today;
  const [focus, setFocus] = useState<Iso>(clampIso(anchor, min, max));
  const grid = useRef<HTMLDivElement>(null);
  const moved = useRef(false);

  // After a keyboard move the newly focused day must receive DOM focus once it has rendered (it may be on another month).
  useEffect(() => {
    if (!moved.current) return;
    moved.current = false;
    grid.current?.querySelector<HTMLElement>(`[data-iso="${focus}"]`)?.focus();
  }, [focus]);

  const go = (iso: Iso, keyboard = true) => { moved.current = keyboard; setFocus(iso); };
  const weeks = monthWeeks(focus);
  const disabled = (iso: Iso) => Boolean((min && iso < min) || (max && iso > max));
  const sel = (iso: Iso) => (range ? iso === range.from || iso === range.to : iso === value);

  const onKey = (e: KeyboardEvent<HTMLElement>) => {
    const step: Record<string, Iso> = {
      ArrowLeft: addDays(focus, -1), ArrowRight: addDays(focus, 1), ArrowUp: addDays(focus, -7), ArrowDown: addDays(focus, 7),
      Home: startOfWeek(focus), End: endOfWeek(focus),
      PageUp: addMonths(focus, e.shiftKey ? -12 : -1), PageDown: addMonths(focus, e.shiftKey ? 12 : 1),
    };
    const next = step[e.key];
    if (!next) return;
    e.preventDefault();
    go(next);
  };

  const monthNav = (n: number) => go(addMonths(focus, n), false);
  const navBtn = "inline-grid size-10 cursor-pointer place-items-center rounded-full text-fg-muted transition-colors duration-150 hover:bg-neutral-soft hover:text-fg focus-visible:outline-2 focus-visible:outline-[var(--ops-accent)]";
  const first = startOfMonth(focus), last = endOfMonth(focus);

  return (
    <div className={cx("grid gap-2", className)}>
      <div className="flex items-center justify-between gap-2">
        <button type="button" aria-label={L.prev} onClick={() => monthNav(-1)} className={navBtn}><ChevronLeft aria-hidden="true" size={18} /></button>
        <p aria-live="polite" className="text-sm font-bold text-fg">{monthTitle(focus, lang)}</p>
        <button type="button" aria-label={L.next} onClick={() => monthNav(1)} className={navBtn}><ChevronRight aria-hidden="true" size={18} /></button>
      </div>
      <div ref={grid} role="grid" aria-label={monthTitle(focus, lang)} onKeyDown={onKey} className="grid gap-y-1">
        <div role="row" className="grid grid-cols-7">
          {weekdayShort(lang).map((w, i) => (
            <span key={w} role="columnheader" aria-label={weekdayLong(lang)[i]} className="grid h-8 place-items-center text-xs font-semibold text-fg-muted">{w}</span>
          ))}
        </div>
        {weeks.map((week, wi) => (
          <div key={wi} role="row" className="grid grid-cols-7">
            {week.map((iso, di) => {
              if (!iso) return <span key={di} role="gridcell" aria-hidden="true" />;
              const selected = sel(iso);
              const inRange = range ? isBetween(iso, range.from, range.to) : false;
              const isToday = iso === today;
              const off = disabled(iso);
              const edgeL = inRange && (iso === (range!.from! < range!.to! ? range!.from : range!.to) || di === 0 || iso === first);
              const edgeR = inRange && (iso === (range!.from! < range!.to! ? range!.to : range!.from) || di === 6 || iso === last);
              return (
                <span key={iso} role="gridcell" aria-selected={selected || undefined} className={cx("grid place-items-center", inRange && "bg-accent-soft", edgeL && "rounded-l-full", edgeR && "rounded-r-full")}>
                  <button
                    type="button" data-iso={iso} tabIndex={iso === focus ? 0 : -1} aria-label={isToday ? `${dayName(iso, lang)} (${L.today})` : dayName(iso, lang)}
                    aria-current={isToday ? "date" : undefined} aria-disabled={off || undefined}
                    onClick={() => { go(iso, false); if (!off) onPick(iso); }}
                    className={cx(
                      "tnum relative grid size-10 cursor-pointer place-items-center rounded-full text-sm font-semibold transition-colors duration-150 md:size-9",
                      "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--ops-accent)]",
                      selected ? "bg-accent text-on-accent" : off ? "cursor-not-allowed text-fg-muted opacity-40" : "text-fg hover:bg-neutral-soft",
                      isToday && !selected && "ring-1 ring-accent ring-inset",
                    )}
                  >
                    {Number(iso.slice(8, 10))}
                  </button>
                </span>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
