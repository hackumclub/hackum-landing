import { connection } from "next/server";
import { copy, ordinal } from "@/i18n/areas/public";
import { href, type Locale } from "@/i18n/config";
import { googleCalendarUrl } from "@/lib/calendar/gcal";
import { log } from "@/lib/log";
import { eventForViewer } from "@/lib/mockdb/queries";
import { getStore } from "@/lib/mockdb/store";
import { getSession } from "@/lib/server/session";
import { formatUb } from "@/lib/time";
import { toIcsEvent } from "@/lib/public/calendar";
import { rsvpView } from "@/lib/public/rsvp";
import { publicAttendees, seatInfo } from "@/lib/public/select";
import RsvpPanel, { type PanelProps } from "./RsvpPanel";

/** Everything the panel needs for this visitor, or null when the event is not visible to them. Throws if the store cannot be read. */
function loadPanel(slug: string, lang: Locale, session: Awaited<ReturnType<typeof getSession>>, now: Date): PanelProps | null {
  const db = getStore().read();
  const ev = eventForViewer(db, slug, session?.profileId ?? null); // hides the online link from people without a seat
  if (!ev) return null;
  const view = rsvpView(db, ev, session && { profileId: session.profileId, status: session.status, onboarded: session.onboarded }, now);
  const who = publicAttendees(db, ev.id, 5);
  const eventPath = href(lang, `/events/${ev.slug}`);
  const applyPath = href(lang, `/me/events/${ev.slug}/apply`);
  const nextPath = view.kind === "signed_out" && view.apply ? applyPath : eventPath;
  const day = { month: "long", day: "numeric" } as const;
  const seated = view.kind === "going";
  return {
    copy: copy[lang].rsvp,
    eventId: ev.id,
    name: ev.title[lang].trim() || ev.title.mn,
    view,
    seats: seatInfo(db, ev),
    dates: {
      opensAt: view.kind === "blocked" && view.opensAt ? formatUb(new Date(view.opensAt), lang, { ...day, hour: "2-digit", minute: "2-digit", hour12: false }) : undefined,
      decisionBy: view.kind === "apply" && view.decisionDeadline ? formatUb(new Date(view.decisionDeadline), lang, day) : undefined,
    },
    attendees: { shown: who.shown.map((p) => ({ id: p.id, name: p.name[lang].trim() || p.name.mn })), more: who.more },
    ordinal: view.kind === "waitlisted" ? ordinal(lang, view.position) : "",
    links: {
      signIn: href(lang, `/sign-in?next=${encodeURIComponent(nextPath)}`),
      onboarding: href(lang, `/me/onboarding?next=${encodeURIComponent(eventPath)}`),
      myEvents: href(lang, "/me/events"),
      apply: applyPath,
      join: href(lang, "/join"),
      ics: `/api/events/${encodeURIComponent(ev.slug)}/ics?lang=${lang}`,
      ...(seated ? { google: googleCalendarUrl(toIcsEvent(ev, { lang, includeOnline: true })) } : {}),
      ...(seated && ev.online_url && /^https?:\/\//i.test(ev.online_url) ? { online: ev.online_url } : {}),
    },
  };
}

/**
 * Request-time half of the event page (render it inside <Suspense>): who is looking, what they may do, live seat counts.
 * Reads the store directly, so it is always current; the rest of the page stays static.
 */
export default async function RsvpSection({ slug, lang }: { slug: string; lang: Locale }) {
  await connection();
  let panel: PanelProps | null = null;
  try {
    panel = loadPanel(slug, lang, await getSession(), new Date());
  } catch {
    log("WARN", "public.rsvp", "rsvp_section_failed", "n/a", { event_slug: slug });
    return <p className="text-sm text-muted">{copy[lang].rsvp.unavailable}</p>;
  }
  return panel ? <RsvpPanel {...panel} /> : null;
}
