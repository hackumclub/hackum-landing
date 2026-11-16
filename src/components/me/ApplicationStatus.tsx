import Link from "next/link";
import { Users } from "lucide-react";
import type { Dict } from "@/i18n";
import type { MeCopy } from "@/i18n/areas/me";
import { fill, tf, type Locale } from "@/i18n/config";
import type { EventCardVm } from "@/lib/me/queries";
import { ButtonLink } from "@/components/ui/Button";
import StatusPill from "@/components/ui/StatusPill";
import Sticker from "@/components/Sticker";
import { CancelButton } from "./EventActions";
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
  const cancel = reg.status === "waitlisted"
    ? { trigger: c.event.leaveWaitlist, title: c.event.leaveWaitlistTitle, body: fill(c.event.leaveWaitlistBody, { pos: String(reg.waitPos ?? 1) }) }
    : reg.status === "applied" ? { trigger: c.event.withdraw, title: c.event.withdrawTitle, body: c.event.withdrawBody }
      : { trigger: c.event.cancel, title: c.event.cancelTitle, body: c.event.cancelBody };
  return (
    <div className="grid gap-4">
      <div className="grid gap-3 rounded-[var(--radius-md)] border border-line bg-panel p-4 md:p-5">
        <div className="flex items-center gap-3">
          <Sticker name={reg.status === "going" ? "yell" : reg.status === "rejected" ? "toast" : "coffee"} className="w-16 shrink-0" sizes="64px" />
          <div className="grid gap-1">
            <h1 className="font-display text-xl font-bold text-fg">{title}</h1>
            <p className="text-sm font-semibold text-fg-muted">{a.statusTitle}</p>
          </div>
        </div>
        <p className="flex flex-wrap items-center gap-2 font-bold text-fg"><StatusPill status={reg.status} label={d.status[reg.status]} />{head}</p>
        {line && <p className="text-sm text-fg-muted">{line}</p>}
        {team && (
          <Link href={`/${lang}/me/teams/${team.id}`} className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-accent-fg hover:underline">
            <Users aria-hidden="true" size={16} />{fill(c.event.teamLine, { team: team.name })}
          </Link>
        )}
        <div className="flex flex-wrap gap-2">
          <ButtonLink href={`/${lang}/events/${vm.slug}`} variant="secondary" size="lg">{a.eventPage}</ButtonLink>
          {live && (
            <CancelButton eventId={vm.id} variant="secondary" doneText={c.event.cancelDone} errors={c.errors as Record<string, string>} keep={c.event.keep}
              confirm={cancel.trigger} trigger={cancel.trigger} title={fill(cancel.title, { title })} body={cancel.body} />
          )}
        </div>
      </div>
      {live && !team && vm.teamMode !== "none" && <JoinTeamBox c={a} max={teamMax} defaultCode={prefillCode ?? ""} />}
    </div>
  );
}
