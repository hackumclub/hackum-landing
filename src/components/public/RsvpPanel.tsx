"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useOptimistic, useState, useTransition } from "react";
import { CalendarPlus, Check, Loader2, Ticket, Video } from "lucide-react";
import Sticker from "@/components/Sticker";
import ScopeTag from "./ScopeTag";
import { fill, type Locale } from "@/i18n/config";
import type { PublicCopy } from "@/i18n/areas/public";
import type { Result } from "@/lib/result";
import { cancelRsvp, rsvp } from "@/lib/me/actions";
import type { RsvpView } from "@/lib/public/rsvp";
import type { SeatInfo } from "@/lib/public/types";

export type PanelLinks = { signIn: string; onboarding: string; myEvents: string; apply: string; join: string; membership: string; browse: string; ics: string; google?: string; online?: string };
export type PanelProps = {
  copy: PublicCopy["rsvp"];
  eventId: string;
  name: string;
  /** Which schools may register (`events.school_scope`); shown as a tag. */
  scope: "num" | "all";
  lang: Locale;
  view: RsvpView;
  seats: SeatInfo;
  /** Pre-formatted dates (UB time) for the notes that need one. */
  dates: { opensAt?: string; decisionBy?: string };
  /** Public-visibility attendees (initials + name) and how many more there are. */
  attendees: { shown: { id: string; name: string }[]; more: number };
  /** Label for the ordinal in "3rd in line", already worked out for the viewer's language. */
  ordinal: string;
  links: PanelLinks;
};

// Initials must read at 12px: white on brand-dark (5.8:1), ink on leaf (6.0:1) and on sun (9.8:1).
const AVATAR = ["bg-brand-dark text-white", "bg-leaf text-ink", "bg-sun text-ink"];
const initials = (name: string) => name.trim().slice(0, 2).toUpperCase();
const primary = "btn-primary inline-flex min-h-[56px] w-full items-center justify-center gap-2 rounded-full px-8 py-3.5 text-center text-lg shadow-glow disabled:cursor-wait";
const secondary = "btn-glass-light inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold text-ink hover:text-brand";
const chip = "inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-bold";

/**
 * The registration panel on an event page. The server decides what to offer (src/lib/public/rsvp.ts); this component
 * only performs the two actions, shows an optimistic state while they run and maps every error code to a message.
 */
export default function RsvpPanel({ copy: c, eventId, name, scope, lang, view, seats, dates, attendees, ordinal, links }: PanelProps) {
  const router = useRouter();
  const [state, setOptimistic] = useOptimistic<RsvpView, RsvpView>(view, (_current, next) => next);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const errorId = useId();
  const confirmId = useId();

  const run = (optimistic: RsvpView, action: () => Promise<Result<unknown>>) => start(async () => {
    setError(null);
    setConfirming(false);
    setOptimistic(optimistic);
    const result = await action();
    if (!result.ok) { setError(result.error); router.refresh(); }
  });
  const doRsvp = () => run(view.kind === "rsvp" && view.waitlist ? { kind: "waitlisted", position: seats.waitlisted + 1 } : { kind: "going" }, () => rsvp(eventId));
  const doCancel = () => run({ kind: "rsvp", waitlist: seats.full }, () => cancelRsvp(eventId));

  // Seat numbers follow the optimistic state, so the bar moves the moment someone clicks.
  const had = view.kind === "going" ? 1 : 0;
  const has = state.kind === "going" ? 1 : 0;
  const going = seats.going - had + has;
  const left = seats.capacity === null ? null : Math.max(0, seats.capacity - going);

  return (
    <section aria-labelledby={`${errorId}-h`} aria-busy={pending} className="min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id={`${errorId}-h`} className="font-display text-lg font-black">{c.title}</h2>
        <ScopeTag scope={scope} lang={lang} />
      </div>
      <div className="mt-4 space-y-4">
        <Seats c={c} capacity={seats.capacity} left={left} going={going} waitlisted={seats.waitlisted} />
        <Body c={c} state={state} pending={pending} name={name} dates={dates} ordinal={ordinal} links={links}
          confirming={confirming} confirmId={confirmId} onRsvp={doRsvp} onAskCancel={() => setConfirming(true)} onKeep={() => setConfirming(false)} onCancel={doCancel} />
        {error ? (
          <p id={errorId} role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 ring-1 ring-red-200">
            {c.errors[error] ?? c.errors.server}
            {error === "unauthenticated" ? <>{" "}<Link href={links.signIn} className="underline underline-offset-2">{c.signInAgain}</Link></> : null}
          </p>
        ) : null}
        <Attendees c={c} attendees={attendees} />
      </div>
    </section>
  );
}

