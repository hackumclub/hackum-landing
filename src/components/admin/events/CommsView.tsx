"use client";
import { useMemo } from "react";
import { fill, href, tf, type Locale } from "@/i18n/config";
import { copy } from "@/i18n/areas/admin-events";
import { copy as listsCopy } from "@/i18n/areas/admin-members";
import { plural } from "@/i18n/plural";
import { facetCounts, filterComms } from "@/lib/admin/list-filters";
import type { ListSpec, ListState } from "@/lib/admin/list-state";
import type { OutboxRow } from "@/lib/events/admin-outbox";
import type { NotifStatus } from "@/lib/mockdb/types";
import type { Status } from "@/lib/status";
import { formatUbStable } from "@/lib/time";
import { ButtonLink } from "@/components/ui/Button";
import DataTable, { type Column } from "@/components/ui/DataTable";
import EmptyState from "@/components/ui/EmptyState";
import StatusPill from "@/components/ui/StatusPill";
import ListFilters, { describeFilters, NoResults, type ChipGroup } from "@/components/admin/lists/ListFilters";
import { useListState } from "@/components/admin/lists/useListState";

/** Outbox statuses borrow StatusPill's tones: queued = warn, sending = accent, sent = ok, failed = danger, skipped = neutral. */
const TONE: Record<NotifStatus, Status> = { queued: "pending", sending: "applied", sent: "approved", failed: "rejected", skipped: "withdrawn" };
const ORDER: NotifStatus[] = ["queued", "sending", "sent", "failed", "skipped"];
const SPEC: ListSpec = { search: true, dates: true, multi: { status: ORDER } };
const when = (iso: string, lang: Locale) => formatUbStable(new Date(iso), lang, "datetimeShort");

type Flat = OutboxRow & { group: string };

export default function CommsView({ rows, lang, eventId }: { rows: OutboxRow[]; lang: Locale; eventId: string }) {
  const t = copy[lang].comms;
  const ls = listsCopy[lang].lists;
  const list = useListState(SPEC);
  // `filterComms` searches the recipient text, so each row carries it next to the raw outbox fields.
  const flat = useMemo(() => rows.map((r): Flat & { recipientText: string } => ({ ...r, group: r.status, recipientText: r.recipient ? tf(r.recipient, lang) : t.recipientGone })), [rows, lang, t.recipientGone]);
  const filterable = useMemo(() => flat.map((r) => ({ ...r, recipient: r.recipientText })), [flat]);
  const visible = useMemo(() => filterComms(filterable, list.state), [filterable, list.state]);

  if (rows.length === 0) return <EmptyState sticker="mail" title={t.empty.title} line={t.empty.line} action={<ButtonLink href={href(lang, `/admin/events/${eventId}/registrations`)}>{t.empty.action}</ButtonLink>} />;

  const present = ORDER.filter((s) => rows.some((r) => r.status === s) || s === "queued" || s === "sent" || s === "failed");
  const counts = facetCounts(filterable, list.state, "status", present, (r, s: ListState) => filterComms(r, s));
  const groups: ChipGroup[] = [{ key: "status", label: ls.groups.status, options: present.map((s) => ({ value: s, label: t.statuses[s], count: counts[s] })) }];
  const dateText = list.state.from && list.state.to
    ? fill(ls.dates, { from: formatUbStable(new Date(`${list.state.from}T04:00:00Z`), lang, "date"), to: formatUbStable(new Date(`${list.state.to}T04:00:00Z`), lang, "date") }) : undefined;
  const summary = describeFilters({ list, groups, dateText, quoteQ: (q) => fill(ls.quote, { q }) });

  const columns: Column<(typeof visible)[number]>[] = [
    { key: "template", header: t.cols.template, sortValue: (r) => t.templates[r.template] ?? r.template, cell: (r) => <span className="font-semibold text-fg">{t.templates[r.template] ?? r.template}</span> },
    { key: "recipient", header: t.cols.recipient, hideBelow: "sm", sortValue: (r) => r.recipient, cell: (r) => (r.recipientText === t.recipientGone ? <span className="text-fg-muted">{t.recipientGone}</span> : r.recipientText) },
    { key: "status", header: t.cols.status, sortValue: (r) => r.status, cell: (r) => <StatusPill status={TONE[r.status]} label={t.statuses[r.status]} /> },
    { key: "scheduled", header: t.cols.scheduled, hideBelow: "md", sortValue: (r) => r.scheduledAt, cell: (r) => <time dateTime={r.scheduledAt} className="whitespace-nowrap text-fg-muted">{when(r.scheduledAt, lang)}</time> },
    { key: "sent", header: t.cols.sent, hideBelow: "md", sortValue: (r) => r.sentAt ?? "", cell: (r) => (r.sentAt ? <time dateTime={r.sentAt} className="whitespace-nowrap text-fg-muted">{when(r.sentAt, lang)}</time> : <span className="text-fg-muted">—</span>) },
    { key: "attempts", header: t.cols.attempts, numeric: true, hideBelow: "lg", sortValue: (r) => r.attempts, cell: (r) => r.attempts },
    { key: "error", header: t.cols.error, hideBelow: "lg", cell: (r) => (r.lastError ? <span className="text-danger-fg">{t.errors[r.lastError] ?? r.lastError}</span> : <span className="text-fg-muted">—</span>) },
  ];

  return (
    <div className="grid grid-cols-1 gap-4">
      <h2 className="font-display text-base font-bold text-fg">{t.title}</h2>
      <ListFilters list={list} groups={groups} lang={lang} dates labels={{ filters: ls.filters, clear: ls.clear, searchLabel: listsCopy[lang].lists.comms.searchLabel, searchPlaceholder: listsCopy[lang].lists.comms.searchPlaceholder }} />
      <p role="status" className="text-sm font-semibold text-fg-muted">{plural(lang, visible.length, t.results)}</p>
      <DataTable
        rows={visible} columns={columns} getId={(r) => r.id} caption={t.caption} pageSize={25}
        empty={<NoResults sticker="search" list={list} title={t.noMatch.title} line={ls.noMatchLine} summary={summary} clearLabel={ls.clear} />}
      />
    </div>
  );
}
