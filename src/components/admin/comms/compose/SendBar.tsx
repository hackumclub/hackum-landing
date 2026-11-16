"use client";
import { Send } from "lucide-react";
import { useId } from "react";
import Button from "@/components/ui/Button";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { fill, type Locale } from "@/i18n/config";
import { plural } from "@/i18n/plural";
import { daysSentence, type AudienceKind, type BlockReason } from "@/lib/announce/compose-state";
import { copy } from "@/lib/announce/copy";

/**
 * Sticky bar with the one primary action. Send stays disabled until the message is valid, with the reason written next
 * to it; the confirm dialog names the subject, the audience and the number, how many days the free plan needs, and
 * that people who opted out are skipped.
 */
export default function SendBar({ lang, reason, subject, kind, eventTitle, audienceLabel, willReceive, optedOut, plan, enMissing, sending, onConfirm }: {
  lang: Locale; reason: BlockReason | null; subject: string; kind: AudienceKind | null; eventTitle: string; audienceLabel: string;
  willReceive: number; optedOut: number; plan: { perDay: number; reserved: number }; enMissing: boolean; sending: boolean; onConfirm: () => void;
}) {
  const c = copy[lang].send;
  const reasonId = useId();
  const noun = kind ? plural(lang, willReceive, c.nouns[kind], { event: eventTitle }).replace(/^\d+\s*/, "") : "";
  const body = (
    <span className="grid gap-2">
      <span>{fill(c.confirmAudience, { audience: audienceLabel })}</span>
      <span>{daysSentence(willReceive, plan, { one: c.planOne, other: c.planOther })}</span>
      <span>{optedOut > 0 ? fill(c.confirmOptedOut, { n: optedOut }) : c.confirmNobodyOptedOut}</span>
      {enMissing && <span>{c.confirmEnMissing}</span>}
    </span>
  );
  return (
    <div data-testid="send-bar" className="sticky bottom-[calc(var(--tab-bar,0px)+0.75rem)] z-20 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-[var(--radius-md)] border border-line bg-panel p-3 shadow-[var(--shadow-float)]">
      <p id={reasonId} aria-live="polite" className="min-w-0 flex-1 text-sm font-semibold text-fg-muted [overflow-wrap:anywhere]">{reason ? c.why[reason] : c.ready}</p>
      <ConfirmDialog
        trigger={
          <Button icon={<Send aria-hidden="true" size={16} />} disabled={reason !== null || sending} aria-describedby={reasonId} aria-busy={sending || undefined}>
            {sending ? c.sending : c.button}
          </Button>
        }
        title={fill(c.confirmTitle, { subject, n: willReceive, noun })}
        body={body}
        confirmLabel={c.confirmLabel}
        cancelLabel={c.cancel}
        onConfirm={onConfirm}
      />
    </div>
  );
}
