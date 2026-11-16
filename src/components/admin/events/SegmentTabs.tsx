"use client";
import { cx } from "@/components/ui/cx";

export type SegmentOption<T extends string> = { value: T; label: string; count?: number };

/**
 * Status segments with live counts (Stripe / Linear style). Not route tabs: they filter the view in place, so each is a
 * toggle button and the pressed one is announced with aria-pressed.
 */
export default function SegmentTabs<T extends string>({ label, options, value, onChange }: { label: string; options: SegmentOption<T>[]; value: T; onChange: (v: T) => void }) {
  return (
    <div role="group" aria-label={label} className="-mx-1 flex gap-1 overflow-x-auto border-b border-line px-1 max-md:[mask-image:linear-gradient(90deg,#000_calc(100%-36px),transparent)]">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(o.value)}
            className={cx(
              "inline-flex min-h-10 cursor-pointer items-center gap-1.5 border-b-2 px-3 text-sm font-semibold whitespace-nowrap transition-colors duration-150",
              on ? "border-accent text-fg" : "border-transparent text-fg-muted hover:text-fg",
            )}
          >
            {o.label}
            {o.count !== undefined && <span className="tnum rounded-full bg-neutral-soft px-1.5 text-xs text-fg">{o.count}</span>}
          </button>
        );
      })}
    </div>
  );
}