function Seats({ c, capacity, left, going, waitlisted }: { c: PanelProps["copy"]; capacity: number | null; left: number | null; going: number; waitlisted: number }) {
  if (capacity === null && going === 0) return null;
  const pct = capacity ? Math.min(100, Math.round((going / capacity) * 100)) : 0;
  return (
    <div className="rounded-2xl bg-white/60 p-4 ring-1 ring-white/80">
      {capacity !== null && left !== null ? (
        <>
          <div className="flex items-end justify-between gap-3">
            <p aria-hidden className="font-display text-3xl leading-none font-black tabular-nums">{going}<span className="text-lg text-muted">/{capacity}</span></p>
          </div>
          <div aria-hidden className="mt-3 h-3 overflow-hidden rounded-full bg-brand-tint shadow-[inset_0_1px_2px_rgb(0_60_100/0.2)]">
            <div className={`h-full rounded-full transition-[width] duration-500 ${left === 0 ? "bg-ink" : "bg-gradient-to-b from-[#13a3ea] via-[#0085ca] to-[#006ba3]"}`} style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-2 text-sm font-bold">{left === 0 ? fill(c.seatsFull, { total: capacity }) : fill(c.seatsLeft, { left, total: capacity })}</p>
        </>
      ) : <p className="text-sm font-bold">{fill(c.seatsOpen, { n: going })}</p>}
      {waitlisted > 0 ? <p className="mt-0.5 text-sm text-muted">{fill(c.onWaitlist, { n: waitlisted })}</p> : null}
    </div>
  );
}

function Attendees({ c, attendees }: { c: PanelProps["copy"]; attendees: PanelProps["attendees"] }) {
  if (attendees.shown.length === 0) return null;
  const names = attendees.shown.map((p) => p.name).join(", ");
  return (
    <div>
      <p className="text-sm text-faint">{c.attendees}</p>
      <div role="group" aria-label={fill(c.attendeesAria, { names: attendees.more ? `${names} ${fill(c.more, { n: attendees.more })}` : names })} className="mt-2 flex items-center">
        <ul aria-hidden className="flex -space-x-2">
          {attendees.shown.map((p, i) => (
            <li key={p.id} title={p.name} className={`grid h-10 w-10 place-items-center rounded-full text-xs font-black shadow-sm ring-2 ring-white ${AVATAR[i % AVATAR.length]}`}>{initials(p.name)}</li>
          ))}
        </ul>
        {attendees.more > 0 ? <span aria-hidden className="ml-2 rounded-full bg-brand-tint px-2.5 py-1 text-sm font-black text-brand-deep">{fill(c.more, { n: attendees.more })}</span> : null}
      </div>
    </div>
  );
}

type BodyProps = {
  c: PanelProps["copy"]; state: RsvpView; pending: boolean; name: string; dates: PanelProps["dates"]; ordinal: string; links: PanelLinks;
  confirming: boolean; confirmId: string; onRsvp: () => void; onAskCancel: () => void; onKeep: () => void; onCancel: () => void;
};

