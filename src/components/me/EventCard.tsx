import Link from "next/link";
import type { ReactNode } from "react";
import { CalendarDays, CalendarPlus, Clock, ExternalLink, Lock, MapPin, Navigation } from "lucide-react";
import type { Dict } from "@/i18n";
import type { MeCopy } from "@/i18n/areas/me";
import { fill, tf, type Locale } from "@/i18n/config";
import { plural } from "@/i18n/plural";
import { formatUb } from "@/lib/time";
import type { EventCardVm } from "@/lib/me/queries";
import { countdown, ordinal } from "@/lib/me/queries";
import { ButtonLink } from "@/components/ui/Button";
import StatusPill from "@/components/ui/StatusPill";
import Tag from "@/components/ui/Tag";
import { cx } from "@/components/ui/cx";
import { DateChip, Poster } from "./parts";
import { pill } from "./pill";
import { CancelButton, RsvpButton } from "./EventActions";

export type CardMode = "home" | "upcoming" | "going" | "applied" | "past";

export const whenText = (vm: Pick<EventCardVm, "starts_at" | "approximate">, lang: Locale) =>
  vm.approximate
    ? formatUb(new Date(vm.starts_at), lang, { year: "numeric", month: "long" })
    : formatUb(new Date(vm.starts_at), lang, { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

/** Month + day for the date chip over the poster (an approximate date shows the month and year instead). */
export const chipParts = (vm: Pick<EventCardVm, "starts_at" | "approximate">, lang: Locale) => {
  const d = new Date(vm.starts_at);
  return vm.approximate
    ? { month: formatUb(d, lang, { month: "short" }), day: formatUb(d, lang, { year: "2-digit" }) }
    : { month: formatUb(d, lang, { month: "short" }), day: formatUb(d, lang, { day: "numeric" }) };
};

/** Seats taken vs capacity as a slim bar: "52 of 60 going" on the left, "8 seats left" on the right. */
export function SeatsBar({ vm, lang, c }: { vm: Pick<EventCardVm, "capacity" | "going" | "seatsLeft">; lang: Locale; c: MeCopy }) {
  if (vm.capacity === null || vm.seatsLeft === null) return null;
  const pct = Math.min(100, Math.round((vm.going / Math.max(vm.capacity, 1)) * 100));
  const tone = pct >= 100 ? "bg-danger" : pct >= 85 ? "bg-ember" : "bg-accent";
  const left = vm.seatsLeft === 0 ? c.event.full : plural(lang, vm.seatsLeft, c.event.seatsLeft);
  return (
    <div className="grid gap-1">
      <div role="meter" aria-label={`${fill(c.event.seatsBar, { n: vm.going, max: vm.capacity })}. ${left}`} aria-valuenow={vm.going} aria-valuemin={0} aria-valuemax={vm.capacity} className="h-2 overflow-hidden rounded-full bg-neutral-soft">
        <div className={cx("h-full rounded-full", tone)} style={{ width: `${pct}%` }} />
      </div>
      <p aria-hidden="true" className="flex justify-between gap-2 text-xs text-fg-muted tnum"><span>{fill(c.event.seatsBar, { n: vm.going, max: vm.capacity })}</span><span className={cx("font-bold", vm.seatsLeft === 0 ? "text-danger-fg" : pct >= 85 ? "text-ember-fg" : "text-fg")}>{left}</span></p>
    </div>
  );
}

export const placeText = (vm: Pick<EventCardVm, "mode" | "venue">, c: MeCopy) =>
  vm.mode === "online" ? c.event.online : vm.mode === "hybrid" ? [vm.venue, c.event.online].filter(Boolean).join(" · ") : vm.venue;

/** Google Maps search link for a venue, or null for online-only events. */
export const mapsUrl = (venue: string | null) => (venue ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(venue)}` : null);

/** Responsive list of event cards: one column on phones, two when there is room; a lone card takes the full row (and so switches to its wide layout). */
export function EventGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,22rem),1fr))]", className)}>{children}</div>;
}

/**
 * Compact action row shared by the card and the Home ticket: Calendar and Directions as soft pills (two equal columns on
 * phones, natural width once the card is wide), and the destructive action under a hairline as a quiet text button.
 */
export function QuickActions({ vm, c, lead, danger }: { vm: Pick<EventCardVm, "slug" | "venue">; c: MeCopy; lead?: ReactNode; danger?: ReactNode }) {
  const h = c.home;
  const maps = mapsUrl(vm.venue);
  return (
    <div className="grid gap-2">
      <p className="sr-only">{h.quickActions}</p>
      <div className="grid grid-cols-2 gap-2 @md:flex @md:flex-wrap">
        {lead}
        <a href={`/api/events/${encodeURIComponent(vm.slug)}/ics`} title={h.ics} className={pill.soft}><CalendarPlus aria-hidden="true" size={18} className="shrink-0 text-accent-fg" />{h.calendarShort}</a>
        {maps && <a href={maps} target="_blank" rel="noopener noreferrer" className={pill.soft}><Navigation aria-hidden="true" size={18} className="shrink-0 text-accent-fg" />{h.directions}</a>}
      </div>
      {danger && <div className="flex border-t border-line pt-2"><div className="-ml-3">{danger}</div></div>}
    </div>
  );
}

/**
 * Event card, one anatomy on every tab and screen: poster (whole image, nothing on top of it) → header (date tile, countdown,
 * tags) → title + status pill → date and time → place → seats → actions. Closed options are greyed with the reason.
 * The card is a container: stacked when narrow, poster beside the text once it is wide (so it adapts to its slot, not the viewport).
 */
export default function EventCard({ vm, lang, d, c, mode, now, eager, after }: { vm: EventCardVm; lang: Locale; d: Dict; c: MeCopy; mode: CardMode; now?: Date; eager?: boolean; /** Extra action row under the details (the Past tab's feedback pill). */ after?: ReactNode }) {
  const T = c.event;
  const title = tf(vm.title, lang);
  const place = placeText(vm, c);
  const applyHref = `/${lang}/me/events/${vm.slug}/apply`;
  const blocked = !vm.reg && !vm.elig.ok;
  const greyed = blocked || vm.cancelled || (vm.over && mode === "past" && vm.reg?.status !== "attended");
  const reasonId = `reason-${vm.id}`;
  const errors = c.errors as Record<string, string>;
  const chip = chipParts(vm, lang);
  const accepted = vm.regMode === "application" && vm.reg?.status === "going";
  const schoolLocked = !vm.reg && !vm.elig.ok && vm.elig.reason === "school";
  const openHref = `/${lang}/me/events?tab=upcoming&show=open`;
  const left = now && !vm.over && !vm.cancelled ? countdown(vm, now, lang) : null;

  // "Registered" on a past event is a neutral state (they were going but no attendance was recorded); `archived` is the neutral tone.
  const regPill = vm.reg && (mode === "past" && vm.reg.status === "going"
    ? <StatusPill status="archived" label={T.registered} />
    : <StatusPill status={vm.reg.status} label={vm.reg.status === "attended" ? T.attendedBadge : accepted ? T.accepted : d.status[vm.reg.status]} />);

  const reason = !vm.elig.ok && !vm.reg
    ? fill(c.reasons[vm.elig.reason], { date: vm.elig.at ? formatUb(new Date(vm.elig.at), lang, { month: "short", day: "numeric" }) : "" })
    : null;

  const cancelCopy = accepted
    ? { trigger: T.cantCome, title: T.cantComeTitle, body: T.cantComeBody }
    : vm.reg?.status === "waitlisted"
    ? { trigger: T.leaveWaitlist, title: T.leaveWaitlistTitle, body: fill(T.leaveWaitlistBody, { pos: ordinal(lang, vm.reg.waitPos ?? 1) }) }
    : vm.reg?.status === "applied"
      ? { trigger: T.withdraw, title: T.withdrawTitle, body: T.withdrawBody }
      : { trigger: T.cancel, title: T.cancelTitle, body: T.cancelBody };
  const showSeats = !vm.over && vm.regMode === "rsvp" && !vm.cancelled && vm.capacity !== null;
  const canCancel = (mode === "going" || mode === "applied") && vm.reg && vm.reg.status !== "rejected" && !vm.over;
  const canQuick = mode === "going" && vm.reg?.status === "going" && !vm.over && !vm.cancelled;

  const primary = [
    schoolLocked && <Link key="open" href={openHref} className={pill.soft}>{T.browseOpen}</Link>,
    (mode === "home" || mode === "upcoming") && !vm.reg && !schoolLocked && (vm.regMode === "application"
      ? vm.elig.ok
        ? <ButtonLink key="apply" href={applyHref} size="lg">{T.apply}</ButtonLink>
        : <Link key="apply" href={applyHref} aria-disabled="true" aria-describedby={reasonId} tabIndex={-1} className={pill.soft}>{T.apply}</Link>
      : vm.elig.ok
        ? <RsvpButton key="rsvp" eventId={vm.id} label={vm.elig.waitlist ? T.joinWaitlist : T.rsvp} doneLabel={T.rsvpDone} waitlistDoneLabel={d.status.waitlisted} errors={errors} />
        : <button key="rsvp" type="button" disabled aria-describedby={reasonId} className={pill.soft}>{T.rsvp}</button>),
    mode === "going" && vm.reg && vm.onlineUrl && vm.reg.status === "going" &&
      <ButtonLink key="join" href={vm.onlineUrl} size="lg" target="_blank" rel="noopener noreferrer" icon={<ExternalLink aria-hidden="true" size={16} />}>{T.joinOnline}</ButtonLink>,
    (mode === "going" || mode === "applied") && vm.reg && vm.regMode === "application" &&
      <Link key="app" href={applyHref} className={pill.soft}>{T.viewApplication}</Link>,
    (mode === "going" || mode === "applied") && vm.reg?.teamId &&
      <Link key="team" href={`/${lang}/me/teams/${vm.reg.teamId}`} className={pill.soft}>{T.viewTeam}</Link>,
  ].filter(Boolean);

  const danger = canCancel
    ? <CancelButton eventId={vm.id} doneText={accepted ? T.cantComeDone : T.cancelDone} errors={errors} keep={T.keep} confirm={cancelCopy.trigger}
        trigger={cancelCopy.trigger} title={fill(cancelCopy.title, { title })} body={cancelCopy.body} />
    : null;

  return (
    <article className="@container h-full overflow-hidden rounded-[var(--radius-md)] border border-line bg-panel">
      <div className="flex h-full flex-col @xl:flex-row">
        <Poster cover={vm.cover} greyed={greyed} eager={eager} sizes="(min-width: 768px) 480px, 100vw" className="aspect-[5/4] shrink-0 @xl:aspect-auto @xl:min-h-60 @xl:w-56" />
        <div className="grid min-w-0 flex-1 content-start gap-3 p-4 md:p-5">
          <div className="flex items-start gap-3">
            <DateChip month={chip.month} day={chip.day} />
            <div className="grid min-w-0 flex-1 gap-1.5">
              <div className="flex flex-wrap items-center gap-1.5">
                {vm.live && !vm.over && <StatusPill status="live" label={T.live} />}
                {left && left.kind === "in" && <Tag tone="accent" icon={Clock}>{left.text}</Tag>}
                {vm.schoolScope === "num" && <Tag tone="accent">{T.numTag}</Tag>}
              </div>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <h3 className="font-display text-lg leading-snug font-bold text-fg [overflow-wrap:anywhere]">
                  <Link href={`/${lang}/events/${vm.slug}`} className="inline-flex min-h-11 items-center hover:underline">{title}</Link>
                </h3>
                {vm.cancelled && <StatusPill status="cancelled" label={d.status.cancelled} />}
                {regPill}
              </div>
            </div>
          </div>

          <div className="grid gap-1.5">
            <p className="flex items-start gap-2 text-sm font-bold text-accent-fg">
              <CalendarDays aria-hidden="true" size={16} className="mt-0.5 shrink-0" />
              <span>{whenText(vm, lang)}</span>
            </p>
            {vm.approximate && <p className="pl-6 text-xs leading-normal text-fg-muted">{T.approx}</p>}
            {place && (
              <p className="flex items-start gap-2 text-sm text-fg-muted">
                <MapPin aria-hidden="true" size={16} className="mt-0.5 shrink-0" />
                <span className="[overflow-wrap:anywhere]">{place}</span>
              </p>
            )}
            {vm.mode !== "offline" && !vm.onlineUrl && mode !== "past" && vm.reg?.status !== "going" && (
              <p className="pl-6 text-xs leading-normal text-fg-muted">{T.onlineAfter}</p>
            )}
          </div>
          {showSeats && <SeatsBar vm={vm} lang={lang} c={c} />}

          {(reason || (vm.reg?.status === "waitlisted" && vm.reg.waitPos) || (!vm.reg && !vm.over && vm.regMode === "rsvp" && vm.seatsLeft === 0 && vm.elig.ok)) && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              {vm.reg?.status === "waitlisted" && vm.reg.waitPos && <span className="text-sm font-semibold text-ember-fg">{fill(T.waitPos, { pos: ordinal(lang, vm.reg.waitPos) })}</span>}
              {!vm.reg && !vm.over && vm.regMode === "rsvp" && vm.seatsLeft === 0 && vm.elig.ok && <span className="text-sm font-semibold text-ember-fg">{vm.elig.waitlist ? T.waitlistOn : T.full}</span>}
              {reason && <span id={reasonId} className="inline-flex items-center gap-1.5 text-sm font-semibold text-fg-muted"><Lock aria-hidden="true" size={14} className="shrink-0" />{reason}</span>}
            </div>
          )}

          {vm.reg?.status === "rejected" && <p className="text-sm text-fg-muted">{T.rejectedLine}</p>}
          {vm.reg?.status === "applied" && <p className="text-sm text-fg-muted">{vm.decisionDeadline ? fill(T.decisionBy, { date: formatUb(new Date(vm.decisionDeadline), lang, { month: "long", day: "numeric" }) }) : T.pendingReview}</p>}

          {after}

          {(primary.length > 0 || canQuick || danger) && (
            <div className="mt-auto grid gap-2 pt-1">
              {!canQuick && primary.length > 0 && <div className="flex flex-wrap items-start gap-2">{primary}</div>}
              {canQuick ? <QuickActions vm={vm} c={c} lead={primary} danger={danger} /> : danger && <div className="flex border-t border-line pt-2"><div className="-ml-3">{danger}</div></div>}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
