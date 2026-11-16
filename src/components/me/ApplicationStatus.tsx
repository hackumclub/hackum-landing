import Link from "next/link";
import { PageHeader, Timeline, type TimelineItem } from "./parts";
import { Hourglass, Mail, Send, Users } from "lucide-react";
import type { Dict } from "@/i18n";
import type { MeCopy } from "@/i18n/areas/me";
import { fill, tf, type Locale } from "@/i18n/config";
import type { EventCardVm } from "@/lib/me/queries";
import StatusPill from "@/components/ui/StatusPill";
import { CancelButton } from "./EventActions";
import { pill } from "./pill";
import JoinTeamBox from "./JoinTeamBox";

/** What an applicant sees instead of the form: their status, the team, and the few things they can still do. */
export default function ApplicationStatus({ vm, lang, d, c, deadline, team, teamMax, prefillCode }: {
  vm: EventCardVm; lang: Locale; d: Dict; c: MeCopy; deadline: string | null; team: { id: string; name: string } | null; teamMax: number; prefillCode?: string | null;
}) {
  const reg = vm.reg;
  if (!reg) return null;
  const a = c.apply;
  const title = tf(vm.title, lang);
  const head = { applied: a.statusApplied, going: a.statusGoing, waitlisted: a.statusWaitlisted, rejected: a.statusRejected, attended: a.statusAttended, no_show: a.statusApplied, cancelled: a.statusApplied }[reg.status];
  const line = reg.status === "applied" ? (deadline ? fill(a.statusAppliedLine, { date: deadline }) : a.statusAppliedNoDate)
    : reg.status === "going" ? a.statusGoingLine : reg.status === "rejected" ? a.statusRejectedLine : null;
  const live = !vm.over && reg.status !== "rejected";
  const accepted = vm.regMode === "application" && reg.status === "going";
  const cancel = accepted ? { trigger: c.event.cantCome, title: c.event.cantComeTitle, body: c.event.cantComeBody } : reg.status === "waitlisted"
    ? { trigger: c.event.leaveWaitlist, title: c.event.leaveWaitlistTitle, body: fill(c.event.leaveWaitlistBody, { pos: String(reg.waitPos ?? 1) }) }
    : reg.status === "applied" ? { trigger: c.event.withdraw, title: c.event.withdrawTitle, body: c.event.withdrawBody }
      : { trigger: c.event.cancel, title: c.event.cancelTitle, body: c.event.cancelBody };
  const pastReview = reg.status !== "applied";
  const decided = reg.status === "going" || reg.status === "rejected" || reg.status === "attended";
  const steps: TimelineItem[] = [
    { state: "done", icon: Send, title: a.timelineSent },
    { state: pastReview ? "done" : "current", icon: Hourglass, title: a.timelineReview, line: reg.status === "applied" ? line ?? undefined : undefined },
    { state: decided ? "done" : pastReview ? "current" : "todo", icon: Mail, title: accepted ? c.event.accepted : decided || reg.status === "waitlisted" ? d.status[reg.status] : a.timelineDecision, line: pastReview ? line ?? undefined : undefined },
  ];
  return (
    <div className="grid gap-4">
      <PageHeader title={title} lead={a.statusTitle} sticker={reg.status === "going" ? "rsvp" : reg.status === "rejected" ? "comfort" : reg.status === "waitlisted" ? "queue" : "writing"} />
      <div className="grid gap-3 rounded-[var(--radius-md)] border border-line bg-panel p-4 md:p-5">
        <p className="flex flex-wrap items-center gap-2 font-bold text-fg"><StatusPill status={reg.status} label={accepted ? c.event.accepted : d.status[reg.status]} />{head}</p>
        <Timeline label={a.statusTitle} items={steps} />
        {team && (
          <Link href={`/${lang}/me/teams/${team.id}`} className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-accent-fg hover:underline">
            <Users aria-hidden="true" size={16} />{fill(c.event.teamLine, { team: team.name })}
          </Link>
        )}
        <div className="flex flex-wrap gap-2">
          <Link href={`/${lang}/events/${vm.slug}`} className={pill.soft}>{a.eventPage}</Link>
          {live && (
            <CancelButton eventId={vm.id} doneText={accepted ? c.event.cantComeDone : c.event.cancelDone} errors={c.errors as Record<string, string>} keep={c.event.keep}
              confirm={cancel.trigger} trigger={cancel.trigger} title={fill(cancel.title, { title })} body={cancel.body} />
          )}
        </div>
      </div>
      {live && !team && vm.teamMode !== "none" && <JoinTeamBox c={a} max={teamMax} defaultCode={prefillCode ?? ""} />}
    </div>
  );
}
