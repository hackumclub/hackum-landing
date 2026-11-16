import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cx } from "./cx";

export type TagTone = "neutral" | "accent" | "ok" | "warn" | "ember";
const TONE: Record<TagTone, string> = {
  neutral: "bg-neutral-soft text-fg",
  accent: "bg-accent-soft text-accent-fg",
  ok: "bg-ok-soft text-ok-fg",
  warn: "bg-warn-soft text-warn-fg",
  ember: "bg-ember-soft text-ember-fg",
};

/**
 * Category / label chip (event kind, school, scope, theme). Not a state: use StatusPill for that.
 * The text is always rendered, so colour and icon are never the only cue.
 */
export default function Tag({ tone = "neutral", icon: Icon, children, className }: { tone?: TagTone; icon?: LucideIcon; children: ReactNode; className?: string }) {
  return (
    <span className={cx("inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-xs leading-none font-semibold whitespace-nowrap", TONE[tone], className)}>
      {Icon && <Icon aria-hidden="true" size={14} className="shrink-0" />}
      {children}
    </span>
  );
}
