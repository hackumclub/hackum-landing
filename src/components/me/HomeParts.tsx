import Link from "next/link";
import { CalendarDays, CalendarPlus, CalendarX, Clock, ExternalLink, MapPin, Navigation } from "lucide-react";
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
import Sticker from "@/components/Sticker";
import type { StickerName } from "@/lib/manul";
import { cx } from "@/components/ui/cx";
import { Card, DateChip, Poster } from "./parts";
import { CancelButton } from "./EventActions";
import { chipParts, placeText, whenText } from "./EventCard";

/** Calendar-style action tile for the ticket's quick-actions row: icon over label, 64px tall so it is an easy thumb target. */
const tile = "h-auto! min-h-16! w-full flex-col! gap-1! rounded-[var(--radius-sm)]! px-2! py-2! text-xs! leading-tight! whitespace-normal!";

/**
 * The soonest event the person is going to, as a ticket: the poster large with a countdown chip, then the details and a
 * row of quick actions (calendar, directions or join link, cancel), notches on the tear line between them.
 */
export function NextEventCard({ vm, lang, c, d, now }: { vm: EventCardVm; lang: Locale; c: MeCopy; d: Dict; now: Date }) {
  const h = c.home;
  const T = c.event;
  const title = tf(vm.title, lang);
  const left = countdown(vm, now, lang);
  const place = placeText(vm, c);
  const location = vm.mode === "online" ? (vm.onlineUrl ?? c.event.online) : [vm.venue, vm.mode === "hybrid" ? vm.onlineUrl : null].filter(Boolean).join(" · ");
  const gcal = googleCalendarUrl({
    title, start: new Date(vm.starts_at), end: new Date(vm.ends_at), location,
    description: `${tf(vm.tagline, lang)}\n${SITE_URL}/${lang}/events/${vm.slug}`.trim(),
  });
  const maps = vm.venue ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(vm.venue)}` : null;
  const chip = chipParts(vm, lang);
  const notch = "absolute size-4 rounded-full border border-line bg-canvas";
  return (
    <article aria-label={h.nextTitle} className="grid grid-cols-[minmax(0,1fr)] overflow-hidden rounded-[var(--radius-md)] border border-line bg-panel shadow-[var(--shadow-card)] md:grid-cols-[minmax(0,5fr)_auto_minmax(0,6fr)]">
      <Poster cover={vm.cover} sizes="(min-width: 768px) 400px, 100vw" className="aspect-[5/4] md:aspect-auto md:min-h-80">
        <div className="absolute inset-x-3 top-3 flex items-start justify-between gap-2">
          <DateChip month={chip.month} day={chip.day} />
          <span className="ops-gloss inline-flex min-h-9 items-center gap-1.5 rounded-full px-3.5 text-sm font-bold"><Clock aria-hidden="true" size={16} />{left.kind === "live" ? h.countdownLive : left.text}</span>
        </div>
        <div className="absolute bottom-3 left-3"><StatusPill status="going" label={d.status.going} className="shadow-[0_4px_10px_-4px_rgb(0_20_40/0.5)] ring-2 ring-panel" /></div>
      </Poster>
      {/* Tear line: dashed, with a notch cut out of each end (left/right on phones, top/bottom beside the poster). */}
      <div aria-hidden="true" className="relative h-0 border-t-2 border-dashed border-line md:h-auto md:w-0 md:border-t-0 md:border-l-2">
        <span className={cx(notch, "-top-[9px] -left-2 md:-top-2 md:-left-[9px]")} />
        <span className={cx(notch, "-top-[9px] -right-2 md:top-auto md:right-auto md:-bottom-2 md:-left-[9px]")} />
      </div>
      <div className="grid content-between gap-4 p-4 md:p-5">
        <div className="grid gap-2">
          <h3 className="font-display text-xl leading-snug font-bold text-fg [overflow-wrap:anywhere]">
            <Link href={`/${lang}/events/${vm.slug}`} className="hover:underline">{title}</Link>
          </h3>
          <p className="flex items-center gap-1.5 text-sm font-bold text-accent-fg"><CalendarDays aria-hidden="true" size={16} className="shrink-0" />{whenText(vm, lang)}</p>
          {place && <p className="flex items-start gap-1.5 text-sm text-fg-muted"><MapPin aria-hidden="true" size={16} className="mt-0.5 shrink-0" />{place}</p>}
        </div>
        {vm.onlineUrl && <ButtonLink href={vm.onlineUrl} target="_blank" rel="noopener noreferrer" size="lg" className="w-full" icon={<ExternalLink aria-hidden="true" size={16} />}>{T.joinOnline}</ButtonLink>}
        <div className="grid gap-2">
          <p className="sr-only">{h.quickActions}</p>
          <div className="grid grid-cols-3 gap-2">
            <a href={`/api/events/${encodeURIComponent(vm.slug)}/ics`} title={h.ics} className={buttonClass("secondary", "lg", tile)}><CalendarPlus aria-hidden="true" size={20} className="text-accent-fg" />{h.calendarShort}</a>
            {maps
              ? <a href={maps} target="_blank" rel="noopener noreferrer" className={buttonClass("secondary", "lg", tile)}><Navigation aria-hidden="true" size={20} className="text-accent-fg" />{h.directions}</a>
              : <a href={gcal} target="_blank" rel="noopener noreferrer" className={buttonClass("secondary", "lg", tile)}><ExternalLink aria-hidden="true" size={20} className="text-accent-fg" />{h.google}</a>}
            <CancelButton eventId={vm.id} variant="secondary" doneText={T.cancelDone} errors={c.errors as Record<string, string>} keep={T.keep} confirm={T.cancel}
              trigger={T.cancel} title={fill(T.cancelTitle, { title })} body={T.cancelBody} className={tile} icon={<CalendarX aria-hidden="true" size={20} className="text-danger-fg" />} />
          </div>
          <p className="text-xs text-fg-muted">{h.calendarNote}{" "}<a href={gcal} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-6 items-center gap-1 font-semibold text-accent-fg hover:underline">{h.google}<ExternalLink aria-hidden="true" size={12} /></a></p>
        </div>
      </div>
    </article>
  );
}

// One Manul per kind of news: checkin = good news, queue = waiting, comfort = bad news, team = needs people.
const STICKER: Record<string, StickerName> = { going: "checkin", approved: "checkin", waitlisted: "queue", waitlist: "queue", rejected: "comfort", team: "team" };
const WASH: Record<string, string> = {
  going: "var(--ops-ok-soft)", approved: "var(--ops-ok-soft)", waitlisted: "var(--ops-warn-soft)", waitlist: "var(--ops-warn-soft)", team: "var(--ops-accent-soft)", rejected: "var(--ops-neutral-soft)",
};

/** "Needs your attention": decisions, waitlist spots, membership answers and short teams. Each is one sticker, one line, one link. */
export function AttentionList({ items, lang, c }: { items: Attention[]; lang: Locale; c: MeCopy }) {
  const h = c.home;
  return (
    <ul className="grid gap-3">
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
        return (
          <li key={i}>
            <div className="relative grid grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-x-3 gap-y-3 overflow-hidden rounded-[var(--radius-md)] border border-line bg-panel p-4" style={{ background: `radial-gradient(120% 140% at 0% 0%, ${WASH[key]}, var(--ops-panel) 70%)` }}>
              <Sticker name={STICKER[key] ?? "checkin"} sizes="72px" className="w-[4.5rem] -rotate-3" />
              <div className="grid min-w-0 gap-0.5">
                <p className="text-sm font-bold text-fg">{title}</p>
                <p className="text-sm text-fg-muted">{line}</p>
              </div>
              <Link href={href} className={buttonClass("secondary", "lg", "col-span-2 w-full bg-panel")}>{action}</Link>
            </div>
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
      <Card className="flex items-start gap-3" style={{ background: "radial-gradient(120% 160% at 100% 0%, var(--ops-warn-soft), var(--ops-panel) 65%)" }}>
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
    <Card className="flex flex-wrap items-center gap-3 shadow-[var(--shadow-card)]" style={{ background: "radial-gradient(120% 160% at 100% 0%, var(--ops-accent-soft), var(--ops-panel) 65%)" }}>
      <Icon3D name="rocket" sizes="64px" className="size-14 shrink-0 drop-shadow-[0_8px_10px_rgb(0_40_70/0.25)]" />
      <div className="grid min-w-0 flex-1 basis-44 gap-1">
        <p className="font-display text-lg font-bold text-fg">{h.ctaTitle}</p>
        <p className="text-sm text-fg-muted">{fill(h.ctaLine, { season: tf(m.window.label, lang), date: formatUb(new Date(m.window.until), lang, { month: "long", day: "numeric" }) })}</p>
      </div>
      <ButtonLink href={`/${lang}/me/membership`} size="lg" className="w-full sm:w-auto">{h.ctaAction}</ButtonLink>
    </Card>
  );
}
