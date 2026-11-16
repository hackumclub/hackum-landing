import { cx } from "./cx";

/**
 * Shared look of "chip" controls (filter chips, the Filters and date buttons, preset chips): a 1px soft border
 * (`line`), a faint tinted fill, a small lift on hover, and a selected state that is an accent wash with accent text.
 * Chips are identified by their visible text, so they do not need the 3:1 `line-strong` outline (WCAG 1.4.11 is about
 * boundaries needed to identify a control; text inputs keep `line-strong`). Pair with a leading `Check` when `on`.
 * Height is the caller's: `CHIP_H` (40px on phones, 36px from md) for filter chips, `min-h-11` for the phone-only Filters button.
 */
export const chipClass = (on = false, className?: string) =>
  cx(
    "inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3.5 text-sm font-semibold whitespace-nowrap",
    "transition-[background-color,border-color,box-shadow,transform] duration-150 motion-safe:hover:-translate-y-px",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ops-accent)]",
    on
      ? "border-accent/40 bg-accent-soft text-accent-fg"
      : "border-line bg-neutral-soft/60 text-fg hover:border-line-strong/60 hover:bg-panel hover:shadow-[var(--shadow-soft)]",
    className,
  );

export const CHIP_H = "min-h-10 md:min-h-9";

/**
 * Boundary of text inputs and selects that sit in a filter row (search, "date applies to"): one tone lighter than
 * `controlClass` form fields (`line-strong` at 55%, darker on hover, accent on focus), with a hairline lift.
 * Full-strength `line-strong` stays on form fields, where the boundary is what identifies the field.
 */
export const FILTER_CONTROL = "border-line-strong/55! bg-panel shadow-[var(--shadow-soft)] transition-[border-color,box-shadow] duration-150 hover:border-line-strong! focus-visible:border-accent!";
