"use client";
import { cx } from "./cx";

/**
 * Small two-to-four way choice drawn as the same soft track + raised chip as `SegmentedTabs`, but as a radio group
 * (it picks a value, it does not switch a panel): language, view mode, density. Native radios underneath, so arrow keys,
 * labels and form submission work; `name` is required for that reason.
 */
export default function SegmentedChoice<T extends string>({ name, ariaLabel, value, onChange, options, disabled, className }: {
  name: string; ariaLabel: string; value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; disabled?: boolean; className?: string;
}) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className={cx("inline-flex items-center gap-0.5 rounded-full bg-seg-track p-1", className)}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <label
            key={o.value}
            className={cx(
              "inline-flex h-8 cursor-pointer items-center rounded-full px-3.5 text-sm font-semibold whitespace-nowrap transition-[background-color,color,box-shadow] duration-150",
              "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-1 has-[:focus-visible]:outline-accent",
              on ? "bg-seg-chip text-fg shadow-raise" : "text-fg-muted hover:bg-seg-chip/50 hover:text-fg",
              disabled && "cursor-not-allowed opacity-60",
            )}
          >
            <input type="radio" name={name} value={o.value} checked={on} disabled={disabled} onChange={() => onChange(o.value)} className="sr-only" />
            {o.label}
          </label>
        );
      })}
    </div>
  );
}
