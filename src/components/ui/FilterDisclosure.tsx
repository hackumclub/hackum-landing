"use client";
import { ChevronDown, SlidersHorizontal } from "lucide-react";
import { useId, useState, type ReactNode } from "react";
import { cx } from "./cx";

/**
 * Wraps a screen's filter chips so they fold behind one "Filters" button on phones (three rows of chips pushed the
 * data off-screen) and stay fully visible from tablet width up. Opens by itself when a filter is already active.
 */
export default function FilterDisclosure({ label, activeCount, children, className, contentClassName }: { label: string; activeCount: number; children: ReactNode; className?: string; contentClassName?: string }) {
  const [open, setOpen] = useState(activeCount > 0);
  const id = useId();
  return (
    <div className={cx("grid gap-3", className)}>
      <button
        type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)}
        className="inline-flex min-h-11 w-fit cursor-pointer items-center gap-2 rounded-full border border-line-strong bg-panel px-4 text-sm font-bold text-fg md:hidden"
      >
        <SlidersHorizontal aria-hidden="true" size={16} />
        {label}
        {activeCount > 0 && <span className="tnum grid min-w-5 place-items-center rounded-full bg-accent px-1.5 text-xs text-on-accent">{activeCount}</span>}
        <ChevronDown aria-hidden="true" size={16} className={cx("transition-transform duration-150", open && "rotate-180")} />
      </button>
      <div id={id} className={cx(open ? "grid" : "hidden", contentClassName ?? "gap-3 md:grid")}>{children}</div>
    </div>
  );
}
