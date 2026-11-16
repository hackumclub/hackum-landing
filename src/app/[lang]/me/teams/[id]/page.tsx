import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Crown, Lock, Unlock } from "lucide-react";
import { copy } from "@/i18n/areas/me";
import { fill, isLocale, tf } from "@/i18n/config";
import { teamView } from "@/lib/me/queries";
import Avatar from "@/components/ui/Avatar";
import { ButtonLink } from "@/components/ui/Button";
import CopyButton from "@/components/me/CopyButton";
import LeaveTeamButton from "@/components/me/LeaveTeamButton";
import { PageSkeleton, Section } from "@/components/me/parts";
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
      <header className="grid gap-1">
        <p className="text-sm font-semibold text-fg-muted">{t.title}</p>
        <h1 className="font-display text-2xl font-bold text-fg md:text-3xl">{v.name}</h1>
        <p className="text-sm text-fg-muted">
          <Link href={`/${lang}/events/${v.slug}`} className="font-semibold text-accent-fg hover:underline">{eventTitle}</Link>
        </p>
      </header>

      <div className="grid gap-4 rounded-[var(--radius-md)] border border-line bg-panel p-4 md:p-5">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <p className="text-sm font-semibold text-fg tnum">{fill(t.size, { n: v.members.length, max: v.max })}</p>
          <span className="inline-flex items-center gap-1 text-sm text-fg-muted">
            {v.locked ? <Lock aria-hidden="true" size={14} /> : <Unlock aria-hidden="true" size={14} />}{v.locked ? t.locked : t.open}
          </span>
          {short && <span className="text-sm font-semibold text-warn-fg">{fill(t.needMore, { min: v.min })}</span>}
        </div>
        {v.lookingFor.length > 0 && (
          <p className="flex flex-wrap items-center gap-2 text-sm text-fg-muted">{t.lookingFor}:
            {v.lookingFor.map((x) => <span key={x} className="rounded-full bg-neutral-soft px-2.5 py-0.5 text-xs font-bold text-fg">{x}</span>)}
          </p>
        )}
        <div className="grid gap-1">
          <p className="text-sm font-semibold text-fg-muted">{t.code}</p>
          <p className="font-display text-3xl font-bold text-fg tnum" data-testid="team-code">{v.code}</p>
        </div>
        <div className="grid gap-1">
          <p className="text-sm font-semibold text-fg">{t.share}</p>
          <p className="text-sm text-fg-muted">{t.shareLine}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <CopyButton value={v.code} label={t.copyCode} copiedLabel={t.copied} />
          <CopyButton value={invitePath} label={t.copyLink} copiedLabel={t.copied} variant="ghost" />
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
                {m.captain && <span className="inline-flex items-center gap-1 rounded-full bg-warn-soft px-2.5 py-0.5 text-xs font-bold text-warn-fg"><Crown aria-hidden="true" size={12} />{t.captain}</span>}
              </li>
            );
          })}
        </ul>
      </Section>

      <div className="flex flex-wrap gap-2">
        <ButtonLink href={`/${lang}/me/events?tab=applied`} size="lg" variant="ghost">{t.back}</ButtonLink>
        {!v.eventOver && (
          <LeaveTeamButton teamId={v.id} backHref={`/${lang}/me/events?tab=applied`} trigger={t.leave} title={fill(t.leaveTitle, { team: v.name })} body={leaveBody}
            confirm={t.leaveConfirm} doneText={t.leaveDone} keep={c.event.keep} errors={c.errors as Record<string, string>} />
        )}
      </div>
    </div>
  );
}

export default async function TeamPage(props: Props) {
  const { lang } = await props.params;
  if (!isLocale(lang)) notFound();
  return (
    <Suspense fallback={<PageSkeleton label={copy[lang].loading} cards={2} />}>
      <Body {...props} />
    </Suspense>
  );
}
