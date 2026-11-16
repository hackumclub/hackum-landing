import Link from "next/link";
import { CalendarDays, ExternalLink, Lock, MapPin } from "lucide-react";
import type { Dict } from "@/i18n";
import type { MeCopy } from "@/i18n/areas/me";
import { fill, tf, type Locale } from "@/i18n/config";
import { plural } from "@/i18n/plural";
import { formatUb } from "@/lib/time";
import type { EventCardVm } from "@/lib/me/queries";
import { ordinal } from "@/lib/me/queries";
import { ButtonLink } from "@/components/ui/Button";
import StatusPill from "@/components/ui/StatusPill";
import { cx } from "@/components/ui/cx";
import { DateChip, Poster } from "./parts";
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

/**
 * Event card, one size on every tab: poster (fixed ratio, date chip and status pill over it) → title → date → venue → seats →
 * the one action. Closed options are greyed with the reason.
 */
export default function EventCard({ vm, lang, d, c, mode }: { vm: EventCardVm; lang: Locale; d: Dict; c: MeCopy; mode: CardMode }) {
  const T = c.event;
  const title = tf(vm.title, lang);
  const place = placeText(vm, c);
  const applyHref = `/${lang}/me/events/${vm.slug}/apply`;
  const blocked = !vm.reg && !vm.elig.ok;
  const greyed = blocked || vm.cancelled || (vm.over && mode === "past" && vm.reg?.status !== "attended");
  const reasonId = `reason-${vm.id}`;
  const errors = c.errors as Record<string, string>;
  const chip = chipParts(vm, lang);

  const regPill = vm.reg && (mode === "past" && vm.reg.status === "going"
    ? <span className="rounded-full bg-panel px-2.5 py-0.5 text-xs font-bold text-fg shadow-sm">{T.registered}</span>
    : <StatusPill status={vm.reg.status} label={vm.reg.status === "attended" ? T.attendedBadge : d.status[vm.reg.status]} className="shadow-[0_4px_10px_-4px_rgb(0_20_40/0.5)] ring-2 ring-panel" />);

  const reason = !vm.elig.ok && !vm.reg
    ? fill(c.reasons[vm.elig.reason], { date: vm.elig.at ? formatUb(new Date(vm.elig.at), lang, { month: "short", day: "numeric" }) : "" })
    : null;

  const cancelCopy = vm.reg?.status === "waitlisted"
    ? { trigger: T.leaveWaitlist, title: T.leaveWaitlistTitle, body: fill(T.leaveWaitlistBody, { pos: ordinal(lang, vm.reg.waitPos ?? 1) }) }
    : vm.reg?.status === "applied"
      ? { trigger: T.withdraw, title: T.withdrawTitle, body: T.withdrawBody }
      : { trigger: T.cancel, title: T.cancelTitle, body: T.cancelBody };
  const showSeats = !vm.over && vm.regMode === "rsvp" && !vm.cancelled && vm.capacity !== null;

  return (
    <article className="flex flex-col overflow-hidden rounded-[var(--radius-md)] border border-line bg-panel md:flex-row">
      <Poster cover={vm.cover} greyed={greyed} className="aspect-[4/3] shrink-0 md:aspect-auto md:min-h-60 md:w-56">
        <div className="absolute inset-x-3 top-3 flex items-start justify-between gap-2">
          <DateChip month={chip.month} day={chip.day} />
          <div className="flex flex-col items-end gap-1.5">
            {vm.live && !vm.over && <StatusPill status="live" label={T.live} className="shadow-[0_4px_10px_-4px_rgb(0_20_40/0.5)] ring-2 ring-panel" />}
            {vm.cancelled && <StatusPill status="cancelled" label={d.status.cancelled} className="ring-2 ring-panel" />}
            {regPill}
          </div>
        </div>
      </Poster>
      <div className="grid min-w-0 flex-1 content-start gap-2.5 p-4">
        <h3 className="font-display text-lg leading-snug font-bold text-fg [overflow-wrap:anywhere]">
          <Link href={`/${lang}/events/${vm.slug}`} className="hover:underline">{title}</Link>
        </h3>
        <p className="flex items-center gap-1.5 text-sm font-bold text-accent-fg">
          <CalendarDays aria-hidden="true" size={16} className="shrink-0" />
          <span>{whenText(vm, lang)}</span>
        </p>
        {vm.approximate && <p className="-mt-1 text-xs text-fg-muted">{T.approx}</p>}
        {place && (
          <p className="flex items-start gap-1.5 text-sm text-fg-muted">
            <MapPin aria-hidden="true" size={16} className="mt-0.5 shrink-0" />
            <span>{place}</span>
          </p>
        )}
        {vm.mode !== "offline" && !vm.onlineUrl && mode !== "past" && vm.reg?.status !== "going" && (
          <p className="text-xs text-fg-muted">{T.onlineAfter}</p>
        )}
        {showSeats && <SeatsBar vm={vm} lang={lang} c={c} />}

        {(reason || (vm.reg?.status === "waitlisted" && vm.reg.waitPos) || (!vm.reg && !vm.over && vm.regMode === "rsvp" && vm.seatsLeft === 0 && vm.elig.ok)) && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            {vm.reg?.status === "waitlisted" && vm.reg.waitPos && <span className="text-sm font-semibold text-ember-fg">{fill(T.waitPos, { pos: ordinal(lang, vm.reg.waitPos) })}</span>}
            {!vm.reg && !vm.over && vm.regMode === "rsvp" && vm.seatsLeft === 0 && vm.elig.ok && <span className="text-sm font-semibold text-ember-fg">{vm.elig.waitlist ? T.waitlistOn : T.full}</span>}
            {reason && <span id={reasonId} className="inline-flex items-center gap-1 text-sm font-semibold text-fg-muted"><Lock aria-hidden="true" size={14} />{reason}</span>}
          </div>
        )}

        {vm.reg?.status === "rejected" && <p className="text-sm text-fg-muted">{T.rejectedLine}</p>}
        {vm.reg?.status === "applied" && <p className="text-sm text-fg-muted">{vm.decisionDeadline ? fill(T.decisionBy, { date: formatUb(new Date(vm.decisionDeadline), lang, { month: "long", day: "numeric" }) }) : T.pendingReview}</p>}

        <div className="mt-auto flex flex-wrap items-start gap-2 pt-1">
          {(mode === "home" || mode === "upcoming") && !vm.reg && (vm.regMode === "application"
            ? vm.elig.ok
              ? <ButtonLink href={applyHref} size="lg">{T.apply}</ButtonLink>
              : <ButtonLink href={applyHref} size="lg" variant="secondary" aria-disabled="true" aria-describedby={reasonId} tabIndex={-1}>{T.apply}</ButtonLink>
            : vm.elig.ok
              ? <RsvpButton eventId={vm.id} label={vm.elig.waitlist ? T.joinWaitlist : T.rsvp} doneLabel={T.rsvpDone} waitlistDoneLabel={d.status.waitlisted} errors={errors} />
              : <button type="button" disabled aria-describedby={reasonId} className="inline-flex min-h-11 items-center rounded-full border border-line-strong px-5 font-bold opacity-50">{T.rsvp}</button>)}

          {mode === "going" && vm.reg && vm.onlineUrl && vm.reg.status === "going" && (
            <ButtonLink href={vm.onlineUrl} size="lg" variant="primary" target="_blank" rel="noopener noreferrer" icon={<ExternalLink aria-hidden="true" size={16} />}>{T.joinOnline}</ButtonLink>
          )}
          {(mode === "going" || mode === "applied") && vm.reg && vm.regMode === "application" && (
            <ButtonLink href={applyHref} size="lg" variant="secondary">{T.viewApplication}</ButtonLink>
          )}
          {(mode === "going" || mode === "applied") && vm.reg?.teamId && (
            <ButtonLink href={`/${lang}/me/teams/${vm.reg.teamId}`} size="lg" variant="secondary">{T.viewTeam}</ButtonLink>
          )}
          {(mode === "going" || mode === "applied") && vm.reg && vm.reg.status !== "rejected" && !vm.over && (
            <CancelButton eventId={vm.id} variant="secondary" doneText={T.cancelDone} errors={errors} keep={T.keep} confirm={cancelCopy.trigger}
              trigger={cancelCopy.trigger} title={fill(cancelCopy.title, { title })} body={cancelCopy.body} />
          )}
        </div>
      </div>
    </article>
  );
}
