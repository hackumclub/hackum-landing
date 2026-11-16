import Link from "next/link";
import { BadgeCheck, CalendarPlus, ExternalLink, Hourglass, Info, MapPin, PartyPopper, Users, type LucideIcon } from "lucide-react";
import type { Dict } from "@/i18n";
import type { MeCopy } from "@/i18n/areas/me";
import { fill, tf, type Locale } from "@/i18n/config";
import { googleCalendarUrl } from "@/lib/calendar/gcal";
import { SITE_URL } from "@/lib/site-url";
import { formatUb } from "@/lib/time";
import { countdown, ordinal, type Attention, type EventCardVm, type MembershipView } from "@/lib/me/queries";
import { ButtonLink, buttonClass } from "@/components/ui/Button";
import StatusPill from "@/components/ui/StatusPill";
import Icon3D from "@/components/Icon3D";
import { cx } from "@/components/ui/cx";
import { Card } from "./parts";
import { placeText, whenText } from "./EventCard";

/** The soonest event the person is going to, as a ticket: details on one side, a countdown stub on the other, notches on the tear line. */
export function NextEventCard({ vm, lang, c, now }: { vm: EventCardVm; lang: Locale; c: MeCopy; now: Date }) {
  const h = c.home;
  const title = tf(vm.title, lang);
  const left = countdown(vm, now, lang);
  const place = placeText(vm, c);
  const location = vm.mode === "online" ? (vm.onlineUrl ?? c.event.online) : [vm.venue, vm.mode === "hybrid" ? vm.onlineUrl : null].filter(Boolean).join(" · ");
  const gcal = googleCalendarUrl({
    title, start: new Date(vm.starts_at), end: new Date(vm.ends_at), location,
    description: `${tf(vm.tagline, lang)}\n${SITE_URL}/${lang}/events/${vm.slug}`.trim(),
  });
  const notch = "absolute size-4 rounded-full border border-line bg-canvas";
  return (
    <article aria-label={h.nextTitle} className="grid grid-cols-[minmax(0,1fr)] overflow-hidden rounded-[var(--radius-md)] border border-line bg-panel md:grid-cols-[minmax(0,1fr)_auto_11rem]">
      <div className="grid content-start gap-2 p-4 md:p-5">
        <h3 className="font-display text-xl leading-snug font-bold text-fg">
          <Link href={`/${lang}/events/${vm.slug}`} className="hover:underline">{title}</Link>
        </h3>
        <p className="text-sm font-bold text-accent-fg">{whenText(vm, lang)}</p>
        {place && <p className="flex items-center gap-1.5 text-sm text-fg-muted"><MapPin aria-hidden="true" size={16} className="shrink-0" />{place}</p>}
        <div className="mt-2 flex flex-wrap gap-2">
          {vm.onlineUrl && <ButtonLink href={vm.onlineUrl} target="_blank" rel="noopener noreferrer" size="lg" icon={<ExternalLink aria-hidden="true" size={16} />}>{c.event.joinOnline}</ButtonLink>}
          <a href={`/api/events/${encodeURIComponent(vm.slug)}/ics`} title={h.ics} className={buttonClass(vm.onlineUrl ? "secondary" : "primary", "lg")}><CalendarPlus aria-hidden="true" size={16} />{h.addToCalendar}</a>
          <a href={gcal} target="_blank" rel="noopener noreferrer" className={buttonClass("secondary", "lg")}>{h.google}<ExternalLink aria-hidden="true" size={14} /></a>
        </div>
        <p className="text-xs text-fg-muted">{h.calendarNote}</p>
      </div>
      {/* Tear line: dashed, with a notch cut out of each end (left/right on phones, top/bottom beside the stub). */}
      <div aria-hidden="true" className="relative h-0 border-t-2 border-dashed border-line md:h-auto md:w-0 md:border-t-0 md:border-l-2">
        <span className={cx(notch, "-top-[9px] -left-2 md:-top-2 md:-left-[9px]")} />
        <span className={cx(notch, "-top-[9px] -right-2 md:top-auto md:right-auto md:-bottom-2 md:-left-[9px]")} />
      </div>
      <div className="grid content-center justify-items-start gap-1 p-4 md:justify-items-center md:p-5 md:text-center">
        <Icon3D name="calendar" sizes="64px" className="size-12" />
        <p className="font-display text-lg font-bold text-fg">{left.text}</p>
        <p className="text-xs text-fg-muted tnum">{formatUb(new Date(vm.starts_at), lang, { hour: "2-digit", minute: "2-digit" })}</p>
      </div>
    </article>
  );
}

