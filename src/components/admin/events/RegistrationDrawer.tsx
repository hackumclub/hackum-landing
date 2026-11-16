"use client";
import { fill, tf, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n";
import { copy } from "@/i18n/areas/admin-events";
import { plural } from "@/i18n/plural";
import { answerText } from "@/lib/events/format";
import type { Question } from "@/lib/events/questions";
import type { RegRow } from "@/lib/events/admin-registrations";
import { formatUb } from "@/lib/time";
import Avatar from "@/components/ui/Avatar";
import Button from "@/components/ui/Button";
import Drawer from "@/components/ui/Drawer";
import StatusPill from "@/components/ui/StatusPill";

const when = (iso: string, lang: Locale) => formatUb(new Date(iso), lang, { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });

/** Everything the person told us plus a profile summary: no email address, by design. */
export default function RegistrationDrawer({ lang, row, teamName, questions, application, statusLabel, wholeTeamPossible, pending, onClose, onDecide }: {
  lang: Locale; row: RegRow | null; teamName: string | null; questions: Question[]; application: boolean; statusLabel: string;
  wholeTeamPossible: boolean; pending: boolean; onClose: () => void; onDecide: (d: "accept" | "reject" | "waitlist", scope: "individual" | "team") => void;
}) {
  const d = getDictionary(lang);
  const t = copy[lang].regs;
  const x = t.drawer;
  const name = row ? tf(row.name, lang) : "";
  const decisionLine = !row ? "" : row.decidedAt ? `${fill(x.decidedAt, { when: when(row.decidedAt, lang) })} · ${row.notified ? x.notified : x.notNotified}` : x.undecided;
  const yesNo = { yes: x.yes, no: x.no };
  return (
    <Drawer open={row !== null} onOpenChange={(o) => { if (!o) onClose(); }} title={name} description={row?.school ?? undefined} closeLabel={d.ui.close}>
      {row && (
        <div className="grid gap-6">
          <div className="flex items-center gap-3">
            <Avatar name={name} src={row.avatar} size={48} />
            <div className="grid gap-1">
              <StatusPill status={row.status} label={statusLabel} className="w-fit" />
              <p className="text-sm text-fg-muted">{fill(x.appliedAt, { when: when(row.createdAt, lang) })}</p>
            </div>
          </div>

          <section aria-labelledby="drawer-decision" className="grid gap-2">
            <h3 id="drawer-decision" className="text-sm font-bold text-fg">{x.decision}</h3>
            <p className="text-sm text-fg-muted">{decisionLine}</p>
            {application ? (
              <div className="flex flex-wrap gap-2">
                <Button size="sm" disabled={pending || row.status === "going"} onClick={() => onDecide("accept", "individual")}>{t.bulk.accept}</Button>
                <Button size="sm" variant="secondary" disabled={pending || row.status === "waitlisted"} onClick={() => onDecide("waitlist", "individual")}>{t.bulk.waitlist}</Button>
                <Button size="sm" variant="secondary" disabled={pending || row.status === "rejected"} onClick={() => onDecide("reject", "individual")}>{t.bulk.reject}</Button>
                {wholeTeamPossible && <Button size="sm" variant="ghost" disabled={pending} onClick={() => onDecide("accept", "team")}>{t.teams.acceptTeam}</Button>}
              </div>
            ) : (
              row.status === "waitlisted" && <div><Button size="sm" disabled={pending} onClick={() => onDecide("accept", "individual")}>{t.bulk.promote}</Button></div>
            )}
          </section>

          <section aria-labelledby="drawer-profile" className="grid gap-2">
            <h3 id="drawer-profile" className="text-sm font-bold text-fg">{x.profile}</h3>
            <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-sm">
              <dt className="text-fg-muted">{x.school}</dt><dd className="text-fg">{row.school ?? x.unknown}</dd>
              <dt className="text-fg-muted">{x.major}</dt><dd className="text-fg">{row.major ?? x.unknown}</dd>
              <dt className="text-fg-muted">{x.grad}</dt><dd className="tnum text-fg">{row.gradYear ?? x.unknown}</dd>
              <dt className="text-fg-muted">{x.member}</dt><dd className="text-fg">{d.status[row.memberStatus]}</dd>
              <dt className="text-fg-muted">{x.attended}</dt><dd className="text-fg">{plural(lang, row.attended, x.attendedValue)}</dd>
              {teamName && (<><dt className="text-fg-muted">{x.team}</dt><dd className="font-semibold text-fg">{teamName}</dd></>)}
            </dl>
          </section>

          {questions.length > 0 && (
            <section aria-labelledby="drawer-answers" className="grid gap-3">
              <h3 id="drawer-answers" className="text-sm font-bold text-fg">{x.answers}</h3>
              {Object.keys(row.answers).length === 0 && <p className="text-sm text-fg-muted">{x.noAnswers}</p>}
              <dl className="grid gap-3">
                {questions.map((q) => {
                  const text = answerText(q, row.answers[q.id], lang, yesNo);
                  return (
                    <div key={q.id} className="grid gap-0.5">
                      <dt className="text-xs font-semibold text-fg-muted">{tf(q.label, lang)}</dt>
                      <dd className="text-sm break-words whitespace-pre-wrap text-fg">
                        {text === "" ? "—" : q.type === "url" && /^https?:\/\//.test(text) ? <a href={text} target="_blank" rel="noopener noreferrer" className="text-accent-fg underline">{text}</a> : text}
                      </dd>
                    </div>
                  );
                })}
              </dl>
            </section>
          )}
        </div>
      )}
    </Drawer>
  );
}
