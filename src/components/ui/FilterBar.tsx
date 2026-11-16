"use client";
import { cx } from "./cx";

export type FilterOption = { value: string; label: string; count?: number };

/** Multi-select filter chips (toggle buttons). Selection state is announced via aria-pressed. */
export default function FilterBar({ label, options, value, onChange }: { label: string; options: FilterOption[]; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = value.includes(o.value);
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((v) => v !== o.value) : [...value, o.value])}
            className={cx(
              "inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-sm font-semibold transition-colors duration-150",
              on ? "border-accent bg-accent-soft text-accent-fg" : "border-line-strong bg-panel text-fg hover:bg-panel-2",
            )}
          >
            {o.label}
            {o.count !== undefined && <span className="tnum text-xs text-fg-muted">{o.count}</span>}
          </button>
        );
      })}
    </div>
  );
}
