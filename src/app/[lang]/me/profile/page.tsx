import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, ExternalLink } from "lucide-react";
import { copy } from "@/i18n/areas/me";
import { fill, isLocale, tf } from "@/i18n/config";
import { profileView } from "@/lib/me/queries";
import { formatUb } from "@/lib/time";
import Avatar from "@/components/ui/Avatar";
import { ButtonLink } from "@/components/ui/Button";
import StatusPill from "@/components/ui/StatusPill";
import BadgeGrid from "@/components/me/BadgeGrid";
import { Card, PageSkeleton, Section } from "@/components/me/parts";
import { meContext } from "@/components/me/context";

type Props = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  return isLocale(lang) ? { title: copy[lang].profile.title } : {};
}

/** Only http(s) links are rendered as links; anything else is shown as plain text (a stored `javascript:` URL must never become an href). */
const safeHref = (u: string) => { try { const x = new URL(u); return x.protocol === "https:" || x.protocol === "http:" ? x.href : null; } catch { return null; } };

async function Body({ params }: Props) {
  const { lang, session, db, now, d, c } = await meContext(params, (l) => `/${l}/me/profile`);
  const t = c.profile;
  const v = profileView(db, session.profileId, now);
  const name = tf(v.name, lang) || v.handle;
  const earned = v.badges.filter((b) => b.earned).length;
  const links = Object.entries(v.links);
  return (
    <div className="grid gap-7">
      <header className="flex items-center gap-4">
        <Avatar name={name} size={72} />
        <div className="grid min-w-0 gap-1">
          <h1 className="truncate font-display text-2xl font-bold text-fg md:text-3xl">{name}</h1>
          <p className="flex flex-wrap items-center gap-2 text-sm text-fg-muted">
            <StatusPill status={v.status} label={d.status[v.status]} />
            {v.school && <span>{v.grad_year ? fill(t.school, { school: v.school, year: v.grad_year }) : v.school}</span>}
          </p>
          <p className="text-sm text-fg-muted tnum">{t.seasons}: {v.seasons.length ? v.seasons.join(" · ") : t.noSeasons}</p>
        </div>
      </header>

      <Link href={`/${lang}/me/membership`} className="flex min-h-14 items-center gap-3 rounded-[var(--radius-md)] border border-line bg-panel px-4 py-2 hover:bg-panel-2">
        <span className="grid flex-1 gap-0.5"><span className="font-bold text-fg">{t.membershipLink}</span><span className="text-sm text-fg-muted">{t.membershipLinkLine}</span></span>
        <ChevronRight aria-hidden="true" size={18} className="text-fg-muted" />
      </Link>

      <Section title={t.badges} id="badges" aside={<span className="text-sm font-semibold text-fg-muted tnum">{fill(t.badgesLine, { earned, total: v.badges.length })}</span>}>
        <BadgeGrid badges={v.badges} c={c.badges} />
      </Section>

      <Section title={t.events} id="events">
        {v.attended.length === 0 ? (
          <Card className="grid justify-items-start gap-2"><p className="text-sm text-fg-muted">{t.eventsEmpty}</p><ButtonLink href={`/${lang}/me/events`} size="lg" variant="secondary">{t.eventsEmptyAction}</ButtonLink></Card>
        ) : (
          <ul className="grid gap-2">
            {v.attended.map((e) => (
              <li key={`${e.slug}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-[var(--radius-md)] border border-line bg-panel p-3">
                <Link href={`/${lang}/events/${e.slug}`} className="min-w-0 flex-1 font-bold text-fg hover:underline">{tf(e.title, lang)}</Link>
                <span className="text-sm text-fg-muted tnum">{formatUb(new Date(e.starts_at), lang, { year: "numeric", month: "short", day: "numeric" })}</span>
                <StatusPill status={e.status} label={d.status[e.status]} />
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title={t.links} id="links">
        {links.length === 0 ? <p className="text-sm text-fg-muted">{t.linksEmpty}</p> : (
          <ul className="grid gap-2">
            {links.map(([k, u]) => {
              const href = safeHref(u);
              return (
                <li key={k} className="flex items-center gap-2 rounded-[var(--radius-md)] border border-line bg-panel p-3 text-sm">
                  <span className="font-semibold text-fg-muted">{k}</span>
                  {href ? <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-6 items-center gap-1 truncate font-semibold text-accent-fg hover:underline">{u}<ExternalLink aria-hidden="true" size={14} /></a> : <span className="truncate text-fg">{u}</span>}
                </li>
              );
            })}
          </ul>
        )}
        <p className="text-sm text-fg-muted">
          {fill(t.visibility, { v: t.vis[v.visibility] })}{" · "}
          <Link href={`/${lang}/me/settings`} className="font-semibold text-accent-fg hover:underline">{t.visibilityChange}</Link>
        </p>
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
