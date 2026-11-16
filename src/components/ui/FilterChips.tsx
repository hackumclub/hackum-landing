"use client";
import { Check } from "lucide-react";
import CountBadge from "./CountBadge";
import { CHIP_H, chipClass } from "./control";
import { cx } from "./cx";

export type FilterOption = { value: string; label: string; count?: number };

/**
 * Multi-select filter chips (toggle buttons). Selection state is announced via aria-pressed; the selected chip also
 * shows a check, so colour is never the only cue. With `showLabel` the group label sits in a fixed-width column from
 * md (so the chips of every group start at the same x) and above the chips on phones.
 */
export default function FilterChips({ label, options, value, onChange, showLabel = false }: { label: string; options: FilterOption[]; value: string[]; onChange: (v: string[]) => void; showLabel?: boolean }) {
  const chips = (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = value.includes(o.value);
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((v) => v !== o.value) : [...value, o.value])}
            className={chipClass(on, CHIP_H)}
          >
            {on && <Check aria-hidden="true" size={14} className="shrink-0" />}
            {o.label}
            {o.count !== undefined && <CountBadge n={o.count} className={cx("bg-panel", on ? "text-accent-fg" : "text-fg-muted")} />}
          </button>
        );
      })}
    </div>
  );
  if (!showLabel) return chips;
  return (
    <div className="grid gap-1.5 md:grid-cols-[6.5rem_minmax(0,1fr)] md:items-start md:gap-3">
      <span aria-hidden="true" className="text-sm font-semibold text-fg-muted md:flex md:min-h-9 md:items-center">{label}</span>
      {chips}
    </div>
  );
}
