"use client";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { fill, type Locale } from "@/i18n/config";
import { copy } from "@/i18n/areas/admin-events";
import { getDictionary } from "@/i18n";
import { setEventStatusAction } from "@/lib/events/actions";
import type { EventStatus } from "@/lib/status";
import Button from "@/components/ui/Button";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { useToast } from "./Toast";

type Move = "publish" | "cancelEvent" | "complete" | "archive" | "toDraft";
const TARGET: Record<Move, EventStatus> = { publish: "published", cancelEvent: "cancelled", complete: "completed", archive: "archived", toDraft: "draft" };
const DONE: Record<Move, "published" | "cancelled" | "completed" | "archived" | "drafted"> = { publish: "published", cancelEvent: "cancelled", complete: "completed", archive: "archived", toDraft: "drafted" };

/** Which moves make sense from each status (mirrors the rule's transition table; "back to draft" only when nobody is registered). */
export function movesFor(status: EventStatus, hasRegistrations: boolean): Move[] {
  switch (status) {
    case "draft": return ["publish"];
    case "published": return hasRegistrations ? ["complete", "cancelEvent"] : ["complete", "toDraft", "cancelEvent"];
    case "completed":
    case "cancelled": return ["archive"];
    case "archived": return [];
  }
}

export default function StatusActions({ lang, eventId, title, status, people }: { lang: Locale; eventId: string; title: string; status: EventStatus; people: number }) {
  const t = copy[lang].header;
  const d = getDictionary(lang);
  const router = useRouter();
  const [pending, start] = useTransition();
  const { show, node } = useToast(copy[lang].regs.toast.close);

  const run = (move: Move) =>
    start(async () => {
      const r = await setEventStatusAction(eventId, TARGET[move]);
      if (r.ok) show(t[DONE[move]]);
      else show(t.errors[r.error] ?? t.errors.generic, "error");
      router.refresh();
    });

  const dialog = (move: Move) => {
    if (move === "cancelEvent") {
      const x = people > 0 ? t.dialogs.cancel : t.dialogs.cancelNobody;
      return { title: fill(x.title, { title, n: people }), body: fill(x.body, { n: people }), confirm: x.confirm, tone: "danger" as const };
    }
    const x = t.dialogs[move];
    return { title: fill(x.title, { title }), body: x.body, confirm: t[move], tone: "default" as const };
  };

  const moves = movesFor(status, people > 0);
  if (moves.length === 0) return null;
  return (
    <div role="group" aria-label={t.actionsLabel} className="flex flex-wrap items-center gap-2">
      {moves.map((move) => {
        const x = dialog(move);
        return (
          <ConfirmDialog
            key={move}
            trigger={<Button variant={move === "publish" ? "primary" : "secondary"} disabled={pending}>{t[move]}</Button>}
            title={x.title} body={x.body} confirmLabel={x.confirm} cancelLabel={d.ui.cancel} tone={x.tone}
            onConfirm={() => run(move)}
          />
        );
      })}
      {node}
    </div>
  );
}
