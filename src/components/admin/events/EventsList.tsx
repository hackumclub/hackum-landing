"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { Languages, School } from "lucide-react";

import { fill, href, tf, type L, type Locale } from "@/i18n/config";
import { copy as listsCopy } from "@/i18n/areas/admin-members";
import { getDictionary } from "@/i18n";
import { copy } from "@/i18n/areas/admin-events";
import { plural } from "@/i18n/plural";
import type { EventKind, RegMode, SchoolScope } from "@/lib/mockdb/types";
import type { EventStatus, Status } from "@/lib/status";
import { formatUbStable } from "@/lib/time";
import { PRESETS, type Preset } from "@/lib/events/list-presets";
import { facetCounts, filterEvents } from "@/lib/admin/list-filters";
import type { ListSpec, ListState } from "@/lib/admin/list-state";
import { ButtonLink } from "@/components/ui/Button";
import CapacityBar from "@/components/ui/CapacityBar";
import DataTable, { type Column } from "@/components/ui/DataTable";
import EmptyState from "@/components/ui/EmptyState";
import StatusPill from "@/components/ui/StatusPill";
import { Meta, RowEntity, rowTitleClass } from "@/components/ui/RowParts";
import Tag from "@/components/ui/Tag";
import { eventKindIcon } from "@/components/ui/icons";
import Poster from "./Poster";
import ListFilters, { describeFilters, NoResults, PresetChip, type ChipGroup } from "@/components/admin/lists/ListFilters";
import { useListState } from "@/components/admin/lists/useListState";

export type ListRow = {
  id: string;
  slug: string;
  title: L;
  kind: EventKind;
  /** Stored status (tab counts) and the shown one (a published event happening now reads "live"). */
  stored: EventStatus;
  shown: Status;
  startsAt: string;
  approximate: boolean;
  regMode: RegMode;
  capacity: number | null;
  going: number;
  applied: number;
  accepted: number;
  legacy: number | null;
  needsEn: boolean;
  cover: string | null;
  /** Title is missing in English (the dashboard's "missing English text" count). */
  noEnTitle: boolean;
  /** "num" = МУИС students only (shown as a tag); omitted or "all" = every school. */
  scope?: SchoolScope;
};

/** Same text in Node and in the browser (no ICU), so the Mongolian page hydrates cleanly. The date sits over a smaller time. */
const whenParts = (r: ListRow, lang: Locale) => {
  const at = new Date(r.startsAt);
  return r.approximate
    ? { date: formatUbStable(at, lang, "monthYear"), time: null }
    : { date: formatUbStable(at, lang, "date"), time: formatUbStable(at, lang, "time") };
};
const STATUSES: EventStatus[] = ["draft", "published", "completed", "cancelled", "archived"];
const SCOPES = ["num", "all"] as const;

