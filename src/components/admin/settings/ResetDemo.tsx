"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { RotateCcw } from "lucide-react";
import Button from "@/components/ui/Button";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import type { AreaCopy } from "@/i18n/areas/admin-members";
import { resetDemoData } from "@/lib/server/auth-actions";
import { NoticeBanner, type Notice } from "@/components/admin/members/shared";

/** Admin-only: put the local demo database back to the seed. Confirmation names exactly what is lost. */
export default function ResetDemo({ c, common }: { c: AreaCopy["settings"]["integrations"]["reset"]; common: AreaCopy["common"] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<Notice | null>(null);
  const run = () => startTransition(async () => {
    const r = await resetDemoData();
    setNotice(r.ok ? { tone: "ok", text: c.done } : { tone: "error", text: c.failed });
    router.refresh();
  });
  return (
    <section aria-labelledby="reset-demo" className="grid gap-3 rounded-[var(--radius-md)] border border-line bg-panel p-4">
      <div className="grid gap-0.5">
        <h2 id="reset-demo" className="font-display text-base font-bold text-fg">{c.title}</h2>
        <p className="max-w-2xl text-sm text-fg-muted">{c.lead}</p>
      </div>
      <NoticeBanner notice={notice} onDismiss={() => setNotice(null)} dismissLabel={common.dismiss} />
      <div>
        <ConfirmDialog
          trigger={<Button variant="danger" icon={<RotateCcw aria-hidden="true" size={16} />} disabled={pending} data-testid="reset-demo">{c.button}</Button>}
          title={c.confirmTitle}
          body={c.confirmBody}
          confirmLabel={c.confirm}
          cancelLabel={common.cancel}
          tone="danger"
          onConfirm={run}
        />
      </div>
    </section>
  );
}
