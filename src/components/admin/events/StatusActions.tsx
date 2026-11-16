"use client";
import { useRouter } from "next/navigation";
import { useTransition, type ReactNode } from "react";
import { fill, type Locale } from "@/i18n/config";
import { copy } from "@/i18n/areas/admin-events";
import { getDictionary } from "@/i18n";
import { setEventStatusAction } from "@/lib/events/actions";
import type { Missing } from "@/lib/events/readiness";
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

/**
 * Status moves with a confirm dialog that names the object and the consequence. Publishing an event with gaps (no
 * description, venue, cover or English text) lists them first: "Publish anyway" / "Fix first" (audit F-15).
 */
export default function StatusActions({ lang, eventId, title, status, people, missing = [] }: { lang: Locale; eventId: string; title: string; status: EventStatus; people: number; missing?: Missing[] }) {
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

  const dialog = (move: Move): { title: string; body: ReactNode; confirm: string; cancel: string; tone: "danger" | "default" } => {
    if (move === "publish" && missing.length > 0) {
      const r = t.readiness;
      return {
        title: fill(r.title, { title }), confirm: r.confirm, cancel: r.fix, tone: "default",
        body: (
          <>
            <span className="block">{r.body}</span>
            <ul className="mt-2 grid list-disc gap-1 pl-5 font-semibold text-fg">{missing.map((m) => <li key={m}>{r.items[m]}</li>)}</ul>
          </>
        ),
      };
    }
    if (move === "cancelEvent") {
      const x = people > 0 ? t.dialogs.cancel : t.dialogs.cancelNobody;
      return { title: fill(x.title, { title, n: people }), body: fill(x.body, { n: people }), confirm: x.confirm, cancel: d.ui.cancel, tone: "danger" };
    }
    const x = t.dialogs[move];
    return { title: fill(x.title, { title }), body: x.body, confirm: t[move], cancel: d.ui.cancel, tone: "default" };
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
            title={x.title} body={x.body} confirmLabel={x.confirm} cancelLabel={x.cancel} tone={x.tone}
            onConfirm={() => run(move)}
          />
        );
      })}
      {node}
    </div>
  );
}
