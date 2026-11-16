import { cx } from "./cx";

/** Number chip (tab counts, unread). Shows `99+` past `max` but the accessible name is always the exact count. */
export default function CountBadge({ n, max = 99, className }: { n: number; max?: number; className?: string }) {
  const exact = Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
  return (
    <span
      role="img"
      aria-label={String(exact)}
      className={cx("tnum inline-grid h-5 min-w-5 place-items-center rounded-full bg-neutral-soft px-1.5 text-xs font-bold text-fg", className)}
    >
      <span aria-hidden="true">{exact > max ? `${max}+` : exact}</span>
    </span>
  );
}
