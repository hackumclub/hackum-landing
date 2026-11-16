import { cx } from "./cx";

/** Loading placeholder. Decorative; pair with a visually hidden "Loading…" status in the region. */
export default function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cx("rounded-[var(--radius-sm)] bg-neutral-soft motion-safe:animate-pulse", className)} />;
}
