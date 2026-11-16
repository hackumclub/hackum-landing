import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Crown, Lock, Unlock } from "lucide-react";
import { copy } from "@/i18n/areas/me";
import { fill, isLocale, tf } from "@/i18n/config";
import { teamView } from "@/lib/me/queries";
import Avatar from "@/components/ui/Avatar";
import Tag from "@/components/ui/Tag";
import { pill } from "@/components/me/pill";
import CopyButton from "@/components/me/CopyButton";
import LeaveTeamButton from "@/components/me/LeaveTeamButton";
import Sticker from "@/components/Sticker";
import { PageHeader, Section } from "@/components/me/parts";
import RouteSkeleton from "@/components/me/RouteSkeleton";
import { meContext } from "@/components/me/context";

type Props = { params: Promise<{ lang: string; id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  return isLocale(lang) ? { title: copy[lang].team.title } : {};
}

async function Body({ params }: Props) {
  const { id } = await params;
  const { lang, session, db, now, c } = await meContext(params, (l) => `/${l}/me/teams/${encodeURIComponent(id)}`);
  const t = c.team;
  const v = teamView(db, id, session.profileId, now);
  if (!v) notFound(); // not your team = no such team
  const eventTitle = tf(v.eventTitle, lang);
  const invitePath = `/${lang}/me/events/${v.slug}/apply?code=${v.code}`;
  const leaveBody = v.members.length === 1 ? t.leaveBodyLast : v.isCaptain ? t.leaveBodyCaptain : fill(t.leaveBodyMember, { event: eventTitle });
  const short = v.members.length < v.min;
  return (
    <div className="grid gap-6">
      <PageHeader
        sticker="team" title={v.name}
        lead={<Link href={`/${lang}/events/${v.slug}`} className="inline-flex min-h-11 items-center font-semibold underline-offset-4 hover:underline">{t.event}: {eventTitle}</Link>}
      />

      {short && (
        <div className="flex items-center gap-3 rounded-[var(--radius-md)] border border-line p-4" style={{ background: "radial-gradient(120% 160% at 0% 0%, var(--ops-warn-soft), var(--ops-panel) 70%)" }}>
          <Sticker name="queue" sizes="64px" className="w-14 shrink-0" />
          <p className="text-sm font-bold text-warn-fg">{fill(t.needMore, { min: v.min })}</p>
        </div>
      )}

      <div className="grid gap-4 rounded-[var(--radius-md)] border border-line bg-panel p-4 md:p-5">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <p className="text-sm font-semibold text-fg tnum">{fill(t.size, { n: v.members.length, max: v.max })}</p>
          <span className="inline-flex items-center gap-1 text-sm text-fg-muted">
            {v.locked ? <Lock aria-hidden="true" size={14} /> : <Unlock aria-hidden="true" size={14} />}{v.locked ? t.locked : t.open}
          </span>
        </div>
        {v.lookingFor.length > 0 && (
          <p className="flex flex-wrap items-center gap-2 text-sm text-fg-muted">{t.lookingFor}:
            {v.lookingFor.map((x) => <Tag key={x}>{x}</Tag>)}
          </p>
        )}
        <div className="grid gap-2 rounded-[var(--radius-sm)] p-4" style={{ background: "radial-gradient(120% 140% at 100% 0%, var(--ops-accent-soft), var(--ops-panel-2) 70%)" }}>
          <p className="text-sm font-semibold text-fg-muted">{t.code}</p>
          <p className="w-fit rounded-[var(--radius-sm)] border-2 border-dashed border-accent bg-panel px-4 py-2 font-display text-3xl font-black tracking-wide text-fg tnum" data-testid="team-code">{v.code}</p>
          <p className="text-sm text-fg-muted"><span className="font-bold text-fg">{t.share}.</span> {t.shareLine}</p>
        </div>
        <div className="grid gap-2 sm:flex sm:flex-wrap">
          <CopyButton value={v.code} label={t.copyCode} copiedLabel={t.copied} className="w-full sm:w-auto" />
          <CopyButton value={invitePath} label={t.copyLink} copiedLabel={t.copied} variant="soft" className="w-full sm:w-auto" />
        </div>
      </div>

      <Section title={t.members} id="members">
        <ul className="grid gap-2">
          {v.members.map((m) => {
            const name = tf(m.name, lang) || "?";
            return (
              <li key={m.profileId} className="flex items-center gap-3 rounded-[var(--radius-md)] border border-line bg-panel p-3">
                <Avatar name={name} src={m.avatar} size={40} />
                <span className="min-w-0 flex-1 truncate text-sm font-bold text-fg">{name}{m.you && <span className="font-normal text-fg-muted"> ({t.you})</span>}</span>
                {m.captain && <Tag tone="warn" icon={Crown}>{t.captain}</Tag>}
              </li>
            );
          })}
        </ul>
      </Section>

      <div className="flex flex-wrap gap-2">
        <Link href={`/${lang}/me/events?tab=applied`} className={pill.soft}>{t.back}</Link>
        {!v.eventOver && (
          <LeaveTeamButton teamId={v.id} backHref={`/${lang}/me/events?tab=applied`} trigger={t.leave} title={fill(t.leaveTitle, { team: v.name })} body={leaveBody}
            confirm={t.leaveConfirm} doneText={t.leaveDone} keep={c.event.keep} errors={c.errors as Record<string, string>} />
        )}
      </div>
    </div>
  );
}

/** Awaiting `params` (it carries the dynamic segment) must happen inside <Suspense>, so the guard lives in here. */
async function Guard(props: Props) {
  const { lang } = await props.params;
  if (!isLocale(lang)) notFound();
  return <Body {...props} />;
}

export default function TeamPage(props: Props) {
  return (
    <Suspense fallback={<RouteSkeleton cards={2} />}>
      <Guard {...props} />
    </Suspense>
  );
}
