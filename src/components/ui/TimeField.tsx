"use client";
import { useState } from "react";
import { parseTime, shiftTime } from "@/lib/calendar";
import { controlClass } from "./Field";
import { cx } from "./cx";

/**
 * 24-hour `HH:mm` text field (UB wall clock). Type "930" or "9:30"; ArrowUp/ArrowDown step 15 minutes (Shift: 1 hour).
 * Calls `onChange` only with a valid "HH:mm"; an unfinished entry stays as typed and shows the invalid state on blur.
 */
export default function TimeField({ value, onChange, label, invalidLabel, className, ...aria }: {
  value: string | null; onChange: (v: string) => void; label: string; invalidLabel?: string; className?: string;
  id?: string; "aria-describedby"?: string; required?: boolean;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const [bad, setBad] = useState(false);
  const shown = draft ?? value ?? "";
  const commit = (raw: string) => {
    const t = parseTime(raw);
    if (t) { onChange(t); setDraft(null); setBad(false); } else if (raw.trim() === "") { setDraft(null); setBad(false); } else setBad(true);
  };
  return (
    <>
      <input
        type="text" inputMode="numeric" autoComplete="off" placeholder="HH:mm" maxLength={5} aria-label={label} aria-invalid={bad || undefined}
        {...aria} value={shown}
        onChange={(e) => { setDraft(e.target.value); setBad(false); if (parseTime(e.target.value) && /^\d{2}:\d{2}$/.test(e.target.value)) commit(e.target.value); }}
        onBlur={() => { if (draft !== null) commit(draft); }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && draft !== null) { e.preventDefault(); commit(draft); }
          if (e.key === "ArrowUp" || e.key === "ArrowDown") {
            e.preventDefault();
            const base = parseTime(shown) ?? "09:00";
            const next = shiftTime(base, (e.key === "ArrowUp" ? 1 : -1) * (e.shiftKey ? 60 : 15));
            setDraft(null); setBad(false); onChange(next);
          }
        }}
        className={controlClass(cx("tnum", className))}
      />
      {bad && invalidLabel && <span role="alert" className="sr-only">{invalidLabel}</span>}
    </>
  );
}
