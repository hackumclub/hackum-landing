"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import { Check, Loader2 } from "lucide-react";
import Button from "@/components/ui/Button";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { cx } from "@/components/ui/cx";
import { cancelRsvp, rsvp } from "@/lib/me/actions";
import { useToast } from "./Toast";
import { pill } from "./pill";

type Errors = Record<string, string>;

/** Messages keyed by Result error code (+ a generic fallback under "server"). */
const say = (errors: Errors, code: string) => errors[code] ?? errors.server;

/**
 * One-tap RSVP. The button flips to its confirmed state the moment it is pressed (optimistic) and flips back with a
 * specific message if the server refuses (full, closed, members-only…).
 */
export function RsvpButton({ eventId, label, doneLabel, waitlistDoneLabel, errors, size = "lg" }: {
  eventId: string; label: string; doneLabel: string; waitlistDoneLabel: string; errors: Errors; size?: "md" | "lg";
}) {
  const router = useRouter();
  const toast = useToast();
  const [phase, setPhase] = useState<"idle" | "pending" | "done" | "waitlisted">("idle");
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();

  function run() {
    setError(null);
    setPhase("pending");
    start(async () => {
      const r = await rsvp(eventId);
      if (r.ok) {
        setPhase(r.data.status === "waitlisted" ? "waitlisted" : "done");
        toast(r.data.status === "waitlisted" ? waitlistDoneLabel : doneLabel);
        router.refresh();
      } else {
        setPhase("idle");
        setError(say(errors, r.error));
      }
    });
  }

  const busy = phase === "pending";
  const settled = phase === "done" || phase === "waitlisted";
  return (
    <div className="grid gap-1.5">
      <Button size={size} variant={settled ? "ghost" : "primary"} disabled={busy || settled} aria-busy={busy} onClick={run}
        icon={busy ? <Loader2 aria-hidden="true" size={16} className="motion-safe:animate-spin" /> : settled ? <Check aria-hidden="true" size={16} className="text-ok-fg" /> : undefined}>
        {phase === "waitlisted" ? waitlistDoneLabel : settled ? doneLabel : label}
      </Button>
      <p role="alert" className="min-h-0 text-sm font-semibold text-danger-fg empty:hidden">{error}</p>
    </div>
  );
}

/** Cancel / leave waitlist / withdraw application. The dialog names the event and says what will happen. */
export function CancelButton({ eventId, trigger, title, body, confirm, keep, doneText, errors, variant = "danger", className, icon }: {
  eventId: string; trigger: string; title: string; body: string; confirm: string; keep: string; doneText: string; errors: Errors; variant?: "soft" | "danger"; className?: string; icon?: ReactNode;
}) {
  const router = useRouter();
  const toast = useToast();
  const [state, setState] = useState<"idle" | "pending" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();

  function run() {
    setError(null);
    setState("pending");
    start(async () => {
      const r = await cancelRsvp(eventId);
      if (r.ok) { setState("done"); toast(doneText); router.refresh(); }
      else { setState("idle"); setError(say(errors, r.error)); }
    });
  }
  return (
    <div className="grid min-w-0 gap-1.5">
      <ConfirmDialog
        trigger={<button type="button" disabled={state !== "idle"} className={cx(pill[variant], className)}>{icon}{trigger}</button>}
        title={title} body={body} confirmLabel={confirm} cancelLabel={keep} tone="danger" onConfirm={run}
      />
      <p role="alert" className="text-sm font-semibold text-danger-fg empty:hidden">{error}</p>
    </div>
  );
}
