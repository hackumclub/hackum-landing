"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { EyeOff, Globe, ListChecks, Plus, UsersRound, type LucideIcon } from "lucide-react";
import { fill, href, tf, type Locale } from "@/i18n/config";
import { copy } from "@/i18n/areas/admin-polls";
import { copy as listsCopy } from "@/i18n/areas/admin-members";
import { plural } from "@/i18n/plural";
import { formatUbStable } from "@/lib/time";
import type { ListSpec } from "@/lib/admin/list-state";
import { facetCounts } from "@/lib/admin/list-filters";
import { filterPolls, POLL_STATUSES, type PollRow } from "@/lib/polls/rows";
import type { PollAudience } from "@/lib/mockdb/types";
import { ButtonLink } from "@/components/ui/Button";
import DataTable, { type Column } from "@/components/ui/DataTable";
import EmptyState from "@/components/ui/EmptyState";
import StatusPill from "@/components/ui/StatusPill";
import Tag from "@/components/ui/Tag";
import { IconTile, Meta, RowEntity, rowTitleClass } from "@/components/ui/RowParts";
import ListFilters, { describeFilters, NoResults, type ChipGroup } from "@/components/admin/lists/ListFilters";
import { useListState } from "@/components/admin/lists/useListState";
import { PHASE_PILL } from "./phase";
import TurnoutBar from "./TurnoutBar";

const AUDIENCE_ICON: Record<PollAudience, LucideIcon> = { members: UsersRound, community: UsersRound, everyone: Globe };

export default function PollsList({ rows, lang }: { rows: PollRow[]; lang: Locale }) {
  const router = useRouter();
  const t = copy[lang];
  const ls = listsCopy[lang].lists;
  const spec = useMemo<ListSpec>(() => ({ search: true, multi: { status: POLL_STATUSES } }), []);
  const list = useListState(spec);
  const visible = useMemo(() => filterPolls(rows, list.state), [rows, list.state]);
  const counts = facetCounts(rows, list.state, "status", POLL_STATUSES, filterPolls);
  const groups: ChipGroup[] = [{ key: "status", label: t.list.statusLabel, options: POLL_STATUSES.map((v) => ({ value: v, label: t.list.statuses[v], count: counts[v] })) }];
  const summary = describeFilters({ list, groups, quoteQ: (q) => fill(ls.quote, { q }) });

  if (rows.length === 0) {
    return (
      <EmptyState
        sticker="writing" title={t.list.empty.title} line={t.list.empty.line}
        action={<ButtonLink href={href(lang, "/admin/polls/new")} icon={<Plus aria-hidden="true" size={16} />}>{t.newPoll}</ButtonLink>}
      />
    );
  }

  const columns: Column<PollRow>[] = [
    {
      key: "poll", header: t.list.cols.poll, primary: true, sortValue: (r) => tf(r.title, lang),
      cell: (r) => {
        const title = tf(r.title, lang);
        return (
          <RowEntity
            leading={<IconTile><ListChecks size={22} /></IconTile>}
            title={<Link href={href(lang, `/admin/polls/${r.id}`)} title={title} className={rowTitleClass} aria-label={`${t.list.open}: ${title}`}>{title}</Link>}
            sub={<>
              <Tag icon={AUDIENCE_ICON[r.audience]}>{t.audience[r.audience]}</Tag>
              {r.anonymous && <Tag icon={EyeOff}>{t.anonymousTag}</Tag>}
            </>}
          />
        );
      },
    },
    { key: "status", header: t.list.cols.status, width: "md:w-32", sortValue: (r) => r.phase, cell: (r) => <StatusPill status={PHASE_PILL[r.phase]} label={t.phase[r.phase]} /> },
    {
      key: "turnout", header: t.list.cols.turnout, width: "md:w-56", wide: true, sortValue: (r) => (r.eligible ? r.voters / r.eligible : 0),
      cell: (r) => r.stored === "draft" ? <span className="text-sm text-fg-muted">—</span> : (
        <TurnoutBar voters={r.voters} eligible={r.eligible} label={r.eligible ? fill(t.list.turnoutLabel, { voters: r.voters, eligible: r.eligible }) : t.list.turnoutNone} className="w-full md:max-w-48" />
      ),
    },
    {
      key: "closes", header: t.list.cols.closes, width: "md:w-40", sortValue: (r) => r.closesAt ?? "9999",
      cell: (r) => r.closesAt
        ? <time dateTime={r.closesAt}><Meta primary={formatUbStable(new Date(r.closesAt), lang, "date")} secondary={formatUbStable(new Date(r.closesAt), lang, "time")} /></time>
        : <span className="text-sm text-fg-muted">{t.list.noClose}</span>,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4">
      <ListFilters list={list} groups={groups} lang={lang} labels={{ filters: t.list.filters, clear: t.list.clear, searchLabel: t.list.searchLabel, searchPlaceholder: t.list.searchPlaceholder }} />
      <p role="status" className="text-sm font-semibold text-fg-muted">{plural(lang, visible.length, t.list.results)}</p>
      <DataTable
        rows={visible} columns={columns} getId={(r) => r.id} caption={t.list.caption} pageSize={25}
        onRowClick={(r) => router.push(href(lang, `/admin/polls/${r.id}`))}
        empty={<NoResults list={list} title={t.list.noMatch.title} line={t.list.noMatch.line} summary={summary} clearLabel={t.list.clear} />}
      />
    </div>
  );
}
