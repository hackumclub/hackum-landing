"use client";
import Link from "next/link";
import { Languages, Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import { fill, href, tf, type L, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n";
import { copy } from "@/i18n/areas/admin-events";
import { plural } from "@/i18n/plural";
import type { EventKind, RegMode } from "@/lib/mockdb/types";
import type { EventStatus, Status } from "@/lib/status";
import { eventWhen } from "@/lib/events/format";
import { PRESET_TEST, type Preset } from "@/lib/events/list-presets";
import Button, { ButtonLink } from "@/components/ui/Button";
import CapacityBar from "@/components/ui/CapacityBar";
import DataTable, { type Column } from "@/components/ui/DataTable";
import EmptyState from "@/components/ui/EmptyState";
import FilterBar from "@/components/ui/FilterBar";
import FilterDisclosure from "@/components/ui/FilterDisclosure";
import { Input } from "@/components/ui/Field";
import StatusPill from "@/components/ui/StatusPill";
import Poster from "./Poster";
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
  cover: string | null;
  /** Title is missing in English (the dashboard's "missing English text" count). */
  noEnTitle: boolean;
};

const STATUS_TABS: EventStatus[] = ["draft", "published", "completed", "cancelled", "archived"];
const norm = (s: string) => s.toLowerCase().trim();

export default function EventsList({ rows, lang, preset: initialPreset = null }: { rows: ListRow[]; lang: Locale; preset?: Preset | null }) {
  const d = getDictionary(lang);
  const t = copy[lang].list;
  const [tab, setTab] = useState<EventStatus | "all">("all");
  const [kinds, setKinds] = useState<string[]>([]);
  const [q, setQ] = useState("");
  const [preset, setPreset] = useState<Preset | null>(initialPreset);

  const inTab = (r: ListRow) => tab === "all" || r.stored === tab;
  const inSearch = useMemo(() => {
    const needle = norm(q);
    return (r: ListRow) => (!preset || PRESET_TEST[preset](r)) && (!needle || [r.title.mn, r.title.en, r.slug].some((s) => norm(s).includes(needle)));
  }, [q, preset]);

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
  const filtered = tab !== "all" || kinds.length > 0 || q.trim() !== "" || preset !== null;
  const clear = () => { setTab("all"); setKinds([]); setQ(""); setPreset(null); };

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
          <div className="flex min-w-0 items-center gap-3">
            <Poster path={r.cover} sizes="48px" className="aspect-[4/5] w-10 md:w-11" />
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
        <FilterDisclosure label={t.filters} activeCount={kinds.length + (preset ? 1 : 0)} className="md:contents">
          <div className="flex flex-wrap items-center gap-2">
          {preset && (
            <button
              type="button" onClick={() => setPreset(null)} aria-label={fill(t.presetClear, { name: t.presets[preset] })}
              className="inline-flex min-h-9 w-fit cursor-pointer items-center gap-1.5 rounded-full border border-accent bg-accent-soft px-3 text-sm font-semibold text-accent-fg"
            >
              {t.presets[preset]}<X aria-hidden="true" size={14} />
            </button>
          )}
          <FilterBar label={t.kindLabel} options={kindOptions} value={kinds} onChange={setKinds} />
          </div>
        </FilterDisclosure>
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
