import { fill } from "@/i18n/config";
import type { AreaCopy } from "@/i18n/areas/admin-members";
import Icon3D from "@/components/Icon3D";
import { cx } from "@/components/ui/cx";

/**
 * Daily email budget (Resend free tier): sent today against the limit, with the last `reserved` slots marked as kept
 * for transactional mail. Reminders and announcements stop at `limit - reserved`; the meter shows exactly that line.
 * The card is the loudest thing on the page on purpose: running out of budget is what silently stops reminders.
 */
export default function BudgetCard({ sent, limit, reserved, label, c, className }: {
  sent: number; limit: number; reserved: number; label: string; c: AreaCopy["comms"]["budget"]; className?: string;
}) {
  const cap = limit - reserved;
  const pct = (n: number) => `${Math.min(100, Math.max(0, (n / limit) * 100))}%`;
  const bulkStopped = sent >= cap;
  return (
    <div className={cx(
      "relative grid content-start gap-3 overflow-hidden rounded-[var(--radius-md)] border border-line p-4 shadow-[var(--shadow-card)] md:p-5",
      bulkStopped ? "bg-[radial-gradient(120%_140%_at_100%_0%,var(--ops-ember-soft),var(--ops-panel)_65%)]" : "bg-[radial-gradient(120%_140%_at_100%_0%,var(--ops-accent-soft),var(--ops-panel)_65%)]",
      className,
    )}>
      <Icon3D name="send" sizes="96px" className="pointer-events-none absolute -top-1 right-2 size-16 rotate-6 drop-shadow-[0_8px_10px_rgb(0_40_70/0.25)] md:size-24" />
      <p className="pr-16 text-sm font-semibold text-fg-muted md:pr-24">{label}</p>
      <p className="tnum font-display text-4xl font-black text-fg md:text-5xl">{fill(c.value, { sent, limit })}</p>
      <div role="meter" aria-label={fill(c.meter, { sent, limit })} aria-valuemin={0} aria-valuemax={limit} aria-valuenow={Math.min(sent, limit)} className="relative h-4 overflow-hidden rounded-full bg-neutral-soft ring-1 ring-line">
        <div aria-hidden="true" className="absolute inset-y-0 right-0 bg-ember-soft" style={{ width: pct(reserved) }} />
        <div aria-hidden="true" data-testid="budget-fill" className={cx("absolute inset-y-0 left-0 rounded-full", bulkStopped ? "bg-ember" : "bg-accent")} style={{ width: pct(sent) }} />
        <div aria-hidden="true" className="absolute inset-y-0 w-0.5 bg-fg/60" style={{ left: pct(cap) }} />
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-fg-muted md:text-sm">
        <li className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="size-2.5 rounded-full bg-accent" />{fill(c.bulk, { cap })}</li>
        <li className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="size-2.5 rounded-full bg-ember-soft ring-1 ring-line-strong" />{fill(c.reserved, { n: reserved })}</li>
      </ul>
      <p className="text-xs text-fg-muted md:text-sm">{bulkStopped ? c.reachedBulk : fill(c.note, { cap, reserved })}</p>
    </div>
  );
}
