"use client";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Check, GraduationCap, Lock, Quote, TriangleAlert, X } from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import Button, { ButtonLink } from "@/components/ui/Button";
import { cx } from "@/components/ui/cx";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import EmptyState from "@/components/ui/EmptyState";
import { Textarea } from "@/components/ui/Field";
import StatusPill from "@/components/ui/StatusPill";
import { fill, href, tf, type Locale } from "@/i18n/config";
import { plural } from "@/i18n/plural";
import type { Dict } from "@/i18n";
import type { AreaCopy } from "@/i18n/areas/admin-members";
import { reviewApplicationAction } from "@/lib/members/actions";
import { relativeTime } from "@/lib/members/format";
import type { ApplicationStatus } from "@/lib/status";
import { formatUbStable } from "@/lib/time";
import type { ApplicationDto, ApplicationsData } from "./data";
import { CARD } from "@/components/admin/members/card";
import { NoticeBanner, errorText, type Notice } from "./shared";
import SegmentedTabs from "@/components/ui/SegmentedTabs";
import CountBadge from "@/components/ui/CountBadge";
import Tag from "@/components/ui/Tag";
import ListFilters, { describeFilters, NoResults, type ChipGroup } from "@/components/admin/lists/ListFilters";
import { useListState } from "@/components/admin/lists/useListState";
import { facetCounts, filterApplications, MEMBER_SCHOOL_VALUES, MEMBER_TRACK_VALUES } from "@/lib/admin/list-filters";
import type { ListSpec, ListState } from "@/lib/admin/list-state";
import { MAJOR_TRACKS } from "@/lib/num/schools";

type Tab = "pending" | "approved" | "rejected";
const TABS: Tab[] = ["pending", "approved", "rejected"];
const SPEC: ListSpec = { search: true, dates: true, multi: { school: MEMBER_SCHOOL_VALUES, track: MEMBER_TRACK_VALUES }, single: { status: TABS } };
/** Membership is NUM-only and needs a major track (the same rule `applyForMembership` enforces). */
const eligibility = (p: { schoolId: string | null; track: string | null }) => (p.schoolId !== "num" ? "school" : p.track === null ? "track" : "ok") as "school" | "track" | "ok";
type Override = { status: Tab; reviewer: string | null; reviewedAt: string; note: string | null };
const nameOf = (a: ApplicationDto, lang: Locale) => tf(a.person.name, lang).trim() || a.person.name.mn || a.person.handle;

