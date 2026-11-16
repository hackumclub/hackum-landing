"use client";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Eye, Mail, RotateCcw } from "lucide-react";
import Button from "@/components/ui/Button";
import DataTable, { type Column } from "@/components/ui/DataTable";
import EmptyState from "@/components/ui/EmptyState";
import { IconTile, RowEntity, RowTitle } from "@/components/ui/RowParts";
import StatusPill from "@/components/ui/StatusPill";
import Tag from "@/components/ui/Tag";
import { ButtonLink } from "@/components/ui/Button";
import { fill, type Locale } from "@/i18n/config";
import { plural } from "@/i18n/plural";
import type { AreaCopy } from "@/i18n/areas/admin-members";
import { retryNotificationAction } from "@/lib/members/actions";
import { humanizeCode, relativeTime } from "@/lib/members/format";
import type { NotifStatus } from "@/lib/mockdb/types";
import type { Status } from "@/lib/status";
import { formatUbStable } from "@/lib/time";
import { NoticeBanner, errorText, type Notice } from "@/components/admin/members/shared";
import ListFilters, { describeFilters, NoResults, type ChipGroup } from "@/components/admin/lists/ListFilters";
import { focusRowOpener } from "@/components/admin/lists/focus";
import { useListState } from "@/components/admin/lists/useListState";
import { facetCounts, filterComms } from "@/lib/admin/list-filters";
import type { ListSpec, ListState } from "@/lib/admin/list-state";
import type { OutboxRow } from "./data";
import EmailPreviewDrawer from "./EmailPreviewDrawer";

// Outbox states reuse the shared pill tones (spec §7: never invent pill colours): queued = pending, sent = ok, failed = danger.
const PILL: Record<NotifStatus, Status> = { queued: "pending", sending: "pending", sent: "going", failed: "rejected", skipped: "withdrawn" };

const STATUSES = ["queued", "sent", "failed", "skipped"] as const;

