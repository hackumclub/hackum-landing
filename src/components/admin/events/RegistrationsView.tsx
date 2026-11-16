"use client";
import { useRouter } from "next/navigation";
import { Download, Megaphone, Send } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { fill, href, tf, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n";
import { copy } from "@/i18n/areas/admin-events";
import { plural } from "@/i18n/plural";
import { decideAction, sendDecisionsAction } from "@/lib/events/actions";
import { acceptImpact, pendingDecisions, segmentCounts, type RegRow, type TeamRow } from "@/lib/events/admin-registrations";
import { ANSWER_PREFIX, facetCounts, filterRegistrations } from "@/lib/admin/list-filters";
import type { ListSpec, ListState } from "@/lib/admin/list-state";
import { copy as listsCopy } from "@/i18n/areas/admin-members";
import ListFilters, { describeFilters, NoResults, type ChipGroup } from "@/components/admin/lists/ListFilters";
import { focusRowOpener } from "@/components/admin/lists/focus";
import { useListState } from "@/components/admin/lists/useListState";
import { answerText } from "@/lib/events/format";
import type { Question } from "@/lib/events/questions";
import type { RegStatus } from "@/lib/status";
import { formatUbStable } from "@/lib/time";
import Avatar from "@/components/ui/Avatar";
import Button, { buttonClass, ButtonLink } from "@/components/ui/Button";
import { composeHref } from "@/lib/announce/compose-state";
import { copy as announceCopy } from "@/lib/announce/copy";
import CapacityBar from "@/components/ui/CapacityBar";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import DataTable, { type Column } from "@/components/ui/DataTable";
import EmptyState from "@/components/ui/EmptyState";
import Icon3D from "@/components/Icon3D";
import { RowEntity, rowTitleClass } from "@/components/ui/RowParts";
import StatusPill from "@/components/ui/StatusPill";
import BulkBar from "./BulkBar";
import Glance from "./Glance";
import RegistrationDrawer, { type OtherRegistration } from "./RegistrationDrawer";
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
  rows: RegViewRow[];
  teams: TeamRow[];
};

/** A registration plus what the drawer links to: the person's handle and their other registrations (built by the page). */
export type RegViewRow = RegRow & { handle: string; others: OtherRegistration[] };

type Decision = "accept" | "reject" | "waitlist";

