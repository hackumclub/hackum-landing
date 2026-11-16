import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { copy } from "@/i18n/areas/me";
import { fill, isLocale, tf } from "@/i18n/config";
import { membershipView } from "@/lib/me/queries";
import { formDefinition } from "@/lib/mockdb/forms";
import { formatUb } from "@/lib/time";
import StatusPill from "@/components/ui/StatusPill";
import Sticker from "@/components/Sticker";
import Icon3D from "@/components/Icon3D";
import EmptyState from "@/components/ui/EmptyState";
import { pill } from "@/components/me/pill";
import { ButtonLink, buttonClass } from "@/components/ui/Button";
import Link from "next/link";
import { CLUB } from "@/lib/club";
import RenewButton from "@/components/me/RenewButton";
import MembershipForm from "@/components/me/MembershipForm";
import { PageHeader, PageSkeleton, Section } from "@/components/me/parts";
import { meContext } from "@/components/me/context";

type Props = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  return isLocale(lang) ? { title: copy[lang].membership.title } : {};
}

async function Body({ params }: Props) {
  const { lang, session, db, now, d, c } = await meContext(params, (l) => `/${l}/me/membership`);
  const t = c.membership;
  const v = membershipView(db, session.profileId, now);
  const day = (iso: string) => formatUb(new Date(iso), lang, { month: "long", day: "numeric" });
  const w = v.window;
  const windowText = w.state === "open" ? fill(t.windowOpen, { season: tf(w.label, lang), date: day(w.until) })
    : w.state === "opens" ? fill(t.windowOpens, { season: tf(w.label, lang), date: day(w.from) }) : t.windowClosed;
  const season = v.app ? v.history.find((h) => h.season === v.app?.season)?.label ?? { mn: String(v.app.season), en: String(v.app.season) } : null;
  const app = v.app;
  const alumni = v.status === "alumni";
  const closedEmpty = w.state === "closed" && !app && v.status !== "member" && !alumni;
  const currentSeason = v.history[0] ? tf(v.history[0].label, lang) : "";
  const mail = CLUB.email ? `mailto:${CLUB.email}?subject=${encodeURIComponent(t.mentorMailSubject)}` : CLUB.socials[0][1];
  const appCopy = app && {
    pending: { title: t.pending, line: t.pendingLine }, approved: { title: t.approved, line: t.approvedLine },
    rejected: { title: t.rejected, line: t.rejectedLine }, withdrawn: { title: t.withdrawn, line: t.withdrawnLine },
  }[app.status];

  return (
    <div className="grid gap-6">
      <PageHeader sticker="writing" title={t.title} />

      {!closedEmpty && v.status !== "member" && !alumni && <div className="flex items-center gap-3 rounded-[var(--radius-md)] border border-line p-4" style={{ background: `radial-gradient(120% 160% at 0% 0%, ${w.state === "open" ? "var(--ops-ok-soft)" : "var(--ops-warn-soft)"}, var(--ops-panel) 70%)` }}>
        <Icon3D name="clock" sizes="64px" className="size-12 shrink-0 drop-shadow-[0_6px_8px_rgb(0_40_70/0.25)]" />
        <div className="grid gap-0.5">
          <p className="font-bold text-fg">{windowText}</p>
          {w.state === "closed" && <p className="text-sm text-fg-muted">{t.windowClosedLine}</p>}
        </div>
      </div>}

      {closedEmpty && (
        <EmptyState sticker="mail" title={t.windowClosed} line={t.windowClosedLine} action={<ButtonLink href={`/${lang}/me/events`} size="lg">{c.home.emptyAction}</ButtonLink>} />
      )}

      {v.status === "member" && (
        <Section title={t.statusCardTitle} id="member">
          <div className="grid gap-4 rounded-[var(--radius-md)] border border-line bg-panel p-4">
            <div className="flex items-center gap-3">
              <Sticker name="yell" className="w-16 shrink-0" sizes="64px" />
              <div className="grid gap-0.5">
                <h3 className="flex flex-wrap items-center gap-2 font-display text-lg font-bold text-fg"><StatusPill status="member" label={d.status.member} />{t.memberTitle}</h3>
                <p className="text-sm text-fg-muted">{currentSeason ? fill(t.memberCurrent, { season: currentSeason }) : t.memberLine}</p>
              </div>
            </div>
            {v.renew ? (
              <div className="grid gap-2 rounded-[var(--radius-sm)] bg-accent-soft p-4">
                <h3 className="font-display text-lg font-bold text-fg">{fill(t.renewTitle, { season: tf(v.renew.label, lang) })}</h3>
                <p className="text-sm text-fg">{fill(t.renewLine, { date: day(v.renew.until) })}</p>
                <div><RenewButton lang={lang} label={fill(t.renewAction, { season: tf(v.renew.label, lang) })} doneLabel={t.renewSent} /></div>
              </div>
            ) : v.renewPending && w.state === "open" ? (
              <div className="grid gap-1 rounded-[var(--radius-sm)] bg-warn-soft p-4">
                <p className="flex flex-wrap items-center gap-2 font-bold text-fg"><StatusPill status="pending" label={d.status.pending} />{t.renewPending}</p>
                <p className="text-sm text-fg">{fill(t.renewPendingLine, { season: tf(w.label, lang) })}</p>
              </div>
            ) : (
              <div className="grid gap-2"><p className="text-sm text-fg-muted">{t.historyOnly}</p><div><ButtonLink href={`/${lang}/me/events`} >{c.home.allEvents}</ButtonLink></div></div>
            )}
          </div>
        </Section>
      )}

      {alumni && (
        <Section title={t.alumniTitle} id="alumni">
          <div className="grid gap-4">
            <p className="text-fg">{t.alumniLine}</p>
            <div className="grid gap-3 rounded-[var(--radius-md)] border border-line bg-panel p-4 md:grid-cols-[auto_minmax(0,1fr)] md:items-center" style={{ background: "radial-gradient(120% 160% at 100% 0%, var(--ops-accent-soft), var(--ops-panel) 65%)" }}>
              <Icon3D name="handshake" sizes="64px" className="size-14 shrink-0 drop-shadow-[0_8px_10px_rgb(0_40_70/0.25)]" />
              <div className="grid gap-2">
                <h3 className="flex flex-wrap items-center gap-2 font-display text-lg font-bold text-fg">{t.mentorTitle}<span className="rounded-full bg-neutral-soft px-2.5 py-0.5 text-xs font-semibold text-fg">{t.mentorSoon}</span></h3>
                <p className="text-sm text-fg-muted">{t.mentorLine}</p>
                <div className="flex flex-wrap gap-3">
                  <a href={mail} className={buttonClass("primary", "lg")}>{t.mentorHelp}</a>
                  <Link href={`/${lang}/me/events?tab=upcoming&show=alumni`} className={pill.soft}>{t.alumniEvents}</Link>
                </div>
              </div>
            </div>
          </div>
        </Section>
      )}

      {app && appCopy && v.status !== "member" && !alumni && (
        <Section title={t.statusTitle} id="status">
          <div className="grid grid-cols-[5rem_minmax(0,1fr)] items-center gap-3 rounded-[var(--radius-md)] border border-line bg-panel p-4">
            <Sticker name={app.status === "approved" ? "trophy" : app.status === "rejected" ? "comfort" : app.status === "withdrawn" ? "sleepy" : "mail"} sizes="80px" className="w-20 max-h-24 object-contain" />
            <div className="grid gap-1.5">
              <p className="flex flex-wrap items-center gap-2 font-bold text-fg"><StatusPill status={app.status} label={d.status[app.status]} />{appCopy.title}</p>
              <p className="text-sm text-fg-muted">{fill(appCopy.line, { season: season ? tf(season, lang) : app.season })}</p>
              <p className="text-xs text-fg-muted">{fill(t.sentOn, { date: day(app.created_at) })}</p>
            </div>
          </div>
        </Section>
      )}

      {v.status !== "member" && !alumni && v.eligibility !== "ok" && (
        <EmptyState
          sticker="lock"
          title={v.eligibility === "school" ? t.schoolTitle : t.majorTitle}
          line={v.eligibility === "school" ? t.schoolLine : t.majorLine}
          action={<div className="flex flex-wrap justify-center gap-3"><ButtonLink href={`/${lang}/me/profile#school`} size="lg">{t.fixProfile}</ButtonLink><ButtonLink href={`/${lang}/me/events?tab=upcoming&show=open`} >{t.browseEvents}</ButtonLink></div>}
        />
      )}

      {v.canApply && <MembershipForm c={t} errors={t.err} lang={lang} questions={formDefinition(db, "membership_application")?.questions ?? []} />}

      {v.history.length > 0 && (
        <Section title={t.history} id="history">
          <ul className="grid gap-2">
            {v.history.map((h) => (
              <li key={h.season} className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-[var(--radius-md)] border border-line bg-panel p-3 text-sm">
                <span className="font-display text-base font-bold text-fg tnum">{tf(h.label, lang)}</span>
                <span className="text-fg-muted">{t.team}: <span className="font-semibold text-fg">{h.team ? (t.teams as Record<string, string>)[h.team] ?? h.team : t.noTeam}</span></span>
                {h.role && <span className="text-fg-muted">{t.role}: <span className="font-semibold text-fg">{tf(h.role, lang)}</span></span>}
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}

export default async function MembershipPage(props: Props) {
  const { lang } = await props.params;
  if (!isLocale(lang)) notFound();
  return (
    <Suspense fallback={<PageSkeleton label={copy[lang].loading} cards={2} />}>
      <Body {...props} />
    </Suspense>
  );
}
