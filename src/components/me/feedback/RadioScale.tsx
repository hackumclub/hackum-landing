"use client";
import { Star } from "lucide-react";
import { useId, useState, type ReactNode } from "react";
import { fill } from "@/i18n/config";
import { cx } from "@/components/ui/cx";

type Common = {
  /** Form field name; also keeps the radios in one group so the arrow keys move between them. */
  name: string; value: number | null; onChange: (n: number) => void;
  label: ReactNode; required?: boolean; error?: string;
};

/** The group's label, the live "you chose" line and the error, wired to the radiogroup with ids. */
function Shell({ label, required, error, status, children, ids }: { label: ReactNode; required?: boolean; error?: string; status: string; children: ReactNode; ids: { label: string; status: string; error: string } }) {
  return (
    <div role="radiogroup" aria-labelledby={ids.label} aria-required={required || undefined} aria-invalid={error ? true : undefined} aria-describedby={[error ? ids.error : null, ids.status].filter(Boolean).join(" ")} className="grid gap-2">
      <p id={ids.label} className="text-sm font-semibold text-fg">{label}{required && <span aria-hidden="true" className="text-danger-fg"> *</span>}</p>
      {children}
      <p id={ids.status} aria-live="polite" className="min-h-5 text-sm text-fg-muted">{status}</p>
      {error && <p id={ids.error} className="text-sm font-semibold text-danger-fg">{error}</p>}
    </div>
  );
}

const useIds = () => {
  const id = useId();
  return { label: `${id}-l`, status: `${id}-s`, error: `${id}-e` };
};

/**
 * Overall rating: five 44 px star buttons (native radios, so Tab enters the group once and the arrow keys move and choose).
 * Hover previews the fill; the chosen star is never colour-only: every star carries its number and the line below spells out
 * "4 of 5: Great".
 */
export function StarRating({ words, starLabel, chosen, none, ...p }: Common & { words: readonly string[]; starLabel: string; chosen: string; none: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const ids = useIds();
  const shown = hover ?? p.value ?? 0;
  const status = p.value ? fill(chosen, { n: p.value, word: words[p.value - 1] }) : none;
  return (
    <Shell label={p.label} required={p.required} error={p.error} status={status} ids={ids}>
      <div className="flex flex-wrap gap-1" onMouseLeave={() => setHover(null)}>
        {words.map((word, i) => {
          const n = i + 1;
          const on = n <= shown;
          return (
            <label key={n} onMouseEnter={() => setHover(n)}
              className="relative grid min-h-14 min-w-12 cursor-pointer content-center justify-items-center gap-0.5 rounded-[var(--radius-sm)] px-1 transition-colors duration-150 hover:bg-neutral-soft has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent">
              <input type="radio" name={p.name} value={n} checked={p.value === n} onChange={() => p.onChange(n)} aria-label={fill(starLabel, { n, word })} className="peer sr-only" />
              <Star aria-hidden="true" size={30} strokeWidth={2} className={cx("transition-colors duration-150", on ? "fill-warn-fg text-warn-fg" : "text-fg-muted")} />
              <span aria-hidden="true" className={cx("text-xs tnum", p.value === n ? "font-black text-fg" : "font-semibold text-fg-muted")}>{n}</span>
            </label>
          );
        })}
      </div>
    </Shell>
  );
}

/**
 * "Would you recommend this?" 0–10: eleven numbered radios, six + five on a phone (two rows), one row from 640 px, every target
 * at least 44 px. The end labels carry their numbers so the two rows still read as one scale.
 */
export function NpsScale({ option, low, high, chosen, none, ...p }: Common & { option: string; low: string; high: string; chosen: string; none: string }) {
  const ids = useIds();
  const status = p.value !== null ? fill(chosen, { n: p.value }) : none;
  return (
    <Shell label={p.label} required={p.required} error={p.error} status={status} ids={ids}>
      <p aria-hidden="true" className="flex justify-between gap-3 text-xs font-semibold text-fg-muted"><span>0 · {low}</span><span className="text-right">10 · {high}</span></p>
      <div className="grid grid-cols-6 gap-2 sm:grid-cols-11">
        {Array.from({ length: 11 }, (_, n) => (
          <label key={n}
            className={cx("grid min-h-11 min-w-11 cursor-pointer place-items-center rounded-[var(--radius-sm)] border-2 text-base tnum transition-colors duration-150 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent",
              p.value === n ? "border-accent bg-accent-soft font-black text-accent-fg" : "border-line bg-panel-2 font-semibold text-fg hover:bg-neutral-soft")}>
            <input type="radio" name={p.name} value={n} checked={p.value === n} onChange={() => p.onChange(n)} aria-label={fill(option, { n })} className="sr-only" />
            <span aria-hidden="true">{n}</span>
          </label>
        ))}
      </div>
    </Shell>
  );
}
