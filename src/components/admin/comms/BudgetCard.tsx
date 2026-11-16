import { fill } from "@/i18n/config";
import type { AreaCopy } from "@/i18n/areas/admin-members";
import { cx } from "@/components/ui/cx";

/**
 * Daily email budget (Resend free tier): sent today against the limit, with the last `reserved` slots marked as kept
 * for transactional mail. Reminders and announcements stop at `limit - reserved`; the meter shows exactly that line.
 */
export default function BudgetCard({ sent, limit, reserved, label, c, className }: {
  sent: number; limit: number; reserved: number; label: string; c: AreaCopy["comms"]["budget"]; className?: string;
}) {
  const cap = limit - reserved;
  const pct = (n: number) => `${Math.min(100, Math.max(0, (n / limit) * 100))}%`;
  const bulkStopped = sent >= cap;
  return (
    <div className={cx("grid content-start gap-2 rounded-[var(--radius-md)] border border-line bg-panel p-4", className)}>
      <p className="text-sm font-semibold text-fg-muted">{label}</p>
      <p className="tnum font-display text-3xl font-bold text-fg">{fill(c.value, { sent, limit })}</p>
      <div role="meter" aria-label={fill(c.meter, { sent, limit })} aria-valuemin={0} aria-valuemax={limit} aria-valuenow={Math.min(sent, limit)} className="relative h-3 overflow-hidden rounded-full bg-neutral-soft">
        <div aria-hidden="true" className="absolute inset-y-0 right-0 bg-ember-soft" style={{ width: pct(reserved) }} />
        <div aria-hidden="true" data-testid="budget-fill" className={cx("absolute inset-y-0 left-0 rounded-full", bulkStopped ? "bg-ember" : "bg-accent")} style={{ width: pct(sent) }} />
        <div aria-hidden="true" className="absolute inset-y-0 w-px bg-line-strong" style={{ left: pct(cap) }} />
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-fg-muted">
        <li className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="size-2.5 rounded-full bg-accent" />{fill(c.bulk, { cap })}</li>
        <li className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="size-2.5 rounded-full bg-ember-soft ring-1 ring-line-strong" />{fill(c.reserved, { n: reserved })}</li>
      </ul>
      <p className="text-xs text-fg-muted">{bulkStopped ? c.reachedBulk : fill(c.note, { cap, reserved })}</p>
    </div>
  );
}
