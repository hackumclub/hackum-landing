"use client";
import { ChevronDown, SlidersHorizontal } from "lucide-react";
import { useId, useState, type ReactNode } from "react";
import { chipClass } from "./control";
import CountBadge from "./CountBadge";
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
        className={chipClass(activeCount > 0, "min-h-11 w-fit gap-2 px-4 font-bold md:hidden")}
      >
        <SlidersHorizontal aria-hidden="true" size={16} />
        {label}
        {activeCount > 0 && <CountBadge n={activeCount} className="bg-accent text-on-accent" />}
        <ChevronDown aria-hidden="true" size={16} className={cx("transition-transform duration-150", open && "rotate-180")} />
      </button>
      <div id={id} className={cx(open ? "grid" : "hidden", contentClassName ?? "gap-3 md:grid")}>{children}</div>
    </div>
  );
}
