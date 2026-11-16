"use client";
import { cx } from "@/components/ui/cx";

export type SegmentedOption<T extends string> = { value: T; label: string; hint?: string };

/** A small radio group drawn as buttons (or cards when options carry a hint). Native radios: arrow keys and labels just work. */
export default function Segmented<T extends string>({ legend, name, value, options, onChange, cards = false }: {
  legend: string; name: string; value: T; options: SegmentedOption<T>[]; onChange: (v: T) => void; cards?: boolean;
}) {
  return (
    <fieldset className="grid gap-1.5">
      <legend className="mb-0.5 text-sm font-semibold text-fg">{legend}</legend>
      <div className={cx("grid gap-2", cards ? "sm:grid-cols-2" : "grid-cols-[repeat(auto-fit,minmax(7rem,1fr))]")}>
        {options.map((o) => (
          <label
            key={o.value}
            className={cx(
              "relative grid cursor-pointer content-start gap-0.5 rounded-[var(--radius-sm)] border px-3 py-2 text-sm transition-colors duration-150",
              "has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent",
              value === o.value ? "border-accent bg-accent-soft text-fg" : "border-line-strong bg-panel text-fg hover:bg-panel-2",
            )}
          >
            <input type="radio" name={name} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} className="sr-only" />
            <span className="font-semibold">{o.label}</span>
            {o.hint && <span className="text-xs text-fg-muted">{o.hint}</span>}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
