"use client";
import { useRouter } from "next/navigation";
import { Download, Search, Send } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { fill, href, tf, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n";
import { copy } from "@/i18n/areas/admin-events";
import { plural } from "@/i18n/plural";
import { decideAction, sendDecisionsAction } from "@/lib/events/actions";
import { acceptImpact, filterRows, pendingDecisions, segmentCounts, type RegRow, type Segment, type TeamRow } from "@/lib/events/admin-registrations";
import { answerText } from "@/lib/events/format";
import type { Question } from "@/lib/events/questions";
import type { RegStatus } from "@/lib/status";
import { formatUb } from "@/lib/time";
import Avatar from "@/components/ui/Avatar";
import Button, { buttonClass, ButtonLink } from "@/components/ui/Button";
import CapacityBar from "@/components/ui/CapacityBar";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import DataTable, { type Column } from "@/components/ui/DataTable";
import EmptyState from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Field";
import FilterBar from "@/components/ui/FilterBar";
import FilterDisclosure from "@/components/ui/FilterDisclosure";
import Icon3D from "@/components/Icon3D";
import StatusPill from "@/components/ui/StatusPill";
import BulkBar from "./BulkBar";
import Glance from "./Glance";
import RegistrationDrawer from "./RegistrationDrawer";
import SegmentTabs from "./SegmentTabs";
import TeamBoard from "./TeamBoard";
import { useToast } from "./Toast";

export type RegistrationsProps = {
  lang: Locale;
  eventId: string;
  slug: string;
  published: boolean;
  application: boolean;
  capacity: number | null;
  teamMode: "none" | "optional" | "required";
  teamMin: number;
  teamMax: number;
  questions: Question[];
  rows: RegRow[];
  teams: TeamRow[];
};

type Decision = "accept" | "reject" | "waitlist";

export default function RegistrationsView({ lang, eventId, slug, published, application, capacity, teamMode, teamMin, teamMax, questions, rows, teams }: RegistrationsProps) {
  const d = getDictionary(lang);
  const t = copy[lang].regs;
  const router = useRouter();
  const [pending, start] = useTransition();
  const { show, node } = useToast(t.toast.close);

  const [segment, setSegment] = useState<Segment>("all");
  const [teamFilter, setTeamFilter] = useState<string[]>([]);
  const [q, setQ] = useState("");
  const [answerFilters, setAnswerFilters] = useState<Record<string, string[]>>({});
  const [view, setView] = useState<"list" | "teams">("list");
  const [sel, setSel] = useState<string[]>([]);
  const [epoch, setEpoch] = useState(0); // bumping it remounts the table, which clears its internal selection
  const [wholeTeam, setWholeTeam] = useState(false);
  const [drawerId, setDrawerId] = useState<string | null>(null);

  const counts = useMemo(() => segmentCounts(rows), [rows]);
  const waiting = useMemo(() => pendingDecisions(rows), [rows]);
  const seats = counts.going + counts.attended;
  const hasTeams = application && teamMode !== "none";
  const yesNo = { yes: t.drawer.yes, no: t.drawer.no };

  const statusLabel = (s: RegStatus) => (application && s === "going" ? t.accepted : d.status[s]);
  const teamName = useMemo(() => new Map(teams.map((tm) => [tm.id, tm.name])), [teams]);

  const filtered = useMemo(
    () => filterRows(rows, { segment, team: teamFilter.length === 1 ? (teamFilter[0] === "team" ? "team" : "solo") : "any", q, answers: answerFilters }),
    [rows, segment, teamFilter, q, answerFilters],
  );
  const visible = useMemo(() => new Set(filtered.map((r) => r.id)), [filtered]);
  // Selection survives filtering inside the table, but only rows you can see are ever acted on.
  const selected = sel.filter((id) => visible.has(id));
  const selectedRows = rows.filter((r) => selected.includes(r.id));

  const segments: Segment[] = application
    ? ["all", "applied", "going", "waitlisted", "rejected", ...(counts.attended > 0 ? ["attended" as const] : []), ...(counts.cancelled > 0 ? ["cancelled" as const] : [])]
    : ["all", "going", "waitlisted", ...(counts.attended > 0 ? ["attended" as const] : []), ...(counts.cancelled > 0 ? ["cancelled" as const] : [])];

  const answerGroups = application
    ? questions.filter((x) => (x.type === "select" || x.type === "multi") && (x.options?.length ?? 0) > 0).map((x) => ({
        q: x,
        options: (x.options ?? []).map((o, i) => ({
          value: String(i), label: tf(o, lang),
          count: rows.filter((r) => r.status !== "cancelled" && (Array.isArray(r.answers[x.id]) ? (r.answers[x.id] as string[]).includes(String(i)) : r.answers[x.id] === String(i))).length,
        })),
      }))
    : [];

  const decide = (ids: string[], decision: Decision, scope: "individual" | "team" = "individual") =>
    start(async () => {
      const r = await decideAction({ ids, decision, scope });
      if (r.ok) {
        show(r.data.changed === 0 ? t.toast.noChange : plural(lang, r.data.changed, application ? t.toast[decision] : t.toast.promote));
        setSel([]);
        setEpoch((n) => n + 1);
        setDrawerId(null);
      } else {
        show(t.errors[r.error] ?? t.errors.generic, "error");
      }
      router.refresh();
    });

  const sendAll = () =>
    start(async () => {
      const r = await sendDecisionsAction(eventId);
      if (r.ok) show(r.data.queued === 0 ? t.toast.sentNone : plural(lang, r.data.queued, t.toast.sent));
      else show(t.errors[r.error] ?? t.errors.generic, "error");
      router.refresh();
    });

  const scope: "individual" | "team" = wholeTeam ? "team" : "individual";
  // RSVP events only ever promote people off the waitlist; applications take the full accept / waitlist / reject set.
  const actRows = application ? selectedRows : selectedRows.filter((r) => r.status === "waitlisted");
  const impact = acceptImpact(rows, actRows.map((r) => r.id), application ? scope : "individual", capacity);
  const clearFilters = () => { setSegment("all"); setTeamFilter([]); setQ(""); setAnswerFilters({}); };
  const filtering = segment !== "all" || teamFilter.length > 0 || q.trim() !== "" || Object.values(answerFilters).some((v) => v.length > 0);

  const drawerRow = rows.find((r) => r.id === drawerId) ?? null;
  const drawerTeamMembers = drawerRow?.teamId ? rows.filter((r) => r.teamId === drawerRow.teamId).length : 0;

  if (rows.length === 0) {
    return (
      <EmptyState
        sticker="queue" title={t.empty.title} line={published ? t.empty.linePublished : t.empty.lineDraft}
        action={published
          ? <ButtonLink href={href(lang, `/events/${slug}`)} target="_blank" rel="noopener noreferrer">{t.empty.viewPublic}</ButtonLink>
          : <ButtonLink href={href(lang, `/admin/events/${eventId}`)}>{t.empty.editEvent}</ButtonLink>}
      />
    );
  }

  const answersSummary = (r: RegRow) => {
    const parts = questions.map((x) => answerText(x, r.answers[x.id], lang, yesNo)).filter(Boolean);
    return parts.length === 0 ? "—" : `${parts.slice(0, 2).join(" · ")}${parts.length > 2 ? ` · +${parts.length - 2}` : ""}`;
  };

  const columns: Column<RegRow>[] = [
    {
      key: "person", header: t.cols.person, sortValue: (r) => tf(r.name, lang),
      cell: (r) => {
        const name = tf(r.name, lang);
        return (
          <button type="button" onClick={() => setDrawerId(r.id)} className="flex min-w-0 cursor-pointer items-center gap-2.5 rounded text-left">
            <Avatar name={name} src={r.avatar} size={32} />
            <span className="grid min-w-0">
              <span className="truncate font-semibold text-fg">{name}<span className="sr-only">{t.openRow}</span></span>
              <span className="truncate text-xs text-fg-muted md:hidden">{r.school ?? ""}</span>
            </span>
          </button>
        );
      },
    },
    { key: "school", header: t.cols.school, hideBelow: "md", sortValue: (r) => r.school ?? "", cell: (r) => <span className="whitespace-nowrap text-fg-muted">{r.school ?? "—"}</span> },
    { key: "status", header: t.cols.status, sortValue: (r) => r.status, cell: (r) => <StatusPill status={r.status} label={statusLabel(r.status)} /> },
    ...(hasTeams ? [{
      key: "team", header: t.cols.team, hideBelow: "lg" as const, sortValue: (r: RegRow) => (r.teamId ? teamName.get(r.teamId) ?? "" : ""),
      cell: (r: RegRow) => <span className="text-fg-muted">{r.teamId ? teamName.get(r.teamId) ?? "—" : t.solo}</span>,
    }] : []),
    {
      key: "applied", header: t.cols.applied, hideBelow: "md", sortValue: (r) => r.createdAt,
      cell: (r) => <time dateTime={r.createdAt} className="whitespace-nowrap text-fg-muted">{formatUb(new Date(r.createdAt), lang, { month: "short", day: "numeric" })}</time>,
    },
    ...(questions.length > 0 ? [{
      key: "answers", header: t.cols.answers, hideBelow: "lg" as const,
      cell: (r: RegRow) => <span className="block max-w-64 truncate text-fg-muted" title={answersSummary(r)}>{answersSummary(r)}</span>,
    }] : []),
  ];

  return (
    <div className="grid grid-cols-1 gap-5">
      <section aria-labelledby="glance" className="grid gap-2">
        <h2 id="glance" className="text-sm font-bold text-fg">{t.glance}</h2>
        <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Glance label={application ? t.accepted : t.goingSeats} value={seats} icon="ticket" tone="green" className="col-span-2 md:col-span-1">
            <CapacityBar value={seats} max={capacity} label={capacity === null ? fill(t.noLimit, { n: seats }) : fill(t.seats, { n: seats, max: capacity })} />
          </Glance>
          {application && <Glance label={t.applied} value={counts.applied} icon="clipboard" tone="blue" />}
          <Glance label={t.waitlisted} value={counts.waitlisted} icon="clock" tone="yellow" className={application ? undefined : "col-span-2 md:col-span-1"} />
          {application && <Glance label={t.rejected} value={counts.rejected} icon="flag" tone="ember" className="col-span-2 md:col-span-1" />}
        </dl>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentTabs
          label={t.segmentsLabel} value={segment} onChange={setSegment}
          options={segments.map((s) => ({ value: s, label: s === "all" ? t.all : statusLabel(s), count: counts[s] }))}
        />
        <div className="flex flex-wrap items-center gap-2">
          {hasTeams && (
            <div role="group" aria-label={t.viewLabel} className="inline-flex overflow-hidden rounded-[var(--radius-sm)] border border-line-strong">
              {(["list", "teams"] as const).map((v) => (
                <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)} className={`min-h-9 cursor-pointer px-3 text-sm font-semibold ${view === v ? "bg-accent-soft text-accent-fg" : "bg-panel text-fg hover:bg-panel-2"}`}>
                  {v === "list" ? t.viewList : t.viewTeams}
                </button>
              ))}
            </div>
          )}
          <a href={href(lang, `/admin/events/${eventId}/registrations/export`)} download className={buttonClass("secondary", "sm")}>
            <Download aria-hidden="true" size={16} />{t.export}
          </a>
        </div>
      </div>

      {application && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-[var(--radius-md)] border border-line bg-panel p-4">
          <Icon3D name="send" sizes="48px" className="pointer-events-none size-11 shrink-0 -rotate-6 drop-shadow-[0_6px_8px_rgb(0_40_70/0.25)]" />
          <div className="grid min-w-0 flex-1 gap-0.5 basis-56">
            <p role="status" className="text-sm font-bold text-fg">{waiting.total > 0 ? plural(lang, waiting.total, t.waiting) : t.nothingWaiting}</p>
            <p className="text-sm text-fg-muted">{t.send.hint}</p>
          </div>
          <ConfirmDialog
            trigger={<Button variant={waiting.total > 0 ? "primary" : "secondary"} size="sm" disabled={waiting.total === 0 || pending} icon={<Send aria-hidden="true" size={14} />}>{t.send.button}</Button>}
            title={fill(t.send.title, { n: waiting.total })}
            body={fill(t.send.body, { accepted: waiting.accepted, rejected: waiting.rejected, waitlisted: waiting.waitlisted })}
            confirmLabel={t.send.confirm} cancelLabel={t.send.cancel} onConfirm={sendAll}
          />
        </div>
      )}

      {view === "teams" && hasTeams ? (
        <TeamBoard
          lang={lang} rows={rows} teams={teams} capacity={capacity} teamMin={teamMin} teamMax={teamMax} pending={pending} statusLabel={statusLabel}
          onDecide={(ids, dec) => decide(ids, dec, "team")}
          onSolo={() => { setView("list"); setSegment("all"); setTeamFilter(["solo"]); }} onList={() => setView("list")}
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative w-full sm:w-72">
              <label htmlFor="regs-search" className="sr-only">{t.searchLabel}</label>
              <Search aria-hidden="true" size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-fg-muted" />
              <Input id="regs-search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.searchPlaceholder} className="pl-9" />
            </div>
            {(hasTeams || answerGroups.length > 0) && (
              <FilterDisclosure label={t.filters} activeCount={teamFilter.length + Object.values(answerFilters).reduce((n, v) => n + v.length, 0)} className="md:contents">
                <div className="flex flex-wrap items-center gap-2">
                {hasTeams && (
                  <FilterBar
                    label={t.teamFilter} value={teamFilter} onChange={setTeamFilter}
                    options={[{ value: "team", label: t.teamTeam, count: rows.filter((r) => r.teamId && r.status !== "cancelled").length }, { value: "solo", label: t.teamSolo, count: rows.filter((r) => !r.teamId && r.status !== "cancelled").length }]}
                  />
                )}
                {answerGroups.map((g) => (
                  <FilterBar key={g.q.id} label={tf(g.q.label, lang)} options={g.options} value={answerFilters[g.q.id] ?? []} onChange={(v) => setAnswerFilters((p) => ({ ...p, [g.q.id]: v }))} />
                ))}
                </div>
              </FilterDisclosure>
            )}
          </div>
          <p role="status" className="text-sm font-semibold text-fg-muted">{plural(lang, filtered.length, t.results)}</p>
          <DataTable
            key={epoch} rows={filtered} columns={columns} getId={(r) => r.id} caption={t.caption} selectable selectLabel={t.selectRow} selectAllLabel={t.selectAll}
            onSelectionChange={setSel}
            empty={
              <EmptyState
                sticker="search" title={t.noMatch.title} line={t.noMatch.line}
                action={filtering ? <Button variant="secondary" onClick={clearFilters}>{t.noMatch.clear}</Button> : undefined}
              />
            }
          />
          {actRows.length > 0 && (
            <BulkBar
              lang={lang} count={application ? selected.length : actRows.length} application={application} hasTeam={selectedRows.some((r) => r.teamId)} wholeTeam={wholeTeam} onWholeTeam={setWholeTeam}
              adding={impact.adding} taken={impact.taken} over={impact.over} capacity={capacity} pending={pending}
              onClear={() => { setSel([]); setEpoch((n) => n + 1); }}
              onDecide={(dec) => decide(application ? selected : actRows.map((r) => r.id), dec, application ? scope : "individual")}
            />
          )}
        </>
      )}

      <RegistrationDrawer
        lang={lang} row={drawerRow} teamName={drawerRow?.teamId ? teamName.get(drawerRow.teamId) ?? null : null} questions={questions} application={application}
        statusLabel={drawerRow ? statusLabel(drawerRow.status) : ""} wholeTeamPossible={application && drawerTeamMembers > 1} pending={pending}
        onClose={() => setDrawerId(null)} onDecide={(dec, sc) => drawerRow && decide([drawerRow.id], dec, sc)}
      />
      {node}
    </div>
  );
}
