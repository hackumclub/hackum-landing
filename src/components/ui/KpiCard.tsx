import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cx } from "./cx";

export type Delta = { text: string; trend: "up" | "down" | "flat"; /** Is this direction good news? Drives colour only. */ good: boolean; srLabel: string };

/** Label above, big tabular number, signed delta vs the previous period (Stripe-style). */
export default function KpiCard({ label, value, delta, hint }: { label: string; value: string; delta?: Delta; hint?: string }) {
  const Icon = delta?.trend === "up" ? ArrowUpRight : delta?.trend === "down" ? ArrowDownRight : Minus;
  return (
    <div className="grid content-start gap-1 rounded-[var(--radius-md)] border border-line bg-panel p-4">
      <p className="text-sm font-semibold text-fg-muted">{label}</p>
      <p className="tnum font-display text-3xl font-bold text-fg">{value}</p>
      <div className="flex min-h-6 flex-wrap items-center gap-2">
        {delta && (
          <span className={cx("tnum inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-bold", delta.trend === "flat" ? "bg-neutral-soft text-fg" : delta.good ? "bg-ok-soft text-ok-fg" : "bg-danger-soft text-danger-fg")}>
            <Icon aria-hidden="true" size={14} />
            <span aria-hidden="true">{delta.text}</span>
            <span className="sr-only">{delta.srLabel}</span>
          </span>
        )}
        {hint && <span className="text-xs text-fg-muted">{hint}</span>}
      </div>
    </div>
  );
}
