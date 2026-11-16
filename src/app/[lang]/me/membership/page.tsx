import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { copy } from "@/i18n/areas/me";
import { fill, isLocale, tf } from "@/i18n/config";
import { membershipView } from "@/lib/me/queries";
import { formatUb } from "@/lib/time";
import StatusPill from "@/components/ui/StatusPill";
import Sticker from "@/components/Sticker";
import Icon3D from "@/components/Icon3D";
import EmptyState from "@/components/ui/EmptyState";
import { ButtonLink } from "@/components/ui/Button";
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
  const closedEmpty = w.state === "closed" && !app && v.status !== "member";
  const appCopy = app && {
    pending: { title: t.pending, line: t.pendingLine }, approved: { title: t.approved, line: t.approvedLine },
    rejected: { title: t.rejected, line: t.rejectedLine }, withdrawn: { title: t.withdrawn, line: t.withdrawnLine },
  }[app.status];

  return (
    <div className="grid gap-6">
      <PageHeader sticker="writing" title={t.title} />

      {!closedEmpty && <div className="flex items-center gap-3 rounded-[var(--radius-md)] border border-line p-4" style={{ background: `radial-gradient(120% 160% at 0% 0%, ${w.state === "open" ? "var(--ops-ok-soft)" : "var(--ops-warn-soft)"}, var(--ops-panel) 70%)` }}>
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
        <div className="flex items-center gap-3 rounded-[var(--radius-md)] border border-line bg-panel p-4">
          <Sticker name="yell" className="w-16 shrink-0" sizes="64px" />
          <div className="grid gap-0.5"><h2 className="font-display text-lg font-bold text-fg">{t.memberTitle}</h2><p className="text-sm text-fg-muted">{t.memberLine}</p></div>
        </div>
      )}

      {app && appCopy && v.status !== "member" && (
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

      {v.canApply && <MembershipForm c={t} errors={t.err} />}

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
