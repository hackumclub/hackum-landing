import { cx } from "./cx";

/** Seats taken vs capacity. `max: null` = unlimited → text only (a meter with no maximum would mislead). */
export default function CapacityBar({ value, max, label, align = "start", className }: { value: number; max: number | null; label: string; /** "end" right-aligns the numbers in the table layout (md and up; phone cards stay left). */ align?: "start" | "end"; className?: string }) {
  if (max === null) return <p className={cx("tnum text-sm text-fg-muted", align === "end" && "md:text-right", className)}>{label}</p>;
  const pct = Math.min(100, Math.round((value / Math.max(max, 1)) * 100));
  const tone = pct >= 100 ? "bg-danger" : pct >= 85 ? "bg-ember" : "bg-accent";
  return (
    <div className={cx("grid gap-1", className)}>
      <div role="meter" aria-label={label} aria-valuenow={value} aria-valuemin={0} aria-valuemax={max} className="h-2 overflow-hidden rounded-full bg-neutral-soft">
        <div data-testid="capacity-fill" className={cx("h-full rounded-full", tone)} style={{ width: `${pct}%` }} />
      </div>
      <p aria-hidden="true" className={cx("tnum text-xs text-fg-muted", align === "end" && "md:text-right")}>{label}</p>
    </div>
  );
}
