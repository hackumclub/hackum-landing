"use client";
import { useId, type ReactNode } from "react";

/** A labelled on/off switch (role=switch on a checkbox): 44 px+ target, the explanation is read with it. */
export default function Switch({ label, line, checked, onChange }: { label: string; line: ReactNode; checked: boolean; onChange: (v: boolean) => void }) {
  const id = useId();
  return (
    <label className="flex min-h-14 cursor-pointer items-center gap-3 rounded-[var(--radius-sm)] border border-line bg-panel-2 px-4 py-3">
      <span className="grid flex-1 gap-0.5"><span className="font-semibold text-fg">{label}</span><span id={`${id}-d`} className="text-sm text-fg-muted">{line}</span></span>
      <input type="checkbox" role="switch" checked={checked} aria-describedby={`${id}-d`} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
      <span aria-hidden="true" className="relative h-8 w-14 shrink-0 rounded-full bg-line-strong transition-colors duration-150 peer-checked:bg-accent peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent peer-checked:[&>span]:translate-x-6">
        <span className="absolute top-1 left-1 size-6 rounded-full bg-white shadow-sm transition-transform duration-150" />
      </span>
    </label>
  );
}
