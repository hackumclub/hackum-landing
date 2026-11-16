import Image from "next/image";
import Link from "next/link";
import { CalendarDays, ExternalLink, Lock, MapPin, Users } from "lucide-react";
import type { Dict } from "@/i18n";
import type { MeCopy } from "@/i18n/areas/me";
import { fill, tf, type Locale } from "@/i18n/config";
import { plural } from "@/i18n/plural";
import { formatUb } from "@/lib/time";
import type { EventCardVm } from "@/lib/me/queries";
import { ordinal } from "@/lib/me/queries";
import { ButtonLink } from "@/components/ui/Button";
import StatusPill from "@/components/ui/StatusPill";
import Icon3D from "@/components/Icon3D";
import { cx } from "@/components/ui/cx";
import { CancelButton, RsvpButton } from "./EventActions";

export type CardMode = "home" | "upcoming" | "going" | "applied" | "past";

export const whenText = (vm: Pick<EventCardVm, "starts_at" | "approximate">, lang: Locale) =>
  vm.approximate
    ? formatUb(new Date(vm.starts_at), lang, { year: "numeric", month: "long" })
    : formatUb(new Date(vm.starts_at), lang, { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

export const placeText = (vm: Pick<EventCardVm, "mode" | "venue">, c: MeCopy) =>
  vm.mode === "online" ? c.event.online : vm.mode === "hybrid" ? [vm.venue, c.event.online].filter(Boolean).join(" · ") : vm.venue;

/** Eventbrite order: image → title → date (accent) → venue → status + seats → the one action. Closed options are greyed with the reason. */
export default function EventCard({ vm, lang, d, c, mode }: { vm: EventCardVm; lang: Locale; d: Dict; c: MeCopy; mode: CardMode }) {
  const T = c.event;
  const title = tf(vm.title, lang);
  const place = placeText(vm, c);
  const applyHref = `/${lang}/me/events/${vm.slug}/apply`;
  const blocked = !vm.reg && !vm.elig.ok;
  const greyed = blocked || vm.cancelled || (vm.over && mode === "past" && vm.reg?.status !== "attended");
  const reasonId = `reason-${vm.id}`;
  const errors = c.errors as Record<string, string>;

  const regPill = vm.reg && (mode === "past" && vm.reg.status === "going"
    ? <span className="text-sm font-semibold text-fg-muted">{T.registered}</span>
    : <StatusPill status={vm.reg.status} label={vm.reg.status === "attended" ? T.attendedBadge : d.status[vm.reg.status]} />);

  const reason = !vm.elig.ok && !vm.reg
    ? fill(c.reasons[vm.elig.reason], { date: vm.elig.at ? formatUb(new Date(vm.elig.at), lang, { month: "short", day: "numeric" }) : "" })
    : null;

  const cancelCopy = vm.reg?.status === "waitlisted"
    ? { trigger: T.leaveWaitlist, title: T.leaveWaitlistTitle, body: fill(T.leaveWaitlistBody, { pos: ordinal(lang, vm.reg.waitPos ?? 1) }) }
    : vm.reg?.status === "applied"
      ? { trigger: T.withdraw, title: T.withdrawTitle, body: T.withdrawBody }
      : { trigger: T.cancel, title: T.cancelTitle, body: T.cancelBody };

  return (
    <article className="overflow-hidden rounded-[var(--radius-md)] border border-line bg-panel md:grid md:grid-cols-[11rem_1fr]">
      <div className={cx("relative aspect-[16/9] bg-ember-soft md:aspect-auto md:min-h-full", greyed && "grayscale")}>
        {vm.cover
          ? <Image src={vm.cover} alt="" fill sizes="(min-width: 768px) 176px, 100vw" className="object-cover" />
          : <div className="grid h-full min-h-28 place-items-center"><Icon3D name="calendar" sizes="64px" className="size-16" /></div>}
      </div>
      <div className="grid content-start gap-2 p-4">
        <h3 className="font-display text-lg leading-snug font-bold text-fg">
          <Link href={`/${lang}/events/${vm.slug}`} className="hover:underline">{title}</Link>
        </h3>
        <p className="flex items-center gap-1.5 text-sm font-bold text-accent-fg">
          <CalendarDays aria-hidden="true" size={16} className="shrink-0" />
          <span>{whenText(vm, lang)}</span>
        </p>
        {vm.approximate && <p className="-mt-1 text-xs text-fg-muted">{T.approx}</p>}
        {place && (
          <p className="flex items-center gap-1.5 text-sm text-fg-muted">
            <MapPin aria-hidden="true" size={16} className="shrink-0" />
            <span>{place}</span>
          </p>
        )}
        {vm.mode !== "offline" && !vm.onlineUrl && mode !== "past" && vm.reg?.status !== "going" && (
          <p className="text-xs text-fg-muted">{T.onlineAfter}</p>
        )}

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          {vm.live && !vm.over && <StatusPill status="live" label={T.live} />}
          {vm.cancelled && <StatusPill status="cancelled" label={d.status.cancelled} />}
          {regPill}
          {vm.reg?.status === "waitlisted" && vm.reg.waitPos && <span className="text-sm font-semibold text-ember-fg">{fill(T.waitPos, { pos: ordinal(lang, vm.reg.waitPos) })}</span>}
          {!vm.reg && !vm.over && vm.regMode === "rsvp" && vm.seatsLeft !== null && vm.elig.ok && (
            <span className="inline-flex items-center gap-1 text-sm text-fg-muted tnum">
              <Users aria-hidden="true" size={14} />
              {vm.seatsLeft === 0 ? (vm.elig.waitlist ? T.waitlistOn : T.full) : plural(lang, vm.seatsLeft, T.seatsLeft)}
            </span>
          )}
          {reason && <span id={reasonId} className="inline-flex items-center gap-1 text-sm font-semibold text-fg-muted"><Lock aria-hidden="true" size={14} />{reason}</span>}
        </div>

        {vm.reg?.status === "rejected" && <p className="text-sm text-fg-muted">{T.rejectedLine}</p>}
        {vm.reg?.status === "applied" && <p className="text-sm text-fg-muted">{vm.decisionDeadline ? fill(T.decisionBy, { date: formatUb(new Date(vm.decisionDeadline), lang, { month: "long", day: "numeric" }) }) : T.pendingReview}</p>}

        <div className="mt-1 flex flex-wrap items-start gap-2">
          {(mode === "home" || mode === "upcoming") && !vm.reg && (vm.regMode === "application"
            ? vm.elig.ok
              ? <ButtonLink href={applyHref} size="lg">{T.apply}</ButtonLink>
              : <ButtonLink href={applyHref} size="lg" variant="secondary" aria-disabled="true" aria-describedby={reasonId} tabIndex={-1}>{T.apply}</ButtonLink>
            : vm.elig.ok
              ? <RsvpButton eventId={vm.id} label={vm.elig.waitlist ? T.joinWaitlist : T.rsvp} doneLabel={T.rsvpDone} waitlistDoneLabel={d.status.waitlisted} errors={errors} />
              : <button type="button" disabled aria-describedby={reasonId} className="inline-flex min-h-11 items-center rounded-[var(--radius-sm)] border border-line-strong px-5 font-semibold opacity-50">{T.rsvp}</button>)}

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
