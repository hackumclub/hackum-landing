"use client";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Eye, RotateCcw } from "lucide-react";
import Button from "@/components/ui/Button";
import DataTable, { type Column } from "@/components/ui/DataTable";
import EmptyState from "@/components/ui/EmptyState";
import StatusPill from "@/components/ui/StatusPill";
import { ButtonLink } from "@/components/ui/Button";
import { fill, type Locale } from "@/i18n/config";
import { plural } from "@/i18n/plural";
import type { AreaCopy } from "@/i18n/areas/admin-members";
import { retryNotificationAction } from "@/lib/members/actions";
import { humanizeCode, relativeTime } from "@/lib/members/format";
import type { NotifStatus } from "@/lib/mockdb/types";
import type { Status } from "@/lib/status";
import { formatUb } from "@/lib/time";
import { NoticeBanner, errorText, type Notice } from "@/components/admin/members/shared";
import type { OutboxRow } from "./data";
import EmailPreviewDrawer from "./EmailPreviewDrawer";

// Outbox states reuse the shared pill tones (spec §7: never invent pill colours): queued = pending, sent = ok, failed = danger.
const PILL: Record<NotifStatus, Status> = { queued: "pending", sending: "pending", sent: "going", failed: "rejected", skipped: "withdrawn" };

export default function OutboxTable({ rows, now: nowIso, lang, c, common, closeLabel, allHref, filtered }: {
  rows: OutboxRow[]; now: string; lang: Locale; c: AreaCopy["comms"]; common: AreaCopy["common"]; closeLabel: string; allHref: string; filtered: boolean;
}) {
  const eventsHref = allHref.replace(/\/comms$/, "/events");
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [notice, setNotice] = useState<Notice | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const now = useMemo(() => new Date(nowIso), [nowIso]);
  const phrase = (code: string | null) => (code ? ((c.errors as Record<string, string>)[code] ?? humanizeCode(code)) : null);
  const label = (r: OutboxRow) => c.templates[r.template];
  const previewRow = rows.find((r) => r.id === previewId);

  const retry = (r: OutboxRow) => {
    setBusyId(r.id);
    startTransition(async () => {
      const res = await retryNotificationAction(r.id);
      setNotice(res.ok ? { tone: "ok", text: c.retryDone } : { tone: "error", text: res.error === "conflict" ? c.retryConflict : errorText(common.errors, res.error) });
      setBusyId(null);
      router.refresh();
    });
  };

  const whenOf = (r: OutboxRow) => {
    const iso = r.sentAt ?? r.scheduledAt;
    const abs = formatUb(new Date(iso), lang, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
    return { iso, abs, text: fill(r.sentAt ? c.sentAt : c.scheduled, { when: abs }) };
  };

  const columns: Column<OutboxRow>[] = [
    {
      key: "template", header: c.columns.template, sortValue: (r) => label(r),
      cell: (r) => <span className="grid"><span className="font-semibold whitespace-nowrap">{label(r)}</span><span className="text-xs text-fg-muted">{c.priorities[r.priority]}</span><span className="max-w-[12rem] truncate text-xs text-fg sm:hidden">{r.recipient}</span>{r.lastError && <span className="mt-0.5 max-w-[12rem] text-xs text-fg-muted lg:hidden">{phrase(r.lastError)}</span>}</span>,
    },
    { key: "recipient", header: c.columns.recipient, hideBelow: "sm", sortValue: (r) => r.recipient.toLowerCase(), cell: (r) => <span className="block max-w-[14rem] truncate" title={r.recipient}>{r.recipient}</span> },
    {
      key: "status", header: c.columns.status, sortValue: (r) => r.status,
      cell: (r) => (
        <span className="grid justify-items-start gap-1">
          <StatusPill status={PILL[r.status]} label={c.statuses[r.group]} />
          {r.attempts > 0 && <span className="tnum text-xs text-fg-muted">{c.columns.attempts}: {r.attempts}</span>}
        </span>
      ),
    },
    {
      key: "when", header: c.columns.when, hideBelow: "sm", sortValue: (r) => Date.parse(r.sentAt ?? r.scheduledAt),
      cell: (r) => { const w = whenOf(r); return <time dateTime={w.iso} title={relativeTime(new Date(w.iso), now, lang)} className="whitespace-nowrap">{w.text}</time>; },
    },
    { key: "error", header: c.columns.error, hideBelow: "lg", sortValue: (r) => phrase(r.lastError) ?? "", cell: (r) => <span className="block min-w-[10rem] max-w-[14rem] text-fg-muted">{phrase(r.lastError) ?? c.noError}</span> },
    {
      key: "actions", header: c.columns.actions,
      cell: (r) => (
        <span className="flex flex-wrap justify-end gap-1.5 md:justify-start">
          <Button size="sm" variant="secondary" icon={<Eye aria-hidden="true" size={14} />} onClick={() => setPreviewId(r.id)} aria-label={`${c.preview}: ${label(r)}, ${r.recipient}`} className="max-2xl:size-10 max-2xl:px-0" title={c.preview}><span className="max-2xl:hidden">{c.preview}</span></Button>
          {r.status === "failed" && (
            <Button size="sm" variant="secondary" icon={<RotateCcw aria-hidden="true" size={14} />} disabled={busyId === r.id} onClick={() => retry(r)} aria-label={`${c.retry}: ${label(r)}, ${r.recipient}`} className="max-2xl:size-10 max-2xl:px-0" title={c.retry}><span className="max-2xl:hidden">{c.retry}</span></Button>
          )}
        </span>
      ),
    },
  ];

  return (
    <div className="grid gap-3">
      <p aria-live="polite" className="tnum text-sm font-semibold text-fg-muted">{plural(lang, rows.length, common.results)}</p>
      <NoticeBanner notice={notice} onDismiss={() => setNotice(null)} dismissLabel={common.dismiss} />
      <DataTable<OutboxRow>
        rows={rows}
        columns={columns}
        getId={(r) => r.id}
        caption={c.caption}
        empty={filtered
          ? <EmptyState sticker="mail" title={c.emptyTitle} line={c.emptyLine} action={<ButtonLink variant="secondary" href={allHref}>{c.showAll}</ButtonLink>} />
          : <EmptyState sticker="mail" title={c.emptyAll} line={c.emptyAllLine} action={<ButtonLink variant="secondary" href={eventsHref}>{c.emptyAllAction}</ButtonLink>} />}
      />
      <EmailPreviewDrawer id={previewId} title={previewRow ? fill(c.previewOf, { template: label(previewRow), name: previewRow.recipient }) : ""} lang={lang} c={c} common={common} closeLabel={closeLabel} onClose={() => setPreviewId(null)} />
    </div>
  );
}
