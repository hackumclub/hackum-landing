"use client";
import Link from "next/link";
import { Languages, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { fill, href, tf, type L, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n";
import { copy } from "@/i18n/areas/admin-events";
import { plural } from "@/i18n/plural";
import type { EventKind, RegMode } from "@/lib/mockdb/types";
import type { EventStatus, Status } from "@/lib/status";
import { eventWhen } from "@/lib/events/format";
import Button, { ButtonLink } from "@/components/ui/Button";
import CapacityBar from "@/components/ui/CapacityBar";
import DataTable, { type Column } from "@/components/ui/DataTable";
import EmptyState from "@/components/ui/EmptyState";
import FilterBar from "@/components/ui/FilterBar";
import { Input } from "@/components/ui/Field";
import StatusPill from "@/components/ui/StatusPill";
import SegmentTabs from "./SegmentTabs";

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
};

const STATUS_TABS: EventStatus[] = ["draft", "published", "completed", "cancelled", "archived"];
const norm = (s: string) => s.toLowerCase().trim();

export default function EventsList({ rows, lang }: { rows: ListRow[]; lang: Locale }) {
  const d = getDictionary(lang);
  const t = copy[lang].list;
  const [tab, setTab] = useState<EventStatus | "all">("all");
  const [kinds, setKinds] = useState<string[]>([]);
  const [q, setQ] = useState("");

  const inTab = (r: ListRow) => tab === "all" || r.stored === tab;
  const inSearch = useMemo(() => {
    const needle = norm(q);
    return (r: ListRow) => !needle || [r.title.mn, r.title.en, r.slug].some((s) => norm(s).includes(needle));
  }, [q]);

  const tabCounts = useMemo(() => {
    const c = Object.fromEntries(STATUS_TABS.map((s) => [s, 0])) as Record<EventStatus, number>;
    for (const r of rows.filter(inSearch)) c[r.stored]++;
    return c;
  }, [rows, inSearch]);
  const searched = rows.filter(inSearch).length;

  const kindOptions = [...new Set(rows.map((r) => r.kind))].map((k) => ({
    value: k, label: d.admin.kinds[k], count: rows.filter((r) => r.kind === k && inTab(r) && inSearch(r)).length,
  }));

  const visible = rows.filter((r) => inTab(r) && inSearch(r) && (kinds.length === 0 || kinds.includes(r.kind)));
  const filtered = tab !== "all" || kinds.length > 0 || q.trim() !== "";
  const clear = () => { setTab("all"); setKinds([]); setQ(""); };

  if (rows.length === 0) {
    return (
      <EmptyState
        sticker="rsvp" title={t.empty.title} line={t.empty.line}
        action={<ButtonLink href={href(lang, "/admin/events/new")}>{t.createEvent}</ButtonLink>}
      />
    );
  }

  const registrationText = (r: ListRow) =>
    r.legacy !== null ? fill(t.legacy, { n: r.legacy })
    : r.regMode === "application" ? fill(t.appsSummary, { apps: plural(lang, r.applied, t.applications), accepted: r.accepted })
    : r.capacity === null ? fill(t.noLimit, { n: r.going }) : fill(t.seats, { n: r.going, max: r.capacity });

  const columns: Column<ListRow>[] = [
    {
      key: "event", header: t.cols.event, sortValue: (r) => tf(r.title, lang),
      cell: (r) => {
        const title = tf(r.title, lang);
        return (
          <div className="grid min-w-0 gap-0.5">
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <Link href={href(lang, `/admin/events/${r.id}`)} className="min-w-0 font-bold text-fg hover:underline" aria-label={`${t.open}: ${title}`}>{title}</Link>
              {r.needsEn && (
                <span className="inline-flex items-center gap-1 rounded-full bg-neutral-soft px-2 py-0.5 text-xs font-semibold text-fg">
                  <Languages aria-hidden="true" size={12} />{t.needsEn}
                </span>
              )}
            </span>
            <span className="text-xs text-fg-muted">{d.admin.kinds[r.kind]}<span className="md:hidden"> · {eventWhen({ starts_at: r.startsAt, approximate_date: r.approximate }, lang)}</span></span>
            <span className="text-xs font-semibold text-fg-muted sm:hidden">{registrationText(r)}</span>
          </div>
        );
      },
    },
    {
      key: "when", header: t.cols.when, hideBelow: "md", sortValue: (r) => r.startsAt,
      cell: (r) => <time dateTime={r.startsAt} className="whitespace-nowrap text-fg-muted">{eventWhen({ starts_at: r.startsAt, approximate_date: r.approximate }, lang)}</time>,
    },
    { key: "status", header: t.cols.status, sortValue: (r) => r.stored, cell: (r) => <StatusPill status={r.shown} label={d.status[r.shown]} /> },
    {
      key: "registration", header: t.cols.registration, hideBelow: "sm",
      cell: (r) => {
        if (r.legacy !== null) return <span className="text-sm text-fg-muted">{fill(t.legacy, { n: r.legacy })}</span>;
        if (r.regMode === "application") {
          return <span className="text-sm font-semibold text-accent-fg">{fill(t.appsSummary, { apps: plural(lang, r.applied, t.applications), accepted: r.accepted })}</span>;
        }
        return (
          <CapacityBar value={r.going} max={r.capacity} label={r.capacity === null ? fill(t.noLimit, { n: r.going }) : fill(t.seats, { n: r.going, max: r.capacity })} className="min-w-36 max-w-52" />
        );
      },
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4">
      <SegmentTabs
        label={t.tabsLabel} value={tab} onChange={setTab}
        options={[{ value: "all" as const, label: t.all, count: searched }, ...STATUS_TABS.map((s) => ({ value: s, label: d.status[s], count: tabCounts[s] }))]}
      />
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:w-72">
          <label htmlFor="events-search" className="sr-only">{t.searchLabel}</label>
          <Search aria-hidden="true" size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-fg-muted" />
          <Input id="events-search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.searchPlaceholder} className="pl-9" />
        </div>
        <FilterBar label={t.kindLabel} options={kindOptions} value={kinds} onChange={setKinds} />
      </div>
      <p role="status" className="text-sm font-semibold text-fg-muted">{plural(lang, visible.length, t.results)}</p>
      <DataTable
        rows={visible} columns={columns} getId={(r) => r.id} caption={t.caption}
        empty={
          <EmptyState
            sticker="search" title={t.noMatch.title} line={t.noMatch.line}
            action={filtered ? <Button variant="secondary" onClick={clear}>{t.noMatch.clear}</Button> : undefined}
          />
        }
      />
    </div>
  );
}
