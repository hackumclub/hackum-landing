"use client";
import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { Download, Eye } from "lucide-react";
import { fill, href, tf, type L, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n";
import { copy } from "@/i18n/areas/admin-events";
import { plural } from "@/i18n/plural";
import type { Answers, Question } from "@/lib/events/questions";
import { answerText, csvHref, rawAnswerText } from "@/lib/forms/hub";
import type { FormId } from "@/lib/mockdb/forms";
import { ALL_STATUSES, type Status } from "@/lib/status";
import { formatUb } from "@/lib/time";
import { buttonClass } from "@/components/ui/Button";
import Avatar from "@/components/ui/Avatar";
import { RowEntity, rowTitleClass } from "@/components/ui/RowParts";
import DataTable, { type Column } from "@/components/ui/DataTable";
import Drawer from "@/components/ui/Drawer";
import EmptyState from "@/components/ui/EmptyState";
import IconButton from "@/components/ui/IconButton";
import StatusPill from "@/components/ui/StatusPill";
import Tag from "@/components/ui/Tag";
import { paginationFor } from "./pagination";

/** One answer sheet as the page hands it over (names and handles only, never emails). */
export type ResponseRow = { profile_id: string; handle: string; name: L; submitted_at: string; status: string; answers: Answers };
type Keyed = ResponseRow & { key: string };

const when: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" };
const isStatus = (s: string): s is Status => (ALL_STATUSES as readonly string[]).includes(s);

/**
 * Responses to one form: person (links to Members), when (UB time), state, then one column per question; answers to
 * questions that were removed later stay visible as "Removed question: <id>". Long answers are clamped; the drawer
 * shows everything one person answered.
 */
export default function ResponsesTable({ rows, questions, orphans, lang, formId, emptyAction }: {
  rows: ResponseRow[]; questions: Question[]; orphans: string[]; lang: Locale; formId: FormId; emptyAction: ReactNode;
}) {
  const t = copy[lang].forms.responses;
  const d = getDictionary(lang);
  const [open, setOpen] = useState<Keyed | null>(null);
  const keyed = useMemo<Keyed[]>(() => rows.map((r, i) => ({ ...r, key: `${r.profile_id}:${i}` })), [rows]);

  if (rows.length === 0) {
    return <EmptyState sticker="feedback" title={t.empty.title} line={t.empty.line} action={emptyAction} />;
  }

  const person = (r: ResponseRow) => tf(r.name, lang).trim() || t.anonymous;
  const membersHref = (r: ResponseRow) => href(lang, `/admin/members?q=${encodeURIComponent(r.handle)}`);
  const status = (r: ResponseRow) => (isStatus(r.status) ? <StatusPill status={r.status} label={d.status[r.status]} /> : <Tag>{t.submittedStatus}</Tag>);
  const text = (q: Question, r: ResponseRow) => answerText(q, r.answers[q.id], lang, t.yes, t.no);
  const submitted = (r: ResponseRow) => formatUb(new Date(r.submitted_at), lang, when);
  const clamp = (s: string) => (s ? <span className="line-clamp-2 max-w-64 break-words whitespace-pre-line">{s}</span> : <span aria-hidden="true" className="text-fg-muted">—</span>);

  const columns: Column<Keyed>[] = [
    {
      key: "person", header: t.person, primary: true, sortValue: (r) => person(r),
      cell: (r) => (
        <RowEntity
          leading={<Avatar name={person(r)} size={40} />}
          title={<Link href={membersHref(r)} title={person(r)} aria-label={fill(t.memberLink, { name: person(r) })} className={rowTitleClass}>{person(r)}</Link>}
        />
      ),
    },
    { key: "submitted", header: t.submitted, width: "md:w-48", sortValue: (r) => r.submitted_at, cell: (r) => <time dateTime={r.submitted_at} className="text-fg-muted md:whitespace-nowrap">{submitted(r)}</time> },
    { key: "status", header: t.status, width: "md:w-32", sortValue: (r) => r.status, cell: status },
    ...questions.map((q): Column<Keyed> => ({ key: `q:${q.id}`, header: tf(q.label, lang), hideBelow: "md", hideInCard: true, cell: (r) => clamp(text(q, r)) })),
    ...orphans.map((id): Column<Keyed> => ({ key: `o:${id}`, header: fill(t.removed, { id }), hideBelow: "md", hideInCard: true, cell: (r) => clamp(rawAnswerText(r.answers[id])) })),
    {
      key: "open", header: "", width: "md:w-14", cell: (r) => <IconButton label={fill(t.open, { name: person(r) })} icon={<Eye size={18} />} onClick={() => setOpen(r)} />,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p role="status" className="text-sm font-semibold text-fg-muted">{plural(lang, rows.length, t.results)}</p>
        <a href={csvHref(formId, lang)} download className={buttonClass("secondary")}><Download aria-hidden="true" size={16} />{t.exportCsv}</a>
      </div>
      <DataTable rows={keyed} columns={columns} getId={(r) => r.key} caption={t.caption} empty={null} pageSize={25} paginationLabels={paginationFor(lang)} onRowClick={setOpen} />

      <Drawer open={open !== null} onOpenChange={(o) => { if (!o) setOpen(null); }} title={open ? fill(t.drawerTitle, { name: person(open) }) : ""} description={open ? submitted(open) : undefined} closeLabel={t.drawerClose}>
        {open && (
          <div className="grid gap-4">
            <div className="flex flex-wrap items-center gap-2">
              {status(open)}
              <Link href={membersHref(open)} className="text-sm font-semibold text-accent-fg hover:underline">{fill(t.memberLink, { name: person(open) })}</Link>
            </div>
            <dl className="grid gap-4">
              {questions.map((q) => (
                <div key={q.id} className="grid gap-1">
                  <dt className="text-sm font-semibold text-fg-muted">{tf(q.label, lang)}</dt>
                  <dd className="break-words whitespace-pre-line text-fg">{text(q, open) || <span className="text-fg-muted">{t.noAnswer}</span>}</dd>
                </div>
              ))}
              {orphans.filter((id) => open.answers[id] !== undefined).map((id) => (
                <div key={id} className="grid gap-1">
                  <dt className="flex flex-wrap items-center gap-2 text-sm font-semibold text-fg-muted">{fill(t.removed, { id })}<Tag tone="warn">{t.removedTag}</Tag></dt>
                  <dd className="break-words whitespace-pre-line text-fg">{rawAnswerText(open.answers[id])}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}
      </Drawer>
    </div>
  );
}
