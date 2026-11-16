"use client";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Check, Lock, X } from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import Button from "@/components/ui/Button";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import EmptyState from "@/components/ui/EmptyState";
import { Textarea } from "@/components/ui/Field";
import StatusPill from "@/components/ui/StatusPill";
import { fill, tf, type Locale } from "@/i18n/config";
import { plural } from "@/i18n/plural";
import type { Dict } from "@/i18n";
import type { AreaCopy } from "@/i18n/areas/admin-members";
import { reviewApplicationAction } from "@/lib/members/actions";
import { relativeTime } from "@/lib/members/format";
import type { ApplicationStatus } from "@/lib/status";
import { formatUb } from "@/lib/time";
import type { ApplicationDto, ApplicationsData } from "./data";
import { NoticeBanner, Segments, errorText, type Notice } from "./shared";

type Tab = "pending" | "approved" | "rejected";
type Override = { status: Tab; reviewer: string | null; reviewedAt: string; note: string | null };
const nameOf = (a: ApplicationDto, lang: Locale) => tf(a.person.name, lang).trim() || a.person.name.mn || a.person.handle;

function Card({ a, lang, now, c, status, busy, cancelLabel, onReview }: {
  a: ApplicationDto; lang: Locale; now: Date; c: AreaCopy["members"]["applications"]; status: Dict["status"]; busy: boolean; cancelLabel: string;
  onReview: (approve: boolean, note: string) => void;
}) {
  const [note, setNote] = useState("");
  const name = nameOf(a, lang);
  const pending = a.status === "pending";
  return (
    <li className="grid gap-3 rounded-[var(--radius-md)] border border-line bg-panel p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name={name} size={40} />
          <div className="grid min-w-0">
            <p className="truncate font-semibold text-fg">{name}</p>
            <p className="text-sm text-fg-muted">
              {[a.person.school, a.person.gradYear ? fill(c.gradYear, { year: a.person.gradYear }) : null, plural(lang, a.person.attended, c.pastEvents)].filter(Boolean).join(" · ")}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm text-fg-muted">
          <StatusPill status={a.status} label={status[a.status]} />
          <span>{fill(c.season, { label: tf(a.seasonLabel, lang) })}</span>
          <span aria-hidden="true">·</span>
          <time dateTime={a.createdAt} title={formatUb(new Date(a.createdAt), lang, { dateStyle: "medium", timeStyle: "short" })}>{fill(c.submitted, { when: relativeTime(new Date(a.createdAt), now, lang) })}</time>
        </div>
      </div>

      <div className="grid gap-1">
        <p className="text-xs font-semibold text-fg-muted">{c.motivation}</p>
        <p className="text-sm leading-relaxed whitespace-pre-line text-fg">{a.motivation}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-fg-muted">{c.interests}</span>
        {a.interests.length === 0 ? <span className="text-sm text-fg-muted">{c.noInterests}</span> : a.interests.map((i) => (
          <span key={i} className="rounded-full bg-neutral-soft px-2.5 py-0.5 text-xs font-semibold text-fg">{i}</span>
        ))}
      </div>

      {pending ? (
        <div className="grid gap-3 border-t border-line pt-3">
          <details className="group rounded-[var(--radius-sm)] border border-line bg-panel-2 px-3 py-2">
            <summary className="flex min-h-8 cursor-pointer list-none items-center gap-1.5 text-sm font-semibold text-fg">
              <Lock aria-hidden="true" size={13} />{c.noteLabel}
              {note.trim() && <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs text-accent-fg">1</span>}
            </summary>
            <div className="mt-2 grid gap-1.5">
              <Textarea aria-label={c.noteLabel} aria-describedby={`${a.id}-note-hint`} rows={2} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} className="min-h-16!" />
              <p id={`${a.id}-note-hint`} className="text-sm text-fg-muted">{c.noteHint}</p>
            </div>
          </details>
          <div className="flex flex-wrap gap-2">
            <Button icon={<Check aria-hidden="true" size={16} />} disabled={busy} onClick={() => onReview(true, note)}>{c.approve}</Button>
            <ConfirmDialog
              trigger={<Button variant="secondary" icon={<X aria-hidden="true" size={16} />} disabled={busy}>{c.reject}</Button>}
              title={fill(c.rejectTitle, { name })}
              body={c.rejectBody}
              confirmLabel={c.rejectConfirm}
              cancelLabel={cancelLabel}
              tone="danger"
              onConfirm={() => onReview(false, note)}
            />
          </div>
        </div>
      ) : (
        <div className="grid gap-1 border-t border-line pt-3 text-sm">
          <p className="text-fg-muted">
            {fill(c.reviewedBy, { who: a.reviewer ?? c.reviewerUnknown, when: a.reviewedAt ? relativeTime(new Date(a.reviewedAt), now, lang) : "—" })}
          </p>
          {a.note && (
            <p className="flex items-start gap-1.5 text-fg">
              <Lock aria-hidden="true" size={13} className="mt-1 shrink-0 text-fg-muted" />
              <span><span className="font-semibold">{c.noteSaved}:</span> {a.note}</span>
            </p>
          )}
        </div>
      )}
    </li>
  );
}

