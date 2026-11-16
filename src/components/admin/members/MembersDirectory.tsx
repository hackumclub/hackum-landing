"use client";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { GraduationCap } from "lucide-react";
import Button, { ButtonLink } from "@/components/ui/Button";
import { audienceForStatuses, composeHref } from "@/lib/announce/compose-state";
import { copy as announceCopy } from "@/lib/announce/copy";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import DataTable, { type Column } from "@/components/ui/DataTable";
import Select from "@/components/ui/Select";
import { rowTitleClass } from "@/components/ui/RowParts";
import StatusPill from "@/components/ui/StatusPill";
import Tag from "@/components/ui/Tag";
import { fill, tf, type Locale } from "@/i18n/config";
import { plural } from "@/i18n/plural";
import type { Dict } from "@/i18n";
import type { AreaCopy } from "@/i18n/areas/admin-members";
import { facetCounts, filterMembers, MEMBER_SCHOOL_VALUES, MEMBER_TRACK_VALUES } from "@/lib/admin/list-filters";
import type { ListSpec, ListState } from "@/lib/admin/list-state";
import { setStatusAction } from "@/lib/members/actions";
import { relativeTime } from "@/lib/members/format";
import { MAJOR_TRACKS } from "@/lib/num/schools";
import { semesterLabel } from "@/lib/semester";
import type { MemberStatus } from "@/lib/status";
import { formatUbStable } from "@/lib/time";
import ListFilters, { describeFilters, NoResults, type ChipGroup } from "@/components/admin/lists/ListFilters";
import { focusRowOpener } from "@/components/admin/lists/focus";
import { useListState } from "@/components/admin/lists/useListState";
import type { DirectoryData, MemberDto } from "./data";
import MemberDrawer, { type BadgeCopy } from "./MemberDrawer";
import { NoticeBanner, PersonCell, errorText, type Notice } from "./shared";

// Rows follow the shared row anatomy (docs/design/polish-rubric.md, "Controls and rows").
const STATUSES: MemberStatus[] = ["member", "guest", "alumni"];
const BULK: { status: MemberStatus; key: "promote" | "alumni" | "guest" }[] = [
  { status: "member", key: "promote" }, { status: "alumni", key: "alumni" }, { status: "guest", key: "guest" },
];
const IGNORE = ["by"] as const;
const displayName = (m: MemberDto, lang: Locale) => tf(m.name, lang).trim() || m.name.mn || m.handle;

const specFor = (data: DirectoryData): ListSpec => ({
  search: true, dates: true,
  multi: {
    status: STATUSES, school: MEMBER_SCHOOL_VALUES, track: MEMBER_TRACK_VALUES,
    semester: data.semesters.map((s) => s.key), season: data.seasons.map((s) => String(s.year)), team: data.teams,
  },
  single: { by: ["joined", "seen"] },
});

