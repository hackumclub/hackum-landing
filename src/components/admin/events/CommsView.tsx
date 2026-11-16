"use client";
import { useMemo, useState } from "react";
import { href, tf, type Locale } from "@/i18n/config";
import { copy } from "@/i18n/areas/admin-events";
import { plural } from "@/i18n/plural";
import type { OutboxRow } from "@/lib/events/admin-outbox";
import type { NotifStatus } from "@/lib/mockdb/types";
import type { Status } from "@/lib/status";
import { formatUb } from "@/lib/time";
import Button, { ButtonLink } from "@/components/ui/Button";
import DataTable, { type Column } from "@/components/ui/DataTable";
import EmptyState from "@/components/ui/EmptyState";
import StatusPill from "@/components/ui/StatusPill";
import SegmentTabs from "./SegmentTabs";

/** Outbox statuses borrow StatusPill's tones: queued = warn, sending = accent, sent = ok, failed = danger, skipped = neutral. */
const TONE: Record<NotifStatus, Status> = { queued: "pending", sending: "applied", sent: "approved", failed: "rejected", skipped: "withdrawn" };
const ORDER: NotifStatus[] = ["queued", "sending", "sent", "failed", "skipped"];
const when = (iso: string, lang: Locale) => formatUb(new Date(iso), lang, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

export default function CommsView({ rows, lang, eventId }: { rows: OutboxRow[]; lang: Locale; eventId: string }) {
  const t = copy[lang].comms;
  const [tab, setTab] = useState<NotifStatus | "all">("all");
  const counts = useMemo(() => {
    const c: Record<NotifStatus, number> = { queued: 0, sending: 0, sent: 0, failed: 0, skipped: 0 };
    for (const r of rows) c[r.status]++;
    return c;
  }, [rows]);
  const visible = tab === "all" ? rows : rows.filter((r) => r.status === tab);

  if (rows.length === 0) return <EmptyState sticker="mail" title={t.empty.title} line={t.empty.line} action={<ButtonLink href={href(lang, `/admin/events/${eventId}/registrations`)}>{t.empty.action}</ButtonLink>} />;

  const columns: Column<OutboxRow>[] = [
    { key: "template", header: t.cols.template, sortValue: (r) => t.templates[r.template] ?? r.template, cell: (r) => <span className="font-semibold text-fg">{t.templates[r.template] ?? r.template}</span> },
    { key: "recipient", header: t.cols.recipient, hideBelow: "sm", sortValue: (r) => (r.recipient ? tf(r.recipient, lang) : ""), cell: (r) => (r.recipient ? tf(r.recipient, lang) : <span className="text-fg-muted">{t.recipientGone}</span>) },
    { key: "status", header: t.cols.status, sortValue: (r) => r.status, cell: (r) => <StatusPill status={TONE[r.status]} label={t.statuses[r.status]} /> },
    { key: "scheduled", header: t.cols.scheduled, hideBelow: "md", sortValue: (r) => r.scheduledAt, cell: (r) => <time dateTime={r.scheduledAt} className="whitespace-nowrap text-fg-muted">{when(r.scheduledAt, lang)}</time> },
    { key: "sent", header: t.cols.sent, hideBelow: "md", sortValue: (r) => r.sentAt ?? "", cell: (r) => (r.sentAt ? <time dateTime={r.sentAt} className="whitespace-nowrap text-fg-muted">{when(r.sentAt, lang)}</time> : <span className="text-fg-muted">—</span>) },
    { key: "attempts", header: t.cols.attempts, numeric: true, hideBelow: "lg", sortValue: (r) => r.attempts, cell: (r) => r.attempts },
    { key: "error", header: t.cols.error, hideBelow: "lg", cell: (r) => (r.lastError ? <span className="text-danger-fg">{t.errors[r.lastError] ?? r.lastError}</span> : <span className="text-fg-muted">—</span>) },
  ];

  return (
    <div className="grid grid-cols-1 gap-4">
      <h2 className="font-display text-base font-bold text-fg">{t.title}</h2>
      <SegmentTabs
        label={t.statusLabel} value={tab} onChange={setTab}
        options={[{ value: "all" as const, label: t.all, count: rows.length }, ...ORDER.filter((s) => counts[s] > 0 || s === "queued" || s === "sent" || s === "failed").map((s) => ({ value: s, label: t.statuses[s], count: counts[s] }))]}
      />
      <p role="status" className="text-sm font-semibold text-fg-muted">{plural(lang, visible.length, t.results)}</p>
      <DataTable
        rows={visible} columns={columns} getId={(r) => r.id} caption={t.caption}
        empty={<EmptyState sticker="search" title={t.noMatch.title} line={t.noMatch.line} action={<Button variant="secondary" onClick={() => setTab("all")}>{t.noMatch.clear}</Button>} />}
      />
    </div>
  );
}