function Card({ a, lang, now, c, la, schools, status, busy, cancelLabel, onReview }: {
  a: ApplicationDto; lang: Locale; now: Date; c: AreaCopy["members"]["applications"]; la: AreaCopy["lists"]["apps"]; schools: AreaCopy["lists"]["members"]["schools"];
  status: Dict["status"]; busy: boolean; cancelLabel: string; onReview: (approve: boolean, note: string) => void;
}) {
  const [note, setNote] = useState("");
  const name = nameOf(a, lang);
  const pending = a.status === "pending";
  const eligible = eligibility(a.person);
  const track = a.person.track ? tf(MAJOR_TRACKS.find((x) => x.id === a.person.track)?.name ?? { mn: a.person.track, en: a.person.track }, lang) : null;
  return (
    <li className={cx(CARD, "grid gap-4 p-4 md:p-5", pending && "border-l-4 border-l-warn-fg")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name={name} size={48} />
          <div className="grid min-w-0">
            <p className="font-display text-lg font-bold [overflow-wrap:anywhere] text-fg">{name}</p>
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-fg-muted">
              <Tag tone={a.person.schoolId === "num" ? "accent" : "neutral"} icon={GraduationCap}>{a.person.schoolId === "num" ? schools.num : (a.person.school ?? la.noSchool)}</Tag>
              <span>{[track ?? la.noTrack, a.person.gradYear ? fill(c.gradYear, { year: a.person.gradYear }) : null, plural(lang, a.person.attended, c.pastEvents)].filter(Boolean).join(" · ")}</span>
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-fg-muted">
          <StatusPill status={a.status} label={status[a.status]} />
          <span>{fill(c.season, { label: tf(a.seasonLabel, lang) })}</span>
          <span aria-hidden="true">·</span>
          <time dateTime={a.createdAt} title={formatUbStable(new Date(a.createdAt), lang, "datetime")}>{fill(c.submitted, { when: relativeTime(new Date(a.createdAt), now, lang) })}</time>
        </div>
      </div>

      <figure className="grid gap-1.5 rounded-[var(--radius-sm)] border-l-4 border-accent bg-panel-2 px-4 py-3">
        <figcaption className="flex items-center gap-1.5 text-xs font-semibold text-fg-muted"><Quote aria-hidden="true" size={13} />{c.motivation}</figcaption>
        <blockquote className="text-base leading-relaxed whitespace-pre-line text-fg [overflow-wrap:anywhere]">{a.motivation}</blockquote>
      </figure>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-fg-muted">{c.interests}</span>
        {a.interests.length === 0 ? <span className="text-sm text-fg-muted">{c.noInterests}</span> : a.interests.map((i) => (
          <Tag key={i} tone="accent">{i}</Tag>
        ))}
      </div>

      {eligible !== "ok" && (
        <div role="note" className="flex items-start gap-2 rounded-[var(--radius-sm)] bg-warn-soft px-3 py-2.5 text-sm text-warn-fg">
          <TriangleAlert aria-hidden="true" size={16} className="mt-0.5 shrink-0" />
          <p><span className="font-bold">{la.notEligibleTitle}.</span> {eligible === "school" ? fill(la.notEligibleSchool, { school: a.person.school ?? la.noSchool }) : la.notEligibleTrack}</p>
        </div>
      )}

      {pending ? (
        <div className="grid gap-3 border-t border-line pt-4">
          <details className="group rounded-[var(--radius-sm)] border border-line bg-panel-2 px-3 py-1.5">
            <summary className="flex min-h-10 cursor-pointer list-none items-center gap-2 text-sm font-semibold text-fg">
              <Lock aria-hidden="true" size={14} className="shrink-0" />{c.noteSummary}
              {note.trim() && <CountBadge n={1} className="bg-accent-soft text-accent-fg" />}
            </summary>
            <div className="mt-2 grid gap-1.5 pb-2">
              <Textarea aria-label={c.noteLabel} aria-describedby={`${a.id}-note-hint`} rows={2} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} className="min-h-16!" />
              <p id={`${a.id}-note-hint`} className="text-sm text-fg-muted">{c.noteHint}</p>
            </div>
          </details>
          <div className="grid gap-2 sm:flex sm:flex-row-reverse sm:justify-start">
            <Button size="lg" className="w-full sm:w-auto sm:min-w-44" icon={<Check aria-hidden="true" size={18} />} disabled={busy || eligible !== "ok"} title={eligible !== "ok" ? la.approveBlocked : undefined} onClick={() => onReview(true, note)}>{c.approve}</Button>
            <ConfirmDialog
              trigger={<Button variant="secondary" size="lg" className="w-full sm:w-auto sm:min-w-36" icon={<X aria-hidden="true" size={18} />} disabled={busy}>{c.reject}</Button>}
              title={fill(c.rejectTitle, { name })}
              body={c.rejectBody}
              confirmLabel={c.rejectConfirm}
              cancelLabel={cancelLabel}
              tone="danger"
              onConfirm={() => onReview(false, note)}
            />
          </div>
        </div>
      ) : (
        <div className="grid gap-1.5 border-t border-line pt-3 text-sm">
          <p className="text-fg-muted">
            {fill(c.reviewedBy, { who: a.reviewer ?? c.reviewerUnknown, when: a.reviewedAt ? relativeTime(new Date(a.reviewedAt), now, lang) : "—" })}
          </p>
          {a.note && (
            <p className="flex items-start gap-1.5 text-fg">
              <Lock aria-hidden="true" size={13} className="mt-1 shrink-0 text-fg-muted" />
              <span><span className="font-semibold">{c.noteSaved}:</span> {a.note}</span>
            </p>
          )}
        </div>
      )}
    </li>
  );
}

