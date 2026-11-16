import type { Status } from "@/lib/status";
import { cx } from "./cx";

type Tone = "neutral" | "accent" | "ok" | "warn" | "ember" | "danger" | "ink";
const TONE: Record<Tone, string> = {
  neutral: "bg-neutral-soft text-fg",
  accent: "bg-accent-soft text-accent-fg",
  ok: "bg-ok-soft text-ok-fg",
  warn: "bg-warn-soft text-warn-fg",
  ember: "bg-ember-soft text-ember-fg",
  danger: "bg-danger-soft text-danger-fg",
  ink: "bg-fg text-canvas",
};

/** One status → one tone, everywhere (spec §7). Colour is never the only cue: the label is always visible. */
export const STATUS_STYLE = {
  draft: "neutral", published: "accent", live: "ok", cancelled: "danger", completed: "ink", archived: "neutral",
  applied: "accent", going: "ok", waitlisted: "ember", rejected: "danger", attended: "ok", no_show: "neutral",
  guest: "neutral", member: "accent", alumni: "ink",
  pending: "warn", approved: "ok", withdrawn: "neutral",
} as const satisfies Record<Status, Tone>;

export default function StatusPill({ status, label, className }: { status: Status; label: string; className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold whitespace-nowrap", TONE[STATUS_STYLE[status]], className)}>
      {status === "live" && <span aria-hidden="true" className="size-1.5 rounded-full bg-current motion-safe:animate-pulse" />}
      {label}
    </span>
  );
}