/** Membership application queue. Approving or rejecting moves the card to its tab straight away (and the page refreshes behind it). */
export default function ApplicationsQueue({ data, lang, c, common, status }: {
  data: ApplicationsData; lang: Locale; c: AreaCopy["members"]["applications"]; common: AreaCopy["common"]; status: Dict["status"];
}) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [tab, setTab] = useState<Tab>("pending");
  const [overrides, setOverrides] = useState<Record<string, Override>>({});
  const [notice, setNotice] = useState<Notice | null>(null);
  const now = useMemo(() => new Date(data.now), [data.now]);

  // An optimistic move only applies while the server still says "pending"; once the refreshed data arrives it wins.
  const items = useMemo(() => data.items.map((a) => {
    const o = overrides[a.id];
    return o && a.status === "pending" ? { ...a, status: o.status as ApplicationStatus, reviewer: o.reviewer, reviewedAt: o.reviewedAt, note: o.note } : a;
  }), [data.items, overrides]);
  const counts = { pending: items.filter((a) => a.status === "pending").length, approved: items.filter((a) => a.status === "approved").length, rejected: items.filter((a) => a.status === "rejected").length };
  const shown = items.filter((a) => a.status === tab);

  const review = (a: ApplicationDto, approve: boolean, note: string) => {
    const name = nameOf(a, lang);
    startTransition(async () => {
      const r = await reviewApplicationAction({ id: a.id, approve, note });
      if (r.ok) {
        setOverrides((o) => ({ ...o, [a.id]: { status: approve ? "approved" : "rejected", reviewer: null, reviewedAt: new Date().toISOString(), note: note.trim() || null } }));
        setNotice({ tone: "ok", text: fill(approve ? c.doneApproved : c.doneRejected, { name }) });
      } else if (r.error === "conflict" && "reviewer" in r) {
        setNotice({ tone: "error", text: r.reviewer ? fill(c.conflictBy, { reviewer: tf(r.reviewer, lang) }) : c.conflictUnknown });
      } else {
        setNotice({ tone: "error", text: errorText(common.errors, r.error) });
      }
      router.refresh();
    });
  };

  return (
    <div className="grid gap-4">
      <Segments label={c.tabsLabel} value={tab} onChange={setTab} options={[
        { value: "pending", label: c.tabs.pending, count: counts.pending },
        { value: "approved", label: c.tabs.approved, count: counts.approved },
        { value: "rejected", label: c.tabs.rejected, count: counts.rejected },
      ]} />
      <NoticeBanner notice={notice} onDismiss={() => setNotice(null)} dismissLabel={common.dismiss} />
      {shown.length === 0 ? (
        <EmptyState sticker={tab === "pending" ? "sleepy" : "smug"} title={c.emptyTitle[tab]} line={c.emptyLine[tab]} />
      ) : (
        <ul className="grid gap-3">
          {shown.map((a) => <Card key={a.id} a={a} lang={lang} now={now} c={c} status={status} busy={busy} cancelLabel={common.cancel} onReview={(approve, note) => review(a, approve, note)} />)}
        </ul>
      )}
    </div>
  );
}