export default function RegistrationsView({ lang, eventId, slug, published, application, capacity, teamMode, teamMin, teamMax, questions, rows, teams }: RegistrationsProps) {
  const d = getDictionary(lang);
  const t = copy[lang].regs;
  const router = useRouter();
  const [pending, start] = useTransition();
  const { show, node } = useToast(t.toast.close);

  const [view, setView] = useState<"list" | "teams">("list");
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

  const hasAttended = counts.attended > 0, hasCancelled = counts.cancelled > 0;
  const segments = useMemo<RegStatus[]>(() => [
    ...(application ? (["applied", "going", "waitlisted", "rejected"] as const) : (["going", "waitlisted"] as const)),
    ...(hasAttended ? (["attended"] as const) : []), ...(hasCancelled ? (["cancelled"] as const) : []),
  ], [application, hasAttended, hasCancelled]);
  const answerQuestions = useMemo(
    () => (application ? questions.filter((x) => (x.type === "select" || x.type === "multi") && (x.options?.length ?? 0) > 0) : []),
    [application, questions],
  );
  const spec = useMemo<ListSpec>(() => ({
    search: true, dates: true,
    multi: {
      status: segments, team: ["team", "solo"],
      ...Object.fromEntries(answerQuestions.map((x) => [`${ANSWER_PREFIX}${x.id}`, (x.options ?? []).map((_, i) => String(i))])),
    },
  }), [segments, answerQuestions]);
  const list = useListState(spec);
  const ls = listsCopy[lang].lists;

  const filtered = useMemo(() => filterRegistrations(rows, list.state), [rows, list.state]);
  const visible = useMemo(() => new Set(filtered.map((r) => r.id)), [filtered]);
  const filterFn = (r: RegViewRow[], st: ListState) => filterRegistrations(r, st);
  const statusCounts = facetCounts(rows, list.state, "status", segments, filterFn);
  const teamCounts = facetCounts(rows, list.state, "team", ["team", "solo"], filterFn);
  const groups: ChipGroup[] = [
    { key: "status", label: ls.groups.status, options: segments.map((v) => ({ value: v, label: statusLabel(v), count: statusCounts[v] })) },
    ...(hasTeams ? [{ key: "team", label: t.teamFilter, options: [{ value: "team", label: t.teamTeam, count: teamCounts.team }, { value: "solo", label: t.teamSolo, count: teamCounts.solo }] }] : []),
    ...answerQuestions.map((q) => {
      const key = `${ANSWER_PREFIX}${q.id}`;
      const values = (q.options ?? []).map((_, i) => String(i));
      const cnt = facetCounts(rows, list.state, key, values, filterFn);
      return { key, label: tf(q.label, lang), options: values.map((v, i) => ({ value: v, label: tf((q.options ?? [])[i]!, lang), count: cnt[v] })) };
    }),
  ];
  const open = (id: string) => { focusRowOpener(id); setDrawerId(id); };

  const decide = (ids: string[], decision: Decision, scope: "individual" | "team" = "individual") =>
    start(async () => {
      const r = await decideAction({ ids, decision, scope });
      if (r.ok) {
        show(r.data.changed === 0 ? t.toast.noChange : plural(lang, r.data.changed, application ? t.toast[decision] : t.toast.promote));
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
      if (r.ok) show(r.data.queued === 0 ? t.toast.sentNone : plural(lang, r.data.queued, t.toast.sent), "ok", r.data.queued === 0 ? undefined : { label: t.toast.viewComms, href: href(lang, `/admin/events/${eventId}/comms`) });
      else show(t.errors[r.error] ?? t.errors.generic, "error");
      router.refresh();
    });

  const scope: "individual" | "team" = wholeTeam ? "team" : "individual";
  const dateText = list.state.from && list.state.to
    ? fill(ls.dates, { from: formatUbStable(new Date(`${list.state.from}T04:00:00Z`), lang, "date"), to: formatUbStable(new Date(`${list.state.to}T04:00:00Z`), lang, "date") }) : undefined;
  const summary = describeFilters({ list, groups, dateText, quoteQ: (q) => fill(ls.quote, { q }) });

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

  const answersSummary = (r: RegViewRow) => {
    const parts = questions.map((x) => answerText(x, r.answers[x.id], lang, yesNo)).filter(Boolean);
    return parts.length === 0 ? "—" : `${parts.slice(0, 2).join(" · ")}${parts.length > 2 ? ` · +${parts.length - 2}` : ""}`;
  };

  const columns: Column<RegViewRow>[] = [
    {
      key: "person", header: t.cols.person, primary: true, sortValue: (r) => tf(r.name, lang),
      cell: (r) => {
        const name = tf(r.name, lang);
        return (
          <RowEntity
            leading={<Avatar name={name} src={r.avatar} size={40} />}
            title={<button type="button" data-open={r.id} onClick={() => setDrawerId(r.id)} title={name} className={rowTitleClass}>{name}<span className="sr-only">{t.openRow}</span></button>}
          />
        );
      },
    },
    { key: "school", header: t.cols.school, hideBelow: "md", width: "md:w-40", sortValue: (r) => r.school ?? "", cell: (r) => <span className="block truncate text-fg-muted" title={r.school ?? undefined}>{r.school ?? "—"}</span> },
    { key: "status", header: t.cols.status, width: "md:w-32", sortValue: (r) => r.status, cell: (r) => <StatusPill status={r.status} label={statusLabel(r.status)} /> },
    ...(hasTeams ? [{
      key: "team", header: t.cols.team, hideBelow: "xl" as const, width: "xl:w-36", sortValue: (r: RegRow) => (r.teamId ? teamName.get(r.teamId) ?? "" : ""),
      cell: (r: RegRow) => <span className="text-fg-muted">{r.teamId ? teamName.get(r.teamId) ?? "—" : t.solo}</span>,
    }] : []),
    {
      key: "applied", header: t.cols.applied, hideBelow: "md", width: "md:w-28", sortValue: (r) => r.createdAt,
      cell: (r) => <time dateTime={r.createdAt} className="whitespace-nowrap text-fg-muted">{formatUbStable(new Date(r.createdAt), lang, "short")}</time>,
    },
    ...(questions.length > 0 ? [{
      key: "answers", header: t.cols.answers, hideBelow: "2xl" as const, hideInCard: true, width: "2xl:w-56",
      cell: (r: RegViewRow) => <span className="block max-w-64 truncate text-fg-muted" title={answersSummary(r)}>{answersSummary(r)}</span>,
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

      <div className="flex flex-wrap items-center justify-end gap-2">
        {hasTeams && (
          <div role="group" aria-label={t.viewLabel} className="inline-flex items-center gap-0.5 rounded-full bg-seg-track p-1">
            {(["list", "teams"] as const).map((v) => (
              <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)} className={`min-h-8 cursor-pointer rounded-full px-3.5 text-sm font-semibold transition-[background-color,color,box-shadow] duration-150 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--ops-accent)] ${view === v ? "bg-seg-chip text-fg shadow-raise" : "text-fg-muted hover:bg-seg-chip/50 hover:text-fg"}`}>
                {v === "list" ? t.viewList : t.viewTeams}
              </button>
            ))}
          </div>
        )}
        <ButtonLink variant="secondary" size="sm" href={composeHref(lang, { audience: "event", eventId, statuses: ["going"] })} icon={<Megaphone aria-hidden="true" size={16} />}>{announceCopy[lang].messageAttendees}</ButtonLink>
        <a href={href(lang, `/admin/events/${eventId}/registrations/export`)} download className={buttonClass("secondary", "sm")}>
          <Download aria-hidden="true" size={16} />{t.export}
        </a>
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
          onSolo={() => { setView("list"); list.clear(); list.setMulti("team", ["solo"]); }} onList={() => setView("list")}
        />
      ) : (
        <>
          <ListFilters
            list={list} groups={groups} lang={lang} dates
            labels={{ filters: t.filters, clear: ls.clear, searchLabel: t.searchLabel, searchPlaceholder: t.searchPlaceholder }}
          />
          <p role="status" className="text-sm font-semibold text-fg-muted">{plural(lang, filtered.length, t.results)}</p>
          <DataTable
            key={epoch} rows={filtered} columns={columns} getId={(r) => r.id} caption={t.caption} selectable selectLabel={t.selectRow} selectAllLabel={t.selectAll}
            fixed pageSize={25} onRowClick={(r) => open(r.id)}
            empty={<NoResults list={list} title={t.noMatch.title} line={ls.noMatchLine} summary={summary} clearLabel={ls.clear} />}
            selectionBar={(ids) => {
              const selectedRows = rows.filter((r) => ids.includes(r.id) && visible.has(r.id));
              // RSVP events only ever promote people off the waitlist; applications take the full accept / waitlist / reject set.
              const actRows = application ? selectedRows : selectedRows.filter((r) => r.status === "waitlisted");
              if (actRows.length === 0) return null;
              const impact = acceptImpact(rows, actRows.map((r) => r.id), application ? scope : "individual", capacity);
              return (
                <BulkBar
                  lang={lang} count={application ? selectedRows.length : actRows.length} application={application} hasTeam={selectedRows.some((r) => r.teamId)} wholeTeam={wholeTeam} onWholeTeam={setWholeTeam}
                  adding={impact.adding} taken={impact.taken} over={impact.over} capacity={capacity} pending={pending}
                  onClear={() => setEpoch((n) => n + 1)}
                  onDecide={(dec) => decide(application ? selectedRows.map((r) => r.id) : actRows.map((r) => r.id), dec, application ? scope : "individual")}
                />
              );
            }}
          />
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
