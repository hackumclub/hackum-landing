"use client";
import { fill, type Locale } from "@/i18n/config";
import { copy } from "@/i18n/areas/admin-events";
import { plural } from "@/i18n/plural";
import Button from "@/components/ui/Button";

/**
 * Appears when rows are selected. Capacity-aware: Accept is disabled, with the reason written next to it, when it would
 * take more seats than are left (the rule re-checks and answers "full" if someone else just took a seat).
 */
export default function BulkBar({ lang, count, application, hasTeam, wholeTeam, onWholeTeam, adding, taken, over, capacity, pending, onDecide, onClear }: {
  lang: Locale; count: number; application: boolean; hasTeam: boolean; wholeTeam: boolean; onWholeTeam: (v: boolean) => void;
  adding: number; taken: number; over: number; capacity: number | null; pending: boolean;
  onDecide: (d: "accept" | "reject" | "waitlist") => void; onClear: () => void;
}) {
  const t = copy[lang].regs.bulk;
  const left = capacity === null ? null : Math.max(0, capacity - taken - adding);
  const status = over > 0 ? fill(t.over, { n: over, max: capacity ?? 0 }) : capacity === null ? fill(t.fitsUnlimited, { adding }) : fill(t.fits, { adding, left: left ?? 0 });
  return (
    <div role="group" aria-label={t.groupLabel} className="sticky bottom-3 z-20 grid gap-3 rounded-[var(--radius-md)] border border-line-strong bg-panel p-3 shadow-[var(--shadow-card)] md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-center">
      <div className="flex items-center gap-3">
        <p className="text-sm font-bold text-fg">{plural(lang, count, t.selected)}</p>
        <button type="button" onClick={onClear} className="cursor-pointer rounded text-sm font-semibold text-accent-fg hover:underline">{t.clear}</button>
      </div>
      <div className="grid gap-1.5">
        {application && hasTeam && (
          <label className="flex min-h-9 items-center gap-2 text-sm font-semibold text-fg">
            <input type="checkbox" checked={wholeTeam} onChange={(e) => onWholeTeam(e.target.checked)} className="size-4 accent-[var(--ops-accent)]" />
            {t.wholeTeam}
          </label>
        )}
        <p id="bulk-status" role="status" className={over > 0 ? "text-sm font-semibold text-danger-fg" : "text-sm text-fg-muted"}>{adding > 0 || over > 0 ? status : ""}</p>
        {!application && <p className="text-xs text-fg-muted">{t.promoteNote}</p>}
      </div>
      <div className="flex flex-wrap gap-2">
        {application ? (
          <>
            <Button disabled={pending || over > 0} aria-describedby={over > 0 ? "bulk-status" : undefined} onClick={() => onDecide("accept")}>{t.accept}</Button>
            <Button variant="secondary" disabled={pending} onClick={() => onDecide("waitlist")}>{t.waitlist}</Button>
            <Button variant="secondary" disabled={pending} onClick={() => onDecide("reject")}>{t.reject}</Button>
          </>
        ) : (
          <Button disabled={pending || over > 0} aria-describedby={over > 0 ? "bulk-status" : undefined} onClick={() => onDecide("accept")}>{t.promote}</Button>
        )}
      </div>
    </div>
  );
}
