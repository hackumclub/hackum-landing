import { cx } from "@/components/ui/cx";

/** Voted ÷ eligible as a meter. Never turns red at 100%: full turnout is good news, unlike a full room. */
export default function TurnoutBar({ voters, eligible, label, className }: { voters: number; eligible: number; label: string; className?: string }) {
  const pct = eligible > 0 ? Math.min(100, Math.round((voters / eligible) * 100)) : 0;
  return (
    <div className={cx("grid gap-1", className)}>
      <div role="meter" aria-label={label} aria-valuenow={Math.min(voters, eligible)} aria-valuemin={0} aria-valuemax={Math.max(eligible, 1)} className="h-2 overflow-hidden rounded-full bg-neutral-soft">
        <div className="h-full rounded-full bg-c3" style={{ width: `${pct}%` }} />
      </div>
      <p aria-hidden="true" className="tnum text-xs text-fg-muted">{label}</p>
    </div>
  );
}