const ICON: Record<string, LucideIcon> = { going: PartyPopper, rejected: Info, waitlisted: Hourglass, waitlist: Hourglass, approved: BadgeCheck, team: Users };
const TONE: Record<string, string> = { going: "bg-ok-soft text-ok-fg", approved: "bg-ok-soft text-ok-fg", waitlisted: "bg-warn-soft text-warn-fg", waitlist: "bg-warn-soft text-warn-fg", team: "bg-warn-soft text-warn-fg", rejected: "bg-neutral-soft text-fg" };

/** "Needs your attention": decisions, waitlist spots, membership answers and short teams. Each is one line, one link. */
export function AttentionList({ items, lang, c }: { items: Attention[]; lang: Locale; c: MeCopy }) {
  const h = c.home;
  return (
    <ul className="grid gap-2">
      {items.map((a, i) => {
        let key: string, title: string, line: string, href: string, action: string;
        switch (a.kind) {
          case "decision": {
            const t = tf(a.title, lang);
            key = a.result;
            title = fill(a.result === "going" ? h.decisionGoing : a.result === "rejected" ? h.decisionRejected : h.decisionWaitlisted, { title: t });
            line = a.result === "going" ? h.decisionGoingLine : a.result === "rejected" ? h.decisionRejectedLine : h.decisionWaitlistedLine;
            href = `/${lang}/me/events/${a.slug}/apply`; action = h.open;
            break;
          }
          case "waitlist":
            key = "waitlist"; title = fill(h.waitlist, { title: tf(a.title, lang), pos: ordinal(lang, a.position) }); line = h.waitlistLine;
            href = `/${lang}/me/events?tab=going`; action = h.open;
            break;
          case "membership":
            key = a.result === "approved" ? "approved" : "rejected";
            title = fill(a.result === "approved" ? h.membershipApproved : h.membershipRejected, { season: a.season });
            line = a.result === "approved" ? h.membershipApprovedLine : h.membershipRejectedLine;
            href = `/${lang}/me/membership`; action = h.viewMembership;
            break;
          case "team":
            key = "team"; title = fill(h.team, { team: a.teamName, need: a.need, have: a.have }); line = fill(h.teamLine, { code: a.code });
            href = `/${lang}/me/teams/${a.teamId}`; action = h.teamOpen;
            break;
        }
        const Icon = ICON[key] ?? Info;
        return (
          <li key={i}>
            <Card className="flex flex-wrap items-start gap-3">
              <span aria-hidden="true" className={cx("grid size-9 shrink-0 place-items-center rounded-full", TONE[key])}><Icon size={18} /></span>
              <div className="grid min-w-0 flex-1 basis-40 gap-0.5">
                <p className="text-sm font-bold text-fg">{title}</p>
                <p className="text-sm text-fg-muted">{line}</p>
              </div>
              <Link href={href} className={buttonClass("secondary", "lg", "w-full shrink-0 sm:w-auto")}>{action}</Link>
            </Card>
          </li>
        );
      })}
    </ul>
  );
}

/** Membership call-to-action on Home (guests and alumni while an application window is open) or the status of what they sent. */
export function MembershipCta({ m, lang, c, d }: { m: MembershipView; lang: Locale; c: MeCopy; d: Dict }) {
  const h = c.home;
  if (m.status === "member") return null;
  if (m.app && m.app.status === "pending") {
    return (
      <Card className="flex items-start gap-3">
        <Icon3D name="heart" sizes="64px" className="size-12 shrink-0" />
        <div className="grid min-w-0 flex-1 gap-1">
          <p className="flex flex-wrap items-center gap-2 font-bold text-fg">{h.ctaPendingTitle}<StatusPill status="pending" label={d.status.pending} /></p>
          <p className="text-sm text-fg-muted">{h.ctaPendingLine}</p>
        </div>
      </Card>
    );
  }
  if (m.window.state !== "open" || !m.canApply) return null;
  return (
    <Card className="flex flex-wrap items-center gap-3">
      <Icon3D name="rocket" sizes="64px" className="size-14 shrink-0" />
      <div className="grid min-w-0 flex-1 basis-44 gap-1">
        <p className="font-display text-lg font-bold text-fg">{h.ctaTitle}</p>
        <p className="text-sm text-fg-muted">{fill(h.ctaLine, { season: tf(m.window.label, lang), date: formatUb(new Date(m.window.until), lang, { month: "long", day: "numeric" }) })}</p>
      </div>
      <ButtonLink href={`/${lang}/me/membership`} size="lg" className="w-full sm:w-auto">{h.ctaAction}</ButtonLink>
    </Card>
  );
}
