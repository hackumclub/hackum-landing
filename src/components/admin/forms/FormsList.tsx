"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { FileText, Plus } from "lucide-react";
import { fill, href, tf, type Locale } from "@/i18n/config";
import { copy } from "@/i18n/areas/admin-events";
import { plural } from "@/i18n/plural";
import { filterForms, formHref, tabCounts, type FormTab, FORM_TABS } from "@/lib/forms/hub";
import type { FormKind, FormSummary } from "@/lib/mockdb/forms";
import { formatUb } from "@/lib/time";
import Button, { ButtonLink } from "@/components/ui/Button";
import CountBadge from "@/components/ui/CountBadge";
import DataTable, { type Column } from "@/components/ui/DataTable";
import EmptyState from "@/components/ui/EmptyState";
import FilterBar from "@/components/ui/FilterBar";
import { IconTile, RowEntity, rowTitleClass } from "@/components/ui/RowParts";
import SegmentedTabs from "@/components/ui/SegmentedTabs";
import Tag, { type TagTone } from "@/components/ui/Tag";
import { paginationFor } from "./pagination";

const KIND_TONE: Record<FormKind, TagTone> = { event_registration: "neutral", membership_application: "accent", join: "ok" };
const dateOpts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" };

/** Every form the club collects answers with: membership, join, and one registration form per event. */
export default function FormsList({ rows, lang }: { rows: FormSummary[]; lang: Locale }) {
  const t = copy[lang].forms;
  const [tab, setTab] = useState<FormTab>("all");
  const [q, setQ] = useState("");

  const counts = useMemo(() => tabCounts(rows, q), [rows, q]);
  const visible = useMemo(() => filterForms(rows, { tab, q }), [rows, tab, q]);
  const clear = () => { setTab("all"); setQ(""); };

  if (rows.length === 0) {
    return <EmptyState sticker="writing" title={t.empty.title} line={t.empty.line} action={<ButtonLink href={href(lang, "/admin/events/new")} icon={<Plus aria-hidden="true" size={16} />}>{t.empty.action}</ButtonLink>} />;
  }

  const last = (r: FormSummary) => (r.last_response_at ? formatUb(new Date(r.last_response_at), lang, dateOpts) : t.never);
  const title = (r: FormSummary) => tf(r.title, lang);
  const actions = (r: FormSummary) => (
    <div className="flex flex-wrap items-center gap-2 md:flex-nowrap">
      <ButtonLink size="sm" variant="secondary" href={href(lang, formHref(r.id, "questions"))} aria-label={fill(t.editLabel, { title: title(r) })}>{t.edit}</ButtonLink>
      <ButtonLink size="sm" variant="secondary" href={href(lang, formHref(r.id, "responses"))} aria-label={fill(t.responsesLabel, { title: title(r) })}>{t.viewResponses}</ButtonLink>
    </div>
  );

  const columns: Column<FormSummary>[] = [
    {
      key: "form", header: t.cols.form, primary: true, sortValue: (r) => title(r),
      cell: (r) => (
        <RowEntity
          leading={<IconTile><FileText aria-hidden="true" size={20} /></IconTile>}
          title={<Link href={href(lang, formHref(r.id))} title={title(r)} aria-label={fill(t.open, { title: title(r) })} className={rowTitleClass}>{title(r)}</Link>}
          sub={<Tag tone={KIND_TONE[r.kind]}>{t.kinds[r.kind]}</Tag>}
        />
      ),
    },
    { key: "questions", header: t.cols.questions, numeric: true, width: "md:w-28", sortValue: (r) => r.question_count, cell: (r) => r.question_count },
    { key: "responses", header: t.cols.responses, numeric: true, width: "md:w-28", sortValue: (r) => r.responses, cell: (r) => <CountBadge n={r.responses} /> },
    { key: "last", header: t.cols.last, width: "md:w-36", sortValue: (r) => r.last_response_at ?? "", cell: (r) => <span className="text-fg-muted md:whitespace-nowrap">{last(r)}</span> },
    { key: "actions", header: t.cols.actions, wide: true, width: "md:w-64", cell: actions },
  ];

  const none = (
    <EmptyState
      sticker="search" title={t.noMatch.title} line={t.noMatch.line}
      action={<Button variant="secondary" onClick={clear}>{t.noMatch.clear}</Button>}
    />
  );

  return (
    <div className="grid grid-cols-1 gap-4">
      <SegmentedTabs
        ariaLabel={t.tabsLabel} value={tab} onChange={(k) => setTab(k as FormTab)}
        items={FORM_TABS.map((k) => ({ key: k, label: t.tabs[k], count: counts[k] }))}
      />
      <FilterBar
        search={{ value: q, onChange: setQ, placeholder: t.searchPlaceholder, label: t.searchLabel }}
        activeCount={(q.trim() ? 1 : 0) + (tab !== "all" ? 1 : 0)} onClear={clear}
      />
      <p role="status" className="text-sm font-semibold text-fg-muted">{plural(lang, visible.length, t.results)}</p>

      {visible.length === 0 ? none : (
        <DataTable rows={visible} columns={columns} getId={(r) => r.id} caption={t.caption} empty={none} fixed pageSize={25} paginationLabels={paginationFor(lang)} />
      )}
    </div>
  );
}