/** Membership application queue. Approving or rejecting moves the card to its tab straight away (and the page refreshes behind it). */
export default function ApplicationsQueue({ data, lang, c, common, status, lists }: {
  data: ApplicationsData; lang: Locale; c: AreaCopy["members"]["applications"]; common: AreaCopy["common"]; status: Dict["status"]; lists: AreaCopy["lists"];
}) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const list = useListState(SPEC, { ignore: ["status"] });
  const tab: Tab = (list.state.single.status as Tab | null) ?? "pending";
  const [overrides, setOverrides] = useState<Record<string, Override>>({});
  const [notice, setNotice] = useState<Notice | null>(null);
  const now = useMemo(() => new Date(data.now), [data.now]);

  // An optimistic move only applies while the server still says "pending"; once the refreshed data arrives it wins.
  const items = useMemo(() => data.items.map((a) => {
    const o = overrides[a.id];
    return o && a.status === "pending" ? { ...a, status: o.status as ApplicationStatus, reviewer: o.reviewer, reviewedAt: o.reviewedAt, note: o.note } : a;
  }), [data.items, overrides]);
  const counts = { pending: items.filter((a) => a.status === "pending").length, approved: items.filter((a) => a.status === "approved").length, rejected: items.filter((a) => a.status === "rejected").length };
  const flat = useMemo(() => items.map((a) => ({ ...a, name: a.person.name, handle: a.person.handle, school: a.person.school, schoolId: a.person.schoolId, track: a.person.track })), [items]);
  const inTab = flat.filter((a) => a.status === tab);
  const shown = filterApplications(inTab, list.state);
  const filterFn = (r: typeof flat, st: ListState) => filterApplications(r, st);
  const groups: ChipGroup[] = (() => {
    const sc = facetCounts(inTab, list.state, "school", MEMBER_SCHOOL_VALUES, filterFn), tr = facetCounts(inTab, list.state, "track", MEMBER_TRACK_VALUES, filterFn);
    const trackLabel = (v: string) => (v === "unknown" ? lists.members.trackUnknown : tf(MAJOR_TRACKS.find((x) => x.id === v)?.name ?? { mn: v, en: v }, lang));
    return [
      { key: "school", label: lists.groups.school, options: MEMBER_SCHOOL_VALUES.map((v) => ({ value: v, label: lists.members.schools[v], count: sc[v] })) },
      { key: "track", label: lists.groups.track, options: MEMBER_TRACK_VALUES.map((v) => ({ value: v, label: trackLabel(v), count: tr[v] })) },
    ];
  })();
  const summary = describeFilters({ list, groups, quoteQ: (q) => fill(lists.quote, { q }) });

  const review = (a: ApplicationDto, approve: boolean, note: string) => {
    const name = nameOf(a, lang);
    startTransition(async () => {
      const r = await reviewApplicationAction({ id: a.id, approve, note });
      if (r.ok) {
        setOverrides((o) => ({ ...o, [a.id]: { status: approve ? "approved" : "rejected", reviewer: null, reviewedAt: new Date().toISOString(), note: note.trim() || null } }));
        setNotice({ tone: "ok", text: fill(approve ? c.doneApproved : c.doneRejected, { name }) });
      } else if (r.error === "conflict" && "reviewer" in r) {
        setNotice({ tone: "error", text: r.reviewer ? fill(c.conflictBy, { reviewer: tf(r.reviewer, lang) }) : c.conflictUnknown });
      } else {
        setNotice({ tone: "error", text: errorText(common.errors, r.error) });
      }
      router.refresh();
    });
  };

  return (
    <div className="grid gap-4">
      <SegmentedTabs
        ariaLabel={c.tabsLabel} value={tab} onChange={(k) => list.setSingle("status", k === "pending" ? null : k)}
        items={TABS.map((k) => ({ key: k, label: c.tabs[k], count: counts[k] }))}
      />
      <ListFilters
        list={list} groups={groups} lang={lang} dates
        labels={{ filters: lists.filters, clear: lists.clear, searchLabel: lists.apps.searchPlaceholder, searchPlaceholder: lists.apps.searchPlaceholder }}
      />
      <NoticeBanner notice={notice} onDismiss={() => setNotice(null)} dismissLabel={common.dismiss} />
      {shown.length === 0 && list.count > 0 ? (
        <NoResults list={list} title={lists.noMatchTitle} line={lists.noMatchLine} summary={summary} clearLabel={lists.clear} />
      ) : shown.length === 0 ? (
        <EmptyState
          sticker={tab === "pending" ? "sleepy" : "smug"} title={c.emptyTitle[tab]} line={c.emptyLine[tab]}
          action={tab === "pending"
            ? <ButtonLink variant="secondary" href={href(lang, "/admin/members")}>{c.emptyAction.pending}</ButtonLink>
            : <Button variant="secondary" onClick={() => list.setSingle("status", null)}>{c.emptyAction[tab]}</Button>}
        />
      ) : (
        <ul className="grid gap-3">
          {shown.map((a) => <Card key={a.id} a={a} lang={lang} now={now} c={c} la={lists.apps} schools={lists.members.schools} status={status} busy={busy} cancelLabel={common.cancel} onReview={(approve, note) => review(a, approve, note)} />)}
        </ul>
      )}
    </div>
  );
}