export default function EventsList({ rows, lang }: { rows: ListRow[]; lang: Locale }) {
  const d = getDictionary(lang);
  const router = useRouter();
  const t = copy[lang].list;
  const ls = listsCopy[lang].lists;
  const kinds = useMemo(() => [...new Set(rows.map((r) => r.kind))], [rows]);
  const spec = useMemo<ListSpec>(() => ({ search: true, multi: { status: STATUSES, kind: kinds, scope: SCOPES }, single: { filter: PRESETS } }), [kinds]);
  // Dashboard links arrive as `?filter=applications|missing_cover|needs_en`: shown as a removable chip, counted as a filter.
  const list = useListState(spec);
  const preset = list.state.single.filter as Preset | null;

  const visible = useMemo(() => filterEvents(rows, list.state), [rows, list.state]);
  const filterFn = (r: ListRow[], st: ListState) => filterEvents(r, st);
  const sc = facetCounts(rows, list.state, "status", STATUSES, filterFn);
  const kc = facetCounts(rows, list.state, "kind", kinds, filterFn);
  const oc = facetCounts(rows, list.state, "scope", SCOPES, filterFn);
  const groups: ChipGroup[] = [
    { key: "status", label: ls.groups.status, options: STATUSES.map((v) => ({ value: v, label: d.status[v], count: sc[v] })) },
    { key: "kind", label: t.kindLabel, options: kinds.map((v) => ({ value: v, label: d.admin.kinds[v], count: kc[v] })) },
    { key: "scope", label: ls.groups.scope, options: SCOPES.map((v) => ({ value: v, label: ls.events.scopes[v], count: oc[v] })) },
  ];
  const summary = describeFilters({ list, groups, quoteQ: (q) => fill(ls.quote, { q }) }) + (preset ? `${list.state.q || list.state.multi.status?.length ? " · " : ""}${t.presets[preset]}` : "");

  if (rows.length === 0) {
    return (
      <EmptyState
        sticker="rsvp" title={t.empty.title} line={t.empty.line}
        action={<ButtonLink href={href(lang, "/admin/events/new")}>{t.createEvent}</ButtonLink>}
      />
    );
  }

  const columns: Column<ListRow>[] = [
    {
      key: "event", header: t.cols.event, primary: true, sortValue: (r) => tf(r.title, lang),
      cell: (r) => {
        const title = tf(r.title, lang);
        return (
          <RowEntity
            leading={<Poster path={r.cover} sizes="48px" className="size-12" />}
            title={<Link href={href(lang, `/admin/events/${r.id}`)} title={title} className={rowTitleClass} aria-label={`${t.open}: ${title}`}>{title}</Link>}
            sub={<>
              <Tag icon={eventKindIcon(r.kind)}>{d.admin.kinds[r.kind]}</Tag>
              {r.scope === "num" && <Tag tone="accent" icon={School}>{t.scopeNum}</Tag>}
              {r.needsEn && <Tag tone="warn" icon={Languages}>{t.needsEn}</Tag>}
            </>}
          />
        );
      },
    },
    {
      key: "when", header: t.cols.when, width: "md:w-44", sortValue: (r) => r.startsAt,
      cell: (r) => { const w = whenParts(r, lang); return <time dateTime={r.startsAt}><Meta primary={w.date} secondary={w.time} /></time>; },
    },
    { key: "status", header: t.cols.status, width: "md:w-32", sortValue: (r) => r.stored, cell: (r) => <StatusPill status={r.shown} label={d.status[r.shown]} /> },
    {
      key: "registration", header: t.cols.registration, width: "md:w-60", numeric: true, wide: true,
      cell: (r) => {
        if (r.legacy !== null) return <span className="text-sm text-fg-muted">{fill(t.legacy, { n: r.legacy })}</span>;
        if (r.regMode === "application") {
          return <span className="text-sm font-semibold text-accent-fg md:whitespace-nowrap">{fill(t.appsSummary, { apps: plural(lang, r.applied, t.applications), accepted: r.accepted })}</span>;
        }
        return (
          <CapacityBar align="end" value={r.going} max={r.capacity} label={r.capacity === null ? fill(t.noLimit, { n: r.going }) : fill(t.seats, { n: r.going, max: r.capacity })} className="w-full md:ml-auto md:max-w-44" />
        );
      },
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4">
      <ListFilters
        list={list} groups={groups} lang={lang}
        labels={{ filters: t.filters, clear: ls.clear, searchLabel: t.searchLabel, searchPlaceholder: t.searchPlaceholder }}
      >
        {preset && <PresetChip label={t.presets[preset]} removeLabel={fill(t.presetClear, { name: t.presets[preset] })} onRemove={() => list.setSingle("filter", null)} />}
      </ListFilters>
      <p role="status" className="text-sm font-semibold text-fg-muted">{plural(lang, visible.length, t.results)}</p>
      <DataTable
        rows={visible} columns={columns} getId={(r) => r.id} caption={t.caption} fixed pageSize={25}
        onRowClick={(r) => router.push(href(lang, `/admin/events/${r.id}`))}
        empty={<NoResults list={list} title={t.noMatch.title} line={ls.noMatchLine} summary={summary} clearLabel={ls.clear} />}
      />
    </div>
  );
}