export default function MembersDirectory({ data, lang, c, common, status, lists, badges }: {
  data: DirectoryData; lang: Locale; c: AreaCopy["members"]; common: AreaCopy["common"]; status: Dict["status"]; lists: AreaCopy["lists"]; badges: BadgeCopy;
}) {
  const t = c.directory;
  const lm = lists.members;
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const spec = useMemo(() => specFor(data), [data]);
  const list = useListState(spec, { ignore: IGNORE });
  const by = list.state.single.by === "seen" ? "seen" : "joined";
  const [epoch, setEpoch] = useState(0); // bumping it remounts the table, which clears its selection
  const [openId, setOpenId] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const now = useMemo(() => new Date(data.now), [data.now]);

  const rows = useMemo(() => filterMembers(data.members, list.state, by), [data.members, list.state, by]);
  const filterFn = useMemo(() => (r: MemberDto[], s: ListState) => filterMembers(r, s, by), [by]);

  const groups: ChipGroup[] = useMemo(() => {
    const counts = (group: string, values: readonly string[]) => facetCounts(data.members, list.state, group, values, filterFn);
    const st = counts("status", STATUSES), sc = counts("school", MEMBER_SCHOOL_VALUES), tr = counts("track", MEMBER_TRACK_VALUES);
    const sem = counts("semester", data.semesters.map((s) => s.key)), se = counts("season", data.seasons.map((s) => String(s.year))), te = counts("team", data.teams);
    const trackLabel = (v: string) => (v === "unknown" ? lm.trackUnknown : tf(MAJOR_TRACKS.find((x) => x.id === v)?.name ?? { mn: v, en: v }, lang));
    return [
      { key: "status", label: lists.groups.status, options: STATUSES.map((v) => ({ value: v, label: status[v], count: st[v] })) },
      { key: "school", label: lists.groups.school, options: MEMBER_SCHOOL_VALUES.map((v) => ({ value: v, label: lm.schools[v], count: sc[v] })) },
      { key: "track", label: lists.groups.track, options: MEMBER_TRACK_VALUES.map((v) => ({ value: v, label: trackLabel(v), count: tr[v] })) },
      { key: "semester", label: lists.groups.semester, options: data.semesters.map((s) => ({ value: s.key, label: semesterLabel(s, lang), count: sem[s.key] })) },
      { key: "season", label: lists.groups.season, options: data.seasons.map((s) => ({ value: String(s.year), label: String(s.year), count: se[String(s.year)] })) },
      { key: "team", label: lists.groups.team, options: data.teams.map((x) => ({ value: x, label: x, count: te[x] })) },
    ].filter((g) => g.options.length > 0);
  }, [data, list.state, filterFn, lang, lists, lm, status]);

  const trackName = (m: MemberDto) => (m.track ? tf(MAJOR_TRACKS.find((x) => x.id === m.track)?.name ?? { mn: m.track, en: m.track }, lang) : null);
  const open = (id: string) => { focusRowOpener(id); setOpenId(id); };

  const columns: Column<MemberDto>[] = [
    {
      key: "person", header: t.columns.person, primary: true, sortValue: (m) => displayName(m, lang).toLowerCase(),
      cell: (m) => (
        <PersonCell name={displayName(m, lang)} sub={`@${m.handle}`} src={m.avatar}>
          <button type="button" data-open={m.id} onClick={() => setOpenId(m.id)} aria-label={fill(t.openProfile, { name: displayName(m, lang) })}
            title={displayName(m, lang)} className={rowTitleClass}>{displayName(m, lang)}</button>
        </PersonCell>
      ),
    },
    { key: "status", header: t.columns.status, width: "md:w-32", sortValue: (m) => m.status, cell: (m) => <StatusPill status={m.status} label={status[m.status]} /> },
    {
      key: "school", header: lm.columns.school, hideBelow: "md", width: "md:w-44", sortValue: (m) => `${m.schoolId === "num" ? "0" : "1"}${m.school ?? ""}`,
      cell: (m) => (
        <span className="grid justify-items-start gap-0.5">
          {m.school || m.schoolId ? (
            <Tag tone={m.schoolId === "num" ? "accent" : "neutral"} icon={GraduationCap} className="max-w-full truncate">{m.schoolId === "num" ? lm.schools.num : (m.school ?? lm.schools.other)}</Tag>
          ) : <span className="text-fg-muted">—</span>}
          <span className="tnum text-xs text-fg-muted">{m.gradYear ?? "—"}</span>
        </span>
      ),
    },
    { key: "track", header: lm.columns.track, hideBelow: "xl", width: "xl:w-40", sortValue: (m) => trackName(m) ?? "~", cell: (m) => trackName(m) ?? <span className="text-fg-muted">{lm.trackUnknown}</span> },
    { key: "team", header: t.columns.team, hideBelow: "2xl", width: "2xl:w-28", sortValue: (m) => m.team ?? "", cell: (m) => m.team ?? <span className="text-fg-muted">{t.noTeam}</span> },
    {
      key: "events", header: t.columns.events, hideBelow: "2xl", width: "2xl:w-40", sortValue: (m) => m.attended * 1000 + m.going,
      cell: (m) => <span className="tnum whitespace-nowrap text-fg-muted">{fill(t.events, { attended: m.attended, going: m.going })}</span>,
    },
    {
      key: "lastSeen", header: t.columns.lastSeen, hideBelow: "xl", width: "xl:w-32", sortValue: (m) => (m.lastSeenAt ? Date.parse(m.lastSeenAt) : 0),
      cell: (m) => m.lastSeenAt
        ? <span className="whitespace-nowrap" title={formatUbStable(new Date(m.lastSeenAt), lang, "datetime")}>{relativeTime(new Date(m.lastSeenAt), now, lang)}</span>
        : <span className="text-fg-muted">{t.never}</span>,
    },
  ];

  const runBulk = (ids: string[], target: MemberStatus) => {
    startTransition(async () => {
      const r = await setStatusAction(ids, target);
      if (!r.ok) { setNotice({ tone: "error", text: errorText(common.errors, r.error) }); return; }
      const label = status[target];
      const same = ids.length - r.data.changed;
      setNotice({
        tone: "ok",
        text: r.data.changed === 0 ? fill(t.bulk.unchanged, { status: label }) : same > 0 ? fill(t.bulk.partial, { changed: r.data.changed, same, status: label }) : fill(t.bulk.done[target], { n: r.data.changed }),
      });
      setEpoch((k) => k + 1);
      router.refresh();
    });
  };

  const dateText = list.state.from && list.state.to
    ? fill(lists.dates, { from: formatUbStable(new Date(`${list.state.from}T04:00:00Z`), lang, "date"), to: formatUbStable(new Date(`${list.state.to}T04:00:00Z`), lang, "date") }) : undefined;
  const summary = describeFilters({ list, groups, dateText, quoteQ: (q) => fill(lists.quote, { q }) });

  return (
    <div className="grid grid-cols-1 gap-4">
      <ListFilters
        list={list} groups={groups} lang={lang} dates
        labels={{ filters: lists.filters, clear: lists.clear, searchLabel: t.searchLabel, searchPlaceholder: t.searchPlaceholder }}
      >
        <label className="inline-flex shrink-0 items-center gap-2 text-sm font-semibold whitespace-nowrap text-fg-muted">
          <span className="whitespace-nowrap max-md:sr-only">{lm.dateBy}</span>
          <Select
            variant="filter" aria-label={lm.dateBy} value={by} onValueChange={(v) => list.setSingle("by", v === "seen" ? "seen" : null)}
            options={[{ value: "joined", label: lm.dateJoined }, { value: "seen", label: lm.dateSeen }]}
          />
        </label>
      </ListFilters>
      <p aria-live="polite" className="tnum text-sm font-semibold text-fg-muted">{plural(lang, rows.length, common.results)}</p>

      <NoticeBanner notice={notice} onDismiss={() => setNotice(null)} dismissLabel={common.dismiss} />

      <DataTable<MemberDto>
        key={epoch}
        rows={rows}
        columns={columns}
        getId={(m) => m.id}
        caption={`${t.caption}: ${rows.length}`}
        selectable fixed
        pageSize={25}
        selectLabel={t.selectRow}
        selectAllLabel={t.selectAll}
        onRowClick={(m) => open(m.id)}
        empty={<NoResults list={list} title={lists.noMatchTitle} line={lists.noMatchLine} summary={summary} clearLabel={lists.clear} />}
        selectionBar={(ids) => (
          <div role="group" aria-label={t.bulk.group} className="flex flex-wrap items-center gap-2">
            <p className="tnum mr-auto text-sm font-bold text-accent-fg max-sm:w-full">{plural(lang, ids.length, t.bulk.selected)}</p>
            {BULK.map(({ status: target, key }) => (
              <ConfirmDialog
                key={target}
                trigger={<Button variant="secondary" disabled={pending}>{t.bulk[key]}</Button>}
                title={fill(t.bulk.confirmTitle[target], { n: ids.length })}
                body={fill(t.bulk.confirmBody[target], { n: ids.length })}
                confirmLabel={t.bulk[key]}
                cancelLabel={common.cancel}
                onConfirm={() => runBulk(ids, target)}
              />
            ))}
            <ButtonLink variant="secondary" href={composeHref(lang, { audience: audienceForStatuses(list.state.multi.status ?? []) })}>{announceCopy[lang].emailSegment}</ButtonLink>
            <Button variant="ghost" onClick={() => setEpoch((k) => k + 1)}>{t.bulk.clear}</Button>
          </div>
        )}
      />

      <MemberDrawer
        member={data.members.find((m) => m.id === openId) ?? null}
        now={now}
        lang={lang}
        c={{ ...c.drawer, never: t.never }}
        lists={lists}
        badges={badges}
        common={common}
        bulk={t.bulk}
        status={status}
        onClose={() => setOpenId(null)}
      />
    </div>
  );
}
