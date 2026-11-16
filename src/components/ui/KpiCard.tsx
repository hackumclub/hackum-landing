import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import Icon3D from "@/components/Icon3D";
import { cx } from "./cx";

export type Delta = { text: string; trend: "up" | "down" | "flat"; /** Is this direction good news? Drives colour only. */ good: boolean; srLabel: string };
export type KpiTone = "blue" | "yellow" | "green" | "ember";

// A soft wash of the tone's colour in the card's corner; the number and label stay on a calm surface (AA-safe).
const WASH: Record<KpiTone, string> = {
  blue: "bg-[radial-gradient(120%_120%_at_100%_0%,var(--ops-accent-soft),var(--ops-panel)_62%)]",
  yellow: "bg-[radial-gradient(120%_120%_at_100%_0%,var(--ops-warn-soft),var(--ops-panel)_62%)]",
  green: "bg-[radial-gradient(120%_120%_at_100%_0%,var(--ops-ok-soft),var(--ops-panel)_62%)]",
  ember: "bg-[radial-gradient(120%_120%_at_100%_0%,var(--ops-ember-soft),var(--ops-panel)_62%)]",
};

/** Label above, big tabular number, signed delta vs the previous period; optional 3D icon (decorative) with a tone wash. */
export default function KpiCard({ label, value, delta, hint, icon, tone = "blue" }: { label: string; value: string; delta?: Delta; hint?: string; icon?: string; tone?: KpiTone }) {
  const Icon = delta?.trend === "up" ? ArrowUpRight : delta?.trend === "down" ? ArrowDownRight : Minus;
  return (
    <div className={cx("relative grid content-start gap-1 overflow-hidden rounded-[var(--radius-md)] p-4 shadow-[var(--shadow-card)]", icon ? WASH[tone] : "bg-panel")}>
      {icon && <Icon3D name={icon} sizes="64px" className="pointer-events-none absolute -top-1 -right-1 size-14 rotate-6 drop-shadow-[0_8px_10px_rgb(0_40_70/0.25)] md:size-16" />}
      <p className={cx("text-sm font-semibold text-fg-muted", icon && "pr-12")}>{label}</p>
      <p className="tnum font-display text-3xl font-black text-fg">{value}</p>
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
