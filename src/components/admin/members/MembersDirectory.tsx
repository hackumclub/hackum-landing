"use client";
import { useRouter } from "next/navigation";
import { useDeferredValue, useMemo, useState, useTransition } from "react";
import { Search, X } from "lucide-react";
import Button from "@/components/ui/Button";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import DataTable, { type Column } from "@/components/ui/DataTable";
import EmptyState from "@/components/ui/EmptyState";
import FilterBar from "@/components/ui/FilterBar";
import { Input } from "@/components/ui/Field";
import StatusPill from "@/components/ui/StatusPill";
import { fill, tf, type Locale } from "@/i18n/config";
import { plural } from "@/i18n/plural";
import type { Dict } from "@/i18n";
import type { AreaCopy } from "@/i18n/areas/admin-members";
import { setStatusAction } from "@/lib/members/actions";
import { relativeTime } from "@/lib/members/format";
import type { MemberStatus } from "@/lib/status";
import { formatUb } from "@/lib/time";
import type { DirectoryData, MemberDto } from "./data";
import MemberDrawer from "./MemberDrawer";
import { NoticeBanner, PersonCell, Segments, errorText, type Notice } from "./shared";

type Segment = "all" | MemberStatus;
const BULK: { status: MemberStatus; key: "promote" | "alumni" | "guest" }[] = [
  { status: "member", key: "promote" }, { status: "alumni", key: "alumni" }, { status: "guest", key: "guest" },
];
const displayName = (m: MemberDto, lang: Locale) => tf(m.name, lang).trim() || m.name.mn || m.handle;

