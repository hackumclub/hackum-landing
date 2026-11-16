"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { LogOut } from "lucide-react";
import Button from "@/components/ui/Button";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { leaveTeamAction } from "@/lib/me/actions";
import { useToast } from "./Toast";

/** Leave the team (the application stays). The dialog names the team and says what happens to captaincy. */
export default function LeaveTeamButton({ teamId, backHref, trigger, title, body, confirm, keep, doneText, errors }: {
  teamId: string; doneText: string; backHref: string; trigger: string; title: string; body: string; confirm: string; keep: string; errors: Record<string, string>;
}) {
  const router = useRouter();
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  function run() {
    setError(null);
    start(async () => {
      const r = await leaveTeamAction(teamId);
      if (r.ok) { toast(doneText); router.replace(backHref); }
      else setError(errors[r.error] ?? errors.server);
    });
  }
  return (
    <div className="grid gap-1.5">
      <ConfirmDialog trigger={<Button variant="secondary" size="lg" disabled={pending} icon={<LogOut aria-hidden="true" size={16} />}>{trigger}</Button>} title={title} body={body} confirmLabel={confirm} cancelLabel={keep} tone="danger" onConfirm={run} />
      <p role="alert" className="text-sm font-semibold text-danger-fg empty:hidden">{error}</p>
    </div>
  );
}
