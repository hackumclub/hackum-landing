import Link from "next/link";
import { CalendarDays, CalendarX, Clock, ExternalLink, MapPin } from "lucide-react";
import type { Dict } from "@/i18n";
import type { MeCopy } from "@/i18n/areas/me";
import { fill, tf, type Locale } from "@/i18n/config";
import { googleCalendarUrl } from "@/lib/calendar/gcal";
import { SITE_URL } from "@/lib/site-url";
import { formatUb } from "@/lib/time";
import { countdown, ordinal, type Attention, type EventCardVm, type MembershipView } from "@/lib/me/queries";
import { ButtonLink } from "@/components/ui/Button";
import StatusPill from "@/components/ui/StatusPill";
import Icon3D from "@/components/Icon3D";
import Sticker from "@/components/Sticker";
import type { StickerName } from "@/lib/manul";
import { cx } from "@/components/ui/cx";
import { Card, DateChip, Poster } from "./parts";
import { pill } from "./pill";
import { CancelButton } from "./EventActions";
import { chipParts, placeText, QuickActions, whenText } from "./EventCard";

/**
 * The soonest event the person is going to, as a ticket: the whole poster on one side (nothing drawn over it), the details on
 * the other. From md up the two halves are separated by a dashed tear line with a real semicircular cut-out at each end (a CSS
 * mask on the card, so the page shows through in both themes); on phones the poster simply sits above the details.
 */
export function NextEventCard({ vm, lang, c, d, now, eager = true }: { vm: EventCardVm; lang: Locale; c: MeCopy; d: Dict; now: Date; eager?: boolean }) {
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
  const chip = chipParts(vm, lang);
  // Cut-outs sit on the tear line: 5fr | 1px | 6fr puts it at 5/11 of the card width.
  const cut = "md:[mask-image:radial-gradient(circle_9px_at_45.4545%_0,#0000_96%,#000),radial-gradient(circle_9px_at_45.4545%_100%,#0000_96%,#000)] md:[mask-composite:intersect] md:[-webkit-mask-composite:source-in]";
  return (
    <div className="drop-shadow-[0_18px_22px_rgb(0_40_70/0.14)]">
      <article aria-label={h.nextTitle} className={cx("@container grid grid-cols-[minmax(0,1fr)] overflow-hidden rounded-[var(--radius-md)] border border-line bg-panel md:grid-cols-[minmax(0,5fr)_1px_minmax(0,6fr)]", cut)}>
        <Poster cover={vm.cover} eager={eager} sizes="(min-width: 768px) 440px, 100vw" className="aspect-[5/4] md:aspect-auto md:min-h-80" />
        <div aria-hidden="true" className="hidden md:block md:my-5 md:bg-[repeating-linear-gradient(to_bottom,var(--ops-line)_0_6px,transparent_6px_12px)]" />
        <div className="grid content-between gap-4 p-4 md:p-6">
          <div className="grid gap-3">
            <div className="flex items-start gap-3">
              <DateChip month={chip.month} day={chip.day} />
              <div className="grid min-w-0 flex-1 gap-1.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="ops-gloss inline-flex min-h-8 items-center gap-1.5 rounded-full px-3 text-sm font-bold"><Clock aria-hidden="true" size={16} />{left.kind === "live" ? h.countdownLive : left.text}</span>
                </div>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <h3 className="font-display text-xl leading-snug font-bold text-fg [overflow-wrap:anywhere]">
                    <Link href={`/${lang}/events/${vm.slug}`} className="inline-flex min-h-11 items-center hover:underline">{title}</Link>
                  </h3>
                  <StatusPill status="going" label={d.status.going} />
                </div>
              </div>
            </div>
            <div className="grid gap-1.5">
              <p className="flex items-start gap-2 text-sm font-bold text-accent-fg"><CalendarDays aria-hidden="true" size={16} className="mt-0.5 shrink-0" />{whenText(vm, lang)}</p>
              {place && <p className="flex items-start gap-2 text-sm text-fg-muted"><MapPin aria-hidden="true" size={16} className="mt-0.5 shrink-0" /><span className="[overflow-wrap:anywhere]">{place}</span></p>}
            </div>
          </div>
          <div className="grid gap-3">
            {vm.onlineUrl && <ButtonLink href={vm.onlineUrl} target="_blank" rel="noopener noreferrer" size="lg" className="w-full" icon={<ExternalLink aria-hidden="true" size={16} />}>{T.joinOnline}</ButtonLink>}
            <QuickActions vm={vm} c={c}
              danger={<CancelButton eventId={vm.id} doneText={T.cancelDone} errors={c.errors as Record<string, string>} keep={T.keep} confirm={T.cancel}
                trigger={T.cancel} title={fill(T.cancelTitle, { title })} body={T.cancelBody} icon={<CalendarX aria-hidden="true" size={18} className="shrink-0" />} />} />
            <p className="text-xs leading-normal text-fg-muted">{h.calendarNote}{" "}<a href={gcal} target="_blank" rel="noopener noreferrer" className="font-semibold whitespace-nowrap text-accent-fg underline-offset-2 hover:underline">{h.google}<ExternalLink aria-hidden="true" size={12} className="ml-1 inline align-[-1px]" /></a></p>
          </div>
        </div>
      </article>
    </div>
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
              <Link href={href} className={cx(pill.soft, "col-span-2 w-full")}>{action}</Link>
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
