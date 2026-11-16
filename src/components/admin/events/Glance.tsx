import Icon3D from "@/components/Icon3D";
import { cx } from "@/components/ui/cx";
import type { ReactNode } from "react";

export type GlanceTone = "blue" | "yellow" | "green" | "ember";

// Same soft corner wash as the dashboard KPI cards: the number and label stay on a calm surface (AA-safe).
const WASH: Record<GlanceTone, string> = {
  blue: "bg-[radial-gradient(120%_120%_at_100%_0%,var(--ops-accent-soft),var(--ops-panel)_62%)]",
  yellow: "bg-[radial-gradient(120%_120%_at_100%_0%,var(--ops-warn-soft),var(--ops-panel)_62%)]",
  green: "bg-[radial-gradient(120%_120%_at_100%_0%,var(--ops-ok-soft),var(--ops-panel)_62%)]",
  ember: "bg-[radial-gradient(120%_120%_at_100%_0%,var(--ops-ember-soft),var(--ops-panel)_62%)]",
};

/** One metric of the "At a glance" strip: tinted card, 3D icon in the corner, big tabular number, optional extra (e.g. a seats bar). */
export default function Glance({ label, value, icon, tone, className, children }: { label: string; value: number; icon: string; tone: GlanceTone; className?: string; children?: ReactNode }) {
  return (
    <div className={cx("relative grid content-start gap-1 overflow-hidden rounded-[var(--radius-md)] p-4 shadow-[var(--shadow-card)]", WASH[tone], className)}>
      <Icon3D name={icon} sizes="64px" className="pointer-events-none absolute -top-1 -right-1 size-14 rotate-6 drop-shadow-[0_8px_10px_rgb(0_40_70/0.25)] md:size-16" />
      <dt className="pr-12 text-sm font-semibold text-fg-muted">{label}</dt>
      <dd className="grid gap-1.5">
        <span className="tnum font-display text-3xl font-black text-fg">{value}</span>
        {children}
      </dd>
    </div>
  );
}
