"use client";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { fill, tf, type L, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n";
import { copy } from "@/i18n/areas/admin-polls";
import { plural } from "@/i18n/plural";
import { setPollStatusAction } from "@/lib/polls/actions";
import { pollMessage } from "@/lib/polls/errors";
import type { PollAudience, PollStatus } from "@/lib/mockdb/types";
import Button from "@/components/ui/Button";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/admin/events/Toast";

/**
 * Publish / Close poll / Reopen, each behind a confirm that names the poll and the number of people involved
 * ("Publish “Next workshop” and notify 38 people?"). `people` is the audience size, `voters` the ballots cast.
 */
export default function PollStatusActions({ lang, pollId, title, status, audience, people, voters }: {
  lang: Locale; pollId: string; title: L; status: PollStatus; audience: PollAudience; people: number; voters: number;
}) {
  const t = copy[lang].status;
  const router = useRouter();
  const [pending, start] = useTransition();
  const { show, node } = useToast(getDictionary(lang).ui.close);
  const name = tf(title, lang);
  const cancel = getDictionary(lang).ui.cancel;

  const run = (to: PollStatus) =>
    start(async () => {
      const r = await setPollStatusAction(pollId, to);
      if (r.ok) show(to === "published" && status === "draft" ? (r.data.notified > 0 ? fill(t.done.notified, { n: r.data.notified }) : t.done.published) : to === "closed" ? t.done.closed : t.done.reopened);
      else show(pollMessage(r.error, lang, "status"), "error");
      router.refresh();
    });

  const move =
    status === "draft"
      ? {
          key: "publish", label: t.publish, variant: "primary" as const, to: "published" as const, tone: "default" as const,
          title: fill(people > 0 ? t.publishTitle : t.publishNobody, { title: name, n: people }),
          body: fill(people > 0 ? t.publishBody : t.publishNobodyBody, { audience: copy[lang].audience[audience], n: people }),
          confirm: people > 0 ? t.publishConfirm : t.publishConfirmNobody,
        }
      : status === "published"
        ? { key: "close", label: t.close, variant: "glass" as const, to: "closed" as const, tone: "default" as const, title: fill(t.closeTitle, { title: name }), body: plural(lang, voters, t.closeBody), confirm: t.closeConfirm }
        : { key: "reopen", label: t.reopen, variant: "glass" as const, to: "published" as const, tone: "default" as const, title: fill(t.reopenTitle, { title: name }), body: t.reopenBody, confirm: t.reopenConfirm };

  return (
    <div role="group" aria-label={t.actionsLabel} className="flex flex-wrap items-center gap-2">
      <ConfirmDialog
        trigger={<Button variant={move.variant} disabled={pending}>{move.label}</Button>}
        title={move.title} body={move.body} confirmLabel={move.confirm} cancelLabel={cancel} tone={move.tone}
        onConfirm={() => run(move.to)}
      />
      {node}
    </div>
  );
}