export default function MembersDirectory({ data, lang, c, common, status }: {
  data: DirectoryData; lang: Locale; c: AreaCopy["members"]; common: AreaCopy["common"]; status: Dict["status"];
}) {
  const t = c.directory;
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [segment, setSegment] = useState<Segment>("all");
  const [seasonSel, setSeasonSel] = useState<string[]>([]);
  const [teamSel, setTeamSel] = useState<string[]>([]);
  const [q, setQ] = useState("");
  const deferredQ = useDeferredValue(q);
  const [selected, setSelected] = useState<string[]>([]);
  const [selectionKey, setSelectionKey] = useState(0);
  const [openId, setOpenId] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const now = useMemo(() => new Date(data.now), [data.now]);
  const n = useMemo(() => new Intl.NumberFormat(lang === "mn" ? "mn-MN" : "en-US"), [lang]);

  const segmentCounts = useMemo(() => ({
    all: data.members.length,
    member: data.members.filter((m) => m.status === "member").length,
    guest: data.members.filter((m) => m.status === "guest").length,
    alumni: data.members.filter((m) => m.status === "alumni").length,
  }), [data.members]);

  const rows = useMemo(() => {
    const needle = deferredQ.trim().toLowerCase();
    return data.members.filter((m) => {
      if (segment !== "all" && m.status !== segment) return false;
      if (seasonSel.length || teamSel.length) {
        const hit = m.memberships.some((x) => (seasonSel.length === 0 || seasonSel.includes(String(x.season))) && (teamSel.length === 0 || (x.team !== null && teamSel.includes(x.team))));
        if (!hit) return false;
      }
      if (!needle) return true;
      return `${m.name.mn} ${m.name.en} ${m.school ?? ""} ${m.handle}`.toLowerCase().includes(needle);
    });
  }, [data.members, segment, seasonSel, teamSel, deferredQ]);

  const visible = useMemo(() => new Set(rows.map((r) => r.id)), [rows]);
  const picked = selected.filter((id) => visible.has(id));
  const filtering = segment !== "all" || seasonSel.length > 0 || teamSel.length > 0 || q.trim() !== "";
  const clearFilters = () => { setSegment("all"); setSeasonSel([]); setTeamSel([]); setQ(""); };

  const columns: Column<MemberDto>[] = [
    {
      key: "person", header: t.columns.person, sortValue: (m) => displayName(m, lang).toLowerCase(),
      cell: (m) => (
        <PersonCell name={displayName(m, lang)} sub={`@${m.handle}`}>
          <button type="button" onClick={() => setOpenId(m.id)} aria-label={fill(t.openProfile, { name: displayName(m, lang) })}
            className="max-w-[16rem] cursor-pointer truncate text-left font-semibold text-fg underline-offset-2 hover:text-accent-fg hover:underline">{displayName(m, lang)}</button>
        </PersonCell>
      ),
    },
    { key: "status", header: t.columns.status, sortValue: (m) => m.status, cell: (m) => <StatusPill status={m.status} label={status[m.status]} /> },
    {
      key: "school", header: t.columns.school, hideBelow: "md", sortValue: (m) => `${m.school ?? ""}${m.gradYear ?? ""}`,
      cell: (m) => <span className="grid"><span className="max-w-[14rem] truncate">{m.school ?? "—"}</span><span className="tnum text-xs text-fg-muted">{m.gradYear ?? "—"}</span></span>,
    },
    { key: "team", header: t.columns.team, hideBelow: "md", sortValue: (m) => m.team ?? "", cell: (m) => m.team ?? <span className="text-fg-muted">{t.noTeam}</span> },
    {
      key: "events", header: t.columns.events, hideBelow: "lg", sortValue: (m) => m.attended * 1000 + m.going,
      cell: (m) => <span className="tnum whitespace-nowrap text-fg-muted">{fill(t.events, { attended: m.attended, going: m.going })}</span>,
    },
    {
      key: "lastSeen", header: t.columns.lastSeen, hideBelow: "lg", sortValue: (m) => (m.lastSeenAt ? Date.parse(m.lastSeenAt) : 0),
      cell: (m) => m.lastSeenAt
        ? <span className="whitespace-nowrap" title={formatUb(new Date(m.lastSeenAt), lang, { dateStyle: "medium", timeStyle: "short" })}>{relativeTime(new Date(m.lastSeenAt), now, lang)}</span>
        : <span className="text-fg-muted">{t.never}</span>,
    },
  ];

  const runBulk = (target: MemberStatus) => {
    const ids = picked;
    startTransition(async () => {
      const r = await setStatusAction(ids, target);
      if (!r.ok) { setNotice({ tone: "error", text: errorText(common.errors, r.error) }); return; }
      const label = status[target];
      const same = ids.length - r.data.changed;
      setNotice({
        tone: "ok",
        text: r.data.changed === 0 ? fill(t.bulk.unchanged, { status: label }) : same > 0 ? fill(t.bulk.partial, { changed: r.data.changed, same, status: label }) : fill(t.bulk.done[target], { n: r.data.changed }),
      });
      setSelected([]);
      setSelectionKey((k) => k + 1);
      router.refresh();
    });
  };

  return (
    <div className="grid gap-4">
      <Segments label={t.segmentLabel} value={segment} onChange={setSegment} options={[
        { value: "all", label: t.segments.all, count: segmentCounts.all },
        { value: "member", label: t.segments.member, count: segmentCounts.member },
        { value: "guest", label: t.segments.guest, count: segmentCounts.guest },
        { value: "alumni", label: t.segments.alumni, count: segmentCounts.alumni },
      ]} />

      <div className="grid gap-3">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <FilterBar label={t.seasonFilter} value={seasonSel} onChange={setSeasonSel} options={data.seasons.map((s) => ({ value: String(s.year), label: String(s.year), count: s.count }))} />
          <FilterBar label={t.teamFilter} value={teamSel} onChange={setTeamSel} options={data.teams.map((x) => ({ value: x, label: x }))} />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-full max-w-md">
            <Search aria-hidden="true" size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-fg-muted" />
            <Input type="search" aria-label={t.searchLabel} placeholder={t.searchPlaceholder} value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" autoComplete="off" />
          </div>
          {filtering && <Button variant="ghost" size="sm" icon={<X aria-hidden="true" size={14} />} onClick={clearFilters}>{t.clear}</Button>}
          <p aria-live="polite" className="tnum ml-auto text-sm font-semibold text-fg-muted">{plural(lang, rows.length, common.results)}</p>
        </div>
      </div>

      <NoticeBanner notice={notice} onDismiss={() => setNotice(null)} dismissLabel={common.dismiss} />

      {picked.length > 0 && (
        <div role="group" aria-label={t.bulk.group} className="flex flex-wrap items-center gap-2 rounded-[var(--radius-md)] border border-line bg-accent-soft px-3 py-2">
          <p className="tnum mr-auto text-sm font-bold text-accent-fg">{plural(lang, picked.length, t.bulk.selected)}</p>
          {BULK.map(({ status: target, key }) => (
            <ConfirmDialog
              key={target}
              trigger={<Button variant="secondary" size="sm" disabled={pending}>{t.bulk[key]}</Button>}
              title={fill(t.bulk.confirmTitle[target], { n: picked.length })}
              body={fill(t.bulk.confirmBody[target], { n: picked.length })}
              confirmLabel={t.bulk[key]}
              cancelLabel={common.cancel}
              onConfirm={() => runBulk(target)}
            />
          ))}
          <Button variant="ghost" size="sm" onClick={() => { setSelected([]); setSelectionKey((k) => k + 1); }}>{t.bulk.clear}</Button>
        </div>
      )}

      <DataTable<MemberDto>
        key={selectionKey}
        rows={rows}
        columns={columns}
        getId={(m) => m.id}
        caption={`${t.caption}: ${n.format(rows.length)}`}
        selectable
        selectLabel={t.selectRow}
        selectAllLabel={t.selectAll}
        onSelectionChange={setSelected}
        empty={<EmptyState sticker="search" title={t.emptyTitle} line={t.emptyLine} action={filtering ? <Button variant="secondary" onClick={clearFilters}>{t.emptyAction}</Button> : undefined} />}
      />

      <MemberDrawer
        member={data.members.find((m) => m.id === openId) ?? null}
        now={now}
        lang={lang}
        c={{ ...c.drawer, never: t.never }}
        status={status}
        onClose={() => setOpenId(null)}
      />
    </div>
  );
}
