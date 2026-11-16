"use client";
import { Check, ChevronDown } from "lucide-react";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { controlClass } from "./Field";
import { FILTER_CONTROL } from "./control";
import PickerSurface from "./PickerSurface";
import { cx } from "./cx";

export type SelectOption = { value: string; label: string; disabled?: boolean; /** Small muted second line. */ hint?: string };

const PANEL = "z-50 max-h-[var(--radix-popover-content-available-height)] min-w-[var(--radix-popover-trigger-width)] max-w-[min(24rem,calc(100vw-1.5rem))] rounded-[var(--radius-sm)] border border-line bg-panel p-1.5 text-fg shadow-[var(--shadow-float)]";

/**
 * Themed single-choice control (replaces the OS menu of a native `<select>`): a field-styled button, a rounded panel
 * with a check on the chosen option, and a full-width bottom sheet on phones. ARIA combobox + listbox: Enter/Space/
 * ArrowDown open; ArrowUp/ArrowDown/Home/End move, typing jumps to a match (also while closed, like a native select),
 * Enter or Space picks, Esc closes and returns focus. `variant="filter"` is the lighter pill used in filter rows.
 * Give it a visible `<label htmlFor={id}>` (or `Field`) or an `aria-label`. Submits `value` under `name` when given.
 */
export default function Select({ id, value, onValueChange, options, name, disabled, required, placeholder, variant = "field", title, closeLabel = "Close", className, ...aria }: {
  id?: string; value: string; onValueChange: (v: string) => void; options: SelectOption[]; name?: string; disabled?: boolean; required?: boolean;
  placeholder?: string; variant?: "field" | "filter"; /** Sheet title on phones (defaults to the aria-label). */ title?: string; closeLabel?: string; className?: string;
  "aria-label"?: string; "aria-describedby"?: string; "aria-invalid"?: boolean | "true";
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const uid = useId();
  const listId = `${uid}-list`;
  const list = useRef<HTMLDivElement>(null);
  const typed = useRef({ text: "", at: 0 });
  const selected = options.find((o) => o.value === value);
  const enabled = (i: number) => !options[i]?.disabled;

  const pick = (v: string) => { onValueChange(v); setOpen(false); };
  const match = (from: number, ch: string) => {
    const now = Date.now();
    typed.current = { text: now - typed.current.at > 700 ? ch : typed.current.text + ch, at: now };
    const q = typed.current.text.toLowerCase();
    const order = options.map((_, i) => (from + 1 + i) % options.length);
    // A repeated single letter cycles through the options starting with it; a longer prefix stays on the first hit.
    return order.find((i) => enabled(i) && options[i].label.toLowerCase().startsWith(q)) ?? -1;
  };

  const openList = () => { setActive(Math.max(0, options.findIndex((o) => o.value === value))); setOpen(true); };
  const onTriggerKey = (e: KeyboardEvent) => {
    if (disabled) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); openList(); return; }
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey && e.key !== " ") {
      const i = match(options.findIndex((o) => o.value === value), e.key);
      if (i >= 0) onValueChange(options[i].value);
    }
  };
  const move = (from: number, step: 1 | -1) => {
    for (let n = 1; n <= options.length; n++) {
      const i = (from + step * n + options.length * 2) % options.length;
      if (enabled(i)) return i;
    }
    return from;
  };
  const onListKey = (e: KeyboardEvent) => {
    if (e.key === "ArrowDown") setActive((a) => move(a, 1));
    else if (e.key === "ArrowUp") setActive((a) => move(a, -1));
    else if (e.key === "Home") setActive(options.findIndex((_, i) => enabled(i)));
    else if (e.key === "End") setActive(options.length - 1 - [...options].reverse().findIndex((o) => !o.disabled));
    else if (e.key === "Enter" || e.key === " ") { if (enabled(active)) pick(options[active].value); }
    else if (e.key === "Tab") { setOpen(false); return; }
    else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) { const i = match(active, e.key); if (i >= 0) setActive(i); return; }
    else return;
    e.preventDefault();
  };

  // Focus the list when it opens (after the popover/sheet has mounted) and keep the active option in view.
  useEffect(() => { if (open) list.current?.focus(); }, [open]);
  useEffect(() => { if (open) list.current?.querySelector('[aria-selected][data-active="true"]')?.scrollIntoView?.({ block: "nearest" }); }, [open, active]);

  const triggerClass = variant === "filter"
    ? cx("inline-flex min-h-10 w-auto items-center justify-between gap-2 rounded-full border px-4 text-sm font-semibold text-fg", FILTER_CONTROL)
    : controlClass("flex cursor-pointer items-center justify-between gap-2 pr-3 text-left");

  return (
    <>
      <PickerSurface
        open={open} onOpenChange={(o) => (o ? openList() : setOpen(false))} title={title ?? aria["aria-label"] ?? ""} closeLabel={closeLabel} contentClassName={PANEL}
        trigger={
          <button
            type="button" id={id} role="combobox" aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? listId : undefined}
            disabled={disabled} aria-required={required || undefined} onKeyDown={onTriggerKey} {...aria}
            className={cx(triggerClass, "cursor-pointer disabled:cursor-not-allowed disabled:opacity-60", className)}
          >
            <span className={cx("min-w-0 truncate", !selected && "text-fg-muted font-normal")}>{selected?.label ?? placeholder ?? ""}</span>
            <ChevronDown aria-hidden="true" size={16} className={cx("shrink-0 text-fg-muted transition-transform duration-150", open && "rotate-180")} />
          </button>
        }
      >
        <div
          ref={list} id={listId} role="listbox" tabIndex={0} aria-label={aria["aria-label"] ?? title} aria-activedescendant={`${uid}-o${active}`} onKeyDown={onListKey}
          className="grid max-h-[min(20rem,60dvh)] gap-0.5 overflow-y-auto outline-none"
        >
          {options.map((o, i) => {
            const on = o.value === value;
            return (
              <div
                key={o.value} id={`${uid}-o${i}`} role="option" aria-selected={on} aria-disabled={o.disabled || undefined} data-active={i === active}
                onPointerMove={() => { if (!o.disabled && active !== i) setActive(i); }}
                onClick={() => { if (!o.disabled) pick(o.value); }}
                className={cx(
                  "flex min-h-10 cursor-pointer items-center gap-2 rounded-[var(--radius-sm)] px-3 py-1.5 text-sm text-fg",
                  i === active && "bg-neutral-soft", on && "font-bold", o.disabled && "cursor-not-allowed opacity-50",
                )}
              >
                <span className="grid min-w-0 flex-1 leading-5">
                  <span className="[overflow-wrap:anywhere]">{o.label}</span>
                  {o.hint && <span className="text-xs font-normal text-fg-muted">{o.hint}</span>}
                </span>
                {on && <Check aria-hidden="true" size={16} className="shrink-0 text-accent-fg" />}
              </div>
            );
          })}
        </div>
      </PickerSurface>
      {name && <input type="hidden" name={name} value={value} />}
    </>
  );
}