export default function OutboxTable({ allRows, templates, now: nowIso, lang, c, common, lists, closeLabel, eventsHref }: {
  allRows: OutboxRow[]; templates: string[]; now: string; lang: Locale; c: AreaCopy["comms"]; common: AreaCopy["common"]; lists: AreaCopy["lists"]; closeLabel: string; eventsHref: string;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [notice, setNotice] = useState<Notice | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const now = useMemo(() => new Date(nowIso), [nowIso]);
  const spec = useMemo<ListSpec>(() => ({ search: true, dates: true, multi: { status: STATUSES, template: templates } }), [templates]);
  const list = useListState(spec);
  const rows = useMemo(() => filterComms(allRows, list.state), [allRows, list.state]);
  const phrase = (code: string | null) => (code ? ((c.errors as Record<string, string>)[code] ?? humanizeCode(code)) : null);
  const label = (r: OutboxRow) => c.templates[r.template];
  const previewRow = allRows.find((r) => r.id === previewId);
  const open = (id: string) => { focusRowOpener(id); setPreviewId(id); };

  // Status and template are the same kind of control: chips in the URL, with the number each one would show.
  const filterFn = (r: OutboxRow[], st: ListState) => filterComms(r, st);
  const sc = facetCounts(allRows, list.state, "status", STATUSES, filterFn);
  const tc = facetCounts(allRows, list.state, "template", templates, filterFn);
  const groups: ChipGroup[] = [
    { key: "status", label: lists.groups.status, options: STATUSES.map((v) => ({ value: v, label: c.tabs[v], count: sc[v] })) },
    { key: "template", label: lists.groups.template, options: templates.map((v) => ({ value: v, label: c.templates[v as OutboxRow["template"]], count: tc[v] })) },
  ];
  const dateText = list.state.from && list.state.to
    ? fill(lists.dates, { from: formatUbStable(new Date(`${list.state.from}T04:00:00Z`), lang, "date"), to: formatUbStable(new Date(`${list.state.to}T04:00:00Z`), lang, "date") }) : undefined;
  const summary = describeFilters({ list, groups, dateText, quoteQ: (q) => fill(lists.quote, { q }) });

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
    const abs = formatUbStable(new Date(iso), lang, "datetimeShort");
    return { iso, abs, text: fill(r.sentAt ? c.sentAt : c.scheduled, { when: abs }) };
  };

  const columns: Column<OutboxRow>[] = [
    {
      key: "template", header: c.columns.template, primary: true, sortValue: (r) => label(r),
      cell: (r) => (
        <RowEntity
          leading={<IconTile><Mail aria-hidden="true" size={20} /></IconTile>}
          title={<RowTitle>{label(r)}</RowTitle>}
          sub={<Tag tone={r.priority === 0 ? "accent" : "neutral"}>{c.priorities[r.priority]}</Tag>}
        />
      ),
    },
    { key: "recipient", header: c.columns.recipient, width: "md:w-32 lg:w-36 xl:w-48", sortValue: (r) => r.recipient.toLowerCase(), cell: (r) => <span className="block truncate" title={r.recipient}>{r.recipient}</span> },
    {
      key: "status", header: c.columns.status, width: "md:w-28 lg:w-36 xl:w-52", sortValue: (r) => r.status,
      cell: (r) => <span className="grid justify-items-start gap-1"><StatusPill status={PILL[r.status]} label={c.statuses[r.group]} />{r.attempts > 0 && <span className="tnum text-xs text-fg-muted">{c.columns.attempts}: {r.attempts}</span>}{r.lastError && <span className="text-xs text-fg-muted">{phrase(r.lastError)}</span>}</span>,
    },
    {
      key: "when", header: c.columns.when, wide: true, width: "md:w-32 xl:w-44", sortValue: (r) => Date.parse(r.sentAt ?? r.scheduledAt),
      cell: (r) => { const w = whenOf(r); return <time dateTime={w.iso} title={relativeTime(new Date(w.iso), now, lang)}>{w.text}</time>; },
    },
    {
      key: "actions", header: c.columns.actions, wide: true, width: "md:w-28 lg:w-32",
      cell: (r) => (
        <span className="flex flex-wrap gap-1.5 md:flex-nowrap md:justify-end">
          <Button size="sm" variant="secondary" data-open={r.id} icon={<Eye aria-hidden="true" size={14} />} onClick={() => setPreviewId(r.id)} aria-label={`${c.preview}: ${label(r)}, ${r.recipient}`} className="max-2xl:size-10 max-2xl:px-0" title={c.preview}><span className="max-2xl:hidden">{c.preview}</span></Button>
          {r.status === "failed" && (
            <Button size="sm" variant="secondary" icon={<RotateCcw aria-hidden="true" size={14} />} disabled={busyId === r.id} onClick={() => retry(r)} aria-label={`${c.retry}: ${label(r)}, ${r.recipient}`} className="max-2xl:size-10 max-2xl:px-0" title={c.retry}><span className="max-2xl:hidden">{c.retry}</span></Button>
          )}
        </span>
      ),
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-3">
      <ListFilters
        list={list} groups={groups} lang={lang} dates
        labels={{ filters: lists.filters, clear: lists.clear, searchLabel: lists.comms.searchLabel, searchPlaceholder: lists.comms.searchPlaceholder }}
      />
      <p aria-live="polite" className="tnum text-sm font-semibold text-fg-muted">{plural(lang, rows.length, common.results)}</p>
      <NoticeBanner notice={notice} onDismiss={() => setNotice(null)} dismissLabel={common.dismiss} />
      <DataTable<OutboxRow>
        rows={rows}
        columns={columns}
        getId={(r) => r.id}
        caption={c.caption}
        fixed pageSize={25}
        onRowClick={(r) => open(r.id)}
        empty={allRows.length > 0
          ? <NoResults sticker="mail" list={list} title={c.emptyTitle} line={lists.noMatchLine} summary={summary} clearLabel={lists.clear} />
          : <EmptyState sticker="mail" title={c.emptyAll} line={c.emptyAllLine} action={<ButtonLink variant="secondary" href={eventsHref}>{c.emptyAllAction}</ButtonLink>} />}
      />
      <EmailPreviewDrawer id={previewId} title={previewRow ? fill(c.previewOf, { template: label(previewRow), name: previewRow.recipient }) : ""} lang={lang} c={c} common={common} closeLabel={closeLabel} onClose={() => setPreviewId(null)} />
    </div>
  );
}