function Body({ c, state, pending, name, dates, ordinal, links, confirming, confirmId, onRsvp, onAskCancel, onKeep, onCancel }: BodyProps) {
  const note = "text-sm text-muted";
  switch (state.kind) {
    case "signed_out":
      return (
        <div className="space-y-2">
          <Link href={links.signIn} className={primary}>{state.apply ? c.signInApply : c.signInRsvp}</Link>
          <p className={note}>{c.signInNote} <Link href={links.join} className="inline-flex min-h-[44px] items-center font-bold text-brand-deep underline decoration-2 underline-offset-4">{c.createAccountCta}</Link></p>
        </div>
      );
    case "needs_onboarding":
      return <div className="space-y-2"><p className="font-bold">{c.finishProfile}</p><p className={note}>{c.finishProfileLead}</p><Link href={links.onboarding} className={primary}>{c.finishProfileCta}</Link></div>;
    case "rsvp":
      return (
        <div className="space-y-2">
          {state.waitlist ? <p className={note}>{c.waitlistNote}</p> : null}
          <button type="button" onClick={onRsvp} disabled={pending} className={primary}>
            {pending ? <Loader2 aria-hidden className="size-5 motion-safe:animate-spin" /> : <Ticket aria-hidden className="size-5" />}
            {pending ? c.saving : state.waitlist ? c.joinWaitlist : c.rsvp}
          </button>
        </div>
      );
    case "going":
      return (
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-2xl bg-leaf/15 p-4 ring-1 ring-leaf/30">
            <Sticker name="rsvp" sizes="72px" className="w-[4.5rem] shrink-0 -rotate-3" />
            <div><p className="flex items-center gap-2 font-black"><span aria-hidden className="grid size-6 place-items-center rounded-full bg-leaf text-ink"><Check className="size-4" /></span><span>{c.going}</span></p><p className={`mt-1 ${note}`}>{c.goingNote}</p></div>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-bold">{c.addToCalendar}</p>
            <div className="flex flex-wrap gap-2">
              {links.online ? <a href={links.online} target="_blank" rel="noopener noreferrer" className={`${secondary} w-full`}><Video aria-hidden className="size-4" />{c.joinOnline}</a> : null}
              {links.google ? <a href={links.google} target="_blank" rel="noopener noreferrer" className={secondary}><CalendarPlus aria-hidden className="size-4" />{c.google}</a> : null}
              <a href={links.ics} download className={secondary}>{c.ics}</a>
            </div>
          </div>
          <Cancel c={c} name={name} pending={pending} confirming={confirming} confirmId={confirmId} onAsk={onAskCancel} onKeep={onKeep} onConfirm={onCancel} />
        </div>
      );
    case "waitlisted":
      return (
        <div className="space-y-4">
          <div><p className={`${chip} bg-sun/25 text-ink`}><span aria-hidden className="size-2 rounded-full bg-sun" />{c.waitlisted}</p><p className="mt-2 font-bold">{fill(c.position, { ord: ordinal })}</p><p className={note}>{c.waitlistedNote}</p></div>
          <Cancel c={c} name={name} pending={pending} confirming={confirming} confirmId={confirmId} onAsk={onAskCancel} onKeep={onKeep} onConfirm={onCancel} />
        </div>
      );
    case "applied":
    case "rejected":
      return (
        <div className="space-y-3">
          <div><p className={`${chip} ${state.kind === "applied" ? "bg-brand-tint text-brand-deep" : "bg-ink/10 text-ink"}`}>{state.kind === "applied" ? c.applied : c.rejected}</p><p className={`mt-2 ${note}`}>{state.kind === "applied" ? c.appliedNote : c.rejectedNote}</p></div>
          <Link href={links.myEvents} className={secondary}>{c.seeMyEvents}</Link>
        </div>
      );
    case "apply":
      return (
        <div className="space-y-2">
          <p className={note}>{c.applyNote}</p>
          <Link href={links.apply} className={primary}>{c.apply}</Link>
          {dates.decisionBy ? <p className={note}>{fill(c.decisionBy, { date: dates.decisionBy })}</p> : null}
        </div>
      );
    case "attended":
      return <p className={`${chip} bg-leaf/15 text-ink`}><span aria-hidden className="size-2 rounded-full bg-leaf" />{c.attended}</p>;
    case "ended":
      return <p className={note}>{c.ended}</p>;
    case "cancelled":
      return <p className="text-sm font-bold">{c.cancelled}</p>;
    case "blocked":
      if (state.reason === "school" || (state.reason === "members" && state.numOnly)) {
        // F-12: membership is impossible for this person, so say so and point at what they can do instead.
        return (
          <div className="space-y-3">
            <p className="font-bold">{c.numOnly}</p>
            <p className={note}>{c.numOnlyLead}</p>
            <div className="flex flex-wrap gap-2">
              <Link href={links.membership} className={secondary}>{c.numOnlyMembership}</Link>
              <Link href={links.browse} className={secondary}>{c.browseOpen}</Link>
            </div>
          </div>
        );
      }
      return (
        <div className="space-y-3">
          <p className="text-sm font-bold">{state.reason === "not_open" ? (dates.opensAt ? fill(c.notOpen, { date: dates.opensAt }) : c.notOpenNoDate) : c[state.reason]}</p>
          {state.reason === "members" ? <Link href={links.membership} className={secondary}>{c.membersCta}</Link> : null}
          {state.reason === "alumni" ? <Link href={links.browse} className={secondary}>{c.browseOpen}</Link> : null}
        </div>
      );
  }
}

/** Inline two-step confirm: no modal, focus lands on the safe choice. */
function Cancel({ c, name, pending, confirming, confirmId, onAsk, onKeep, onConfirm }: { c: PanelProps["copy"]; name: string; pending: boolean; confirming: boolean; confirmId: string; onAsk: () => void; onKeep: () => void; onConfirm: () => void }) {
  if (!confirming) {
    return <button type="button" onClick={onAsk} disabled={pending} className="min-h-[44px] text-sm font-bold text-muted underline decoration-2 underline-offset-4 hover:text-ink">{c.cancelRsvp}</button>;
  }
  return (
    <div id={confirmId} role="group" aria-labelledby={`${confirmId}-t`} className="rounded-2xl bg-white/70 p-4 ring-1 ring-ink/10">
      <p id={`${confirmId}-t`} className="font-bold">{fill(c.cancelTitle, { name })}</p>
      <p className="mt-1 text-sm text-muted">{c.cancelBody}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" autoFocus onClick={onKeep} className="btn-primary inline-flex min-h-[44px] items-center rounded-full px-5 py-2 text-sm">{c.cancelKeep}</button>
        <button type="button" onClick={onConfirm} disabled={pending} className="inline-flex min-h-[44px] items-center rounded-full px-5 py-2 text-sm font-bold text-red-700 ring-1 ring-red-300 hover:bg-red-50">{pending ? c.cancelling : c.cancelConfirm}</button>
      </div>
    </div>
  );
}
