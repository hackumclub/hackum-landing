"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Send } from "lucide-react";
import Button from "@/components/ui/Button";
import { fill } from "@/i18n/config";
import type { AreaCopy } from "@/i18n/areas/admin-members";
import { sendQueuedNowAction } from "@/lib/members/actions";
import { errorText } from "@/components/admin/members/shared";
import { cx } from "@/components/ui/cx";

/** Runs one dispatcher beat on demand and reports what it did: "Sent 3 · skipped 1 · failed 0". */
export default function SendNowButton({ c, common }: { c: AreaCopy["comms"]; common: AreaCopy["common"] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const run = () => startTransition(async () => {
    const r = await sendQueuedNowAction();
    if (!r.ok) { setResult({ tone: "error", text: errorText(common.errors, r.error) }); return; }
    const { sent, skipped, failed, reminders, deferred } = r.data;
    const extra = [reminders ? fill(c.sendExtra.reminders, { n: reminders }) : "", deferred ? fill(c.sendExtra.deferred, { n: deferred }) : ""].filter(Boolean);
    setResult({ tone: "ok", text: [sent + skipped + failed + reminders + deferred === 0 ? c.sendNothing : fill(c.sendResult, { sent, skipped, failed }), ...extra].join(" · ") });
    router.refresh();
  });
  return (
    <div className="grid justify-items-start gap-1.5 sm:justify-items-end">
      <Button icon={<Send aria-hidden="true" size={16} />} onClick={run} disabled={pending} aria-busy={pending}>{pending ? c.sending : c.sendNow}</Button>
      <p role="status" data-testid="send-result" className={cx("max-w-sm text-sm font-semibold sm:text-right", result?.tone === "error" ? "text-danger-fg" : "text-ok-fg", !result && "sr-only")}>{result?.text ?? ""}</p>
    </div>
  );
}
