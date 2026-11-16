import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { copy } from "@/i18n/areas/me";
import { fill, isLocale, tf } from "@/i18n/config";
import { profileEditView } from "@/lib/me/profile-edit";
import { profileView } from "@/lib/me/queries";
import { formatUb } from "@/lib/time";
import { ButtonLink } from "@/components/ui/Button";
import StatusPill from "@/components/ui/StatusPill";
import BadgeGrid from "@/components/me/BadgeGrid";
import ProfileForm from "@/components/profile/ProfileForm";
import EmptyState from "@/components/ui/EmptyState";
import { PageHeader, PageSkeleton, Section } from "@/components/me/parts";
import { meContext } from "@/components/me/context";

type Props = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  return isLocale(lang) ? { title: copy[lang].profile.title } : {};
}

async function Body({ params }: Props) {
  const { lang, session, db, now, d, c } = await meContext(params, (l) => `/${l}/me/profile`);
  const t = c.profile;
  const v = profileView(db, session.profileId, now);
  const name = tf(v.name, lang) || v.handle;
  const earned = v.badges.filter((b) => b.earned).length;
  const edit = profileEditView(db, session.profileId, now, lang);
  if (!edit) notFound();
  return (
    <div className="grid gap-7">
      <PageHeader
        sticker="trophy" title={name}
        lead={
          <span className="grid gap-2">
            <span className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <StatusPill status={v.status} label={d.status[v.status]} />
              {v.school && <span>{v.grad_year ? fill(t.school, { school: v.school, year: v.grad_year }) : v.school}</span>}
            </span>
            <span className="tnum text-base">{t.seasons}: {v.seasons.length ? v.seasons.join(" · ") : t.noSeasons}</span>
          </span>
        }
      />

      <Link href={`/${lang}/me/membership`} className="flex min-h-14 items-center gap-3 rounded-[var(--radius-md)] border border-line bg-panel px-4 py-2 hover:bg-panel-2">
        <span className="grid flex-1 gap-0.5"><span className="font-bold text-fg">{t.membershipLink}</span>{" "}<span className="text-sm text-fg-muted">{t.membershipLinkLine}</span></span>
        <ChevronRight aria-hidden="true" size={18} className="text-fg-muted" />
      </Link>

      <ProfileForm lang={lang} vm={edit} badges={earned} c={t} />

      <Section title={t.badges} id="badges" aside={<span className="text-sm font-semibold text-fg-muted tnum">{fill(t.badgesLine, { earned, total: v.badges.length })}</span>}>
        <BadgeGrid badges={v.badges} c={c.badges} />
      </Section>

      <Section title={t.events} id="events">
        {v.attended.length === 0 ? (
          <EmptyState sticker="sleepy" title={t.eventsEmptyTitle} line={t.eventsEmpty} action={<ButtonLink href={`/${lang}/me/events`} size="lg">{t.eventsEmptyAction}</ButtonLink>} />
        ) : (
          <ul className="grid gap-2">
            {v.attended.map((e) => (
              <li key={`${e.slug}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-[var(--radius-md)] border border-line bg-panel p-3">
                <Link href={`/${lang}/events/${e.slug}`} className="inline-flex min-h-11 min-w-0 flex-1 items-center font-bold text-fg hover:underline">{tf(e.title, lang)}</Link>
                <span className="text-sm text-fg-muted tnum">{formatUb(new Date(e.starts_at), lang, { year: "numeric", month: "short", day: "numeric" })}</span>
                <StatusPill status={e.status} label={d.status[e.status]} />
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

export default async function ProfilePage(props: Props) {
  const { lang } = await props.params;
  if (!isLocale(lang)) notFound();
  return (
    <Suspense fallback={<PageSkeleton label={copy[lang].loading} />}>
      <Body {...props} />
    </Suspense>
  );
}
