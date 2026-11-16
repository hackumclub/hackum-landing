import { cx } from "./cx";

/** Seats taken vs capacity. `max: null` = unlimited → text only (a meter with no maximum would mislead). */
export default function CapacityBar({ value, max, label, className }: { value: number; max: number | null; label: string; className?: string }) {
  if (max === null) return <p className={cx("text-sm text-fg-muted", className)}>{label}</p>;
  const pct = Math.min(100, Math.round((value / Math.max(max, 1)) * 100));
  const tone = pct >= 100 ? "bg-danger" : "bg-accent";
  return (
    <div className={cx("grid gap-1", className)}>
      <div role="meter" aria-label={label} aria-valuenow={value} aria-valuemin={0} aria-valuemax={max} className="h-2 overflow-hidden rounded-full bg-neutral-soft">
        <div data-testid="capacity-fill" className={cx("h-full rounded-full", tone)} style={{ width: `${pct}%` }} />
      </div>
      <p aria-hidden="true" className="tnum text-xs text-fg-muted">{label}</p>
    </div>
  );
}
